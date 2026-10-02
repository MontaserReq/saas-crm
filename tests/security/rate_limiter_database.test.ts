import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, consumeRateLimit, peekRateLimit, rateLimitStorageKey, resetRateLimiterCleanupCounterForTests } from '@/lib/security/rateLimiter';

const secret = 'rate-limiter-test-secret-with-more-than-32-characters';
const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)('PostgreSQL distributed rate limiter', () => {
  const identity = `database-test-${crypto.randomUUID()}`;
  const now = new Date('2026-10-02T10:00:00.000Z');

  beforeAll(async () => {
    process.env.AUTH_SECRET = secret;
    resetRateLimiterCleanupCounterForTests();
    await prisma.$connect();
  });

  afterAll(async () => {
    const key = rateLimitStorageKey('login', identity);
    await prisma.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "key" = ${key}`;
    await prisma.$disconnect();
  });

  it('allows requests under the limit and blocks the excess with correct metadata', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => checkRateLimit({ policy: 'login', identity, limit: 3, windowSeconds: 60, now })));
    expect(results.filter((result) => result.status === 'allowed')).toHaveLength(3);
    const blocked = results.find((result) => result.status === 'blocked');
    expect(blocked?.remaining).toBe(0);
    expect(blocked?.retryAfterSeconds).toBe(60);
    expect(blocked?.resetAt?.toISOString()).toBe('2026-10-02T10:01:00.000Z');
  });

  it('shares the same counter between independent concurrent callers', async () => {
    const distributedIdentity = `distributed-${crypto.randomUUID()}`;
    const results = await Promise.all([
      ...Array.from({ length: 3 }, () => checkRateLimit({ policy: 'public_search', identity: distributedIdentity, limit: 5, windowSeconds: 60, now })),
      ...Array.from({ length: 4 }, () => checkRateLimit({ policy: 'public_search', identity: distributedIdentity, limit: 5, windowSeconds: 60, now })),
    ]);
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => result.status === 'blocked')).toHaveLength(2);
    await prisma.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "key" = ${rateLimitStorageKey('public_search', distributedIdentity)}`;
  });

  it('isolates identities and fixed windows', async () => {
    const first = `isolation-a-${crypto.randomUUID()}`;
    const second = `isolation-b-${crypto.randomUUID()}`;
    const firstWindow = await checkRateLimit({ policy: 'ai', identity: first, limit: 1, windowSeconds: 60, now });
    const firstBlocked = await checkRateLimit({ policy: 'ai', identity: first, limit: 1, windowSeconds: 60, now });
    const secondAllowed = await checkRateLimit({ policy: 'ai', identity: second, limit: 1, windowSeconds: 60, now });
    const nextWindowAllowed = await checkRateLimit({ policy: 'ai', identity: first, limit: 1, windowSeconds: 60, now: new Date('2026-10-02T10:01:00.000Z') });
    expect(firstWindow.allowed).toBe(true);
    expect(firstBlocked.allowed).toBe(false);
    expect(secondAllowed.allowed).toBe(true);
    expect(nextWindowAllowed.allowed).toBe(true);
    const firstKey = rateLimitStorageKey('ai', first);
    const secondKey = rateLimitStorageKey('ai', second);
    await prisma.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "key" IN (${firstKey}, ${secondKey})`;
  });

  it('does not persist raw identities in the limiter key', async () => {
    const rawIdentity = `email=user-${crypto.randomUUID()}@example.test|ip=198.51.100.20|token=secret-token`;
    await checkRateLimit({ policy: 'password_reset', identity: rawIdentity, limit: 1, windowSeconds: 60, now });
    const key = rateLimitStorageKey('password_reset', rawIdentity);
    expect(key).not.toContain('example.test');
    expect(key).not.toContain('198.51.100.20');
    expect(key).not.toContain('secret-token');
    expect(key).toMatch(/^password_reset:[a-f0-9]{64}$/);
    await prisma.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "key" = ${key}`;
  });

  it('peeks without consuming, then atomically consumes only when requested', async () => {
    const peekIdentity = `login-peek-${crypto.randomUUID()}`;
    const key = rateLimitStorageKey('login', peekIdentity);
    const policy = { policy: 'login' as const, identity: peekIdentity, limit: 1, windowSeconds: 60, now };
    const before = await peekRateLimit(policy);
    const beforeRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT "count" FROM "RateLimitCounter"
      WHERE "key" = ${key} AND "windowStart" = ${new Date('2026-10-02T10:00:00.000Z')}
    `;
    expect(before.allowed).toBe(true);
    expect(beforeRows).toHaveLength(0);

    const consumed = await consumeRateLimit(policy);
    const afterRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT "count" FROM "RateLimitCounter"
      WHERE "key" = ${key} AND "windowStart" = ${new Date('2026-10-02T10:00:00.000Z')}
    `;
    expect(consumed.allowed).toBe(true);
    expect(afterRows[0]?.count).toBe(1);
    await prisma.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "key" = ${key}`;
  });
});

describe('rate limiter failure contract', () => {
  it('distinguishes backend failure and supports fail-open/fail-closed selection', async () => {
    const query = vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('database unavailable'));
    process.env.AUTH_SECRET = secret;
    const closed = await checkRateLimit({ policy: 'login', identity: 'failure-test', limit: 1, windowSeconds: 60, failureMode: 'closed' });
    const open = await checkRateLimit({ policy: 'login', identity: 'failure-test', limit: 1, windowSeconds: 60, failureMode: 'open' });
    expect(closed).toMatchObject({ status: 'unavailable', allowed: false });
    expect(open).toMatchObject({ status: 'unavailable', allowed: true });
    query.mockRestore();
  });
});
