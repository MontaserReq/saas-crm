import { requireAuth } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { PlanUpgradeRequestsView } from '@/components/admin/PlanUpgradeRequestsView';

export default async function UpgradeRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const user = await requireAuth(); if (!isPlatformSuperAdmin(user)) redirect('/dashboard');
  const params = await searchParams; const page = Math.max(1, Math.min(100000, Math.floor(Number(params.page) || 1)));
  return <PlanUpgradeRequestsView data={await PlanUpgradeService.requests(user, page, params.status)} page={page} />;
}
