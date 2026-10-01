import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    school: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn() },
    ticket: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn() },
    ticketAssignee: { groupBy: vi.fn().mockResolvedValue([]) },
    todo: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

import { AiAssistantToolService } from '@/server/services/AiAssistantToolService';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    permissions: [],
    ...overrides,
  };
}

const ATTACKER_ID = 'attacker-user';

describe('AI Assistant tools — permission enforcement (server-side, not prompt-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searchSchools is forbidden without schools.view, and never touches the database', async () => {
    const user = makeUser({ permissions: [] });
    const result = await AiAssistantToolService.searchSchools(user, { query: 'test' });
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
    expect(prismaMock.school.findMany).not.toHaveBeenCalled();
    expect(prismaMock.school.count).not.toHaveBeenCalled();
  });

  it('searchSchools succeeds with schools.view and returns only trimmed fields (no raw DB row leakage)', async () => {
    prismaMock.school.count.mockResolvedValue(1);
    prismaMock.school.findMany.mockResolvedValue([
      { id: 's1', name: 'ABC School', city: 'Amman', status: 'ACTIVE', classification: 'A', responsibleEmployee: { name: 'Sara' }, _count: { tickets: 2 }, notes: 'internal notes should not leak', isDeleted: false },
    ]);
    const user = makeUser({ permissions: ['schools.view'] });
    const result = await AiAssistantToolService.searchSchools(user, { query: 'ABC' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schools).toEqual([
        { id: 's1', name: 'ABC School', city: 'Amman', status: 'ACTIVE', classification: 'A', responsibleEmployee: 'Sara', openTickets: 2 },
      ]);
      // The service-level "internal notes" field must never appear in what the AI/UI receives.
      expect(JSON.stringify(result.data)).not.toMatch(/internal notes/);
    }
  });

  it('getSchool is forbidden without schools.view', async () => {
    const user = makeUser({ permissions: [] });
    const result = await AiAssistantToolService.getSchool(user, { schoolId: 'any-id' });
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
    expect(prismaMock.school.findUnique).not.toHaveBeenCalled();
  });

  it('getSchoolFollowUps requires schools.view AND a ticket-view permission — missing either is forbidden', async () => {
    const noSchoolsView = makeUser({ permissions: ['tickets.view_assigned'] });
    expect(await AiAssistantToolService.getSchoolFollowUps(noSchoolsView)).toEqual({ ok: false, reason: 'forbidden' });

    const noTicketsView = makeUser({ permissions: ['schools.view'] });
    expect(await AiAssistantToolService.getSchoolFollowUps(noTicketsView)).toEqual({ ok: false, reason: 'forbidden' });

    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled();
  });

  it('getSchoolFollowUps scopes to the caller\'s own assigned tickets when they lack tickets.view_all (cannot see org-wide follow-ups by asking)', async () => {
    const user = makeUser({ id: 'member-1', permissions: ['schools.view', 'tickets.view_assigned'] });
    await AiAssistantToolService.getSchoolFollowUps(user);
    const whereArg = prismaMock.ticket.findMany.mock.calls[0][0].where;
    expect(whereArg.assignees).toEqual({ some: { userId: 'member-1', isCurrent: true } });
  });

  it('getMostOpenAssignees is forbidden without tickets.view_all (org-wide aggregation is sensitive)', async () => {
    const user = makeUser({ permissions: ['tickets.view_assigned'] });
    const result = await AiAssistantToolService.getMostOpenAssignees(user);
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
    expect(prismaMock.ticketAssignee.groupBy).not.toHaveBeenCalled();
  });

  it('getMostOpenAssignees only returns names and counts, never raw ticket data', async () => {
    prismaMock.ticketAssignee.groupBy.mockResolvedValue([{ userId: 'u1', _count: { userId: 3 } }]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ahmad' }]);
    const user = makeUser({ permissions: ['tickets.view_all'] });
    const result = await AiAssistantToolService.getMostOpenAssignees(user);
    expect(result).toEqual({ ok: true, data: { items: [{ name: 'Ahmad', openCount: 3 }] } });
  });

  it('getMyTasks always queries the CALLER\'s own todos — an attacker cannot see another user\'s tasks by any argument, because no user id is ever accepted as an argument', async () => {
    const attacker = makeUser({ id: ATTACKER_ID, permissions: ['todo.view'] });
    await AiAssistantToolService.getMyTasks(attacker);
    expect(prismaMock.todo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: ATTACKER_ID, organizationId: 'org_codeline_legacy' } }));
  });

  it('getMyTasks is forbidden without todo.view or todo.manage_own', async () => {
    const user = makeUser({ permissions: [] });
    const result = await AiAssistantToolService.getMyTasks(user);
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
    expect(prismaMock.todo.findMany).not.toHaveBeenCalled();
  });

  it('getCurrentUserPermissions only ever reflects the caller\'s own session, never another user\'s', async () => {
    const user = makeUser({ id: 'me', roleDisplayName: 'Member', departmentName: 'PR', permissions: ['schools.view'] });
    const result = await AiAssistantToolService.getCurrentUserPermissions(user);
    expect(result).toEqual({ ok: true, data: { role: 'Member', department: 'PR', permissions: ['schools.view'] } });
  });
});
