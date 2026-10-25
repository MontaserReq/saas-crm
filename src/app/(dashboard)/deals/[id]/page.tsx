import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { DealService } from "@/server/services/DealService";
import { DealDetailView } from "@/components/deals/DealDetailView";
import { CrmWorkspaceService } from "@/server/services/CrmWorkspaceService";
import { LocalizedText } from "@/components/ui/LocalizedText";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.DEALS_VIEW)) return null;
  const id = (await params).id;
  const [deal, timeline] = await Promise.all([
    DealService.get(user, id),
    CrmWorkspaceService.timeline(user, "Deal", id),
  ]);
  if (!deal)
    return (
      <main className="p-6">
        <LocalizedText en="Deal not found" ar="الصفقة غير موجودة" />
      </main>
    );
  return (
    <DealDetailView
      deal={{ ...deal, value: deal.value?.toString() ?? null }}
      timeline={timeline.events}
      canUpdate={hasPermission(user, PERMISSIONS.DEALS_UPDATE)}
      canDelete={hasPermission(user, PERMISSIONS.DEALS_DELETE)}
    />
  );
}
