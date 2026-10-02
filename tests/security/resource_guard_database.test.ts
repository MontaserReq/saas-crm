import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { acquireOperation, finishOperation, recoverExpiredOperations } from '@/lib/security/resourceGuard';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)('PostgreSQL resource guard', () => {
  let organizationId = '';
  let userId = '';
  const prefix = `guard-test-${crypto.randomUUID()}`;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.findFirst({
      where: { isActive: true, organizationMemberships: { some: { status: 'ACTIVE' } } },
      select: { id: true, organizationMemberships: { where: { status: 'ACTIVE' }, select: { organizationId: true }, take: 1 } },
    });
    if (!user?.organizationMemberships[0]) throw new Error('A seeded active organization member is required for resource guard tests');
    userId = user.id;
    organizationId = user.organizationMemberships[0].organizationId;
  });

  afterAll(async () => {
    if (organizationId) await prisma.operationExecution.deleteMany({ where: { organizationId, idempotencyKey: { startsWith: prefix } } });
    await prisma.$disconnect();
  });

  it('allows only one concurrent operation for a one-slot user/org budget', async () => {
    const results = await Promise.all(Array.from({ length: 3 }, (_, i) => acquireOperation({
      organizationId,
      userId,
      operationType: 'SCHOOL_IMPORT',
      idempotencyKey: `${prefix}-concurrent-${i}`,
      limits: { global: 10, organization: 1, user: 1, leaseMs: 60_000 },
    })));
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    const winner = results.find((result) => result.acquired);
    if (winner?.execution) await finishOperation(winner.execution.id, winner.execution.ownerToken!, 'SUCCEEDED');
  });

  it('replays the same idempotency key without acquiring a second execution', async () => {
    const key = `${prefix}-replay`;
    const first = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: key, limits: { global: 10, organization: 1, user: 1, leaseMs: 60_000 } });
    expect(first.acquired).toBe(true);
    await finishOperation(first.execution!.id, first.execution!.ownerToken!, 'SUCCEEDED', { resultPayload: JSON.stringify({ importedCount: 2 }) });
    const replay = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: key, limits: { global: 10, organization: 1, user: 1, leaseMs: 60_000 } });
    expect(replay).toMatchObject({ acquired: false, reason: 'COMPLETED' });
    expect(replay.execution?.resultPayload).toContain('importedCount');
  });

  it('recovers expired leases and permits a later owner to acquire the same operation', async () => {
    const key = `${prefix}-expired`;
    const first = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: key, limits: { global: 10, organization: 1, user: 1, leaseMs: 1 } });
    expect(first.acquired).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await recoverExpiredOperations('SCHOOL_IMPORT');
    const recovered = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: key, limits: { global: 10, organization: 1, user: 1, leaseMs: 60_000 } });
    expect(recovered.acquired).toBe(true);
    await finishOperation(recovered.execution!.id, recovered.execution!.ownerToken!, 'SUCCEEDED');
  });
});
