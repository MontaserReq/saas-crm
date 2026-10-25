import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, verifyPassword, hashPassword, requireAuth, createSession, rateLimitMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    loginSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    organizationMember: { findMany: vi.fn().mockResolvedValue([{ organizationId: 'org-a' }]) },
    $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
  },
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  requireAuth: vi.fn(),
  createSession: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/auth/session', () => ({ requireAuth, verifyPassword, hashPassword, createSession }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => ({ get: (name: string) => name.toLowerCase() === 'user-agent' ? 'vitest-agent' : null }),
}));
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: rateLimitMock,
  RATE_LIMIT_POLICY_CONFIG: { password_change: { limit: 5, windowSeconds: 900 } },
}));

import { updateUserCredentialsAction } from '@/server/actions/users';

describe('password change session invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ status: 'allowed', allowed: true });
  });

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
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: { passwordHash: 'new-hash' } });
    expect(prismaMock.loginSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', logoutAt: null, id: { not: 'current-session' } },
      data: { logoutAt: expect.any(Date) },
    });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'current-session' }));
  });

  it('preserves the existing session policy for an email-only change', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    verifyPassword.mockResolvedValue(true);
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null,
        passwordHash: 'old-hash', role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [] },
        department: { id: 'dept-a', name: 'Dept A' },
      })
      .mockResolvedValueOnce(null);
    prismaMock.user.update.mockResolvedValue({ id: 'user-a', name: 'User A', email: 'new@example.test', phone: null, avatar: null });

    expect((await updateUserCredentialsAction({ currentPassword: 'old-password', newEmail: 'new@example.test' })).success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: { email: 'new@example.test' } });
    expect(prismaMock.loginSession.updateMany).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'current-session', email: 'new@example.test' }));
  });

  it('does not rotate the current session when the credential transaction fails', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('new-hash');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null,
      passwordHash: 'old-hash', role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [] },
      department: { id: 'dept-a', name: 'Dept A' },
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null });
    prismaMock.loginSession.updateMany.mockRejectedValueOnce(new Error('SESSION_INVALIDATION_FAILED'));

    expect(await updateUserCredentialsAction({ currentPassword: 'old-password', newPassword: 'new-password' })).toEqual({ success: false, error: 'SESSION_INVALIDATION_FAILED' });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('does not change credentials when the current password is wrong', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    verifyPassword.mockResolvedValue(false);
    const result = await updateUserCredentialsAction({ currentPassword: 'wrong', newPassword: 'new-password', newEmail: undefined });
    expect(result).toEqual({ success: false, error: 'Current password is incorrect' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when the distributed limiter is unavailable', async () => {
    requireAuth.mockResolvedValue({ id: 'user-a', sessionId: 'current-session', organizationId: 'org-a' });
    rateLimitMock.mockResolvedValue({ status: 'unavailable', allowed: false });
    const result = await updateUserCredentialsAction({ currentPassword: 'old-password', newPassword: 'new-password', newEmail: undefined });
    expect(result).toEqual({ success: false, error: 'Unable to change credentials at this time' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
