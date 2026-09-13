import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    ticket: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), findUnique: vi.fn() },
    meetingDetails: { create: vi.fn() },
    ticketAssignee: { create: vi.fn() },
    assignmentHistory: { create: vi.fn() },
    note: { create: vi.fn() },
    activityEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let currentUser: UserSession | null = null;
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => {
    if (!currentUser) throw new Error('Unauthorized');
    return currentUser;
  },
}));

import { createMeetingTicketAction } from '@/server/actions/tickets';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    reportsToUserId: 'manager-1',
    permissions: ['tickets.create'],
    ...overrides,
  };
}

const validInput = () => ({
  schoolId: null,
  taskTypeId: null,
  subject: 'Weekly Coordination Meeting',
  priority: 'MEDIUM' as const,
  meetingDate: '2026-09-20',
  meetingTime: '10:30',
  participants: [{ name: 'Ahmad', userId: 'user-2' }, { name: 'External Guest' }],
  actionItems: [{ text: 'Send the recap email', assigneeId: 'user-2', done: false }],
  initialNote: 'Discussed Q4 outreach plan.',
});

describe('Meeting Minutes ticket creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      name: 'Manager One',
      isActive: true,
      role: { rolePermissions: [{ id: 'rp-1' }] },
      userPermissions: [],
    });
    prismaMock.ticket.create.mockImplementation(async ({ data }: any) => ({ id: 'ticket-1', ticketNumber: 'CL-00101', ...data }));
  });

  it('rejects an unauthenticated caller', async () => {
    const res = await createMeetingTicketAction(validInput());
    expect(res.success).toBe(false);
    expect(prismaMock.meetingDetails.create).not.toHaveBeenCalled();
  });

  it('rejects a user without tickets.create permission', async () => {
    currentUser = makeUser({ permissions: [] });
    const res = await createMeetingTicketAction(validInput());
    expect(res.success).toBe(false);
    expect(prismaMock.meetingDetails.create).not.toHaveBeenCalled();
  });

  it('rejects when the user has no direct manager configured', async () => {
    currentUser = makeUser({ reportsToUserId: null });
    const res = await createMeetingTicketAction(validInput());
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/direct manager is not assigned/i);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects when the direct manager is disabled', async () => {
    currentUser = makeUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      name: 'Manager One',
      isActive: false,
      role: { rolePermissions: [{ id: 'rp-1' }] },
      userPermissions: [],
    });
    const res = await createMeetingTicketAction(validInput());
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/direct manager is disabled/i);
  });

  it('rejects a meeting title shorter than 3 characters', async () => {
    currentUser = makeUser();
    const res = await createMeetingTicketAction({ ...validInput(), subject: 'Hi' });
    expect(res.success).toBe(false);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid meeting time format', async () => {
    currentUser = makeUser();
    const res = await createMeetingTicketAction({ ...validInput(), meetingTime: '25:99' });
    expect(res.success).toBe(false);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects a meeting with zero participants', async () => {
    currentUser = makeUser();
    const res = await createMeetingTicketAction({ ...validInput(), participants: [] });
    expect(res.success).toBe(false);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('creates the ticket, meeting details, assignment, and notification atomically for a valid meeting', async () => {
    currentUser = makeUser();
    const res = await createMeetingTicketAction(validInput());

    expect(res.success).toBe(true);
    expect(prismaMock.ticket.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.meetingDetails.create).toHaveBeenCalledTimes(1);

    const meetingCreateArgs = prismaMock.meetingDetails.create.mock.calls[0][0].data;
    expect(meetingCreateArgs.ticketId).toBe('ticket-1');
    expect(meetingCreateArgs.meetingTime).toBe('10:30');
    expect(JSON.parse(meetingCreateArgs.participants)).toHaveLength(2);
    expect(JSON.parse(meetingCreateArgs.actionItems)).toHaveLength(1);

    // Assignment is always derived server-side from reportsToUserId, never trusted from input.
    expect(prismaMock.ticketAssignee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'manager-1', ticketId: 'ticket-1' }) })
    );
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'manager-1', type: 'TICKET_ASSIGNED' }) })
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'MEETING_TICKET_CREATED' }) })
    );
  });

  it('never trusts a client-supplied ticket assignee — no assignedToUserId field is accepted by the action input', () => {
    const fs = require('fs');
    const path = require('path');
    const actionSource = fs.readFileSync(path.resolve(__dirname, '../../src/server/actions/tickets.ts'), 'utf8');
    const meetingActionMatch = actionSource.match(/createMeetingTicketAction\(input: \{[\s\S]*?\}\)/);
    expect(meetingActionMatch).toBeTruthy();
    // actionItems[].assigneeId (who owns a follow-up task) is expected and fine — it is not
    // a ticket-level assignee override. What must never appear is a top-level assignee field.
    expect(meetingActionMatch![0]).not.toMatch(/assignedToUserId/);
    expect(meetingActionMatch![0]).not.toMatch(/^\s*assigneeId\??:/m);
  });
});
