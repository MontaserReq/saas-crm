import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';
import { getAiResearchConfig } from '@/lib/ai';
import { AiResearchHomeView } from '@/components/ai-school-research/AiResearchHomeView';

export default async function AiSchoolResearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const [result, config] = await Promise.all([
    SchoolResearchService.listJobs(user, page),
    Promise.resolve(getAiResearchConfig()),
  ]);

  return (
    <AiResearchHomeView
      jobs={result.data}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      canCreate={hasPermission(user, PERMISSIONS.AI_RESEARCH_CREATE) && hasPermission(user, PERMISSIONS.AI_RESEARCH_RUN)}
      isConfigured={Boolean(config.geminiApiKey)}
      maxSchoolsPerJob={config.maxSchoolsPerJob}
    />
  );
}
