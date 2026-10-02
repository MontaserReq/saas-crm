import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, peekRateLimitMock, consumeRateLimitMock, verifyPasswordMock, createSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    loginSession: { create: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  peekRateLimitMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/security/rateLimiter', () => ({
  peekRateLimit: peekRateLimitMock,
  consumeRateLimit: consumeRateLimitMock,
  RATE_LIMIT_POLICY_CONFIG: {
    login: { limit: 10, windowSeconds: 900 },
    password_reset: { limit: 20, windowSeconds: 900 },
  },
}));
vi.mock('@/lib/auth/session', () => ({
  verifyPassword: verifyPasswordMock,
  hashPassword: vi.fn(),
  createSession: createSessionMock,
  destroySession: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => ({ get: (name: string) => name.toLowerCase() === 'user-agent' ? 'vitest-agent' : null }),
  cookies: () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));

import { loginAction } from '@/server/actions/auth';

describe('authentication distributed rate-limit wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    peekRateLimitMock.mockResolvedValue({ status: 'allowed', allowed: true });
    consumeRateLimitMock.mockResolvedValue({ status: 'allowed', allowed: true });
    prismaMock.user.findUnique.mockResolvedValue(null);
    verifyPasswordMock.mockResolvedValue(false);
  });

  it('checks both trusted-IP and normalized-account dimensions before authentication', async () => {
    const result = await loginAction({ email: '  USER@Example.test ', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(peekRateLimitMock).toHaveBeenCalledTimes(2);
    expect(peekRateLimitMock.mock.calls.map(([input]) => input.identity)).toEqual([
      'login-ip:anonymous',
      'login-account:user@example.test',
    ]);
    expect(consumeRateLimitMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns the generic login error without account lookup when either dimension blocks', async () => {
    peekRateLimitMock.mockImplementation(async ({ identity }: { identity: string }) => ({
      status: identity.startsWith('login-account:') ? 'blocked' : 'allowed',
      allowed: !identity.startsWith('login-account:'),
    }));
    const result = await loginAction({ email: 'user@example.test', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
  });

  it('fails closed without exposing limiter state when the backend is unavailable', async () => {
    peekRateLimitMock.mockResolvedValue({ status: 'unavailable', allowed: false });
    const result = await loginAction({ email: 'user@example.test', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not consume either failed-login counter after a successful authentication', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', name: 'User', email: 'user@example.test', passwordHash: 'hash', isActive: true,
      allowedIps: null, accessMode: 'ANY_IP', reportsToUserId: null,
      role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [], },
      department: { id: 'dept-1', name: 'Department' }, userPermissions: [],
    });
    prismaMock.user.update.mockResolvedValue({});
    verifyPasswordMock.mockResolvedValue(true);
    const result = await loginAction({ email: 'user@example.test', password: 'correct-password' });
    expect(result.success).toBe(true);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(createSessionMock).toHaveBeenCalled();
  });

  it('consumes both dimensions after an existing account submits a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', name: 'User', email: 'user@example.test', passwordHash: 'hash', isActive: true,
      allowedIps: null, accessMode: 'ANY_IP', reportsToUserId: null,
      role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [], },
      department: { id: 'dept-1', name: 'Department' }, userPermissions: [],
    });
    verifyPasswordMock.mockResolvedValue(false);
    const result = await loginAction({ email: 'user@example.test', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(consumeRateLimitMock.mock.calls.map(([input]) => input.identity)).toEqual([
      'login-ip:anonymous',
      'login-account:user@example.test',
    ]);
  });
});
