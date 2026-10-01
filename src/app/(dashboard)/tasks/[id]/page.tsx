import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { CrmTaskService } from '@/server/services/CrmTaskService';
import { TaskDetailView } from '@/components/tasks/TaskDetailView';
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.TASKS_VIEW)) return null; const task = await CrmTaskService.get(user, (await params).id); if (!task) return <main className="p-6">Task not found</main>; return <TaskDetailView task={task} />; }
