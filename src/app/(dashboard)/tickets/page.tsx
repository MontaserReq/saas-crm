import { getCurrentUser } from '@/lib/auth/session';
import { TicketService } from '@/server/services/TicketService';
import { TicketsClientView } from '@/components/tickets/TicketsClientView';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) && !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) return null;

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const status = searchParams.status || 'ALL';
  const priority = searchParams.priority || 'ALL';
  const taskTypeId = searchParams.taskTypeId || 'ALL';
  const departmentId = searchParams.departmentId || 'ALL';
  const assigneeId = searchParams.assigneeId || 'ALL';
  const search = searchParams.search || '';
  const isAllTicketsView = searchParams.view === 'all';

  if (isAllTicketsView && !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) return null;

  const [ticketsData, taskTypes, schools, users, departments, manager] = await Promise.all([
    TicketService.listTickets(user, {
      page,
      pageSize: 15,
      myTicketsOnly: !isAllTicketsView,
      status,
      priority,
      departmentId,
      taskTypeId,
      assigneeId,
      search,
    }),
    prisma.taskType.findMany({ where: { isActive: true, organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
    prisma.school.findMany({
      where: { isDeleted: false, organizationId: user.organizationId },
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
    prisma.department.findMany({ where: { isActive: true, organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    user.reportsToUserId ? prisma.user.findFirst({ where: { id: user.reportsToUserId, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } }, select: { id: true, name: true, isActive: true } }) : Promise.resolve(null),
  ]);

  return (
    <TicketsClientView
      user={user}
      ticketsData={ticketsData}
      taskTypes={taskTypes}
      schools={schools}
      users={users}
      departments={departments}
      initialSearch={search}
      initialStatus={status}
      initialPriority={priority}
      initialTaskTypeId={taskTypeId}
      initialDepartmentId={departmentId}
      initialAssigneeId={assigneeId}
      isAllTicketsView={isAllTicketsView}
      directManager={manager ?? null}
    />
  );
}
