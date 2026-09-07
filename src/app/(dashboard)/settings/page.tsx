import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { SettingsClientView } from '@/components/settings/SettingsClientView';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return <SettingsClientView />;
}
