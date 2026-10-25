import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ClientService } from "@/server/services/ClientService";
import { CrmWorkspaceService } from "@/server/services/CrmWorkspaceService";
import { Client360View } from "@/components/crm/Client360View";
import { CustomFieldService } from "@/server/services/CustomFieldService";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { OrganizationConfigService } from "@/server/services/OrganizationConfigService";
import { LocalizedText } from "@/components/ui/LocalizedText";
export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "clients") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const id = (await params).id;
  const [client, timeline, customFields, config] = await Promise.all([
    ClientService.get(user, id),
    CrmWorkspaceService.timeline(user, "Client", id),
    hasPlanFeature(user, "custom_fields")
      ? CustomFieldService.getEntityValues(user, "CLIENT", id)
      : Promise.resolve([]),
    OrganizationConfigService.get(user),
  ]);
  if (!client)
    return (
      <main className="p-6">
        <LocalizedText en="Customer not found" ar="العميل غير موجود" />
      </main>
    );
  return (
    <Client360View
      client={client}
      timeline={timeline.events}
      customFields={customFields}
      clientTypes={config.settings.clientTypes}
      canUpdate={hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE)}
      canDelete={hasPermission(user, PERMISSIONS.SCHOOLS_DELETE)}
      canCreateDeal={hasPermission(user, PERMISSIONS.DEALS_CREATE)}
      canCreateTask={hasPermission(user, PERMISSIONS.TASKS_CREATE)}
      canCreateTicket={hasPermission(user, PERMISSIONS.TICKETS_CREATE)}
      canCreateCalendar={hasPermission(user, PERMISSIONS.CALENDAR_CREATE)}
    />
  );
}
