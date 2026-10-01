import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, rateLimitMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    loginSession: { create: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  rateLimitMock: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: rateLimitMock,
  RATE_LIMIT_POLICY_CONFIG: {
    login: { limit: 10, windowSeconds: 900 },
    password_reset: { limit: 20, windowSeconds: 900 },
  },
}));
vi.mock('@/lib/auth/session', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
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
    rateLimitMock.mockResolvedValue({ status: 'allowed', allowed: true });
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it('checks both trusted-IP and normalized-account dimensions before authentication', async () => {
    const result = await loginAction({ email: '  USER@Example.test ', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(rateLimitMock).toHaveBeenCalledTimes(2);
    expect(rateLimitMock.mock.calls.map(([input]) => input.identity)).toEqual([
      'login-ip:anonymous',
      'login-account:user@example.test',
    ]);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns the generic login error without account lookup when either dimension blocks', async () => {
    rateLimitMock.mockImplementation(async ({ identity }: { identity: string }) => ({
      status: identity.startsWith('login-account:') ? 'blocked' : 'allowed',
      allowed: !identity.startsWith('login-account:'),
    }));
    const result = await loginAction({ email: 'user@example.test', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed without exposing limiter state when the backend is unavailable', async () => {
    rateLimitMock.mockResolvedValue({ status: 'unavailable', allowed: false });
    const result = await loginAction({ email: 'user@example.test', password: 'wrong-password' });
    expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
