import type { Prisma } from '@prisma/client';
import { filterPermissionsForPlan, resolveSubscriptionAccess, type PlanFeatureId, type SubscriptionAccess } from '@/lib/platform/entitlements';

export type OperationAuthorizationReason =
  | 'AUTHORIZED'
  | 'ORGANIZATION_INACTIVE'
  | 'ACTOR_INACTIVE'
  | 'MEMBERSHIP_INACTIVE'
  | 'PLATFORM_IDENTITY_INVALID'
  | 'WORKSPACE_READ_ONLY'
  | 'FEATURE_NOT_INCLUDED'
  | 'PERMISSION_REVOKED';

export type OperationAuthorization = {
  allowed: boolean;
  reasonCode: OperationAuthorizationReason;
  access: SubscriptionAccess;
};

/**
 * Rebuilds authorization for autonomous work from current database state.
 * Call it from the same transaction as the protected checkpoint/write. This
 * deliberately ignores session snapshots so a disabled user, removed member,
 * downgraded subscription, or revoked permission takes effect mid-operation.
 */
export async function evaluateCurrentOperationAuthorization(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    feature: PlanFeatureId;
    requiredPermissions: readonly string[];
  },
): Promise<OperationAuthorization> {
  const organizations = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Organization"
    WHERE "id" = ${input.organizationId} AND "isActive" = true
    FOR SHARE
  `;

  const subscription = organizations.length === 1
    ? await tx.platformSubscription.findUnique({
        where: { organizationId: input.organizationId },
        include: { plan: { select: { features: true, isActive: true } } },
      })
    : null;
  // Prisma maps DateTime to a timestamp without time zone. Convert the server
  // clock to UTC explicitly so a non-UTC PostgreSQL/session timezone cannot
  // move an entitlement boundary by the local offset.
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS "now"`;
  const access = resolveSubscriptionAccess(subscription, clock.now);

  if (organizations.length !== 1) return { allowed: false, reasonCode: 'ORGANIZATION_INACTIVE', access };

  const [membership, user] = await Promise.all([
    tx.organizationMember.findFirst({
      where: { organizationId: input.organizationId, userId: input.userId, status: 'ACTIVE' },
      select: { role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } } },
    }),
    tx.user.findUnique({
      where: { id: input.userId },
      select: {
        isActive: true,
        isPlatformAdmin: true,
        role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
        userPermissions: { select: { permission: { select: { code: true } } } },
      },
    }),
  ]);

  if (!user?.isActive) return { allowed: false, reasonCode: 'ACTOR_INACTIVE', access };
  if (!membership) return { allowed: false, reasonCode: 'MEMBERSHIP_INACTIVE', access };

  const activeRole = membership.role ?? user.role;
  const isPlatformAdmin = user.isPlatformAdmin === true && user.role.name === 'PLATFORM_ADMIN' && activeRole.name === 'PLATFORM_ADMIN';
  if ((user.isPlatformAdmin || user.role.name === 'PLATFORM_ADMIN' || activeRole.name === 'PLATFORM_ADMIN') && !isPlatformAdmin) {
    return { allowed: false, reasonCode: 'PLATFORM_IDENTITY_INVALID', access };
  }
  if (access.readOnly) return { allowed: false, reasonCode: 'WORKSPACE_READ_ONLY', access };
  if (!access.features.includes(input.feature)) return { allowed: false, reasonCode: 'FEATURE_NOT_INCLUDED', access };

  const granted = [...activeRole.rolePermissions, ...user.userPermissions].map((item) => item.permission.code);
  const effective = isPlatformAdmin ? [...new Set(granted)] : filterPermissionsForPlan([...new Set(granted)], access.features);
  if (!isPlatformAdmin && input.requiredPermissions.some((permission) => !effective.includes(permission))) {
    return { allowed: false, reasonCode: 'PERMISSION_REVOKED', access };
  }

  return { allowed: true, reasonCode: 'AUTHORIZED', access };
}
