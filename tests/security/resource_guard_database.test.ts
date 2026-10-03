import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { acquireOperation, assertOperationOwner, consumeResearchBudget, finishOperation, recoverExpiredOperations, renewOperation, ResearchBudgetExceededError, withResearchJobOwner } from '@/lib/security/resourceGuard';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';

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
    await prisma.operationExecution.deleteMany({ where: { operationType: { in: ['SCHOOL_IMPORT', 'AI_RESEARCH', 'PROPOSAL_GENERATION', 'AI_ASSISTANT'] } } });
  });

  afterAll(async () => {
    if (organizationId) await prisma.operationExecution.deleteMany({ where: { organizationId, idempotencyKey: { startsWith: prefix } } });
    await prisma.$disconnect();
  });

  const createTakeoverFixture = async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Stale mutation coverage', requestedCount: 1, requiredFields: '[]' },
    });
    const ownerA = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 20 } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ownerB = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
    expect(ownerA.acquired).toBe(true);
    expect(ownerB.acquired).toBe(true);
    await SchoolResearchService.claimResearchJobStartup(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!);
    const authoritative = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(authoritative.currentOperationId).toBe(ownerB.execution!.id);
    return { job, ownerA, ownerB };
  };

  const cleanupTakeoverFixture = async (fixture: Awaited<ReturnType<typeof createTakeoverFixture>>) => {
    await finishOperation(fixture.ownerB.execution!.id, fixture.ownerB.execution!.ownerToken!, 'SUCCEEDED');
    await prisma.operationExecution.delete({ where: { id: fixture.ownerB.execution!.id } });
    await prisma.schoolResearchJob.delete({ where: { id: fixture.job.id } });
  };

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

  it('atomically consumes a durable research provider budget', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Budget concurrency', requestedCount: 1, requiredFields: '[]' },
    });
    try {
      const owner = await acquireOperation({
        organizationId,
        userId,
        operationType: 'AI_RESEARCH',
        idempotencyKey: job.id,
        limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 },
        researchBudget: { maxProviderRequests: 2, maxSourceRequests: 10, maxSourceRequestsPerSchool: 3, maxRetries: 5, maxTokens: 1000, maxDurationMs: 60_000 },
      });
      await SchoolResearchService.claimResearchJobStartup(job.id, owner.execution!.id, owner.execution!.ownerToken!);
      const results = await Promise.allSettled(Array.from({ length: 3 }, () => consumeResearchBudget(job.id, owner.execution!.id, owner.execution!.ownerToken!, { providerRequests: 1 })));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
      expect(results.filter((result) => result.status === 'rejected' && result.reason instanceof ResearchBudgetExceededError)).toHaveLength(1);
      const row = await prisma.operationExecution.findUniqueOrThrow({ where: { id: owner.execution!.id } });
      expect(row.researchProviderRequests).toBe(2);
    } finally {
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('preserves remaining budget across takeover and fences the stale owner', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Budget takeover', requestedCount: 1, requiredFields: '[]' },
    });
    try {
      const ownerA = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 100 }, researchBudget: { maxProviderRequests: 3, maxSourceRequests: 10, maxSourceRequestsPerSchool: 3, maxRetries: 5, maxTokens: 1000, maxDurationMs: 60_000 } });
      await SchoolResearchService.claimResearchJobStartup(job.id, ownerA.execution!.id, ownerA.execution!.ownerToken!);
      await consumeResearchBudget(job.id, ownerA.execution!.id, ownerA.execution!.ownerToken!, { providerRequests: 1 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      await SchoolResearchService.recoverStaleExecutions();
      const ownerB = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 }, researchBudget: { maxProviderRequests: 3, maxSourceRequests: 10, maxSourceRequestsPerSchool: 3, maxRetries: 5, maxTokens: 1000, maxDurationMs: 60_000 } });
      await SchoolResearchService.claimResearchJobStartup(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!);
      await expect(consumeResearchBudget(job.id, ownerA.execution!.id, ownerA.execution!.ownerToken!, { providerRequests: 1 })).rejects.toThrow('no longer owned');
      await consumeResearchBudget(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!, { providerRequests: 1 });
      const row = await prisma.operationExecution.findUniqueOrThrow({ where: { id: ownerB.execution!.id } });
      expect(row.researchProviderRequests).toBe(2);
      await finishOperation(ownerB.execution!.id, ownerB.execution!.ownerToken!, 'SUCCEEDED');
    } finally {
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
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

      await SchoolResearchService.claimResearchJobStartup(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!);

      await expect(withResearchJobOwner(job.id, ownerA.execution!.id, ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchCandidate.create({
        data: { researchJobId: job.id, name: 'Stale result', normalizedName: 'stale-result' },
      }))).rejects.toThrow('no longer owned');
      expect(await prisma.schoolResearchCandidate.count({ where: { researchJobId: job.id } })).toBe(0);

      await withResearchJobOwner(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!, (tx) => tx.schoolResearchCandidate.create({
        data: { researchJobId: job.id, name: 'Authoritative result', normalizedName: 'authoritative-result' },
      }));
      expect(await prisma.schoolResearchCandidate.count({ where: { researchJobId: job.id } })).toBe(1);
      await finishOperation(ownerB.execution!.id, ownerB.execution!.ownerToken!, 'SUCCEEDED');
    } finally {
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('rejects stale research startup and allows the recovered owner to claim the pending job', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Startup fencing', requestedCount: 1, requiredFields: '[]' },
    });
    try {
      const ownerA = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 20 } });
      expect(ownerA.acquired).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const ownerB = await acquireOperation({ organizationId, userId, operationType: 'AI_RESEARCH', idempotencyKey: job.id, limits: { global: 10, organization: 10, user: 10, leaseMs: 60_000 } });
      expect(ownerB.acquired).toBe(true);

      await expect(SchoolResearchService.claimResearchJobStartup(job.id, ownerA.execution!.id, ownerA.execution!.ownerToken!)).rejects.toThrow('no longer owned');
      expect((await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('PENDING');
      await SchoolResearchService.claimResearchJobStartup(job.id, ownerB.execution!.id, ownerB.execution!.ownerToken!);
      const recoveredJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(recoveredJob.status).toBe('RUNNING');
      expect(recoveredJob.currentOperationId).toBe(ownerB.execution!.id);
      await finishOperation(ownerB.execution!.id, ownerB.execution!.ownerToken!, 'SUCCEEDED');
    } finally {
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('allows exactly one of two distinct concurrent executors to claim a pending research job', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Concurrent startup', requestedCount: 1, requiredFields: '[]' },
    });
    const executorA = { operationId: '', ownerToken: crypto.randomUUID() };
    const executorB = { operationId: '', ownerToken: crypto.randomUUID() };
    try {
      const [operationA, operationB] = await Promise.all([
        prisma.operationExecution.create({
          data: {
            organizationId,
            userId,
            operationType: 'AI_RESEARCH',
            idempotencyKey: `${job.id}-executor-a`,
            status: 'RUNNING',
            ownerToken: executorA.ownerToken,
            leaseExpiresAt: new Date(Date.now() + 60_000),
            startedAt: new Date(),
            attemptCount: 1,
          },
        }),
        prisma.operationExecution.create({
          data: {
            organizationId,
            userId,
            operationType: 'AI_RESEARCH',
            idempotencyKey: `${job.id}-executor-b`,
            status: 'RUNNING',
            ownerToken: executorB.ownerToken,
            leaseExpiresAt: new Date(Date.now() + 60_000),
            startedAt: new Date(),
            attemptCount: 1,
          },
        }),
      ]);
      executorA.operationId = operationA.id;
      executorB.operationId = operationB.id;

      const results = await Promise.allSettled([
        SchoolResearchService.claimResearchJobStartup(job.id, executorA.operationId, executorA.ownerToken),
        SchoolResearchService.claimResearchJobStartup(job.id, executorB.operationId, executorB.ownerToken),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected').every((result) => String((result as PromiseRejectedResult).reason).includes('no longer owned'))).toBe(true);

      const runningJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(runningJob.status).toBe('RUNNING');
      const operations = await prisma.operationExecution.findMany({ where: { id: { in: [executorA.operationId, executorB.operationId] } } });
      const winningOperationId = results[0].status === 'fulfilled' ? executorA.operationId : executorB.operationId;
      expect(runningJob.currentOperationId).toBe(winningOperationId);
      const winner = operations.find((operation) => operation.id === winningOperationId);
      expect(winner).toBeDefined();
      expect(winner!.status).toBe('RUNNING');
      expect(winner!.ownerToken).toBe(winner!.id === executorA.operationId ? executorA.ownerToken : executorB.ownerToken);
      expect(operations).toHaveLength(2);
      const losingOperationId = winningOperationId === executorA.operationId ? executorB.operationId : executorA.operationId;
      const loser = operations.find((operation) => operation.id === losingOperationId)!;
      expect(loser.status).toBe('CANCELLED');
      await expect(withResearchJobOwner(job.id, loser.id, loser.ownerToken || 'stale-owner', (tx) => tx.schoolResearchCandidate.create({
        data: { researchJobId: job.id, name: 'Losing result', normalizedName: 'losing-result' },
      }))).rejects.toThrow('no longer owned');
      await finishOperation(winner!.id, winner!.ownerToken!, 'SUCCEEDED');
    } finally {
      await prisma.operationExecution.deleteMany({ where: { id: { in: [executorA.operationId, executorB.operationId] } } });
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('rejects an operation from another organization during research startup', async () => {
    const job = await prisma.schoolResearchJob.create({
      data: { organizationId, createdById: userId, location: 'Tenant authority', requestedCount: 1, requiredFields: '[]' },
    });
    const organizationB = await prisma.organization.findFirst({ where: { id: { not: organizationId } }, select: { id: true } });
    if (!organizationB) throw new Error('A second organization is required for tenant authority coverage');
    const operationB = await prisma.operationExecution.create({
      data: {
        organizationId: organizationB.id,
        userId,
        operationType: 'AI_RESEARCH',
        idempotencyKey: `${prefix}-tenant-b-${job.id}`,
        status: 'RUNNING',
        ownerToken: crypto.randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 60_000),
        startedAt: new Date(),
        attemptCount: 1,
      },
    });
    try {
      await expect(SchoolResearchService.claimResearchJobStartup(job.id, operationB.id, operationB.ownerToken!)).rejects.toThrow('no longer owned');
      const persistedJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: job.id } });
      const persistedOperation = await prisma.operationExecution.findUniqueOrThrow({ where: { id: operationB.id } });
      expect(persistedJob.currentOperationId).toBeNull();
      expect(persistedOperation.status).toBe('CANCELLED');
    } finally {
      await prisma.operationExecution.delete({ where: { id: operationB.id } });
      await prisma.schoolResearchJob.delete({ where: { id: job.id } });
    }
  });

  it('rejects stale attempt persistence after takeover', async () => {
    const fixture = await createTakeoverFixture();
    try {
      await expect(withResearchJobOwner(fixture.job.id, fixture.ownerA.execution!.id, fixture.ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchAttempt.create({
        data: { jobId: fixture.job.id, provider: 'stale-provider', model: 'stale-model', attemptNumber: 1, status: 'FAILED', durationMs: 1_000, startedAt: new Date(Date.now() - 1_000), completedAt: new Date() },
      }))).rejects.toThrow('no longer owned');
      expect(await prisma.schoolResearchAttempt.count({ where: { jobId: fixture.job.id } })).toBe(0);
    } finally {
      await cleanupTakeoverFixture(fixture);
    }
  });

  it('rejects stale provider-result persistence after takeover', async () => {
    const fixture = await createTakeoverFixture();
    try {
      await expect(withResearchJobOwner(fixture.job.id, fixture.ownerA.execution!.id, fixture.ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchAttempt.create({
        data: { jobId: fixture.job.id, provider: 'stale-provider-result', model: 'stale-model', attemptNumber: 1, status: 'SUCCEEDED', durationMs: 1_000, startedAt: new Date(Date.now() - 1_000), completedAt: new Date(), inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }))).rejects.toThrow('no longer owned');
      expect(await prisma.schoolResearchAttempt.count({ where: { jobId: fixture.job.id } })).toBe(0);
    } finally {
      await cleanupTakeoverFixture(fixture);
    }
  });

  it('rejects stale progress mutation after takeover', async () => {
    const fixture = await createTakeoverFixture();
    try {
      await expect(withResearchJobOwner(fixture.job.id, fixture.ownerA.execution!.id, fixture.ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchJob.update({
        where: { id: fixture.job.id }, data: { aiCallCount: 99, sourceCount: 99 },
      }))).rejects.toThrow('no longer owned');
      const persistedJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: fixture.job.id } });
      expect(persistedJob.aiCallCount).toBe(0);
      expect(persistedJob.sourceCount).toBe(0);
      expect(persistedJob.currentOperationId).toBe(fixture.ownerB.execution!.id);
    } finally {
      await cleanupTakeoverFixture(fixture);
    }
  });

  it('rejects stale completion after takeover', async () => {
    const fixture = await createTakeoverFixture();
    try {
      await expect(withResearchJobOwner(fixture.job.id, fixture.ownerA.execution!.id, fixture.ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchJob.update({
        where: { id: fixture.job.id }, data: { status: 'COMPLETED', completedAt: new Date() },
      }))).rejects.toThrow('no longer owned');
      const persistedJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: fixture.job.id } });
      expect(persistedJob.status).toBe('RUNNING');
      expect(persistedJob.currentOperationId).toBe(fixture.ownerB.execution!.id);
    } finally {
      await cleanupTakeoverFixture(fixture);
    }
  });

  it('rejects stale failure after takeover', async () => {
    const fixture = await createTakeoverFixture();
    try {
      await expect(withResearchJobOwner(fixture.job.id, fixture.ownerA.execution!.id, fixture.ownerA.execution!.ownerToken!, (tx) => tx.schoolResearchJob.update({
        where: { id: fixture.job.id }, data: { status: 'FAILED', completedAt: new Date(), error: 'stale failure' },
      }))).rejects.toThrow('no longer owned');
      const persistedJob = await prisma.schoolResearchJob.findUniqueOrThrow({ where: { id: fixture.job.id } });
      expect(persistedJob.status).toBe('RUNNING');
      expect(persistedJob.error).toBeNull();
      expect(persistedJob.currentOperationId).toBe(fixture.ownerB.execution!.id);
    } finally {
      await cleanupTakeoverFixture(fixture);
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
