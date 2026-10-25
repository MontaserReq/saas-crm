import type { Prisma } from '@prisma/client';

export const PLAN_USER_LIMIT_REACHED = 'Your plan user limit has been reached. Deactivate an active user or upgrade the plan before adding another user.';
export const PLAN_USER_LIMIT_UNAVAILABLE = 'User activation is unavailable because this workspace does not have a valid active plan.';

/**
 * Serializes every counted-seat acquisition on the organization row. The
 * caller must create the membership or activate the user in this same
 * transaction so PostgreSQL retains the lock until that write commits.
 */
export async function assertOrganizationUserCapacity(
  tx: Prisma.TransactionClient,
  organizationId: string,
  options: { excludeUserId?: string } = {},
) {
  const organizations = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE
  `;
  if (organizations.length !== 1) throw new Error(PLAN_USER_LIMIT_UNAVAILABLE);

  // PlatformSubscription.organizationId is unique, so this is the one
  // authoritative subscription for the workspace.
  const subscription = await tx.platformSubscription.findUnique({
    where: { organizationId },
    select: { plan: { select: { userLimit: true, isActive: true } } },
  });
  if (!subscription?.plan.isActive) throw new Error(PLAN_USER_LIMIT_UNAVAILABLE);

  // A null limit is the existing explicit unlimited-plan representation.
  const userLimit = subscription.plan.userLimit;
  if (userLimit === null) return;
  if (!Number.isInteger(userLimit) || userLimit < 1) throw new Error(PLAN_USER_LIMIT_UNAVAILABLE);

  const activeMembers = await tx.organizationMember.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      user: { isActive: true },
      ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
    },
  });
  if (activeMembers >= userLimit) throw new Error(PLAN_USER_LIMIT_REACHED);
}
