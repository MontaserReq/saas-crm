import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';

export type ResourceOperationType = 'AI_RESEARCH' | 'AI_ASSISTANT' | 'PROPOSAL_GENERATION' | 'SCHOOL_IMPORT';
export type OperationStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface ResourceLimits {
  global: number;
  organization: number;
  user: number;
  leaseMs: number;
}

export interface ResearchBudgetLimits {
  maxProviderRequests: number;
  maxSourceRequests: number;
  maxSourceRequestsPerSchool: number;
  maxRetries: number;
  maxTokens: number;
  maxDurationMs: number;
}

export interface ResearchBudgetConsumption {
  providerRequests?: number;
  sourceRequests?: number;
  retryAttempts?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const RESOURCE_LIMITS: Record<ResourceOperationType, ResourceLimits> = {
  AI_RESEARCH: {
    global: positiveInt(process.env.AI_RESEARCH_GLOBAL_CONCURRENCY, 2),
    organization: positiveInt(process.env.AI_RESEARCH_ORG_CONCURRENCY, 1),
    user: positiveInt(process.env.AI_RESEARCH_USER_CONCURRENCY, 1),
    leaseMs: positiveInt(process.env.AI_RESEARCH_LEASE_MS, 20 * 60 * 1000),
  },
  AI_ASSISTANT: {
    global: positiveInt(process.env.AI_ASSISTANT_GLOBAL_CONCURRENCY, 8),
    organization: positiveInt(process.env.AI_ASSISTANT_ORG_CONCURRENCY, 3),
    user: positiveInt(process.env.AI_ASSISTANT_USER_CONCURRENCY, 1),
    leaseMs: positiveInt(process.env.AI_ASSISTANT_LEASE_MS, 2 * 60 * 1000),
  },
  PROPOSAL_GENERATION: {
    global: positiveInt(process.env.PROPOSAL_GENERATION_GLOBAL_CONCURRENCY, 2),
    organization: positiveInt(process.env.PROPOSAL_GENERATION_ORG_CONCURRENCY, 1),
    user: positiveInt(process.env.PROPOSAL_GENERATION_USER_CONCURRENCY, 1),
    leaseMs: positiveInt(process.env.PROPOSAL_GENERATION_LEASE_MS, 10 * 60 * 1000),
  },
  SCHOOL_IMPORT: {
    global: positiveInt(process.env.SCHOOL_IMPORT_GLOBAL_CONCURRENCY, 4),
    organization: positiveInt(process.env.SCHOOL_IMPORT_ORG_CONCURRENCY, 1),
    user: positiveInt(process.env.SCHOOL_IMPORT_USER_CONCURRENCY, 1),
    leaseMs: positiveInt(process.env.SCHOOL_IMPORT_LEASE_MS, 30 * 60 * 1000),
  },
};

export interface AcquireOperationInput {
  organizationId: string;
  userId: string;
  operationType: ResourceOperationType;
  idempotencyKey: string;
  limits?: ResourceLimits;
  researchBudget?: ResearchBudgetLimits;
}

export class StaleOperationError extends Error {
  readonly code = 'STALE_OPERATION';

  constructor() {
    super('Operation lease is no longer owned by this executor');
    this.name = 'StaleOperationError';
  }
}

export class ResearchBudgetExceededError extends Error {
  readonly code = 'RESEARCH_BUDGET_EXCEEDED';

  constructor() {
    super('Research budget has been exhausted');
    this.name = 'ResearchBudgetExceededError';
  }
}

/**
 * Fences an executor using PostgreSQL's clock. The check is deliberately
 * performed in the database so an application clock cannot extend a lease
 * that PostgreSQL already considers expired.
 */
export async function assertOperationOwner(id: string, ownerToken: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "OperationExecution"
    WHERE "id" = ${id}
      AND "ownerToken" = ${ownerToken}
      AND "status" = 'RUNNING'
      AND "leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    LIMIT 1
  `;
  if (rows.length !== 1) throw new StaleOperationError();
}

export async function assertResearchJobOwner(jobId: string, operationId: string, ownerToken: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT job."id"
    FROM "SchoolResearchJob" AS job
    JOIN "OperationExecution" AS operation ON operation."id" = job."currentOperationId"
    WHERE job."id" = ${jobId}
      AND job."currentOperationId" = ${operationId}
      AND operation."ownerToken" = ${ownerToken}
      AND operation."status" = 'RUNNING'
      AND operation."leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    LIMIT 1
  `;
  if (rows.length !== 1) throw new StaleOperationError();
}

/**
 * Runs one authoritative mutation while fencing the operation row. The row
 * lock makes recovery/takeover serialize with the ownership check and the
 * mutation, so a stale executor cannot pass the check and then write after a
 * newer owner has taken over.
 */
export async function withOperationOwner<T>(
  id: string,
  ownerToken: string,
  mutation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "OperationExecution"
      WHERE "id" = ${id}
        AND "ownerToken" = ${ownerToken}
        AND "status" = 'RUNNING'
        AND "leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new StaleOperationError();
    return mutation(tx);
  });
}

