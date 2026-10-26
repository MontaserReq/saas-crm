import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { DataImportService } from "@/server/services/DataImportService";
import { SmartImportWizard } from "@/components/imports/SmartImportWizard";
import { LocalizedText } from "@/components/ui/LocalizedText";
import { resolveSmartImportLimits } from "@/lib/imports/parseSpreadsheet";

export default async function ImportsPage() {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <LocalizedText
          en="You do not have permission to import CRM data."
          ar="ليس لديك صلاحية لاستيراد بيانات إدارة العملاء."
        />
      </div>
    );
  }
  const history = await DataImportService.listHistory(user);
  const importLimits = resolveSmartImportLimits(user.planSlug);
  return (
    <SmartImportWizard
      history={history.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        completedAt: item.completedAt?.toISOString() || null,
      }))}
      limits={{ maxRows: importLimits.maxRows, maxFileBytes: importLimits.maxFileBytes }}
    />
  );
}
