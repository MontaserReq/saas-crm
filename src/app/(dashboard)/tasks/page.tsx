import { requireAuth } from "@/lib/auth/session";
import { requireOrganizationContext } from "@/lib/auth/organization";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { CrmTaskService } from "@/server/services/CrmTaskService";
import { TasksView } from "@/components/tasks/TasksView";
import prisma from "@/lib/db/prisma";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; create?: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.TASKS_VIEW)) return null;
  const params = await searchParams;
  const [tasks, organization, initialClient] = await Promise.all([
    CrmTaskService.list(user),
    requireOrganizationContext(user),
    params.clientId
      ? prisma.client.findFirst({
          where: { id: params.clientId, organizationId: user.organizationId!, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  return (
    <TasksView
      tasks={tasks}
      timeZone={organization.timezone}
      initialNow={Date.now()}
      initialClient={initialClient}
      openCreate={params.create === "1"}
      canCreate={hasPermission(user, PERMISSIONS.TASKS_CREATE)}
      canUpdate={hasPermission(user, PERMISSIONS.TASKS_UPDATE)}
    />
  );
}
