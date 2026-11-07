import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { TeamActivityReportService } from '@/server/services/TeamActivityReportService';
import { TeamActivityReportView } from '@/components/reports/TeamActivityReportView';

export default async function TeamActivityReportPage() {
  const user = await getCurrentUser();
  if (!user || !hasPlanFeature(user, 'reports') || !hasPermission(user, PERMISSIONS.REPORTS_VIEW)) redirect('/dashboard');
  const report = await TeamActivityReportService.get(user);
  return <TeamActivityReportView initialReport={report} canExport={hasPermission(user, PERMISSIONS.REPORTS_EXPORT_PDF)} />;
}
