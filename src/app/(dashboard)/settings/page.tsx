import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { SettingsClientView } from '@/components/settings/SettingsClientView';
import { OrganizationConfigService } from '@/server/services/OrganizationConfigService';
import { CustomFieldService } from '@/server/services/CustomFieldService';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [config, fields] = await Promise.all([OrganizationConfigService.get(user), CustomFieldService.listDefinitions(user)]);
  return <SettingsClientView config={config} fields={fields} />;
}
