import prisma from '@/lib/db/prisma';
import { requireOrganizationIdForUserId, requireOrganizationIdValue } from '@/lib/auth/organization';
import { NotificationEmailService } from './NotificationEmailService';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  organizationId?: string;
}

export class NotificationService {
  static async create(params: CreateNotificationParams) {
    const organizationId = params.organizationId ? requireOrganizationIdValue(params.organizationId) : await this.organizationForUser(params.userId);
    const preferences = await prisma.userNotificationPreference.findUnique({ where: { userId: params.userId } }).catch(() => null);
    const categoryEnabled = (() => {
      if (!preferences?.categories) return true;
      try { return (JSON.parse(preferences.categories) as Record<string, unknown>)[params.type] !== false; } catch { return true; }
    })();
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        organizationId,
        inAppVisible: preferences?.inAppEnabled !== false && categoryEnabled,
      },
    });
    if (preferences?.emailEnabled !== false && categoryEnabled) {
      void NotificationEmailService.dispatch(notification.id).catch((error) => console.warn('Notification email dispatch failed', error));
    }
    return notification;
  }

  static async getUserNotifications(userId: string, limit = 20) {
    const organizationId = await this.organizationForUser(userId);
    const notifications = await prisma.notification.findMany({
      where: { userId, organizationId, inAppVisible: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    void NotificationEmailService.processPendingForUser(userId).catch(() => undefined);
    return notifications;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const organizationId = await this.organizationForUser(userId);
    return prisma.notification.count({
      where: { userId, organizationId, inAppVisible: true, isRead: false },
    });
  }

  static async markAsRead(id: string, userId: string) {
    const organizationId = await this.organizationForUser(userId);
    return prisma.notification.updateMany({
      where: { id, userId, organizationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  static async markAllAsRead(userId: string) {
    const organizationId = await this.organizationForUser(userId);
    return prisma.notification.updateMany({
      where: { userId, organizationId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  private static async organizationForUser(userId: string) {
    return requireOrganizationIdForUserId(userId);
  }
}
