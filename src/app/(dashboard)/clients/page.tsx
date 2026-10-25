import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ClientService } from "@/server/services/ClientService";
import { ClientsView } from "@/components/clients/ClientsView";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { OrganizationConfigService } from "@/server/services/OrganizationConfigService";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "clients") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const params = await searchParams;
  const [clients, config] = await Promise.all([
    ClientService.list(user, { search: params.search }),
    OrganizationConfigService.get(user),
  ]);
  return (
    <ClientsView
      clients={clients}
      clientTypes={config.settings.clientTypes}
      initialSearch={params.search || ""}
      canCreate={hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)}
    />
  );
}
