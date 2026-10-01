import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { WorkflowService } from '@/server/services/WorkflowService';
import { WorkflowsView } from '@/components/workflows/WorkflowsView';
export default async function WorkflowsPage() { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.WORKFLOWS_VIEW)) return <main className="p-6">Forbidden</main>; return <WorkflowsView workflows={await WorkflowService.list(user)} />; }
