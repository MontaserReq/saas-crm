import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { DealService } from "@/server/services/DealService";
import { PipelineService } from "@/server/services/PipelineService";
import prisma from "@/lib/db/prisma";
import { DealsView } from "@/components/deals/DealsView";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; clientId?: string; create?: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.DEALS_VIEW)) return null;
  const organizationId = user.organizationId!;
  const params = await searchParams;
  const [deals, pipelines, members, initialClient] = await Promise.all([
    DealService.list(user, { search: params.search }),
    PipelineService.list(user),
    prisma.organizationMember.findMany({
      where: { organizationId, status: "ACTIVE", user: { isActive: true } },
      select: { user: { select: { id: true, name: true } } },
    }),
    params.clientId
      ? prisma.client.findFirst({
          where: { id: params.clientId, organizationId, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  return (
    <DealsView
      deals={deals.map((deal) => ({
        ...deal,
        value: deal.value?.toString() ?? null,
      }))}
      pipelines={pipelines}
      members={members.map((x) => x.user)}
      initialSearch={params.search || ""}
      canCreate={hasPermission(user, PERMISSIONS.DEALS_CREATE)}
      canUpdate={hasPermission(user, PERMISSIONS.DEALS_UPDATE)}
      currentUserId={user.id}
      initialClient={initialClient}
      openCreate={params.create === "1"}
    />
  );
}
