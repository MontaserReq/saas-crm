import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ComingSoonPanel } from '@/components/ai-school-research/ComingSoonPanel';
import { JobDetailView } from '@/components/ai-school-research/JobDetailView';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';
import { getAiResearchPlatformSettings } from '@/lib/ai/researchSettings';
import { notFound } from 'next/navigation';

export default async function ResearchJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;
  const settings = await getAiResearchPlatformSettings();
  if (settings.status === 'OFF') return <ComingSoonPanel status={settings.status} />;

  const query = await searchParams;
  const activeStatus = query.status || 'ALL';
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  try {
    const result = await SchoolResearchService.listCandidates(user, (await params).jobId, {
      status: activeStatus,
      page,
    });
    const serialized = JSON.parse(JSON.stringify(result));
    return (
      <JobDetailView
        job={serialized.job}
        candidates={serialized.data}
        total={serialized.total}
        page={serialized.page}
        totalPages={serialized.totalPages}
        summary={serialized.summary}
        activeStatus={activeStatus}
        canApprove={hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE) && hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)}
        canReject={hasPermission(user, PERMISSIONS.AI_RESEARCH_REJECT)}
      />
    );
  } catch {
    notFound();
  }
}
