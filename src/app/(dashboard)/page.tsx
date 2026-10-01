import { getCurrentUser } from '@/lib/auth/session';
import { AnalyticsService } from '@/server/services/AnalyticsService';
import { redirect } from 'next/navigation';
import { DashboardClientView } from '@/components/dashboard/DashboardClientView';
import prisma from '@/lib/db/prisma';
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import { CrmDashboardSummary } from '@/components/crm/CrmDashboardSummary';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [data, schools, taskTypes, users, manager, crm] = await Promise.all([
    AnalyticsService.getDashboardMetrics(user),
    prisma.school.findMany({
      where: { isDeleted: false, organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.taskType.findMany({
      where: { isActive: true, organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } },
        OR: [
          { role: { rolePermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } } },
          { userPermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } },
        ],
      },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    user.reportsToUserId ? prisma.user.findFirst({ where: { id: user.reportsToUserId, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } }, select: { id: true, name: true, isActive: true } }) : Promise.resolve(null),
    hasPermission(user, PERMISSIONS.DEALS_VIEW) || hasPermission(user, PERMISSIONS.TASKS_VIEW) || hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) ? CrmWorkspaceService.dashboard(user) : Promise.resolve({ counts: { clients: 0, leads: 0, deals: 0, pipelineValue: '0', openTasks: 0, overdueTasks: 0 }, recentActivity: [], upcomingTasks: [], pipelineSummary: [] }),
  ]);

  return (
    <><CrmDashboardSummary data={crm} /><DashboardClientView user={user} data={data} schools={schools} taskTypes={taskTypes} users={users} directManager={manager ?? null} /></>
  );
}
