'use server';

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from '@/server/services/SchoolService';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';

export async function createSchoolAction(data: any) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to create schools' };
    }

    const school = await SchoolService.createSchool(data, user.id);
    revalidatePath('/schools');
    return { success: true, school };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create school' };
  }
}

export async function updateSchoolAction(id: string, data: any) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to update schools' };
    }

    const canApply = hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT);
    const school = canApply
      ? await SchoolService.updateSchool(id, data, user.id)
      : await SchoolService.createApprovalRequest(id, 'EDIT', user.id, data);
    revalidatePath('/schools');
    return { success: true, school, pending: !canApply };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update school' };
  }
}

export async function validateSchoolImportAction(rawRows: any[]) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to import schools' };
    }

    const previewResult = await SchoolService.validateImportRows(rawRows);
    return { success: true, ...previewResult };
  } catch (err: any) {
    return { success: false, error: err.message || 'Validation failed' };
  }
}

export async function deleteSchoolAction(id: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_DELETE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to delete school' };
    }

    // Registry deletion is always a request. The actual delete/archive is
    // performed only after an approver accepts it.
    await SchoolService.createApprovalRequest(id, 'DELETE', user.id);
    revalidatePath('/schools');
    return { success: true, pending: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete school' };
  }
}

export async function listSchoolApprovalRequestsAction(status = 'PENDING') {
  const user = await requireAuth();
  const canView = hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_VIEW)
    || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT)
    || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE);
  if (!canView) return [];
  const canDecide = hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE);
  const canEdit = canDecide || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT);
  const canDelete = canDecide || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE);
  const typeFilter = canEdit && canDelete ? {} : canEdit ? { type: 'EDIT' } : canDelete ? { type: 'DELETE' } : {};
  const requests = await prisma.schoolApprovalRequest.findMany({ where: { status, ...typeFilter }, orderBy: { createdAt: 'desc' }, include: { school: { select: { id: true, name: true } }, requester: { select: { name: true } } } });
  return requests;
}

export async function decideSchoolApprovalAction(requestId: string, approve: boolean, rejectionReason?: string) {
  try {
    const user = await requireAuth();
    const request = await prisma.schoolApprovalRequest.findUnique({ where: { id: requestId }, select: { type: true } });
    if (!request) return { success: false, error: 'Request not found' };
    const permission = request.type === 'EDIT' ? PERMISSIONS.SCHOOLS_APPROVE_EDIT : PERMISSIONS.SCHOOLS_APPROVE_DELETE;
    if (!hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE) && !hasPermission(user, permission)) return { success: false, error: 'Forbidden' };
    const result = await SchoolService.decideApproval(requestId, user.id, approve, rejectionReason);
    revalidatePath('/schools'); revalidatePath('/admin/approval-requests');
    return { success: true, request: result };
  } catch (err: any) { return { success: false, error: err.message || 'Approval decision failed' }; }
}
