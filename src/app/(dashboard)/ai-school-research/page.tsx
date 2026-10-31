import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ComingSoonPanel } from '@/components/ai-school-research/ComingSoonPanel';
import { AiResearchHomeView } from '@/components/ai-school-research/AiResearchHomeView';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';
import { getAiResearchPlatformSettings } from '@/lib/ai/researchSettings';

export default async function AiSchoolResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;
  const query = await searchParams;
  const settings = await getAiResearchPlatformSettings();
  if (settings.status === 'OFF') return <ComingSoonPanel status={settings.status} />;

  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const result = await SchoolResearchService.listJobs(user, page);
  const isConfigured = Boolean(settings.geminiApiKey || settings.groqApiKey);
  return (
    <AiResearchHomeView
      jobs={result.data.map((job) => ({
        id: job.id,
        location: job.location,
        area: job.area,
        status: job.status,
        requestedCount: job.requestedCount,
        createdAt: job.createdAt.toISOString(),
        createdBy: job.createdBy,
        _count: job._count,
      }))}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      canCreate={isConfigured && hasPermission(user, PERMISSIONS.AI_RESEARCH_CREATE) && hasPermission(user, PERMISSIONS.AI_RESEARCH_RUN)}
      isConfigured={isConfigured}
      maxSchoolsPerJob={Math.max(1, Number(process.env.AI_RESEARCH_MAX_SCHOOLS || 100))}
      status={settings.status}
    />
  );
}
