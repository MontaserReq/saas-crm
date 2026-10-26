import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ProfileClientView } from '@/components/profile/ProfileClientView';
import prisma from '@/lib/db/prisma';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const preference = await prisma.userNotificationPreference.findUnique({ where: { userId: user.id } });
  let categories: Record<string, boolean> = {};
  try { categories = preference?.categories ? JSON.parse(preference.categories) : {}; } catch { categories = {}; }
  return <ProfileClientView user={user} notificationPreferences={{ inAppEnabled: preference?.inAppEnabled !== false, emailEnabled: preference?.emailEnabled !== false, categories }} />;
}
