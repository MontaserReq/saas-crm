import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { CrmTaskService } from '@/server/services/CrmTaskService';
import { TasksView } from '@/components/tasks/TasksView';
export default async function TasksPage() { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.TASKS_VIEW)) return null; return <TasksView tasks={await CrmTaskService.list(user)} />; }
