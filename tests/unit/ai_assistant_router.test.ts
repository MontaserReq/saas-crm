import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

vi.mock('@/server/services/AiAssistantToolService', () => ({
  AiAssistantToolService: {
    searchSchools: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getSchool: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getSchoolActivity: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getSchoolFollowUps: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getTickets: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getMyTickets: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getMeetings: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getMeetingMinutes: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getMyTasks: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getDashboardStats: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getMostOpenAssignees: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getCurrentUserPermissions: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    help: vi.fn().mockReturnValue({ ok: true, data: null }),
  },
}));

import { routeTool } from '@/lib/ai-assistant/router';
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

const user = makeUser();

describe('AI Assistant tool router — allow-list is the real security boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes a known read-only tool to its matching service method', async () => {
    const { tool } = await routeTool(user, 'getMyTickets', {});
    expect(tool).toBe('getMyTickets');
    expect(AiAssistantToolService.getMyTickets).toHaveBeenCalledWith(user);
  });

  it.each([
    'createTicket',
    'updateTicket',
    'deleteTicket',
    'createSchool',
    'updateSchool',
    'deleteSchool',
    'createMeeting',
    'sendMessage',
    'sendEmail',
    'changeStatus',
    'changeAssignee',
    'executeSql',
    'runQuery',
    'updatePermissions',
  ])('never dispatches the mutating/unknown tool name "%s" — falls back to none with no data call', async (fakeTool) => {
    const { tool, result } = await routeTool(user, fakeTool, {});
    expect(tool).toBe('none');
    expect(result).toBeNull();
    for (const fn of Object.values(AiAssistantToolService)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('falls back to none for any tool name outside the fixed allow-list, even if it sounds read-only', async () => {
    const { tool } = await routeTool(user, 'getEverything', {});
    expect(tool).toBe('none');
  });

  it('explicit {tool:"none"} classification never calls any tool method', async () => {
    const { tool, result } = await routeTool(user, 'none', { reason: 'action_requested' });
    expect(tool).toBe('none');
    expect(result).toBeNull();
    for (const fn of Object.values(AiAssistantToolService)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('sanitizes args: trims and caps oversized string arguments before they reach the tool', async () => {
    const longQuery = 'a'.repeat(500);
    await routeTool(user, 'searchSchools', { query: longQuery });
    const args = (AiAssistantToolService.searchSchools as any).mock.calls[0][1];
    expect(args.query.length).toBeLessThanOrEqual(200);
  });

  it('ignores non-string / unexpected-typed args rather than passing them through raw', async () => {
    await routeTool(user, 'searchSchools', { query: { $ne: null } as any, unassignedOnly: 'yes' as any });
    const args = (AiAssistantToolService.searchSchools as any).mock.calls[0][1];
    expect(args.query).toBeUndefined();
  });
});
