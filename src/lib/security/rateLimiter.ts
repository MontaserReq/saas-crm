import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { getAuthSecret } from '@/lib/auth/config';

export const RATE_LIMIT_POLICIES = [
  'login',
  'password_reset',
  'password_change',
  'public_search',
  'chatbot',
  'ai',
  'import',
] as const;

export type RateLimitPolicy = (typeof RATE_LIMIT_POLICIES)[number];
export type RateLimitFailureMode = 'open' | 'closed';
export type RateLimitStatus = 'allowed' | 'blocked' | 'unavailable';

export interface RateLimitCheckInput {
  policy: RateLimitPolicy;
  identity: string;
  limit: number;
  windowSeconds: number;
  failureMode?: RateLimitFailureMode;
  now?: Date;
}

export interface RateLimitResult {
  status: RateLimitStatus;
  allowed: boolean;
  limit: number;
  remaining: number | null;
  resetAt: Date | null;
  retryAfterSeconds: number | null;
}

const CLEANUP_EVERY = 100;
let cleanupCounter = 0;

function validateInput(input: RateLimitCheckInput): void {
  if (!RATE_LIMIT_POLICIES.includes(input.policy)) throw new Error('Invalid rate-limit policy');
  if (!Number.isSafeInteger(input.limit) || input.limit < 1) throw new Error('Rate-limit limit must be a positive integer');
  if (!Number.isSafeInteger(input.windowSeconds) || input.windowSeconds < 1) throw new Error('Rate-limit window must be a positive integer');
  if (!input.identity || input.identity.length > 2048) throw new Error('Rate-limit identity is invalid');
}

function privateKey(policy: RateLimitPolicy, identity: string): string {
  return `${policy}:${crypto.createHmac('sha256', getAuthSecret()).update(identity).digest('hex')}`;
}

export function rateLimitStorageKey(policy: RateLimitPolicy, identity: string): string {
  if (!RATE_LIMIT_POLICIES.includes(policy)) throw new Error('Invalid rate-limit policy');
  if (!identity || identity.length > 2048) throw new Error('Rate-limit identity is invalid');
  return privateKey(policy, identity);
}

async function cleanupExpiredCounters(): Promise<void> {
  await prisma.$executeRaw`
    WITH expired AS (
      SELECT "id" FROM "RateLimitCounter"
      WHERE "expiresAt" <= CURRENT_TIMESTAMP
      ORDER BY "expiresAt"
      LIMIT 100
    )
    DELETE FROM "RateLimitCounter" counter
    USING expired
    WHERE counter."id" = expired."id"
  `;
}

export async function checkRateLimit(input: RateLimitCheckInput): Promise<RateLimitResult> {
  validateInput(input);
  const failureMode = input.failureMode ?? 'closed';
  const now = input.now ?? new Date();
  const windowMs = input.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);
  const key = rateLimitStorageKey(input.policy, input.identity);

  if (++cleanupCounter % CLEANUP_EVERY === 0) {
    void cleanupExpiredCounters().catch(() => undefined);
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; windowStart: Date; expiresAt: Date }>>`
      INSERT INTO "RateLimitCounter" ("id", "key", "windowStart", "count", "expiresAt", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${key}, ${windowStart}, 1, ${resetAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "RateLimitCounter"."count" + 1, "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "count", "windowStart", "expiresAt"
    `;
    const row = rows[0];
    const count = Number(row.count);
    const allowed = count <= input.limit;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
    return {
      status: allowed ? 'allowed' : 'blocked',
      allowed,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      // Derive this boundary from the request clock. PostgreSQL's timestamp
      // decoding can apply the server session timezone to the stored value.
      resetAt,
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
    };
  } catch {
    return {
      status: 'unavailable',
      allowed: failureMode === 'open',
      limit: input.limit,
      remaining: null,
      resetAt,
      retryAfterSeconds: null,
    };
  }
}

export function resetRateLimiterCleanupCounterForTests(): void {
  cleanupCounter = 0;
}
