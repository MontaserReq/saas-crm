import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';
import { JobDetailView } from '@/components/ai-school-research/JobDetailView';
import { notFound } from 'next/navigation';

export default async function ResearchJobDetailPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams: { [key: string]: string | undefined };
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;

  const status = searchParams.status || 'ALL';
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  let result;
  try {
    result = await SchoolResearchService.listCandidates(user, params.jobId, { status, page });
  } catch {
    notFound();
  }

  return (
    <JobDetailView
      job={result.job as any}
      candidates={result.data as any}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      summary={result.summary as Record<string, number>}
      activeStatus={status}
      canApprove={hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE) && hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)}
      canReject={hasPermission(user, PERMISSIONS.AI_RESEARCH_REJECT)}
    />
  );
}
