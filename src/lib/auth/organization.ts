import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';

export type OrganizationContext = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  language: string;
  memberId: string;
  memberStatus: string;
  roleId: string | null;
};

export function requireOrganizationId(user: Pick<UserSession, 'organizationId'>): string {
  if (!user.organizationId) throw new Error('Unauthorized: active organization context required');
  return user.organizationId;
}

export function requireOrganizationIdValue(organizationId: string | null | undefined): string {
  if (!organizationId) throw new Error('Unauthorized: active organization context required');
  return organizationId;
}

export async function requireOrganizationIdForUserId(userId: string): Promise<string> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'ACTIVE', organization: { isActive: true } },
    select: { organizationId: true },
    take: 2,
  });
  if (memberships.length !== 1) throw new Error('Unauthorized: exactly one active organization membership required');
  return memberships[0].organizationId;
}

/**
 * Resolves tenant context from the authenticated user's membership.
 * Never use an organization ID received from a form/query/body as the source
 * of authorization context. A future organization-switch action should mint
 * a new session context only after this membership check succeeds.
 */
export async function getOrganizationContext(
  user: Pick<UserSession, 'id' | 'organizationId'>,
): Promise<OrganizationContext | null> {
  if (!user.organizationId) return null;
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      organizationId: user.organizationId,
      organization: { isActive: true },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      roleId: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          language: true,
        },
      },
    },
  });

  if (!membership) return null;

  return {
    ...membership.organization,
    memberId: membership.id,
    memberStatus: membership.status,
    roleId: membership.roleId,
  };
}

export async function requireOrganizationContext(
  user: Pick<UserSession, 'id' | 'organizationId'>,
): Promise<OrganizationContext> {
  const context = await getOrganizationContext(user);
  if (!context) throw new Error('Unauthorized: active organization membership required');
  return context;
}

