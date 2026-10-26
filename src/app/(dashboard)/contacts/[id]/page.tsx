import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { Contact360View } from "@/components/crm/Contact360View";
import { ClientService } from "@/server/services/ClientService";
import { ContactService } from "@/server/services/ContactService";
import { CrmWorkspaceService } from "@/server/services/CrmWorkspaceService";
import { LocalizedText } from "@/components/ui/LocalizedText";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "contacts") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const id = (await params).id;
  const [contact, timeline, clients] = await Promise.all([
    ContactService.get(user, id),
    CrmWorkspaceService.timeline(user, "Contact", id),
    ClientService.list(user),
  ]);
  if (!contact)
    return (
      <main className="p-6">
        <LocalizedText en="Contact not found" ar="جهة الاتصال غير موجودة" />
      </main>
    );
  return (
    <Contact360View
      contact={contact}
      timeline={timeline.events}
      clients={clients.map(({ id: clientId, name }) => ({
        id: clientId,
        name,
      }))}
      canUpdate={hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE)}
      canDelete={hasPermission(user, PERMISSIONS.SCHOOLS_DELETE)}
      canSendCustomerEmail={Boolean(user.planFeatures?.includes('email_customer_send') && hasPermission(user, PERMISSIONS.CUSTOMER_EMAIL_SEND))}
    />
  );
}
