import type { Prisma } from '@prisma/client';
import { filterPermissionsForPlan, resolveSubscriptionFeatures } from '@/lib/platform/entitlements';
import { PERMISSIONS } from '@/lib/permissions';

export const INTEGRATION_AUTHORIZATION_REVOKED = 'INTEGRATION_AUTHORIZATION_REVOKED';

/**
 * Rebuilds the integration-management authorization decision from current
 * database state. Call this from the same SERIALIZABLE transaction as the
 * credential write/delete so stale sessions cannot authorize it.
 */
export async function requireCurrentIntegrationAuthorization(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  options: { requireEntitlement?: boolean } = {},
) {
  const lockedOrganizations = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Organization"
    WHERE "id" = ${organizationId} AND "isActive" = true
    FOR UPDATE
  `;
  if (lockedOrganizations.length !== 1) throw new Error(INTEGRATION_AUTHORIZATION_REVOKED);

  const [membership, user] = await Promise.all([
    tx.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: {
        role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
        organization: {
          select: {
            platformSubscription: {
              select: {
                status: true,
                startsAt: true,
                endsAt: true,
                plan: { select: { features: true, isActive: true } },
              },
            },
          },
        },
      },
    }),
    tx.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        isPlatformAdmin: true,
        role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
        userPermissions: { select: { permission: { select: { code: true } } } },
      },
    }),
  ]);
  if (!membership || !user?.isActive) throw new Error(INTEGRATION_AUTHORIZATION_REVOKED);

  const activeRole = membership.role ?? user.role;
  const isPlatformAdmin = user.isPlatformAdmin === true && user.role.name === 'PLATFORM_ADMIN' && activeRole.name === 'PLATFORM_ADMIN';
  if ((user.isPlatformAdmin || user.role.name === 'PLATFORM_ADMIN' || activeRole.name === 'PLATFORM_ADMIN') && !isPlatformAdmin) throw new Error(INTEGRATION_AUTHORIZATION_REVOKED);

  const features = resolveSubscriptionFeatures(membership.organization.platformSubscription);
  if (options.requireEntitlement !== false && !features.includes('integrations')) throw new Error(INTEGRATION_AUTHORIZATION_REVOKED);

  const granted = [...activeRole.rolePermissions, ...user.userPermissions].map((item) => item.permission.code);
  const effective = isPlatformAdmin ? granted : filterPermissionsForPlan([...new Set(granted)], features);
  if (!isPlatformAdmin && !effective.includes(PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) {
    throw new Error(INTEGRATION_AUTHORIZATION_REVOKED);
  }
}
