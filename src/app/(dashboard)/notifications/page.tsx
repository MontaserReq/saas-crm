import { getCurrentUser } from '@/lib/auth/session';
import { NotificationService } from '@/server/services/NotificationService';
import { NotificationsClientView } from '@/components/notifications/NotificationsClientView';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.NOTIFICATIONS_VIEW)) return null;
  const notifications = await NotificationService.getUserNotifications(user.id, 50);

  return <NotificationsClientView notifications={notifications} />;
}
