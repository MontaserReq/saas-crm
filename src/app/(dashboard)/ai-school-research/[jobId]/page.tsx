import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ComingSoonPanel } from '@/components/ai-school-research/ComingSoonPanel';

export default async function ResearchJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;

  return <ComingSoonPanel />;
}
