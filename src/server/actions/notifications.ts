'use server';

import { requireAuth } from '@/lib/auth/session';
import { NotificationService } from '@/server/services/NotificationService';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function markNotificationReadAction(notificationId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.NOTIFICATIONS_MARK_READ)) return { success: false, error: 'Forbidden' };
    await NotificationService.markAsRead(notificationId, user.id);
    revalidatePath('/notifications');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.NOTIFICATIONS_MARK_ALL_READ)) return { success: false, error: 'Forbidden' };
    await NotificationService.markAllAsRead(user.id);
    revalidatePath('/notifications');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
