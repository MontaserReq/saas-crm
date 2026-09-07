import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ProfileClientView } from '@/components/profile/ProfileClientView';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return <ProfileClientView user={user} />;
}
