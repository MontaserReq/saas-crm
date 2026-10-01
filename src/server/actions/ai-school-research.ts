'use server';

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolResearchService, CreateResearchJobInput } from '@/server/services/SchoolResearchService';
import { SchoolResearchCandidateService } from '@/server/services/SchoolResearchCandidateService';
import { schoolResearchCandidateRejectSchema, schoolResearchCandidateBulkApproveSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { requireOrganizationId } from '@/lib/auth/organization';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';

export async function createResearchJobAction(input: CreateResearchJobInput) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_CREATE) || !hasPermission(user, PERMISSIONS.AI_RESEARCH_RUN)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to run AI School Research' };
    }
    const policy = RATE_LIMIT_POLICY_CONFIG.ai_research;
    const [userLimit, organizationLimit] = await Promise.all([
      checkRateLimit({ policy: 'ai_research', identity: `ai-research-user:${user.id}`, ...policy }),
      checkRateLimit({ policy: 'ai_research', identity: `ai-research-org:${requireOrganizationId(user)}`, ...policy }),
    ]);
    if (!userLimit.allowed || !organizationLimit.allowed) {
      return { success: false, error: 'Research is temporarily unavailable. Please try again shortly.' };
    }
    const job = await SchoolResearchService.createJob(input, user.id);
    revalidatePath('/ai-school-research');
    return { success: true, job };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to start research. Please try again.' };
  }
}

export async function getResearchJobAction(jobId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const job = await SchoolResearchService.getJobForUser(user, jobId);
    if (!job) return { success: false, error: 'Research job not found' };
    return { success: true, job };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load research job' };
  }
}

export async function listResearchJobsAction(page = 1) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const result = await SchoolResearchService.listJobs(user, page);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load research jobs' };
  }
}

export async function listResearchCandidatesAction(jobId: string, filters: { status?: string; page?: number } = {}) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const result = await SchoolResearchService.listCandidates(user, jobId, filters);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load research results' };
  }
}

export async function getCandidateDetailAction(candidateId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const candidate = await SchoolResearchService.getCandidateDetail(user, candidateId);
    if (!candidate) return { success: false, error: 'Candidate not found' };
    return { success: true, candidate };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load candidate' };
  }
}

export async function approveCandidateAction(candidateId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to approve candidates' };
    }
    // Approving a candidate creates an official School record — the caller
    // must also hold schools.create; ai_research.approve alone is not enough.
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)) {
      return { success: false, error: 'Forbidden: Missing schools.create permission required to add to the School Registry' };
    }
    const candidate = await SchoolResearchService.getCandidateDetail(user, candidateId);
    if (!candidate) return { success: false, error: 'Candidate not found' };

    const school = await SchoolResearchCandidateService.approve(candidateId, user.id);
    revalidatePath('/ai-school-research');
    revalidatePath('/schools');
    return { success: true, school };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve candidate' };
  }
}

export async function bulkApproveCandidatesAction(candidateIds: string[]) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE) || !hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to approve candidates' };
    }
    const validated = schoolResearchCandidateBulkApproveSchema.parse({ candidateIds });

    // Verify access to every candidate's parent job before mutating any of them.
    for (const id of validated.candidateIds) {
      const candidate = await SchoolResearchService.getCandidateDetail(user, id);
      if (!candidate) return { success: false, error: `Candidate ${id} not found or not accessible` };
    }

    const results = await SchoolResearchCandidateService.bulkApprove(validated.candidateIds, user.id);
    revalidatePath('/ai-school-research');
    revalidatePath('/schools');
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bulk approval failed' };
  }
}

export async function rejectCandidateAction(candidateId: string, reason?: string | null) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_REJECT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to reject candidates' };
    }
    const validated = schoolResearchCandidateRejectSchema.parse({ candidateId, reason });
    const candidate = await SchoolResearchService.getCandidateDetail(user, validated.candidateId);
    if (!candidate) return { success: false, error: 'Candidate not found' };

    const updated = await SchoolResearchCandidateService.reject(validated.candidateId, user.id, validated.reason);
    revalidatePath('/ai-school-research');
    return { success: true, candidate: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject candidate' };
  }
}

export async function keepCandidateSeparateAction(candidateId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_REJECT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const candidate = await SchoolResearchService.getCandidateDetail(user, candidateId);
    if (!candidate) return { success: false, error: 'Candidate not found' };

    const updated = await SchoolResearchCandidateService.keepAsSeparate(candidateId, user.id);
    revalidatePath('/ai-school-research');
    return { success: true, candidate: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update candidate' };
  }
}

export async function getJobUsageAction(jobId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const job = await SchoolResearchService.getJobForUser(user, jobId);
    if (!job) return { success: false, error: 'Research job not found' };

    const summary = await SchoolResearchService.getJobUsageSummary(jobId, requireOrganizationId(user));
    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load usage summary' };
  }
}

export async function getJobAttemptsAction(jobId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return { success: false, error: 'Forbidden' };
    const job = await SchoolResearchService.getJobForUser(user, jobId);
    if (!job) return { success: false, error: 'Research job not found' };

    const attempts = await SchoolResearchService.getJobAttempts(jobId, requireOrganizationId(user));
    return { success: true, attempts };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to load research attempts' };
  }
}
