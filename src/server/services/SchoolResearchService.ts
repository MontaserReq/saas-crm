import prisma from '@/lib/db/prisma';
import { UserSession, PaginatedResult } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { schoolResearchJobSchema } from '@/lib/validation';
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';
import { getAiProvider, getAiResearchConfig, AiNotConfiguredError, AiExtractionError, SchoolExtractionItem } from '@/lib/ai';
import { ResearchUsage, JobUsageSummary } from '@/lib/ai/usage';
import { normalizeSchoolName, normalizeResearchPhone, normalizeResearchEmail, extractWebsiteDomain } from '@/lib/ai-school-research/normalize';
import { computeConfidence, determineInitialCandidateStatus } from '@/lib/ai-school-research/confidence';
import { isLikelyDuplicate } from '@/lib/ai-school-research/duplicate';
import { isValidJobTransition, ResearchJobStatus } from '@/lib/ai-school-research/stateMachine';
import { requireOrganizationId, requireOrganizationIdForUserId, requireOrganizationIdValue } from '@/lib/auth/organization';
import { acquireOperation, assertOperationOwner, finishOperation, RESOURCE_LIMITS, StaleOperationError, withOperationOwner } from '@/lib/security/resourceGuard';

const STALE_RUNNING_JOB_MS = 15 * 60 * 1000; // 15 minutes
const MAX_EXTRACTION_ROUNDS = 3;

export interface CreateResearchJobInput {
  location: string;
  area?: string | null;
  schoolType?: string | null;
  requestedCount: number;
  requiredFields: string[];
}

