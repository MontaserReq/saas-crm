import prisma from '@/lib/db/prisma';
import { sendTransactionalEmail } from '@/lib/email';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000;

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function categoryEnabled(raw: string | null | undefined, type: string) {
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed[type] !== false;
  } catch {
    return true;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function isTransient(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/not configured|invalid|authentication|recipient|address|unauthorized|forbidden/i.test(message);
}

export class NotificationEmailService {
  static async dispatch(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
      },
    });
    if (!notification?.user.isActive || !notification.user.email) return;

    const preferences = await prisma.userNotificationPreference.findUnique({ where: { userId: notification.userId } });
    if (preferences?.emailEnabled === false || !categoryEnabled(preferences?.categories, notification.type)) return;

    const delivery = await prisma.notificationDelivery.upsert({
      where: { notificationId_channel: { notificationId, channel: 'EMAIL' } },
      create: { notificationId, channel: 'EMAIL' },
      update: {},
    });
    if (delivery.status === 'SENT' || delivery.attempts >= MAX_ATTEMPTS) return;
    if (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()) return;

    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
      data: { status: 'SENDING', attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1) return;

    const link = notification.entityId ? `${appUrl()}/${notification.entityType === 'ticket' ? 'tickets' : 'notifications'}/${encodeURIComponent(notification.entityId)}` : `${appUrl()}/notifications`;
    try {
      await sendTransactionalEmail({
        to: notification.user.email,
        subject: `SatrCRM: ${notification.title}`,
        text: `${notification.message}\n\n${link}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.message)}</p><p><a href="${escapeHtml(link)}">Open SatrCRM</a></p></div>`,
      });
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: new Date(), nextAttemptAt: null } });
    } catch (error) {
      const retry = isTransient(error) && delivery.attempts + 1 < MAX_ATTEMPTS;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'Email delivery failed',
          nextAttemptAt: retry ? new Date(Date.now() + RETRY_DELAY_MS) : null,
        },
      }).catch(() => undefined);
      console.warn('System notification email delivery failed', { notificationId, retry });
    }
  }

  static async processPendingForUser(userId: string) {
    const pending = await prisma.notificationDelivery.findMany({
      where: {
        channel: 'EMAIL',
        status: { in: ['PENDING', 'FAILED'] },
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        notification: { userId },
      },
      select: { notificationId: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    });
    await Promise.allSettled(pending.map((item) => this.dispatch(item.notificationId)));
  }
}
