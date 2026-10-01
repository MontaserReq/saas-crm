import prisma from '@/lib/db/prisma';

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
    const organizationId = params.organizationId || (await this.organizationForUser(params.userId));
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        organizationId,
      },
    });
  }

  static async getUserNotifications(userId: string, limit = 20) {
    const organizationId = await this.organizationForUser(userId);
    return prisma.notification.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const organizationId = await this.organizationForUser(userId);
    return prisma.notification.count({
      where: { userId, organizationId, isRead: false },
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
    const membership = await prisma.organizationMember.findFirst({ where: { userId, status: 'ACTIVE', organization: { isActive: true } }, orderBy: { createdAt: 'asc' }, select: { organizationId: true } });
    return membership?.organizationId || 'org_codeline_legacy';
  }
}
