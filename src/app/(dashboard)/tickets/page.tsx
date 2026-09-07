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
  const search = searchParams.search || '';

  const [ticketsData, taskTypes, schools, users, manager] = await Promise.all([
    TicketService.listTickets(user, {
      page,
      pageSize: 15,
      status,
      priority,
      taskTypeId,
      search,
    }),
    prisma.taskType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.school.findMany({
      where: { isDeleted: false },
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
    user.reportsToUserId ? prisma.user.findUnique({ where: { id: user.reportsToUserId }, select: { id: true, name: true, isActive: true } }) : Promise.resolve(null),
  ]);

  return (
    <TicketsClientView
      user={user}
      ticketsData={ticketsData}
      taskTypes={taskTypes}
      schools={schools}
      users={users}
      initialSearch={search}
      initialStatus={status}
      initialPriority={priority}
      initialTaskTypeId={taskTypeId}
      directManager={manager ?? null}
    />
  );
}
