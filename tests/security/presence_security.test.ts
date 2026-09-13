import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    userPresence: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

let currentUser: UserSession | null = null;
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => {
    if (!currentUser) throw new Error('Unauthorized');
    return currentUser;
  },
}));

import { heartbeatAction } from '@/server/actions/presence';

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

describe('heartbeatAction — a user can only ever report their OWN presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
  });

  it('fails gracefully for an unauthenticated caller and never writes to the database', async () => {
    const res = await heartbeatAction();
    expect(res.success).toBe(false);
    expect(prismaMock.userPresence.upsert).not.toHaveBeenCalled();
  });

  it('writes presence keyed by the authenticated session id — the action takes no user-id argument, so there is no way to spoof another user\'s presence', async () => {
    currentUser = makeUser({ id: 'real-user-42' });
    const res = await heartbeatAction();
    expect(res.success).toBe(true);
    expect(prismaMock.userPresence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'real-user-42' }, create: expect.objectContaining({ userId: 'real-user-42' }) })
    );
  });

  it('different sessions each heartbeat only their own row', async () => {
    currentUser = makeUser({ id: 'user-a' });
    await heartbeatAction();
    currentUser = makeUser({ id: 'user-b' });
    await heartbeatAction();

    const calledIds = prismaMock.userPresence.upsert.mock.calls.map((c: any) => c[0].where.userId);
    expect(calledIds).toEqual(['user-a', 'user-b']);
  });
});
