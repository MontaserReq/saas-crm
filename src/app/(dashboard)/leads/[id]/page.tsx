import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasPlanFeature } from "@/lib/platform/entitlements";
import { Lead360View } from "@/components/crm/Lead360View";
import { CustomFieldDisplay } from "@/components/crm/CustomFieldDisplay";
import { LeadSetupFields } from "@/components/onboarding/LeadSetupFields";
import { LeadService } from "@/server/services/LeadService";
import { CrmWorkspaceService } from "@/server/services/CrmWorkspaceService";
import { CustomFieldService } from "@/server/services/CustomFieldService";
import { OrganizationConfigService } from "@/server/services/OrganizationConfigService";
import { LocalizedText } from "@/components/ui/LocalizedText";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (
    !hasPlanFeature(user, "leads") ||
    !hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
  )
    return null;
  const id = (await params).id;
  const [lead, timeline, config] = await Promise.all([
    LeadService.get(user, id),
    CrmWorkspaceService.timeline(user, "Lead", id),
    OrganizationConfigService.get(user),
  ]);
  if (!lead)
    return (
      <main className="p-6">
        <LocalizedText en="Lead not found" ar="العميل المحتمل غير موجود" />
      </main>
    );
  const [fields, values] = hasPlanFeature(user, "custom_fields")
    ? await Promise.all([
        CustomFieldService.listDefinitions(user, "LEAD"),
        CustomFieldService.getEntityValues(user, "LEAD", id),
      ])
    : [[], []];
  const textFields = fields
    .filter((field) => field.active && field.fieldType === "TEXT")
    .map((field) => ({
      key: field.key,
      label: field.label,
      required: field.required,
    }));
  const textValues = Object.fromEntries(
    values.map((value) => [value.fieldDefinition.key, value.valueText ?? ""]),
  );
  const canUpdate = hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE);
  return (
    <div className="space-y-6">
      <Lead360View
        lead={lead}
        timeline={timeline.events}
        statuses={config.settings.leadStatuses}
        canUpdate={canUpdate}
        canDelete={hasPermission(user, PERMISSIONS.SCHOOLS_DELETE)}
      />
      {canUpdate && (
        <LeadSetupFields leadId={id} fields={textFields} values={textValues} />
      )}
      <CustomFieldDisplay values={values} />
    </div>
  );
}
