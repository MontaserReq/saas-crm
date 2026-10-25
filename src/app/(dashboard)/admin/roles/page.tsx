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
      where: isPlatformSuperAdmin(user) ? {} : { name: { not: 'PLATFORM_ADMIN' } },
      orderBy: { createdAt: 'asc' },
      include: {
        rolePermissions: true,
      },
    }),
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] }),
  ]);

  const canEdit = isPlatformSuperAdmin(user);

  return <RolesClientView roles={roles} permissions={permissions} canEdit={canEdit} />;
}
