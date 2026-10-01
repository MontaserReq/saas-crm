import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { UserSession, RoleName } from '@/types';
import prisma from '@/lib/db/prisma';
import { randomUUID } from 'crypto';

const COOKIE_NAME = 'codeline_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'codeline-super-secret-jwt-key-change-in-production-2026'
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export async function createSession(user: UserSession): Promise<void> {
  const token = await signToken(user);
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  if (session.sessionId) {
    const loginSession = await prisma.loginSession.findUnique({ where: { id: session.sessionId }, select: { userId: true, logoutAt: true, expiresAt: true } });
    if (!loginSession || loginSession.userId !== session.id || loginSession.logoutAt || loginSession.expiresAt <= new Date()) {
      if (loginSession && loginSession.expiresAt <= new Date() && !loginSession.logoutAt) await prisma.loginSession.update({ where: { id: session.sessionId }, data: { logoutAt: new Date() } });
      return null;
    }
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
          organization: { select: { name: true } },
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

  const permissions = Array.from(new Set([
    ...dbUser.role.rolePermissions.map((rp) => rp.permission.code),
    ...dbUser.userPermissions.map((up) => up.permission.code),
  ]));

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone,
    avatar: dbUser.avatar,
    role: dbUser.role.name as RoleName,
    roleDisplayName: dbUser.role.displayName,
    departmentId: dbUser.department.id,
    departmentName: dbUser.department.name,
    reportsToUserId: dbUser.reportsToUserId,
    permissions,
    sessionId: session.sessionId,
    organizationId: activeOrganization.organizationId,
    organizationName: activeOrganization.organization.name,
  };
}

export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
