import { requireAuth } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';
import { CompanyStatisticsService } from '@/server/services/CompanyStatisticsService';
import { CompanyDirectory } from '@/components/admin/CompanyStatisticsView';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { PlatformManagementView } from '@/components/admin/PlatformManagementView';

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string; view?: string }> }) {
  const user = await requireAuth(); if (!isPlatformSuperAdmin(user)) redirect('/dashboard');
  const params = await searchParams; const page = Math.max(1, Math.min(100000, Math.floor(Number(params.page) || 1))); const search = (params.search ?? '').slice(0, 120);
  if (params.view === 'statistics') return <CompanyDirectory data={await CompanyStatisticsService.list(user, search, page)} page={page} search={search} />;
  return <PlatformManagementView key={`organizations-${page}-${search}`} section="organizations" data={await PlatformAdminService.list(user, 'organizations', search, page)} />;
}
