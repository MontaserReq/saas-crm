import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { acquireOperation, assertOperationOwner, finishOperation, recoverExpiredOperations, renewOperation, withOperationOwner } from '@/lib/security/resourceGuard';

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

  it('never exceeds a two-slot global budget under concurrent acquisition', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => acquireOperation({
      organizationId,
      userId,
      operationType: 'AI_RESEARCH',
      idempotencyKey: `${prefix}-global-${i}`,
      limits: { global: 2, organization: 10, user: 10, leaseMs: 60_000 },
    })));
    const winners = results.filter((result) => result.acquired);
    expect(winners).toHaveLength(2);
    await Promise.all(winners.map((winner) => finishOperation(winner.execution!.id, winner.execution!.ownerToken!, 'SUCCEEDED')));
  });

  it('enforces organization and user limits independently under concurrent acquisition', async () => {
    const organizationResults = await Promise.all(Array.from({ length: 4 }, (_, i) => acquireOperation({
      organizationId,
      userId,
      operationType: 'PROPOSAL_GENERATION',
      idempotencyKey: `${prefix}-organization-${i}`,
      limits: { global: 10, organization: 1, user: 10, leaseMs: 60_000 },
    })));
    const organizationWinners = organizationResults.filter((result) => result.acquired);
    expect(organizationWinners).toHaveLength(1);
    await Promise.all(organizationWinners.map((winner) => finishOperation(winner.execution!.id, winner.execution!.ownerToken!, 'SUCCEEDED')));

    const userResults = await Promise.all(Array.from({ length: 4 }, (_, i) => acquireOperation({
      organizationId,
      userId,
      operationType: 'AI_ASSISTANT',
      idempotencyKey: `${prefix}-user-${i}`,
      limits: { global: 10, organization: 10, user: 1, leaseMs: 60_000 },
    })));
    const userWinners = userResults.filter((result) => result.acquired);
    expect(userWinners).toHaveLength(1);
    await finishOperation(userWinners[0].execution!.id, userWinners[0].execution!.ownerToken!, 'SUCCEEDED');
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

  it('rejects renewal after expiry but permits renewal while the lease is valid', async () => {
    const expired = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: `${prefix}-renew-expired`, limits: { global: 10, organization: 10, user: 10, leaseMs: 20 } });
    expect(expired.acquired).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const rejected = await renewOperation(expired.execution!.id, expired.execution!.ownerToken!, 60_000);
    expect(rejected.count).toBe(0);
    const expiredRow = await prisma.operationExecution.findUniqueOrThrow({ where: { id: expired.execution!.id } });
    expect(expiredRow.leaseExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now());

    const valid = await acquireOperation({ organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: `${prefix}-renew-valid`, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
    expect(valid.acquired).toBe(true);
    const renewed = await renewOperation(valid.execution!.id, valid.execution!.ownerToken!, 60_000);
    expect(renewed.count).toBe(1);
    await finishOperation(valid.execution!.id, valid.execution!.ownerToken!, 'SUCCEEDED');
  });

  it('fences the old owner after takeover', async () => {
    const key = `${prefix}-takeover`;
    const ownerA = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: key, limits: { global: 10, organization: 10, user: 10, leaseMs: 20 } });
    expect(ownerA.acquired).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ownerB = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: key, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
    expect(ownerB.acquired).toBe(true);

    expect((await renewOperation(ownerA.execution!.id, ownerA.execution!.ownerToken!, 60_000)).count).toBe(0);
    expect((await finishOperation(ownerA.execution!.id, ownerA.execution!.ownerToken!, 'FAILED')).count).toBe(0);
    await expect(assertOperationOwner(ownerA.execution!.id, ownerA.execution!.ownerToken!)).rejects.toThrow('no longer owned');
    await assertOperationOwner(ownerB.execution!.id, ownerB.execution!.ownerToken!);
    const current = await prisma.operationExecution.findUniqueOrThrow({ where: { id: ownerB.execution!.id } });
    expect(current.ownerToken).toBe(ownerB.execution!.ownerToken);
    expect(current.status).toBe('RUNNING');
    await finishOperation(ownerB.execution!.id, ownerB.execution!.ownerToken!, 'SUCCEEDED');
  });

  it('blocks stale-owner persistence while allowing the recovered owner to persist', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: {
        organizationId,
        createdById: userId,
        location: 'Concurrency test',
        requestedCount: 1,
        requiredFields: '[]',
      },
    });
    try {
      const ownerA = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 20 } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const ownerB = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
      expect(ownerA.acquired).toBe(true);
      expect(ownerB.acquired).toBe(true);

      await expect(withOperationOwner(ownerA.execution!.id, ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchCandidate.create({
        data: { researchJobId: job.id, name: 'Stale result', normalizedName: 'stale-result' },
      }))).rejects.toThrow('no longer owned');
      expect(await prisma.schoolResearchCandidate.count({ where: { researchJobId: job.id } })).toBe(0);

      await withOperationOwner(ownerB.execution!.id, ownerB.execution!.ownerToken!, (tx) => tx.schoolResearchCandidate.create({
        data: { researchJobId: job.id, name: 'Authoritative result', normalizedName: 'authoritative-result' },
      }));
      expect(await prisma.schoolResearchCandidate.count({ where: { researchJobId: job.id } })).toBe(1);
      await finishOperation(ownerB.execution!.id, ownerB.execution!.ownerToken!, 'SUCCEEDED');
    } finally {
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('treats the same key as one execution within a tenant and keeps tenants independent', async () => {
    const sameKey = `${prefix}-identity`;
    const sameTenant = await Promise.all(Array.from({ length: 5 }, () => acquireOperation({
      organizationId,
      userId,
      operationType: 'SCHOOL_IMPORT',
      idempotencyKey: sameKey,
      limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 },
    })));
    expect(sameTenant.filter((result) => result.acquired)).toHaveLength(1);
    const winner = sameTenant.find((result) => result.acquired)!;
    await finishOperation(winner.execution!.id, winner.execution!.ownerToken!, 'SUCCEEDED');

    const otherMembership = await prisma.organizationMember.findFirst({ where: { organizationId: { not: organizationId }, userId }, select: { organizationId: true } });
    if (!otherMembership) return;
    const independent = await acquireOperation({ organizationId: otherMembership.organizationId, userId, operationType: 'SCHOOL_IMPORT', idempotencyKey: sameKey, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
    expect(independent.acquired).toBe(true);
    await finishOperation(independent.execution!.id, independent.execution!.ownerToken!, 'SUCCEEDED');
  });
});
