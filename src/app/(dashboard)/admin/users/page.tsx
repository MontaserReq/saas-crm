import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { UsersClientView } from '@/components/admin/UsersClientView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';

export default async function AdminUsersPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.USERS_VIEW)) {
    redirect('/dashboard');
  }

  const [users, roles, departments, permissions] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } },
        ...(!isPlatformSuperAdmin(user) ? { isPlatformAdmin: false, role: { name: { not: 'PLATFORM_ADMIN' } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        reportsToUserId: true,
        role: { select: { id: true, name: true, displayName: true } },
        department: { select: { id: true, name: true } },
        userPermissions: { select: { permissionId: true } },
      },
    }),
    prisma.role.findMany({
      where: {
        name: { notIn: isPlatformSuperAdmin(user) || user.role === 'SUPER_ADMIN' ? ['PLATFORM_ADMIN'] : ['PLATFORM_ADMIN', 'SUPER_ADMIN'] },
        ...(isPlatformSuperAdmin(user) ? {} : { OR: [{ organizationId: null }, { organizationId: user.organizationId }] }),
      },
      orderBy: [{ isSystem: 'desc' }, { displayName: 'asc' }],
    }),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),
  ]);

  const [activeUserCount, subscription] = await Promise.all([
    prisma.organizationMember.count({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
        user: { isActive: true },
      },
    }),
    prisma.platformSubscription.findUnique({
      where: { organizationId: user.organizationId },
      select: { plan: { select: { userLimit: true, isActive: true } } },
    }),
  ]);

  const userLimit = subscription?.plan.isActive ? subscription.plan.userLimit : 0;
  const canCreateUser = hasPermission(user, PERMISSIONS.USERS_CREATE)
    && (userLimit === null || activeUserCount < userLimit);

  return (
    <UsersClientView
      users={users}
      roles={roles}
      departments={departments}
      permissions={permissions}
      activeUserCount={activeUserCount}
      userLimit={userLimit}
      canCreateUser={canCreateUser}
    />
  );
}
