import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { LocalizedText } from "@/components/ui/LocalizedText";
import { WorkflowExecutionsView } from "@/components/workflows/WorkflowExecutionsView";
import { WorkflowService } from "@/server/services/WorkflowService";

export default async function WorkflowExecutionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.WORKFLOW_EXECUTIONS_VIEW)) {
    return (
      <main className="p-6">
        <LocalizedText
          en="You do not have permission to view workflow executions."
          ar="ليس لديك صلاحية لعرض عمليات تنفيذ سير العمل."
        />
      </main>
    );
  }
  const routeParams = await params;
  const executions = await WorkflowService.executions(user, routeParams.id);
  const canResume = hasPermission(user, PERMISSIONS.WORKFLOWS_EXECUTE);

  return (
    <WorkflowExecutionsView
      executions={executions.map((execution) => ({
        ...execution,
        startedAt: execution.startedAt?.toISOString() || null,
      }))}
      canResume={canResume}
    />
  );
}
