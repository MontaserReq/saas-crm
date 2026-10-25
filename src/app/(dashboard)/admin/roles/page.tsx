import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { RolesClientView } from '@/components/admin/RolesClientView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';

export default async function AdminRolesPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.ROLES_VIEW)) {
    redirect('/dashboard');
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: {
        name: { not: 'PLATFORM_ADMIN' },
        OR: [{ organizationId: null }, { organizationId: user.organizationId }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        rolePermissions: true,
      },
    }),
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] }),
  ]);

  const canCreate = hasPermission(user, PERMISSIONS.ROLES_CREATE);
  const canEdit = hasPermission(user, PERMISSIONS.ROLES_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.ROLES_DELETE);

  return (
    <RolesClientView
      roles={roles}
      permissions={permissions}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
