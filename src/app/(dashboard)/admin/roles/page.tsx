import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { RolesClientView } from '@/components/admin/RolesClientView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { filterPermissionsForPlan, isCompanyAssignablePermissionCode, isComingSoonPermissionCode } from '@/lib/platform/entitlements';

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
    (permission) => isCompanyAssignablePermissionCode(permission.code),
  );
  const releasedTenantPermissions = tenantVisiblePermissions.filter(
    (permission) => !isComingSoonPermissionCode(permission.code),
  );
  const lockedPermissionIds = new Set(
    tenantVisiblePermissions
      .filter((permission) => isComingSoonPermissionCode(permission.code))
      .map((permission) => permission.id),
  );
  const rolesForView = roles.map((role) => ({
    ...role,
    // The system role is immutable, but the matrix must accurately show its
    // effective tenant authority while keeping unreleased permissions locked.
    rolePermissions: role.name === 'SUPER_ADMIN' || (role.isSystem && role.displayName === 'Company Super Admin')
      ? releasedTenantPermissions.map((permission) => ({ permissionId: permission.id }))
      : role.rolePermissions.filter((rolePermission: { permissionId: string }) => !lockedPermissionIds.has(rolePermission.permissionId)),
  }));

  const canCreate = hasPermission(user, PERMISSIONS.ROLES_CREATE);
  const canEdit = hasPermission(user, PERMISSIONS.ROLES_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.ROLES_DELETE);
  const availablePermissionCodes = isPlatformSuperAdmin(user)
    ? tenantVisiblePermissions.filter((permission) => !isComingSoonPermissionCode(permission.code)).map((permission) => permission.code)
    : filterPermissionsForPlan(
      tenantVisiblePermissions.filter((permission) => !isComingSoonPermissionCode(permission.code)).map((permission) => permission.code),
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
