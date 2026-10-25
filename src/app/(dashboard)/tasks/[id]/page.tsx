import { requireAuth } from "@/lib/auth/session";
import { requireOrganizationContext } from "@/lib/auth/organization";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { CrmTaskService } from "@/server/services/CrmTaskService";
import { TaskDetailView } from "@/components/tasks/TaskDetailView";
import { LocalizedText } from "@/components/ui/LocalizedText";
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.TASKS_VIEW)) return null;
  const id = (await params).id;
  const [task, organization] = await Promise.all([
    CrmTaskService.get(user, id),
    requireOrganizationContext(user),
  ]);
  if (!task)
    return (
      <main className="p-6">
        <LocalizedText en="Task not found" ar="المهمة غير موجودة" />
      </main>
    );
  return (
    <TaskDetailView
      task={{
        ...task,
        deal: task.deal
          ? { ...task.deal, value: task.deal.value?.toString() ?? null }
          : null,
      }}
      timeZone={organization.timezone}
      canUpdate={hasPermission(user, PERMISSIONS.TASKS_UPDATE)}
      canDelete={hasPermission(user, PERMISSIONS.TASKS_DELETE)}
    />
  );
}
