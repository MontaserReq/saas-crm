import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { redirect } from 'next/navigation';
import { LeadDiscoveryService } from '@/server/services/LeadDiscoveryService';
import { LeadDiscoveryView } from '@/components/lead-discovery/LeadDiscoveryView';

export default async function LeadDiscoveryPage() {
  const user = await getCurrentUser();
  if (!user || !hasPlanFeature(user, 'ai_research') || !hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) redirect('/dashboard');
  const jobs = await LeadDiscoveryService.listJobs(user);
  return <LeadDiscoveryView language="en" canImport={hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE)} initialJobs={jobs.map((job) => ({ id: job.id, prompt: job.prompt, status: job.status, stage: job.stage, requestedCount: job.requestedCount, createdAt: job.createdAt.toISOString(), _count: job._count }))} />;
}
