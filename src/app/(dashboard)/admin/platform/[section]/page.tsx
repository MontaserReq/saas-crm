import { getCurrentUser } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import { PlatformManagementView } from '@/components/admin/PlatformManagementView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { platformSections, type PlatformSection, type PlatformResource } from '@/lib/platform/types';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';

export default async function PlatformSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ search?: string; page?: string; resource?: string }> }) {
  const { section } = await params;
  if (!platformSections.includes(section as PlatformSection)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isPlatformSuperAdmin(user)) redirect('/dashboard');
  const query = await searchParams;
  const resource: PlatformResource = section === 'billing' ? (query.resource === 'subscriptions' ? 'subscriptions' : 'plans') : section === 'signups' || section === 'health' || section === 'analytics' ? 'organizations' : section as PlatformResource;
  const data = await PlatformAdminService.list(user, resource, query.search, Number(query.page || 1), section === 'health' || section === 'analytics');
  return <PlatformManagementView key={`${section}-${resource}-${data.page}-${data.search}`} section={section as PlatformSection} data={data} />;
}
