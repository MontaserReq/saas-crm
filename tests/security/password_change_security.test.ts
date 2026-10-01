import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, verifyPassword, hashPassword, requireAuth, createSession } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    loginSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    organizationMember: { findMany: vi.fn().mockResolvedValue([{ organizationId: 'org-a' }]) },
  },
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  requireAuth: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/auth/session', () => ({ requireAuth, verifyPassword, hashPassword, createSession }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateUserCredentialsAction } from '@/server/actions/users';

describe('password change session invalidation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the current session and invalidates every other active session', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('new-hash');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null,
      passwordHash: 'old-hash', role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [{ permission: { code: 'users.view' } }] },
      department: { id: 'dept-a', name: 'Dept A' },
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null });

    const result = await updateUserCredentialsAction({ currentPassword: 'old-password', newPassword: 'new-password', newEmail: undefined });

    expect(result.success).toBe(true);
    expect(prismaMock.loginSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', logoutAt: null, id: { not: 'current-session' } },
      data: { logoutAt: expect.any(Date) },
    });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'current-session' }));
  });

  it('does not change credentials when the current password is wrong', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    verifyPassword.mockResolvedValue(false);
    const result = await updateUserCredentialsAction({ currentPassword: 'wrong', newPassword: 'new-password', newEmail: undefined });
    expect(result).toEqual({ success: false, error: 'Current password is incorrect' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.loginSession.updateMany).not.toHaveBeenCalled();
  });
});
