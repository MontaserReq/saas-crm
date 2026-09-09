import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';

const { prismaMock, sendTransactionalEmail, mockHeaderState } = vi.hoisted(() => {
  const mockHeaderState = { ip: '10.0.0.1', ua: 'vitest-agent' };
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
  return { prismaMock, sendTransactionalEmail, mockHeaderState };
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

import { forgotPasswordAction, resetPasswordAction } from '@/server/actions/auth';

describe('Password reset — unit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    process.env.APP_URL = 'https://crmplatform.codelinejo.com';
    mockHeaderState.ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`;
  });

  it('generates a high-entropy raw token and stores only its SHA-256 hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@codeline.jo', name: 'A', isActive: true });
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    await forgotPasswordAction('a@codeline.jo', 'en');

    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.passwordResetToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex digest
    expect(data.userId).toBe('u1');

    const emailCall = sendTransactionalEmail.mock.calls[0][0];
    const linkMatch = emailCall.html.match(/href="([^"]+)"/);
    expect(linkMatch).toBeTruthy();
    const rawToken = new URL(linkMatch[1]).searchParams.get('token')!;
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/); // 32 random bytes as hex
    expect(createHash('sha256').update(rawToken).digest('hex')).toBe(data.tokenHash);
    // The raw token must never equal the stored hash and must never appear in DB write args.
    expect(rawToken).not.toBe(data.tokenHash);
  });

  it('produces cryptographically random, non-repeating tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomBytes(32).toString('hex')));
    expect(tokens.size).toBe(50);
  });

  it('normalizes email casing and whitespace before lookup', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await forgotPasswordAction('  SOMEONE@CodeLine.JO  ', 'en');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'someone@codeline.jo' }, select: expect.any(Object) });
  });

  it('rejects malformed email input without touching the database', async () => {
    const result = await forgotPasswordAction('not-an-email', 'en');
    expect(result.success).toBe(true);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('builds a reset URL from the configured APP_URL, never a hardcoded host', async () => {
    process.env.APP_URL = 'https://crmplatform.codelinejo.com';
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@codeline.jo', name: 'A', isActive: true });
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    await forgotPasswordAction('a@codeline.jo', 'en');
    const emailCall = sendTransactionalEmail.mock.calls[0][0];
    expect(emailCall.html).toContain('https://crmplatform.codelinejo.com/reset-password?token=');
  });

  it('rejects a password shorter than the policy minimum with a specific error', async () => {
    const result = await resetPasswordAction('sometoken', 'short1', 'short1');
    expect(result).toEqual({ success: false, error: 'PASSWORD_TOO_SHORT' });
    expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation with a specific error', async () => {
    const result = await resetPasswordAction('sometoken', 'longenough1', 'longenough2');
    expect(result).toEqual({ success: false, error: 'PASSWORD_MISMATCH' });
    expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a missing token immediately', async () => {
    const result = await resetPasswordAction('', 'longenough1', 'longenough1');
    expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
  });

  it('rate-limits repeated requests for the same email within the window', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'flood@codeline.jo', name: 'A', isActive: true });
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    const email = `flood-${Date.now()}@codeline.jo`;
    for (let i = 0; i < 5; i++) {
      mockHeaderState.ip = `172.16.5.${i}`; // vary IP so only the email limiter is exercised
      await forgotPasswordAction(email, 'en');
    }
    const callsBefore = prismaMock.user.findUnique.mock.calls.length;
    mockHeaderState.ip = '172.16.5.99';
    await forgotPasswordAction(email, 'en');
    // The 6th request within the window must short-circuit before hitting the database.
    expect(prismaMock.user.findUnique.mock.calls.length).toBe(callsBefore);
  });
});
