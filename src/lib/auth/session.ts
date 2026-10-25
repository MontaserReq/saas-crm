import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { UserSession, RoleName } from '@/types';
import prisma from '@/lib/db/prisma';
import { randomUUID } from 'crypto';
import { getAuthSecret } from '@/lib/auth/config';
import { applyFeatureOverrides, filterPermissionsForPlan, resolveSubscriptionAccess } from '@/lib/platform/entitlements';

const COOKIE_NAME = 'codeline_session';
function secretKey() { return new TextEncoder().encode(getAuthSecret()); }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

type SessionTokenClaims = Pick<UserSession, 'id' | 'sessionId'>;

export async function signToken(payload: SessionTokenClaims): Promise<string> {
  return new SignJWT({ sid: payload.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { id: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export async function createSession(user: UserSession): Promise<void> {
  const token = await signToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  if (!session.sessionId) return null;
  const loginSession = await prisma.loginSession.findUnique({ where: { id: session.sessionId }, select: { userId: true, logoutAt: true, expiresAt: true } });
  if (!loginSession || loginSession.userId !== session.id || loginSession.logoutAt || loginSession.expiresAt <= new Date()) {
    if (loginSession && loginSession.expiresAt <= new Date() && !loginSession.logoutAt) await prisma.loginSession.update({ where: { id: session.sessionId }, data: { logoutAt: new Date() } });
    return null;
  }

  // Verify user is still active in database
  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      isActive: true,
      isPlatformAdmin: true,
      reportsToUserId: true,
      role: {
        select: {
          name: true,
          displayName: true,
          rolePermissions: {
            select: {
              permission: {
                select: { code: true },
              },
            },
          },
        },
      },
      userPermissions: {
        select: { permission: { select: { code: true } } },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      organizationMemberships: {
        where: { status: 'ACTIVE', organization: { isActive: true } },
        orderBy: { createdAt: 'asc' },
        take: 2,
        select: {
          organizationId: true,
          organization: { select: { name: true, settings: { select: { featureOverrides: true } }, platformSubscription: { select: { status: true, startsAt: true, endsAt: true, trialEndsAt: true, plan: { select: { name: true, slug: true, features: true, isActive: true } } } } } },
          role: {
            select: {
              name: true,
              displayName: true,
              rolePermissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  // Once organization membership is part of the security boundary, an
  // authenticated user without an active membership must not receive a
  // usable application session.
  const activeMemberships = dbUser.organizationMemberships;
  if (activeMemberships.length !== 1) return null;
  const activeOrganization = activeMemberships[0];
  const activeRole = activeOrganization.role || dbUser.role;
  const isPlatformAdmin = dbUser.isPlatformAdmin === true && dbUser.role.name === 'PLATFORM_ADMIN' && activeRole.name === 'PLATFORM_ADMIN';
  // Platform authority must be consistent across the account, membership and
  // explicit marker. Company SUPER_ADMIN is a tenant role and is valid without it.
  if ((dbUser.isPlatformAdmin || dbUser.role.name === 'PLATFORM_ADMIN' || activeRole.name === 'PLATFORM_ADMIN') && !isPlatformAdmin) return null;

  const rolePermissions = Array.from(new Set([
    ...activeRole.rolePermissions.map((rp) => rp.permission.code),
    ...dbUser.userPermissions.map((up) => up.permission.code),
  ]));
  let subscription = activeOrganization.organization.platformSubscription;
  const now = new Date();
  if (subscription?.status === 'TRIAL' && subscription.endsAt && subscription.endsAt <= now) {
    await prisma.platformSubscription.updateMany({
      where: { organizationId: activeOrganization.organizationId, status: 'TRIAL', endsAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    subscription = { ...subscription, status: 'EXPIRED' };
  }
  const access = resolveSubscriptionAccess(subscription, now);
  const planFeatures = applyFeatureOverrides(
    access.features,
    activeOrganization.organization.settings?.featureOverrides,
  );
  const permissions = isPlatformAdmin ? rolePermissions : filterPermissionsForPlan(rolePermissions, planFeatures);

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone,
    avatar: dbUser.avatar,
    role: activeRole.name as RoleName,
    isPlatformAdmin,
    roleDisplayName: activeRole.displayName,
    departmentId: dbUser.department.id,
    departmentName: dbUser.department.name,
    reportsToUserId: dbUser.reportsToUserId,
    permissions,
    sessionId: session.sessionId,
    organizationId: activeOrganization.organizationId,
    organizationName: activeOrganization.organization.name,
    planFeatures,
    planName: subscription?.plan.name ?? null,
    planSlug: subscription?.plan.slug ?? null,
    workspaceAccessState: access.state,
    workspaceReadOnly: access.readOnly,
    subscriptionStartsAt: access.startsAt?.toISOString() ?? null,
    subscriptionEndsAt: access.endsAt?.toISOString() ?? null,
  };
}

export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
