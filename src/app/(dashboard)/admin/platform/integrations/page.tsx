import { getCurrentUser } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { PlatformIntegrationPolicies } from '@/components/admin/PlatformIntegrationPolicies';

export default async function PlatformIntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isPlatformSuperAdmin(user)) redirect('/dashboard');
  return <PlatformIntegrationPolicies plans={await PlatformAdminService.getIntegrationPolicies(user)} />;
}
