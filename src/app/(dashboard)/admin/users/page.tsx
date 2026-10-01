import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { UsersClientView } from '@/components/admin/UsersClientView';

export default async function AdminUsersPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.USERS_VIEW)) {
    redirect('/');
  }

  const [users, roles, departments, permissions] = await Promise.all([
    prisma.user.findMany({
      where: { organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } },
      orderBy: { createdAt: 'desc' },
      include: {
        role: true,
        department: true,
        userPermissions: { select: { permissionId: true } },
      },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),
  ]);

  return <UsersClientView users={users} roles={roles} departments={departments} permissions={permissions} />;
}
