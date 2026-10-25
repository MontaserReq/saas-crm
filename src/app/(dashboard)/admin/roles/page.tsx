import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { RolesClientView } from '@/components/admin/RolesClientView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { filterPermissionsForPlan } from '@/lib/platform/entitlements';

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

  const tenantVisiblePermissions = permissions.filter(
    (permission) => permission.module !== 'schools'
      && permission.module !== 'ai_assistant'
      && permission.code !== 'activity.view_school'
      && permission.code !== 'analytics.view_schools',
  );
  const companySuperAdmin = user.role === 'SUPER_ADMIN' && !isPlatformSuperAdmin(user);
  const rolesForView = roles.map((role) => role.name === 'SUPER_ADMIN'
    ? {
        ...role,
        // The system role is immutable, but the matrix must accurately show
        // its effective full tenant authority even if an older database has a
        // partial RolePermission snapshot.
        rolePermissions: tenantVisiblePermissions.map((permission) => ({ permissionId: permission.id })),
      }
    : role);

  const canCreate = hasPermission(user, PERMISSIONS.ROLES_CREATE);
  const canEdit = hasPermission(user, PERMISSIONS.ROLES_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.ROLES_DELETE);
  const availablePermissionCodes = isPlatformSuperAdmin(user) || companySuperAdmin
    ? tenantVisiblePermissions.map((permission) => permission.code)
    : filterPermissionsForPlan(
        tenantVisiblePermissions.map((permission) => permission.code),
        user.planFeatures ?? null,
      );

  return (
    <RolesClientView
      roles={rolesForView}
      permissions={permissions}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      availablePermissionCodes={availablePermissionCodes}
    />
  );
}