export async function withResearchJobOwner<T>(
  jobId: string,
  operationId: string,
  ownerToken: string,
  mutation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT job."id"
      FROM "SchoolResearchJob" AS job
      JOIN "OperationExecution" AS operation ON operation."id" = job."currentOperationId"
      WHERE job."id" = ${jobId}
        AND job."currentOperationId" = ${operationId}
        AND operation."ownerToken" = ${ownerToken}
        AND operation."status" = 'RUNNING'
        AND operation."leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FOR UPDATE OF job, operation
    `;
    if (rows.length !== 1) throw new StaleOperationError();
    return mutation(tx);
  });
}

export async function acquireOperation(input: AcquireOperationInput) {
  const limits = input.limits ?? RESOURCE_LIMITS[input.operationType];
  const now = new Date();
  const ownerToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + limits.leaseMs);

  return prisma.$transaction(async (tx) => {
    // PostgreSQL advisory transaction locks make the limit check and insert
    // one atomic operation without merging state into the rate limiter.
    const scopes = [
      `resource:${input.operationType}:global`,
      `resource:${input.operationType}:org:${input.organizationId}`,
      `resource:${input.operationType}:user:${input.userId}`,
    ].sort();
    for (const scope of scopes) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
    }

    const existing = await tx.operationExecution.findFirst({
      where: {
        organizationId: input.organizationId,
        operationType: input.operationType,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (existing) {
      if (existing.status === 'RUNNING' && existing.leaseExpiresAt && existing.leaseExpiresAt > now) {
        return { acquired: false, reason: 'IN_PROGRESS' as const, execution: existing };
      }
      if (existing.status === 'SUCCEEDED' || existing.status === 'FAILED' || existing.status === 'CANCELLED') {
        return { acquired: false, reason: 'COMPLETED' as const, execution: existing };
      }
      const recovered = await tx.operationExecution.updateMany({
        where: {
          id: existing.id,
          OR: [
            { status: 'PENDING' },
            { status: 'RUNNING', leaseExpiresAt: { lt: now } },
            { status: 'EXPIRED' },
          ],
        },
        data: {
          status: 'RUNNING',
          ownerToken,
          leaseExpiresAt,
          startedAt: now,
          completedAt: null,
          failureReason: null,
          attemptCount: { increment: 1 },
          ...(input.researchBudget ? {
            researchMaxProviderRequests: input.researchBudget.maxProviderRequests,
            researchMaxSourceRequests: input.researchBudget.maxSourceRequests,
            researchMaxSourceRequestsPerSchool: input.researchBudget.maxSourceRequestsPerSchool,
            researchMaxRetries: input.researchBudget.maxRetries,
            researchMaxTokens: input.researchBudget.maxTokens,
            researchMaxDurationMs: input.researchBudget.maxDurationMs,
          } : {}),
        },
      });
      if (recovered.count !== 1) return { acquired: false, reason: 'IN_PROGRESS' as const, execution: existing };
      return { acquired: true, reason: 'ACQUIRED' as const, execution: await tx.operationExecution.findUniqueOrThrow({ where: { id: existing.id } }) };
    }

    const activeWhere = { operationType: input.operationType, status: 'RUNNING', leaseExpiresAt: { gt: now } } as const;
    const [globalActive, organizationActive, userActive] = await Promise.all([
      tx.operationExecution.count({ where: activeWhere }),
      tx.operationExecution.count({ where: { ...activeWhere, organizationId: input.organizationId } }),
      tx.operationExecution.count({ where: { ...activeWhere, userId: input.userId } }),
    ]);
    if (globalActive >= limits.global || organizationActive >= limits.organization || userActive >= limits.user) {
      return { acquired: false, reason: 'BUSY' as const, execution: null };
    }

    const execution = await tx.operationExecution.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        operationType: input.operationType,
        idempotencyKey: input.idempotencyKey,
        status: 'RUNNING',
        ownerToken,
        leaseExpiresAt,
        startedAt: now,
        attemptCount: 1,
        ...(input.researchBudget ? {
          researchMaxProviderRequests: input.researchBudget.maxProviderRequests,
          researchMaxSourceRequests: input.researchBudget.maxSourceRequests,
          researchMaxSourceRequestsPerSchool: input.researchBudget.maxSourceRequestsPerSchool,
          researchMaxRetries: input.researchBudget.maxRetries,
          researchMaxTokens: input.researchBudget.maxTokens,
          researchMaxDurationMs: input.researchBudget.maxDurationMs,
        } : {}),
      },
    });
    return { acquired: true, reason: 'ACQUIRED' as const, execution };
  });
}

/** Atomically consumes durable research budget while retaining operation authority. */
export async function consumeResearchBudget(
  jobId: string,
  operationId: string,
  ownerToken: string,
  consumption: ResearchBudgetConsumption,
) {
  const providerRequests = consumption.providerRequests ?? 0;
  const sourceRequests = consumption.sourceRequests ?? 0;
  const retryAttempts = consumption.retryAttempts ?? 0;
  const inputTokens = consumption.inputTokens ?? 0;
  const outputTokens = consumption.outputTokens ?? 0;
  const totalTokens = consumption.totalTokens ?? 0;
  const rows = await prisma.$executeRaw`
    UPDATE "OperationExecution"
    SET "researchProviderRequests" = "researchProviderRequests" + ${providerRequests},
        "researchSourceRequests" = "researchSourceRequests" + ${sourceRequests},
        "researchRetryAttempts" = "researchRetryAttempts" + ${retryAttempts},
        "researchInputTokens" = "researchInputTokens" + ${inputTokens},
        "researchOutputTokens" = "researchOutputTokens" + ${outputTokens},
        "researchTotalTokens" = "researchTotalTokens" + ${totalTokens},
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "id" = ${operationId}
      AND "ownerToken" = ${ownerToken}
      AND "status" = 'RUNNING'
      AND "leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      AND EXISTS (
        SELECT 1 FROM "SchoolResearchJob" AS job
        WHERE job."id" = ${jobId}
          AND job."currentOperationId" = "OperationExecution"."id"
          AND job."organizationId" = "OperationExecution"."organizationId"
      )
      AND ("researchMaxProviderRequests" IS NULL OR "researchProviderRequests" + ${providerRequests} <= "researchMaxProviderRequests")
      AND ("researchMaxSourceRequests" IS NULL OR "researchSourceRequests" + ${sourceRequests} <= "researchMaxSourceRequests")
      AND ("researchMaxRetries" IS NULL OR "researchRetryAttempts" + ${retryAttempts} <= "researchMaxRetries")
      AND ("researchMaxTokens" IS NULL OR "researchTotalTokens" + ${totalTokens} <= "researchMaxTokens")
      AND ("researchMaxDurationMs" IS NULL OR "startedAt" IS NULL OR "startedAt" + ("researchMaxDurationMs" * INTERVAL '1 millisecond') > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
  `;
  if (rows !== 1) {
    await assertResearchJobOwner(jobId, operationId, ownerToken);
    throw new ResearchBudgetExceededError();
  }
  return { count: rows };
}

export async function renewOperation(id: string, ownerToken: string, leaseMs: number) {
  const leaseExpiresAt = new Date(Date.now() + leaseMs);
  const count = await prisma.$executeRaw`
    UPDATE "OperationExecution"
    SET "leaseExpiresAt" = ${leaseExpiresAt}, "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "id" = ${id}
      AND "ownerToken" = ${ownerToken}
      AND "status" = 'RUNNING'
      AND "leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  `;
  return { count };
}

export async function finishOperation(
  id: string,
  ownerToken: string,
  status: Extract<OperationStatus, 'SUCCEEDED' | 'FAILED' | 'CANCELLED'>,
  details?: { resultPayload?: string; failureReason?: string },
) {
  const count = await prisma.$executeRaw`
    UPDATE "OperationExecution"
    SET "status" = ${status},
        "completedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        "leaseExpiresAt" = NULL,
        "ownerToken" = NULL,
        "resultPayload" = ${details?.resultPayload ?? null},
        "failureReason" = ${details?.failureReason ?? null},
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "id" = ${id}
      AND "ownerToken" = ${ownerToken}
      AND "status" = 'RUNNING'
      AND "leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  `;
  return { count };
}

export async function recoverExpiredOperations(operationType: ResourceOperationType, now = new Date()) {
  return prisma.operationExecution.updateMany({
    where: { operationType, status: 'RUNNING', leaseExpiresAt: { lt: now } },
    data: { status: 'EXPIRED', completedAt: now, ownerToken: null, failureReason: 'Execution lease expired' },
  });
}
