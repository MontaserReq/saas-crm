import { getCurrentUser } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { SearchProviderSettingsView } from '@/components/admin/SearchProviderSettingsView';

export default async function PlatformSearchProvidersPage() {
  const user = await getCurrentUser();
  if (!user || !isPlatformSuperAdmin(user)) redirect('/dashboard');
  const [settings, usage] = await Promise.all([PlatformAdminService.getSearchProviderSettings(user), PlatformAdminService.getSearchProviderUsage(user)]);
  return <SearchProviderSettingsView language="en" settings={settings} usage={usage} />;
}
