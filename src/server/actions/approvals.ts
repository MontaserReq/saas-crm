'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { ClientService } from '@/server/services/ClientService';
import { LeadService } from '@/server/services/LeadService';
import { ContactService } from '@/server/services/ContactService';
import { DealService } from '@/server/services/DealService';
import { CrmTaskService } from '@/server/services/CrmTaskService';
import { CalendarService } from '@/server/services/CalendarService';
import { OperationApprovalService } from '@/server/services/OperationApprovalService';
import { createDepartmentAction, deleteDepartmentAction, toggleDepartmentStatusAction, updateDepartmentAction } from './admin';

export async function listOperationApprovalRequestsAction() {
  try {
    const user = await requireAuth();
    return await OperationApprovalService.list(user);
  } catch {
    return [];
  }
}

async function executeApprovedRequest(request: any) {
  const payload = JSON.parse(request.payload);
  const requester = await OperationApprovalService.requesterSession(request.requesterId, request.organizationId);
  const input = payload.input;
  switch (`${request.resourceType}:${request.operation}`) {
    case 'CLIENT:CREATE': return ClientService.create(requester, input);
    case 'CLIENT:UPDATE': return ClientService.update(requester, payload.id, input);
    case 'CLIENT:DELETE': return ClientService.delete(requester, payload.id);
    case 'LEAD:CREATE': return LeadService.create(requester, input);
    case 'LEAD:UPDATE': return LeadService.update(requester, payload.id, input);
    case 'LEAD:DELETE': return LeadService.delete(requester, payload.id);
    case 'CONTACT:CREATE': return ContactService.create(requester, input);
    case 'CONTACT:UPDATE': return ContactService.update(requester, payload.id, input);
    case 'CONTACT:DELETE': return ContactService.delete(requester, payload.id);
    case 'DEAL:CREATE': return DealService.create(requester, input);
    case 'DEAL:UPDATE': return DealService.update(requester, payload.id, input);
    case 'DEAL:DELETE': return DealService.delete(requester, payload.id);
    case 'TASK:CREATE': return CrmTaskService.create(requester, input);
    case 'TASK:UPDATE': return CrmTaskService.update(requester, payload.id, input);
    case 'TASK:DELETE': return CrmTaskService.delete(requester, payload.id);
    case 'CALENDAR_EVENT:CREATE': return CalendarService.createEvent(requester, input);
    case 'CALENDAR_EVENT:UPDATE': return CalendarService.updateEvent(requester, payload.id, input);
    case 'CALENDAR_EVENT:DELETE': return CalendarService.deleteEvent(requester, payload.id);
    case 'DEPARTMENT:CREATE': {
      const result = await createDepartmentAction(payload.data, payload.managerUserIds || []);
      if (!result.success) throw new Error(result.error);
      return result;
    }
    case 'DEPARTMENT:UPDATE': {
      const result = payload.toggle
        ? await toggleDepartmentStatusAction(payload.id)
        : await updateDepartmentAction(payload.id, payload.data, payload.managerUserIds || []);
      if (!result.success) throw new Error(result.error);
      return result;
    }
    case 'DEPARTMENT:DELETE': {
      const result = await deleteDepartmentAction(payload.id);
      if (!result.success) throw new Error(result.error);
      return result;
    }
    default: throw new Error('Unsupported approval request');
  }
}

export async function decideOperationApprovalAction(id: string, approve: boolean, rejectionReason?: string) {
  const user = await requireAuth();
  const request = await OperationApprovalService.claim(user, id);
  if (request.requesterId === user.id) {
    await OperationApprovalService.release(id);
    return { success: false, error: 'You cannot approve your own request' };
  }
  if (!approve) {
    await OperationApprovalService.finish(user, id, false, rejectionReason);
    revalidatePath('/admin/approval-requests');
    return { success: true };
  }
  try {
    await executeApprovedRequest(request);
    await OperationApprovalService.finish(user, id, true);
    revalidatePath('/', 'layout');
    revalidatePath('/admin/approval-requests');
    return { success: true };
  } catch (error: any) {
    await OperationApprovalService.release(id);
    return { success: false, error: error?.message || 'Approved operation could not be applied' };
  }
}
