import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { ContactsView } from "@/components/crm/ContactsView";
import { ClientService } from "@/server/services/ClientService";
import { ContactService } from "@/server/services/ContactService";

export default async function ContactsPage() {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "contacts") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const [contacts, clients] = await Promise.all([
    ContactService.list(user),
    ClientService.list(user),
  ]);
  return (
    <ContactsView
      contacts={contacts}
      clients={clients.map(({ id, name }) => ({ id, name }))}
      canCreate={hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)}
    />
  );
}
