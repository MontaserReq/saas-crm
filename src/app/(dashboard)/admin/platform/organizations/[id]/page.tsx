import { requireAuth } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { notFound, redirect } from 'next/navigation';
import { CompanyStatisticsService } from '@/server/services/CompanyStatisticsService';
import { CompanyStatisticsView } from '@/components/admin/CompanyStatisticsView';

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(); if (!isPlatformSuperAdmin(user)) redirect('/dashboard');
  const { id } = await params; const data = await CompanyStatisticsService.detail(user, id); if (!data) notFound();
  return <CompanyStatisticsView key={id} data={data} />;
}
