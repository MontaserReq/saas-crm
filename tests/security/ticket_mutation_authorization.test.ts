import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    ticket: { findFirst: vi.fn(), update: vi.fn() },
    ticketApprovalRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    ticketAssignee: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    assignmentHistory: { create: vi.fn() },
    user: { findFirst: vi.fn() },
    school: { findFirst: vi.fn() },
    taskType: { findFirst: vi.fn() },
    attachment: { create: vi.fn() },
    notification: { create: vi.fn() },
    note: { create: vi.fn() }, activityEvent: { create: vi.fn() }, auditLog: { create: vi.fn() },
  };
  prismaMock.$queryRaw = vi.fn();
  prismaMock.$transaction = vi.fn(async (operation: any) => operation(prismaMock));
  return { prismaMock };
});
vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logActivity: vi.fn(), logAudit: vi.fn() } }));

import { TicketService } from '@/server/services/TicketService';

function user(overrides: Partial<UserSession> = {}): UserSession {
  return { id: 'user-a', name: 'User A', email: 'a@example.test', role: 'MEMBER', roleDisplayName: 'Member', departmentId: 'dept-a', departmentName: 'Dept', organizationId: 'org-a', permissions: [], ...overrides };
}

describe('ticket mutation authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ticket.findFirst.mockResolvedValue({ id: 'ticket-a', organizationId: 'org-a', createdById: 'creator', status: 'IN_PROGRESS' });
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'ticket-a', organizationId: 'org-a', createdById: 'creator', status: 'IN_PROGRESS', ticketNumber: 'CL-001', departmentId: 'dept-a' }]);
    prismaMock.ticketAssignee.findFirst.mockResolvedValue({ id: 'assignment', isCurrent: true, role: 'ASSIGNEE' });
    prismaMock.ticket.update.mockResolvedValue({ id: 'ticket-a', status: 'COMPLETED' });
    prismaMock.note.create.mockResolvedValue({ id: 'closing-note' });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-b', name: 'User B', departmentId: 'dept-a', department: { name: 'Dept' } });
    prismaMock.ticketApprovalRequest.findFirst.mockResolvedValue(null);
    prismaMock.ticketApprovalRequest.create.mockResolvedValue({ id: 'edit-request-a', status: 'PENDING' });
    prismaMock.ticketApprovalRequest.update.mockResolvedValue({ id: 'edit-request-a', status: 'APPROVED' });
  });

  it.each([
    ['view-only user', user({ permissions: ['tickets.view_assigned'] })],
    ['creator without mutation permission', user({ id: 'creator', permissions: ['tickets.view_assigned'] })],
    ['historical assignee without mutation permission', user({ permissions: ['tickets.view_assigned'] })],
  ])('rejects a %s without changing state', async (_label, actor) => {
    if (_label.startsWith('historical')) prismaMock.ticketAssignee.findFirst.mockResolvedValue({ id: 'old', isCurrent: false, role: 'VIEWER' });
    await expect(TicketService.updateStatus(actor, 'ticket-a', 'COMPLETED')).rejects.toThrow(/missing permission/i);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('allows an authorized current assignee to perform a valid transition', async () => {
    await expect(TicketService.updateStatus(user({ permissions: ['tickets.complete'] }), 'ticket-a', 'COMPLETED')).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({ where: { id: 'ticket-a' }, data: { status: 'COMPLETED' } });
  });

  it('rejects generic status changes that would bypass a dedicated workflow', async () => {
    await expect(TicketService.updateStatus(user({ permissions: ['tickets.close'] }), 'ticket-a', 'CLOSED')).rejects.toThrow(/requested ticket status/i);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('enforces communication-attempt permission at the service boundary', async () => {
    await expect(TicketService.logCommunicationAttempt(user(), { ticketId: 'ticket-a', method: 'PHONE', result: 'NO_ANSWER' })).rejects.toThrow(/tickets\.contact_attempt/i);
  });

  it('enforces note and rejected-ticket permissions at the service boundary', async () => {
    await expect(TicketService.addNote(user(), { ticketId: 'ticket-a', content: 'Synthetic note' })).rejects.toThrow(/tickets\.add_note/i);
    await expect(TicketService.updateRejectedTicket(user(), { ticketId: 'ticket-a', subject: 'Corrected subject', priority: 'MEDIUM' })).rejects.toThrow(/tickets\.correction_request/i);
    await expect(TicketService.resubmitRejectedTicket(user(), 'ticket-a', 'dept-a', 'user-b')).rejects.toThrow(/tickets\.resubmit_request/i);
  });

  it('allows a note-only user to add an ordinary note', async () => {
    await expect(TicketService.addNote(user({ permissions: ['tickets.add_note'] }), {
      ticketId: 'ticket-a',
      content: 'Synthetic progress note',
    })).resolves.toMatchObject({ id: 'closing-note' });
    expect(prismaMock.note.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ticketAssignee.updateMany).not.toHaveBeenCalled();
  });

  it('rejects note-triggered transfer without tickets.transfer before starting a transaction', async () => {
    await expect(TicketService.addNote(user({ permissions: ['tickets.add_note'] }), {
      ticketId: 'ticket-a',
      content: 'Handoff note',
      transferToUserId: 'user-b',
    })).rejects.toThrow(/tickets\.transfer/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.note.create).not.toHaveBeenCalled();
    expect(prismaMock.ticketAssignee.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.assignmentHistory.create).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('allows an authorized note transfer to an active same-tenant member', async () => {
    await expect(TicketService.addNote(user({ permissions: ['tickets.add_note', 'tickets.transfer'] }), {
      ticketId: 'ticket-a',
      content: 'Handoff note',
      transferToUserId: 'user-b',
    })).resolves.toMatchObject({ id: 'closing-note' });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'user-b', isActive: true }),
    }));
    expect(prismaMock.ticketAssignee.updateMany).toHaveBeenCalled();
    expect(prismaMock.assignmentHistory.create).toHaveBeenCalled();
  });

  it('rejects an inactive or cross-tenant transfer target before creating a note', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(TicketService.addNote(user({ permissions: ['tickets.add_note', 'tickets.transfer'] }), {
      ticketId: 'ticket-a',
      content: 'Handoff note',
      transferToUserId: 'foreign-user',
    })).rejects.toThrow(/not found|inactive/i);
    expect(prismaMock.note.create).not.toHaveBeenCalled();
    expect(prismaMock.ticketAssignee.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant ticket id without changing state', async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(TicketService.updateStatus(user({ permissions: ['tickets.complete'] }), 'ticket-b', 'COMPLETED')).rejects.toThrow(/forbidden/i);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('does not treat create permission as close permission', async () => {
    await expect(TicketService.closeTicket(user({ permissions: ['tickets.create'] }), 'ticket-a', 'Finished work')).rejects.toThrow(/tickets\.close/i);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('allows an authorized current assignee with close permission to close a valid active ticket', async () => {
    prismaMock.ticket.update.mockResolvedValue({ id: 'ticket-a', status: 'CLOSED' });
    await expect(TicketService.closeTicket(user({ permissions: ['tickets.close'] }), 'ticket-a', 'Finished work')).resolves.toMatchObject({ status: 'CLOSED' });
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({ where: { id: 'ticket-a' }, data: { status: 'CLOSED' } });
  });

  it('stores an active assignee edit as pending without changing the ticket', async () => {
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-a',
      ticketNumber: 'CL-001',
      organizationId: 'org-a',
      status: 'IN_PROGRESS',
      schoolId: null,
      taskTypeId: null,
      subject: 'Original subject',
      priority: 'MEDIUM',
      dueDate: null,
      followUpAt: null,
      assignees: [{ id: 'assignment' }],
    });

    await expect(TicketService.requestTicketEdit(user({ permissions: ['tickets.correction_request'] }), {
      ticketId: 'ticket-a',
      subject: 'Proposed subject',
      priority: 'HIGH',
      changeReason: 'Customer requirements changed',
    })).resolves.toMatchObject({ id: 'edit-request-a', status: 'PENDING' });

    expect(prismaMock.ticketApprovalRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ticketId: 'ticket-a', requesterId: 'user-a', type: 'EDIT' }),
    }));
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('does not let the requester approve their own ticket edit', async () => {
    prismaMock.ticketApprovalRequest.findFirst.mockResolvedValue({
      id: 'edit-request-a',
      ticketId: 'ticket-a',
      requesterId: 'user-a',
      type: 'EDIT',
      status: 'PENDING',
      proposedData: '{}',
      requester: { name: 'User A' },
      ticket: { id: 'ticket-a', ticketNumber: 'CL-001', assignees: [] },
    });

    await expect(TicketService.decideTicketApproval(
      user({ permissions: ['tickets.correction_approve'] }),
      'edit-request-a',
      true,
    )).rejects.toThrow(/cannot review their own/i);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('applies a reviewed edit only when current values still match the request baseline', async () => {
    const previous = {
      schoolId: null,
      taskTypeId: null,
      subject: 'Original subject',
      priority: 'MEDIUM',
      dueDate: null,
      followUpAt: null,
    };
    const proposed = { ...previous, subject: 'Approved subject', priority: 'HIGH' };
    prismaMock.ticketApprovalRequest.findFirst.mockResolvedValue({
      id: 'edit-request-a',
      ticketId: 'ticket-a',
      requesterId: 'user-b',
      type: 'EDIT',
      status: 'PENDING',
      proposedData: JSON.stringify({ version: 1, previous, proposed, changeReason: 'Requirements changed' }),
      requester: { name: 'User B' },
      ticket: { id: 'ticket-a', ticketNumber: 'CL-001', ...previous, assignees: [] },
    });

    await expect(TicketService.decideTicketApproval(
      user({ permissions: ['tickets.correction_approve'] }),
      'edit-request-a',
      true,
    )).resolves.toMatchObject({ status: 'APPROVED' });
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-a' },
      data: expect.objectContaining({ subject: 'Approved subject', priority: 'HIGH' }),
    });
  });
});
