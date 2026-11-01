import { getCurrentUser } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { SearchProviderSettingsView } from '@/components/admin/SearchProviderSettingsView';

export default async function PlatformSearchProvidersPage() {
  const user = await getCurrentUser();
  if (!user || !isPlatformSuperAdmin(user)) redirect('/dashboard');
  const settings = await PlatformAdminService.getSearchProviderSettings(user);
  return <SearchProviderSettingsView language="en" settings={settings} />;
}
