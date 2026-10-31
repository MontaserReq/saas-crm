import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { AiResearchSettingsView } from '@/components/admin/AiResearchSettingsView';

export default async function PlatformAiResearchPage() {
  const user = await getCurrentUser();
  if (!user || !isPlatformSuperAdmin(user)) redirect('/dashboard');
  const settings = await PlatformAdminService.getAiResearchSettings(user);
  return <AiResearchSettingsView settings={settings} />;
}
