import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ActivityClientView } from '@/components/activity/ActivityClientView';

export default async function ActivityPage() {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.ACTIVITY_VIEW)) return null;
  const isFullView = hasPermission(user, PERMISSIONS.ACTIVITY_VIEW_ALL);

  const [activities, assignments, auditLogs] = await Promise.all([prisma.activityEvent.findMany({
    where: isFullView
      ? {}
      : {
          ticket: {
            assignees: {
              some: { userId: user.id },
            },
          },
        },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      actor: { select: { name: true } },
      ticket: {
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          school: { select: { name: true } },
        },
      },
    },
  }), prisma.assignmentHistory.findMany({ where: isFullView ? {} : { OR: [{ toUserId: user.id }, { fromUserId: user.id }, { performedById: user.id }] }, orderBy: { createdAt: 'desc' }, take: 40, include: { performedBy: { select: { name: true } }, toUser: { select: { name: true } } } }), prisma.auditLog.findMany({ where: isFullView ? {} : { actorId: user.id }, orderBy: { createdAt: 'desc' }, take: 40, include: { actor: { select: { name: true } } } })]);
  const unified = [
    ...activities.map(a => ({ ...a, actor: a.actor, source: 'activity' })),
    ...assignments.map(a => ({ id: `assignment-${a.id}`, title: a.action, description: `Assigned to ${a.toUser.name}`, createdAt: a.createdAt, actor: a.performedBy, ticket: null, source: 'assignment' })),
    ...auditLogs.map(a => ({ id: `audit-${a.id}`, title: a.action, description: a.entityType, createdAt: a.createdAt, actor: a.actor, ticket: null, source: 'audit' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 80);

  return <ActivityClientView activities={unified as any} />;
}