export class SchoolResearchService {
  private static async organizationForActor(actorId: string): Promise<string> { return requireOrganizationIdForUserId(actorId); }
  /**
   * A user with ai_research.approve (admin-tier) can see every job, matching
   * the existing pattern where a broader permission implies broader
   * oversight (see canAccessTicket's TICKETS_VIEW_ALL override). There is no
   * separate ai_research.view_all permission to avoid inventing scope beyond
   * what was approved.
   */
  private static canViewAllJobs(user: UserSession): boolean {
    return hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE);
  }

  static async createJob(input: CreateResearchJobInput, actorId: string) {
    await this.recoverStaleExecutions();
    const validated = schoolResearchJobSchema.parse({ mode: 'FIND_NEW', ...input });
    const config = getAiResearchConfig();

    const requestedCount = Math.min(validated.requestedCount, config.maxSchoolsPerJob);
    const organizationId = await this.organizationForActor(actorId);

    const job = await prisma.schoolResearchJob.create({
      data: {
        createdById: actorId,
        organizationId,
        mode: validated.mode,
        location: validated.location,
        area: validated.area || null,
        schoolType: validated.schoolType || null,
        requestedCount,
        requiredFields: JSON.stringify(validated.requiredFields),
      },
    });

    await AuditService.logAudit({
      actorId,
      action: 'AI_RESEARCH_JOB_CREATED',
      entityType: 'SchoolResearchJob',
      entityId: job.id,
      metadata: { location: job.location, area: job.area, requestedCount: job.requestedCount },
    });

    // Preserve the existing asynchronous API, but execution ownership is now
    // durable in PostgreSQL. The job row and operation lease are the source of
    // truth; a process restart cannot silently authorize a second executor.
    void this.runJob(job.id).catch((err) => {
      console.error(`AI School Research job ${job.id} crashed unexpectedly:`, err);
    });

    return job;
  }

  static async runJob(jobId: string) {
    const job = await prisma.schoolResearchJob.findUnique({ where: { id: jobId } });
    if (!job || !isValidJobTransition(job.status as ResearchJobStatus, 'RUNNING')) return;

    const organizationId = requireOrganizationIdValue(job.organizationId);
    const execution = await acquireOperation({
      organizationId,
      userId: job.createdById,
      operationType: 'AI_RESEARCH',
      idempotencyKey: job.id,
      limits: RESOURCE_LIMITS.AI_RESEARCH,
    });
    if (!execution.acquired || !execution.execution) {
      if (execution.reason !== 'BUSY') return;
      const message = execution.reason === 'BUSY'
        ? 'Research concurrency limit reached. Please try again shortly.'
        : 'Research execution is already in progress or has completed.';
      await prisma.schoolResearchJob.updateMany({
        where: { id: jobId, status: 'PENDING' },
        data: { status: 'FAILED', completedAt: new Date(), error: message },
      });
      return;
    }

    const ownerToken = execution.execution.ownerToken!;
    await this.claimResearchJobStartup(jobId, execution.execution.id, ownerToken);
    await AuditService.logAudit({ actorId: job.createdById, action: 'AI_RESEARCH_JOB_STARTED', entityType: 'SchoolResearchJob', entityId: jobId });

    const requiredFields: string[] = JSON.parse(job.requiredFields || '[]');

    // Usage tracking: install the onAttempt callback.
    // Each callback invocation is fire-and-forget: a DB logging failure must
    // never cause a successful research result to be discarded.
    const onAttempt = (usage: ResearchUsage) => {
      void withOperationOwner(execution.execution!.id, ownerToken, (tx) => tx.schoolResearchAttempt.create({
          data: {
            jobId,
            provider: usage.provider,
            model: usage.model,
            attemptNumber: usage.attemptNumber,
            status: usage.status,
            httpStatus: usage.httpStatus ?? null,
            durationMs: usage.durationMs,
            startedAt: usage.startedAt,
            completedAt: usage.completedAt,
            inputTokens: usage.inputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            totalTokens: usage.totalTokens ?? null,
            webSearches: usage.webSearches,
            executedTools: usage.executedTools ? JSON.stringify(usage.executedTools) : null,
            isRetry: usage.retry,
            isFallback: usage.fallback,
            errorCode: usage.errorCode ?? null,
            errorMessage: usage.errorMessage ?? null,
          },
        }))
        .catch((err) => {
          if (!(err instanceof StaleOperationError)) {
            console.warn(`[SchoolResearchService] usage tracking write failed for job ${jobId}:`, err?.message ?? err);
          }
        });
    };

    const provider = getAiProvider(onAttempt);
    let aiCallCount = 0;
    let sourceCount = 0;
    const collected: SchoolExtractionItem[] = [];

    try {
      for (let round = 0; round < MAX_EXTRACTION_ROUNDS && collected.length < job.requestedCount; round++) {
        try {
          const result = await provider.extractSchools({
            location: job.location,
            area: job.area,
            schoolType: job.schoolType,
            requestedCount: job.requestedCount - collected.length,
            requiredFields,
            excludeNames: collected.map((item) => item.name),
          });
          await assertOperationOwner(execution.execution.id, ownerToken);
          aiCallCount++;
          if (!result.schools.length) break;
          collected.push(...result.schools);
        } catch (err) {
          if (round === 0) throw err; // first-round failure fails the whole job
          break; // a later round failing still keeps whatever was already found (section 52)
        }
      }

      const existingSchools = await prisma.school.findMany({
        where: { organizationId: requireOrganizationIdValue(job.organizationId), isDeleted: false },
        select: { id: true, name: true, city: true, phone: true },
      });

      const createdInThisJob: { id: string; name: string; city: string | null; phone: string | null; website: string | null }[] = [];

      for (const raw of collected.slice(0, job.requestedCount)) {
        await assertOperationOwner(execution.execution.id, ownerToken);
        const name = raw.name.trim();
        if (!name) continue;
        const normalizedName = normalizeSchoolName(name);
        const phone = raw.phone ? normalizeResearchPhone(raw.phone) : '';
        const email = normalizeResearchEmail(raw.email);
        const website = raw.website?.trim() || null;
        const city = raw.city?.trim() || null;
        const area = raw.area?.trim() || null;
        const address = raw.address?.trim() || null;
        const contactPerson = raw.contactPerson?.trim() || null;
        const schoolType = raw.schoolType?.trim() || null;
        const evidence = raw.evidence || [];
        sourceCount += evidence.length;

        const matchedSchool = existingSchools.find((school) =>
          isLikelyDuplicate({ name, city, phone, website: null }, { name: school.name, city: school.city, phone: school.phone, website: null })
        );
        const matchedCandidate = createdInThisJob.find((candidate) =>
          isLikelyDuplicate({ name, city, phone, website }, { name: candidate.name, city: candidate.city, phone: candidate.phone, website: candidate.website })
        );

        const hostSet = new Set(evidence.map((e) => (e.sourceUrl ? extractWebsiteDomain(e.sourceUrl) : null)).filter(Boolean));
        const hasOfficialWebsiteSource = evidence.some((e) => /official website/i.test(e.source));
        const confidence = computeConfidence({
          hasWebsite: Boolean(website),
          hasPhone: Boolean(phone && phone.length > 5),
          hasEmail: Boolean(email),
          hasAddress: Boolean(address),
          hasOfficialWebsiteSource,
          distinctSourceHostCount: hostSet.size,
        });

        let status: 'NEW' | 'NEEDS_REVIEW' | 'DUPLICATE' = determineInitialCandidateStatus({
          hasCity: Boolean(city),
          hasAnyContactMethod: Boolean((phone && phone.length > 5) || email || website),
          hasEvidence: evidence.length > 0,
        });
        if (matchedSchool || matchedCandidate) status = 'DUPLICATE';

        const candidate = await withOperationOwner(execution.execution.id, ownerToken, (tx) => tx.schoolResearchCandidate.create({
          data: {
            researchJobId: jobId,
            name,
            normalizedName,
            city,
            area,
            phone: phone || null,
            email,
            website,
            address,
            contactPerson,
            schoolType,
            confidence,
            status,
            matchedSchoolId: matchedSchool?.id || null,
            sources: {
              create: evidence.map((e) => ({
                field: e.field,
                sourceType: /official website/i.test(e.source) ? 'OFFICIAL_WEBSITE' : 'SEARCH_GROUNDING',
                sourceUrl: e.sourceUrl || null,
              })),
            },
          },
        }));

        createdInThisJob.push({ id: candidate.id, name, city, phone: phone || null, website });
      }

      await assertOperationOwner(execution.execution.id, ownerToken);
      await withOperationOwner(execution.execution.id, ownerToken, (tx) => tx.schoolResearchJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date(), aiCallCount, sourceCount },
      }));

      const counts = await prisma.schoolResearchCandidate.groupBy({ by: ['status'], where: { researchJobId: jobId }, _count: true });
      const summary = Object.fromEntries(counts.map((c) => [c.status, c._count]));

      await AuditService.logAudit({ actorId: job.createdById, action: 'AI_RESEARCH_JOB_COMPLETED', entityType: 'SchoolResearchJob', entityId: jobId, metadata: { found: createdInThisJob.length, ...summary } });
      await NotificationService.create({
        userId: job.createdById,
        type: 'AI_RESEARCH_JOB_COMPLETED',
        title: 'AI School Research completed',
        message: `${createdInThisJob.length} schools found for ${job.location}${job.area ? ` / ${job.area}` : ''}.`,
        entityType: 'schoolResearchJob',
        entityId: jobId,
      });
      await finishOperation(execution.execution.id, ownerToken, 'SUCCEEDED', { resultPayload: JSON.stringify({ candidateCount: createdInThisJob.length }) });
    } catch (err: any) {
      if (err instanceof StaleOperationError) return;
      const message = err instanceof AiNotConfiguredError
        ? err.message
        : err instanceof AiExtractionError
          ? `AI extraction failed: ${err.message}`
          : 'Research could not be completed. Please try again.';

      try {
        await assertOperationOwner(execution.execution.id, ownerToken);
        await withOperationOwner(execution.execution.id, ownerToken, (tx) => tx.schoolResearchJob.update({ where: { id: jobId }, data: { status: 'FAILED', completedAt: new Date(), error: message, aiCallCount } }));
      } catch (ownershipError) {
        if (ownershipError instanceof StaleOperationError) return;
        throw ownershipError;
      }
      await AuditService.logAudit({ actorId: job.createdById, action: 'AI_RESEARCH_JOB_FAILED', entityType: 'SchoolResearchJob', entityId: jobId, metadata: { error: message } });
      await NotificationService.create({
        userId: job.createdById,
        type: 'AI_RESEARCH_JOB_FAILED',
        title: 'AI School Research failed',
        message,
        entityType: 'schoolResearchJob',
        entityId: jobId,
      });
      await finishOperation(execution.execution.id, ownerToken, 'FAILED', { failureReason: message });
    }
  }

  /** Atomically claims the pending job while verifying the current operation owner. */
  static async claimResearchJobStartup(jobId: string, operationId: string, ownerToken: string): Promise<void> {
    const count = await prisma.$executeRaw`
      UPDATE "SchoolResearchJob" AS job
      SET "status" = 'RUNNING', "startedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      WHERE job."id" = ${jobId}
        AND job."status" = 'PENDING'
        AND EXISTS (
          SELECT 1
          FROM "OperationExecution" AS operation
          WHERE operation."id" = ${operationId}
            AND operation."organizationId" = job."organizationId"
            AND operation."status" = 'RUNNING'
            AND operation."ownerToken" = ${ownerToken}
            AND operation."leaseExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        )
    `;
    if (count !== 1) throw new StaleOperationError();
  }

  /** Recover expired execution leases without requiring a user to open a job. */
  static async recoverStaleExecutions() {
    const now = new Date();
    const expired = await prisma.operationExecution.findMany({
      where: { operationType: 'AI_RESEARCH', status: 'RUNNING', leaseExpiresAt: { lt: now } },
      select: { id: true, idempotencyKey: true },
    });
    let recoveredJobs = 0;
    for (const operation of expired) {
      const claimed = await prisma.operationExecution.updateMany({
        where: { id: operation.id, status: 'RUNNING', leaseExpiresAt: { lt: now } },
        data: { status: 'EXPIRED', completedAt: now, ownerToken: null, failureReason: 'Execution lease expired' },
      });
      if (claimed.count !== 1 || !operation.idempotencyKey) continue;
      const job = await prisma.schoolResearchJob.updateMany({
        where: { id: operation.idempotencyKey, status: 'RUNNING' },
        data: { status: 'PENDING', startedAt: null, completedAt: null, error: null },
      });
      recoveredJobs += job.count;
    }
    return recoveredJobs;
  }

  /** Self-heals a job stuck in RUNNING (e.g. the app container restarted mid-job). */
  private static async reconcileStaleJob(job: { id: string; status: string; startedAt: Date | null }) {
    if (job.status !== 'RUNNING' || !job.startedAt) return job;
    if (Date.now() - job.startedAt.getTime() < STALE_RUNNING_JOB_MS) return job;
    return prisma.schoolResearchJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', completedAt: new Date(), error: 'Research job did not complete (the server may have restarted). Please start a new job.' },
    });
  }

  static async getJobForUser(user: UserSession, jobId: string) {
    const job = await prisma.schoolResearchJob.findFirst({
        where: { id: jobId, organizationId: requireOrganizationId(user) },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!job) return null;
    if (job.createdById !== user.id && !this.canViewAllJobs(user)) return null;
    return this.reconcileStaleJob(job);
  }

  static async listJobs(user: UserSession, page = 1, pageSize = 15) {
    const where: any = { organizationId: requireOrganizationId(user) };
    if (!this.canViewAllJobs(user)) where.createdById = user.id;
    const skip = (page - 1) * pageSize;
    const [total, data] = await Promise.all([
      prisma.schoolResearchJob.count({ where }),
      prisma.schoolResearchJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } }, _count: { select: { candidates: true } } },
      }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } satisfies PaginatedResult<any>;
  }

  static async listCandidates(user: UserSession, jobId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const job = await this.getJobForUser(user, jobId);
    if (!job) throw new Error('Research job not found');

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const where: any = { researchJobId: jobId };
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;

    const [total, data, statusCounts] = await Promise.all([
      prisma.schoolResearchCandidate.count({ where }),
      prisma.schoolResearchCandidate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
        include: {
          matchedSchool: { select: { id: true, name: true, city: true } },
          sources: { take: 1, orderBy: { collectedAt: 'asc' } },
        },
      }),
      prisma.schoolResearchCandidate.groupBy({ by: ['status'], where: { researchJobId: jobId }, _count: true }),
    ]);

    return {
      job,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: Object.fromEntries(statusCounts.map((c) => [c.status, c._count])),
    };
  }

  static async getCandidateDetail(user: UserSession, candidateId: string) {
    const candidate = await prisma.schoolResearchCandidate.findFirst({
        where: { id: candidateId, researchJob: { organizationId: requireOrganizationId(user) } },
      include: {
        sources: true,
        matchedSchool: { select: { id: true, name: true, city: true, phone: true, email: true } },
        researchJob: { select: { id: true, createdById: true, location: true, area: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });
    if (!candidate) return null;
    if (candidate.researchJob.createdById !== user.id && !this.canViewAllJobs(user)) return null;
    return candidate;
  }

  // ---------------------------------------------------------------------------
  // Usage Tracking Methods
  // ---------------------------------------------------------------------------

  /**
   * Returns raw per-attempt rows for a job. The job ownership check is the
   * caller's responsibility (see getJobForUser).
   */
  static async getJobAttempts(jobId: string, organizationId: string) {
    return prisma.schoolResearchAttempt.findMany({
      where: { jobId, job: { organizationId } },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  /**
   * Aggregates all SchoolResearchAttempt rows for a job into a JobUsageSummary.
   * Returns null if no attempts have been recorded yet.
   */
  static async getJobUsageSummary(jobId: string, organizationId: string): Promise<JobUsageSummary | null> {
    const attempts = await prisma.schoolResearchAttempt.findMany({
      where: { jobId, job: { organizationId } },
      select: {
        provider: true,
        status: true,
        httpStatus: true,
        durationMs: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        webSearches: true,
        isRetry: true,
        isFallback: true,
      },
    });

    if (attempts.length === 0) return null;

    let groqRequests = 0;
    let geminiRequests = 0;
    let retryCount = 0;
    let fallbackCount = 0;
    let totalWebSearches = 0;
    let rateLimitErrors = 0;
    let otherErrors = 0;
    let sumInputTokens = 0;
    let sumOutputTokens = 0;
    let sumTotalTokens = 0;
    let hasTokenData = false;
    let sumDurationMs = 0;
    let minDurationMs = Infinity;
    let maxDurationMs = -Infinity;

    for (const a of attempts) {
      if (a.provider === 'groq') groqRequests++;
      else if (a.provider === 'gemini') geminiRequests++;

      if (a.isRetry) retryCount++;
      if (a.isFallback) fallbackCount++;

      totalWebSearches += a.webSearches;

      if (a.status === 'RATE_LIMITED' || a.httpStatus === 429) {
        rateLimitErrors++;
      } else if (a.status === 'FAILED') {
        otherErrors++;
      }

      // Only count tokens from successful attempts
      if (a.status === 'SUCCESS') {
        if (a.inputTokens !== null) { sumInputTokens += a.inputTokens; hasTokenData = true; }
        if (a.outputTokens !== null) { sumOutputTokens += a.outputTokens; hasTokenData = true; }
        if (a.totalTokens !== null) { sumTotalTokens += a.totalTokens; hasTokenData = true; }
      }

      sumDurationMs += a.durationMs;
      if (a.durationMs < minDurationMs) minDurationMs = a.durationMs;
      if (a.durationMs > maxDurationMs) maxDurationMs = a.durationMs;
    }

    return {
      totalApiRequests: attempts.length,
      totalWebSearches,
      groqRequests,
      geminiRequests,
      retryCount,
      fallbackCount,
      inputTokens: hasTokenData ? sumInputTokens : null,
      outputTokens: hasTokenData ? sumOutputTokens : null,
      totalTokens: hasTokenData ? sumTotalTokens : null,
      rateLimitErrors,
      otherErrors,
      avgDurationMs: attempts.length > 0 ? Math.round(sumDurationMs / attempts.length) : null,
      minDurationMs: minDurationMs !== Infinity ? minDurationMs : null,
      maxDurationMs: maxDurationMs !== -Infinity ? maxDurationMs : null,
    };
  }
}
