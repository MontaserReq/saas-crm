import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { LeadsView } from "@/components/crm/LeadsView";
import { LeadService } from "@/server/services/LeadService";
import { OrganizationConfigService } from "@/server/services/OrganizationConfigService";

export default async function LeadsPage() {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "leads") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const [leads, config] = await Promise.all([
    LeadService.list(user),
    OrganizationConfigService.get(user),
  ]);
  return (
    <LeadsView
      leads={leads}
      statuses={config.settings.leadStatuses}
      canCreate={hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)}
    />
  );
}
