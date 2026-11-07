"use server";

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { TeamActivityReportInput, TeamActivityReportService } from '@/server/services/TeamActivityReportService';

function reportAccess(user: Awaited<ReturnType<typeof requireAuth>>, exportReport = false) {
  if (!hasPlanFeature(user, 'reports')) throw new Error('هذا التقرير غير متاح ضمن الخطة الحالية');
  if (!hasPermission(user, exportReport ? PERMISSIONS.REPORTS_EXPORT_PDF : PERMISSIONS.REPORTS_VIEW)) throw new Error('لا تملك صلاحية الوصول إلى هذا التقرير');
}

export async function getTeamActivityReportAction(input: TeamActivityReportInput = {}) {
  try {
    const user = await requireAuth();
    reportAccess(user);
    return { success: true as const, report: await TeamActivityReportService.get(user, input) };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'تعذر تحميل تقرير نشاط الفريق' };
  }
}

export async function exportTeamActivityReportAction(input: TeamActivityReportInput = {}) {
  try {
    const user = await requireAuth();
    reportAccess(user, true);
    return { success: true as const, report: await TeamActivityReportService.get(user, input) };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'تعذر تجهيز التقرير للتصدير' };
  }
}
