'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';
import { requireOrganizationId } from '@/lib/auth/organization';
import { LeadDiscoveryService } from '@/server/services/LeadDiscoveryService';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({ prompt: z.string().trim().min(5).max(4000), requestedCount: z.number().int().min(1).max(100), country: z.string().trim().max(120).nullable().optional(), city: z.string().trim().max(120).nullable().optional(), industry: z.string().trim().max(200).nullable().optional(), requiredFields: z.array(z.string().max(80)).max(20).optional() }).strict();

function allowed(user: Awaited<ReturnType<typeof requireAuth>>, permission: string) {
  if (!hasPlanFeature(user, 'ai_research') || !hasPermission(user, permission)) throw new Error('Forbidden');
}

export async function createLeadDiscoveryJobAction(raw: unknown) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.AI_RESEARCH_CREATE);
    const input = inputSchema.parse(raw);
    const policy = RATE_LIMIT_POLICY_CONFIG.ai_research;
    const limited = await checkRateLimit({ policy: 'ai_research', identity: `lead-discovery:${user.id}:${requireOrganizationId(user)}`, ...policy });
    if (!limited.allowed) return { success: false as const, error: 'Discovery is temporarily rate limited. Please try again shortly.' };
    const job = await LeadDiscoveryService.createJob(user, input);
    revalidatePath('/lead-discovery');
    return { success: true as const, job: { id: job.id, status: job.status, stage: job.stage } };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to start discovery' }; }
}

export async function listLeadDiscoveryJobsAction() {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.AI_RESEARCH_VIEW); return { success: true as const, jobs: await LeadDiscoveryService.listJobs(user) }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to load discovery jobs' }; }
}

export async function getLeadDiscoveryJobAction(jobId: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.AI_RESEARCH_VIEW); const job = await LeadDiscoveryService.getJob(user, z.string().min(1).max(100).parse(jobId)); return job ? { success: true as const, job } : { success: false as const, error: 'Discovery job not found' }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to load discovery job' }; }
}

export async function importLeadDiscoveryResultsAction(jobId: string, resultIds: string[]) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.AI_RESEARCH_APPROVE); const ids = z.array(z.string().min(1).max(100)).min(1).max(100).parse(resultIds); const imported = await LeadDiscoveryService.importResults(user, z.string().min(1).max(100).parse(jobId), ids); revalidatePath('/lead-discovery'); revalidatePath('/leads'); return { success: true as const, imported }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to import selected leads' }; }
}

export async function cancelLeadDiscoveryJobAction(jobId: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.AI_RESEARCH_CREATE); const result = await LeadDiscoveryService.cancelJob(user, z.string().min(1).max(100).parse(jobId)); revalidatePath('/lead-discovery'); return result; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to cancel discovery' }; }
}

export async function retryLeadDiscoveryJobAction(jobId: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.AI_RESEARCH_CREATE); const job = await LeadDiscoveryService.retryJob(user, z.string().min(1).max(100).parse(jobId)); revalidatePath('/lead-discovery'); return { success: true as const, job: { id: job.id, status: job.status, stage: job.stage } }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Unable to retry discovery' }; }
}
