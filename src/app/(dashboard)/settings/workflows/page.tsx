import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { WorkflowService } from "@/server/services/WorkflowService";
import { WorkflowsView } from "@/components/workflows/WorkflowsView";
import { LocalizedText } from "@/components/ui/LocalizedText";
import prisma from "@/lib/db/prisma";
import { requireOrganizationContext } from "@/lib/auth/organization";
export default async function WorkflowsPage() {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.WORKFLOWS_VIEW))
    return (
      <main className="p-6">
        <LocalizedText
          en="You do not have permission to view workflows."
          ar="ليس لديك صلاحية لعرض سير العمل."
        />
      </main>
    );
  const organization = await requireOrganizationContext(user);
  const [workflows, members, stages] = await Promise.all([
    WorkflowService.list(user, true),
    prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: {
          some: { organizationId: organization.id, status: "ACTIVE" },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pipelineStage.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
        pipeline: { isActive: true },
      },
      select: { id: true, name: true, pipeline: { select: { name: true } } },
      orderBy: { order: "asc" },
    }),
  ]);
  return (
    <WorkflowsView
      workflows={workflows}
      members={members}
      stages={stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        pipelineName: stage.pipeline.name,
      }))}
    />
  );
}
