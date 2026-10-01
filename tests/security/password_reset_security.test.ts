import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, sendTransactionalEmail, mockHeaderState, rateLimitMock } = vi.hoisted(() => {
  const mockHeaderState = { ip: '203.0.113.5', ua: 'vitest-agent' };
  const prismaMock: any = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    loginSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  const sendTransactionalEmail = vi.fn().mockResolvedValue(undefined);
  const rateLimitMock = vi.fn();
  return { prismaMock, sendTransactionalEmail, mockHeaderState, rateLimitMock };
});

vi.mock('next/headers', () => ({
  headers: () => ({
    get: (key: string) => {
      const k = key.toLowerCase();
      if (k === 'x-forwarded-for') return mockHeaderState.ip;
      if (k === 'user-agent') return mockHeaderState.ua;
      return null;
    },
  }),
  cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: (...args: any[]) => sendTransactionalEmail(...args) }));
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: rateLimitMock,
  RATE_LIMIT_POLICY_CONFIG: { password_reset: { limit: 20, windowSeconds: 900 } },
}));

import { forgotPasswordAction, resetPasswordAction, checkResetTokenAction } from '@/server/actions/auth';

type FakeRow = { id: string; userId: string; usedAt: Date | null; expiresAt: Date };

// The store $transaction snapshots/restores around each callback, so a throw inside the
// callback rolls back token-claim mutations exactly like a real Postgres transaction abort.
let activeStore: { row: FakeRow | null } | null = null;

// Models the same atomic compare-and-swap the real Postgres UPDATE...WHERE performs:
// updateMany only "wins" (count 1) if usedAt is currently null and not expired, and it
// flips usedAt synchronously before any other call can observe the old state.
function installFakeTokenStore(initial: FakeRow | null) {
  const state = { row: initial };
  activeStore = state;
  prismaMock.passwordResetToken.updateMany.mockImplementation(async ({ data }: any) => {
    if (!state.row || state.row.usedAt !== null || state.row.expiresAt <= new Date()) return { count: 0 };
    state.row = { ...state.row, usedAt: data.usedAt };
    return { count: 1 };
  });
  prismaMock.passwordResetToken.findUnique.mockImplementation(async () => (state.row ? { ...state.row } : null));
  return { get: () => state.row };
}

