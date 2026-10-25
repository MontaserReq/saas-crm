import { getCurrentUser } from "@/lib/auth/session";
import { TicketService } from "@/server/services/TicketService";
import { TicketsClientView } from "@/components/tickets/TicketsClientView";
import prisma from "@/lib/db/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { OrganizationConfigService } from "@/server/services/OrganizationConfigService";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = (await getCurrentUser())!;
  if (
    !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) &&
    !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)
  )
    return null;

  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const status = params.status || "ALL";
  const priority = params.priority || "ALL";
  const taskTypeId = params.taskTypeId || "ALL";
  const departmentId = params.departmentId || "ALL";
  const assigneeId = params.assigneeId || "ALL";
  const search = params.search || "";
  const isAllTicketsView = params.view === "all";

  if (isAllTicketsView && !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL))
    return null;

  const [
    ticketsData,
    taskTypes,
    schools,
    users,
    departments,
    manager,
    organizationConfig,
    initialClient,
  ] = await Promise.all([
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
    prisma.taskType.findMany({
      where: { isActive: true, organizationId: user.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.school.findMany({
      where: { isDeleted: false, organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: {
          some: { organizationId: user.organizationId, status: "ACTIVE" },
        },
        OR: [
          {
            role: {
              rolePermissions: {
                some: {
                  permission: {
                    code: { in: ["tickets.view_assigned", "tickets.view_all"] },
                  },
                },
              },
            },
          },
          {
            userPermissions: {
              some: {
                permission: {
                  code: { in: ["tickets.view_assigned", "tickets.view_all"] },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true, organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    user.reportsToUserId
      ? prisma.user.findFirst({
          where: {
            id: user.reportsToUserId,
            organizationMemberships: {
              some: { organizationId: user.organizationId, status: "ACTIVE" },
            },
          },
          select: { id: true, name: true, isActive: true },
        })
      : Promise.resolve(null),
    OrganizationConfigService.get(user),
    params.clientId
      ? prisma.client.findFirst({
          where: {
            id: params.clientId,
            organizationId: user.organizationId!,
            deletedAt: null,
          },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
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
      priorityOptions={organizationConfig.settings.ticketPriorities as any}
      initialClient={initialClient}
      openCreate={params.create === "1" && hasPermission(user, PERMISSIONS.TICKETS_CREATE)}
    />
  );
}
