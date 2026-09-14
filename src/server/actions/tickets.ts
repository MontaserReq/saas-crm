'use server';

import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { TicketService } from '@/server/services/TicketService';
import { TicketStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { validateAttachmentFile } from '@/lib/storage/attachmentPolicy';

function ticketPermission(user: Awaited<ReturnType<typeof requireAuth>>, permission: string) {
  if (!hasPermission(user, permission)) throw new Error(`Forbidden: missing ${permission}`);
}

export async function markTicketSeenAction(ticketId: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_MARK_SEEN);
    const res = await TicketService.markTicketSeen(user, ticketId);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, status: res.status };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to mark ticket as seen' };
  }
}

export async function acceptTicketAction(ticketId: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_ACCEPT);
    const res = await TicketService.acceptTicket(user, ticketId);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, status: res.status };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to accept ticket' };
  }
}

export async function rejectTicketAction(ticketId: string, reason: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_REJECT);
    const res = await TicketService.rejectTicket(user, ticketId, reason);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, status: res.status };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject ticket' };
  }
}

export async function addNoteAction(formData: FormData) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_ADD_NOTE);
    const ticketId = formData.get('ticketId') as string;
    const content = formData.get('content') as string;
    const priority = formData.get('priority') as string | null;
    const transferToUserId = formData.get('transferToUserId') as string | null;

    const files = formData.getAll('attachments') as File[];
    if (files.some((file) => file instanceof File && file.size > 0) && !hasPermission(user, PERMISSIONS.ATTACHMENTS_UPLOAD)) throw new Error('Forbidden: attachment upload permission required');
    const attachmentBuffers: Array<{ originalName: string; mimeType: string; buffer: Buffer }> = [];

    for (const f of files) {
      if (f && f.size > 0 && f.name) {
        const validationError = validateAttachmentFile(f);
        if (validationError) throw new Error(validationError);
        const arrayBuf = await f.arrayBuffer();
        attachmentBuffers.push({
          originalName: f.name,
          mimeType: f.type || 'application/octet-stream',
          buffer: Buffer.from(arrayBuf),
        });
      }
    }

    const note = await TicketService.addNote(user, {
      ticketId,
      content,
      priority,
      transferToUserId,
      attachments: attachmentBuffers,
    });

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true, noteId: note.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add note' };
  }
}

export async function transferTicketAction(ticketId: string, targetUserId: string, reason: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_TRANSFER);
    const res = await TicketService.transferTicket(user, ticketId, targetUserId, reason);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to transfer ticket' };
  }
}

export async function logCommunicationAttemptAction(data: {
  ticketId: string;
  method: string;
  result: string;
  note?: string | null;
}) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_CONTACT_ATTEMPT);
    const res = await TicketService.logCommunicationAttempt(user, data);
    revalidatePath(`/tickets/${data.ticketId}`);
    return { success: true, attempt: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to log attempt' };
  }
}

export async function updateRejectedTicketAction(data: {
  ticketId: string;
  subject: string;
  priority: string;
  dueDate?: string | null;
  followUpAt?: string | null;
}) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_RESUBMIT);
    const ticket = await TicketService.updateRejectedTicket(user, data);
    revalidatePath(`/tickets/${data.ticketId}`);
    revalidatePath('/tickets');
    return { success: true, ticketId: ticket.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update rejected ticket' };
  }
}

export async function resubmitRejectedTicketAction(ticketId: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_CLOSE);
    const ticket = await TicketService.resubmitRejectedTicket(user, ticketId);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, status: ticket.status };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resubmit ticket' };
  }
}

export async function closeTicketAction(ticketId: string, closingReason: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_CREATE);
    const res = await TicketService.closeTicket(user, ticketId, closingReason);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, status: res.status };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to close ticket' };
  }
}

export async function createTicketAction(input: {
  schoolId?: string | null;
  taskTypeId?: string | null;
  departmentId?: string;
  assignedToUserId?: string | null;
  subject?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  initialNote?: string | null;
}) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_CREATE);
    // The department defaults to the user's own department (not the first department in the DB).
    const departmentId = input.departmentId || user.departmentId;

    const school = input.schoolId ? await prisma.school.findUnique({ where: { id: input.schoolId }, select: { name: true } }) : null;
    const taskType = input.taskTypeId ? await prisma.taskType.findUnique({ where: { id: input.taskTypeId }, select: { name: true } }) : null;
    const subject = input.subject?.trim() || `${taskType?.name || 'Task'} - ${school?.name || 'School'}`;

    // The ticket is auto-assigned server-side to currentUser.reportsToUserId.
    const ticket = await TicketService.createTicket(user, {
      schoolId: input.schoolId || null,
      taskTypeId: input.taskTypeId || null,
      departmentId,
      subject,
      priority: input.priority,
      dueDate: input.dueDate,
      initialNote: input.initialNote,
      assignedToUserId: input.assignedToUserId || null,
    });

    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create ticket' };
  }
}

export async function createMeetingTicketAction(input: {
  schoolId?: string | null;
  taskTypeId?: string | null;
  departmentId?: string;
  subject: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  meetingDate: string;
  meetingTime: string;
  participants: Array<{ name: string; userId?: string | null }>;
  actionItems?: Array<{ text: string; assigneeId?: string | null; done?: boolean }>;
  initialNote?: string | null;
}) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_CREATE);

    const ticket = await TicketService.createMeetingTicket(user, input);

    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create meeting' };
  }
}

export async function updateTicketStatusAction(ticketId: string, newStatus: TicketStatus) {
  try {
    const user = await requireAuth();
    const res = await TicketService.updateStatus(user, ticketId, newStatus);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true, ticket: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update ticket status' };
  }
}

export async function deleteTicketAction(ticketId: string) {
  try {
    const user = await requireAuth();
    ticketPermission(user, PERMISSIONS.TICKETS_DELETE);
    if (user.role !== 'SUPER_ADMIN') throw new Error('Forbidden: Only Super Admin can delete tickets');
    await TicketService.deleteTicket(user, ticketId);
    revalidatePath('/tickets');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete ticket' };
  }
}
