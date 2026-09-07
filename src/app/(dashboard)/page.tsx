import { getCurrentUser } from '@/lib/auth/session';
import { AnalyticsService } from '@/server/services/AnalyticsService';
import { redirect } from 'next/navigation';
import { DashboardClientView } from '@/components/dashboard/DashboardClientView';
import prisma from '@/lib/db/prisma';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [data, schools, taskTypes, users, manager] = await Promise.all([
    AnalyticsService.getDashboardMetrics(user),
    prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.taskType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { rolePermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } } },
          { userPermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } },
        ],
      },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    user.reportsToUserId ? prisma.user.findUnique({ where: { id: user.reportsToUserId }, select: { name: true, isActive: true } }) : Promise.resolve(null),
  ]);

  return (
    <DashboardClientView
      user={user}
      data={data}
      schools={schools}
      taskTypes={taskTypes}
      users={users}
      managerName={manager?.isActive ? manager.name : null}
    />
  );
}
