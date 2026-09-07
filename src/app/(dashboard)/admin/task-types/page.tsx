import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { TaskTypesClientView } from '@/components/admin/TaskTypesClientView';

export default async function TaskTypesPage() {
  const user = (await getCurrentUser())!;

  if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE)) {
    redirect('/');
  }

  const [taskTypes, departments] = await Promise.all([
    prisma.taskType.findMany({ orderBy: { createdAt: 'asc' }, include: {
      department: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { id: 'asc' } },
      _count: { select: { tickets: true } },
    } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: {
      users: { where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } },
    } }),
  ]);

  return <TaskTypesClientView taskTypes={taskTypes as any} departments={departments as any} />;
}
