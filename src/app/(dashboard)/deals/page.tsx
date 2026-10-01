import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DealService } from '@/server/services/DealService';
import { PipelineService } from '@/server/services/PipelineService';
import prisma from '@/lib/db/prisma';
import { DealsView } from '@/components/deals/DealsView';

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.DEALS_VIEW)) return null;
  const organizationId = user.organizationId!;
  const [deals, pipelines, members] = await Promise.all([DealService.list(user, { search: (await searchParams).search }), PipelineService.list(user), prisma.organizationMember.findMany({ where: { organizationId, status: 'ACTIVE' }, select: { user: { select: { id: true, name: true } } } })]);
  return <DealsView deals={deals} pipelines={pipelines} members={members.map(x => x.user)} initialSearch={(await searchParams).search || ''} />;
}