describe('Password reset — security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeStore = null;
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    rateLimitMock.mockResolvedValue({ status: 'allowed', allowed: true });
    // Snapshot/restore the fake token store around each callback so a throw rolls back
    // the CAS claim, mirroring a real Postgres transaction abort.
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const snapshot = activeStore ? activeStore.row : undefined;
      try {
        return await fn(prismaMock);
      } catch (error) {
        if (activeStore) activeStore.row = snapshot ?? null;
        throw error;
      }
    });
    process.env.APP_URL = 'https://crmplatform.codelinejo.com';
    mockHeaderState.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  });

  describe('Account enumeration protection', () => {
    it('returns the identical generic response for an existing account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'exists@codeline.jo', name: 'A', isActive: true });
      prismaMock.passwordResetToken.create.mockResolvedValue({});
      const result = await forgotPasswordAction('exists@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.any(String) });
    });

    it('returns the identical generic response for a non-existing account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      const result = await forgotPasswordAction('nobody@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendTransactionalEmail).not.toHaveBeenCalled();
    });

    it('returns the identical generic response for a disabled account and never emails it', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', email: 'disabled@codeline.jo', name: 'B', isActive: false });
      const result = await forgotPasswordAction('disabled@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendTransactionalEmail).not.toHaveBeenCalled();
    });

    it('never throws or leaks internal errors to the caller when the mailer/db misbehaves', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('connection refused: password=supersecret'));
      const result = await forgotPasswordAction('anyone@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.any(String) });
    });

    it('never reveals account existence through a thrown error when APP_URL is misconfigured', async () => {
      delete process.env.APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXTAUTH_URL;
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'exists@codeline.jo', name: 'A', isActive: true });
      prismaMock.passwordResetToken.create.mockResolvedValue({});
      const result = await forgotPasswordAction('exists@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(sendTransactionalEmail).not.toHaveBeenCalled();
    });
  });

  describe('Token lifecycle enforcement', () => {
    it('rejects an invalid/unknown token with a generic error', async () => {
      installFakeTokenStore(null);
      const result = await resetPasswordAction('garbage-token', 'longenough1', 'longenough1');
      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects an expired token even though it is otherwise well-formed and unused, with a distinct error code', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1000) });
      const result = await resetPasswordAction('expired-token', 'longenough1', 'longenough1');
      expect(result).toEqual({ success: false, error: 'TOKEN_EXPIRED' });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token that has already been used, with a distinct error code (single-use enforcement)', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
      const result = await resetPasswordAction('used-token', 'longenough1', 'longenough1');
      expect(result).toEqual({ success: false, error: 'TOKEN_ALREADY_USED' });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('accepts a valid, unexpired, unused token exactly once via an atomic claim, and marks it used', async () => {
      const store = installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.loginSession.updateMany.mockResolvedValue({ count: 2 });

      const result = await resetPasswordAction('good-token', 'longenough1', 'longenough1');

      expect(result).toEqual({ success: true });
      expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), usedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { usedAt: expect.any(Date) },
      });
      expect(store.get()?.usedAt).toBeInstanceOf(Date);
      // Session invalidation: every active session for the user must be logged out.
      expect(prismaMock.loginSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', logoutAt: null },
        data: { logoutAt: expect.any(Date) },
      });
    });

    it('rejects a second attempt with the same token after a successful reset', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.loginSession.updateMany.mockResolvedValue({ count: 0 });

      const first = await resetPasswordAction('good-token', 'longenough1', 'longenough1');
      expect(first).toEqual({ success: true });

      const second = await resetPasswordAction('good-token', 'differentpass2', 'differentpass2');
      expect(second).toEqual({ success: false, error: 'TOKEN_ALREADY_USED' });
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1); // password was not changed a second time
    });

    it('rejects a reset for a token whose owning account was disabled in the meantime, and does not burn the token', async () => {
      const store = installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      const result = await resetPasswordAction('good-token', 'longenough1', 'longenough1');
      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      // The whole operation is one transaction: since the reset failed, the claim must not persist.
      expect(store.get()?.usedAt).toBeNull();
    });

    it('exactly one of two simultaneous requests for the same token succeeds; the other is rejected as already used', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.loginSession.updateMany.mockResolvedValue({ count: 0 });

      const [a, b] = await Promise.all([
        resetPasswordAction('good-token', 'longenough1', 'longenough1'),
        resetPasswordAction('good-token', 'anotherpass2', 'anotherpass2'),
      ]);

      const results = [a, b];
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error).toBe('TOKEN_ALREADY_USED');
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkResetTokenAction (read-only UX status)', () => {
    it('reports VALID for an unused, unexpired token without mutating it', async () => {
      const store = installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      const status = await checkResetTokenAction('good-token');
      expect(status).toBe('VALID');
      expect(store.get()?.usedAt).toBeNull();
      expect(prismaMock.passwordResetToken.updateMany).not.toHaveBeenCalled();
    });

    it('reports ALREADY_USED for a consumed token', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
      expect(await checkResetTokenAction('used-token')).toBe('ALREADY_USED');
    });

    it('reports EXPIRED for an unused but expired token', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1000) });
      expect(await checkResetTokenAction('expired-token')).toBe('EXPIRED');
    });

    it('reports INVALID for an unknown token and for an empty token', async () => {
      installFakeTokenStore(null);
      expect(await checkResetTokenAction('unknown-token')).toBe('INVALID');
      expect(await checkResetTokenAction('')).toBe('INVALID');
    });
  });

  describe('Concurrent reset requests', () => {
    it('invalidates a previously issued unused token when a newer one is requested', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@codeline.jo', name: 'A', isActive: true });
      prismaMock.passwordResetToken.create.mockResolvedValue({});
      await forgotPasswordAction('a@codeline.jo', 'en');
      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', usedAt: null } });
    });
  });

  describe('No secret leakage', () => {
    it('never writes the raw token or the new password into the audit log', async () => {
      installFakeTokenStore({ id: 'r1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prismaMock.user.update.mockResolvedValue({});

      await resetPasswordAction('the-raw-secret-token', 'MyNewPassw0rd!', 'MyNewPassw0rd!');

      const auditCall = prismaMock.auditLog.create.mock.calls.find((c: any) => c[0].data.action === 'PASSWORD_RESET_COMPLETED');
      expect(auditCall).toBeTruthy();
      const serialized = JSON.stringify(auditCall![0].data);
      expect(serialized).not.toContain('the-raw-secret-token');
      expect(serialized).not.toContain('MyNewPassw0rd!');
    });

    it('never writes the raw token into the request audit log or the token table', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@codeline.jo', name: 'A', isActive: true });
      prismaMock.passwordResetToken.create.mockResolvedValue({});

      await forgotPasswordAction('a@codeline.jo', 'en');

      const link = sendTransactionalEmail.mock.calls[0][0].html as string;
      const rawToken = new URL(link.match(/href="([^"]+)"/)![1]).searchParams.get('token')!;

      const auditCall = prismaMock.auditLog.create.mock.calls.find((c: any) => c[0].data.action === 'PASSWORD_RESET_REQUESTED');
      expect(auditCall).toBeTruthy();
      expect(JSON.stringify(auditCall![0].data)).not.toContain(rawToken);

      const tokenCreateCall = prismaMock.passwordResetToken.create.mock.calls[0][0];
      expect(JSON.stringify(tokenCreateCall)).not.toContain(rawToken);
    });

    it('does not put the userId or email in the reset link — only an opaque token', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-id-12345', email: 'secret@codeline.jo', name: 'A', isActive: true });
      prismaMock.passwordResetToken.create.mockResolvedValue({});
      await forgotPasswordAction('secret@codeline.jo', 'en');
      const link = sendTransactionalEmail.mock.calls[0][0].html as string;
      const url = new URL(link.match(/href="([^"]+)"/)![1]);
      expect(Array.from(url.searchParams.keys())).toEqual(['token']);
      expect(link).not.toContain('user-id-12345');
      expect(link).not.toContain('secret@codeline.jo');
    });
  });

  describe('Rate limiting', () => {
    it('preserves the generic response and fails closed when the limiter is unavailable', async () => {
      rateLimitMock.mockResolvedValue({ status: 'unavailable', allowed: false });
      const result = await forgotPasswordAction('victim@codeline.jo', 'en');
      expect(result).toEqual({ success: true, message: expect.stringContaining('If an account exists') });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('fails closed before attempting reset-token consumption when the limiter is unavailable', async () => {
      rateLimitMock.mockResolvedValue({ status: 'unavailable', allowed: false });
      const result = await resetPasswordAction('opaque-token', 'longenough1', 'longenough1');
      expect(result).toEqual({ success: false, error: 'RESET_FAILED' });
      expect(prismaMock.passwordResetToken.updateMany).not.toHaveBeenCalled();
    });

    it('blocks a flood of requests from the same IP across many different emails', async () => {
      const counts = new Map<string, number>();
      rateLimitMock.mockImplementation(async ({ identity }: { identity: string }) => {
        const count = (counts.get(identity) || 0) + 1;
        counts.set(identity, count);
        return { status: count <= 20 ? 'allowed' : 'blocked', allowed: count <= 20 };
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      const ip = '192.0.2.77';
      mockHeaderState.ip = ip;
      for (let i = 0; i < 20; i++) {
        await forgotPasswordAction(`victim-${i}@codeline.jo`, 'en');
      }
      const callsBefore = prismaMock.user.findUnique.mock.calls.length;
      await forgotPasswordAction('victim-final@codeline.jo', 'en');
      expect(prismaMock.user.findUnique.mock.calls.length).toBe(callsBefore);
    });
  });
});
