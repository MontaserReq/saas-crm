import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { validateAuthSecret } from '@/lib/auth/config';

const { prismaMock, cookieState } = vi.hoisted(() => ({
  prismaMock: {
    loginSession: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  cookieState: { token: undefined as string | undefined, set: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => cookieState.token ? { value: cookieState.token } : undefined, set: cookieState.set, delete: cookieState.delete }),
}));

import { createSession, destroySession, getCurrentUser, signToken, verifyToken } from '@/lib/auth/session';
import { getOrganizationContext, requireOrganizationContext } from '@/lib/auth/organization';
import { UserSession } from '@/types';

const SECRET = 'test-only-auth-secret-with-at-least-32-characters';
const baseUser: UserSession = {
  id: 'user-a', name: 'User A', email: 'a@example.test', role: 'MEMBER', roleDisplayName: 'Member',
  departmentId: 'dept-a', departmentName: 'Dept A', permissions: [], sessionId: 'session-a', organizationId: 'org-a',
};

function databaseUser(memberships: any[]) {
  return {
    id: 'user-a', name: 'User A', email: 'a@example.test', phone: null, avatar: null, isActive: true,
    reportsToUserId: null, role: { name: 'MEMBER', displayName: 'Member', rolePermissions: [] as { permission: { code: string } }[] }, userPermissions: [],
    department: { id: 'dept-a', name: 'Dept A' }, organizationMemberships: memberships,
  };
}

async function token(payload: Partial<UserSession> = {}) {
  return signToken({ ...baseUser, ...payload } as UserSession);
}

describe('authentication configuration', () => {
  it('rejects a missing secret', () => expect(() => validateAuthSecret('')).toThrow(/required/i));
  it('rejects short and placeholder secrets', () => {
    expect(() => validateAuthSecret('short')).toThrow(/32/);
    expect(() => validateAuthSecret('codeline-super-secret-jwt-key-change-in-production-2026')).toThrow(/safe/i);
  });
  it('accepts an explicit test secret', () => expect(validateAuthSecret(SECRET)).toBe(SECRET));
});

describe('browser session validation', () => {
  const membership = { organizationId: 'org-a', organization: { name: 'Org A' }, role: null };
  const oldSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    cookieState.token = undefined;
    vi.clearAllMocks();
    prismaMock.loginSession.findUnique.mockResolvedValue({ userId: 'user-a', logoutAt: null, expiresAt: new Date(Date.now() + 60_000) });
    prismaMock.user.findUnique.mockResolvedValue(databaseUser([membership]));
  });

  afterEach(() => {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  });

  it('writes and deletes session cookies through the asynchronous cookie API', async () => {
    await createSession(baseUser);
    expect(cookieState.set).toHaveBeenCalledWith('codeline_session', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    const sessionCookie = cookieState.set.mock.calls[0][1] as string;
    expect(sessionCookie.length).toBeLessThan(1024);
    await expect(verifyToken(sessionCookie)).resolves.toEqual({ id: 'user-a', sessionId: 'session-a' });
    await destroySession();
    expect(cookieState.delete).toHaveBeenCalledWith('codeline_session');
  });

  it('does not serialize stale authorization or profile data into the session token', async () => {
    const oversized = { ...baseUser, permissions: Array.from({ length: 500 }, (_, index) => `permission.${index}`), name: 'x'.repeat(5000) };
    const signed = await signToken(oversized);
    expect(signed.length).toBeLessThan(1024);
    expect(await verifyToken(signed)).toEqual({ id: 'user-a', sessionId: 'session-a' });
  });

  it('rejects a JWT without sessionId', async () => {
    cookieState.token = await token({ sessionId: undefined });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prismaMock.loginSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invalid or foreign session', async () => {
    cookieState.token = await token({ sessionId: 'missing' });
    prismaMock.loginSession.findUnique.mockResolvedValueOnce(null);
    await expect(getCurrentUser()).resolves.toBeNull();

    cookieState.token = await token({ sessionId: 'foreign' });
    prismaMock.loginSession.findUnique.mockResolvedValueOnce({ userId: 'user-b', logoutAt: null, expiresAt: new Date(Date.now() + 60_000) });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('rejects logged-out and expired sessions', async () => {
    cookieState.token = await token();
    prismaMock.loginSession.findUnique.mockResolvedValueOnce({ userId: 'user-a', logoutAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    await expect(getCurrentUser()).resolves.toBeNull();

    cookieState.token = await token();
    prismaMock.loginSession.findUnique.mockResolvedValueOnce({ userId: 'user-a', logoutAt: null, expiresAt: new Date(Date.now() - 1) });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('requires exactly one active membership in an active organization', async () => {
    cookieState.token = await token();
    prismaMock.user.findUnique.mockResolvedValueOnce(databaseUser([]));
    await expect(getCurrentUser()).resolves.toBeNull();

    cookieState.token = await token();
    prismaMock.user.findUnique.mockResolvedValueOnce(databaseUser([
      membership,
      { organizationId: 'org-b', organization: { name: 'Org B' }, role: null },
    ]));
    await expect(getCurrentUser()).resolves.toBeNull();

    cookieState.token = await token();
    await expect(getCurrentUser()).resolves.toMatchObject({ id: 'user-a', organizationId: 'org-a' });
  });

  it('recomputes plan features and permissions from the database on every request', async () => {
    cookieState.token = await token();
    const plannedMembership = { organizationId: 'org-a', organization: { name: 'Org A', platformSubscription: { status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: null, plan: { name: 'Starter', slug: 'starter', features: JSON.stringify(['crm']), isActive: true } } }, role: null };
    const plannedUser = databaseUser([plannedMembership]);
    plannedUser.role.rolePermissions = [{ permission: { code: 'deals.view' } }, { permission: { code: 'workflows.view' } }];
    prismaMock.user.findUnique.mockResolvedValueOnce(plannedUser);
    await expect(getCurrentUser()).resolves.toMatchObject({ planName: 'Starter', planSlug: 'starter', planFeatures: expect.arrayContaining(['deals']), permissions: ['deals.view'] });
  });
});

describe('mandatory organization context', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not select a membership when the session has no organization', async () => {
    await expect(getOrganizationContext({ id: 'user-a', organizationId: undefined })).resolves.toBeNull();
    expect(prismaMock.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed when the organization is missing or inactive', async () => {
    await expect(requireOrganizationContext({ id: 'user-a', organizationId: undefined })).rejects.toThrow(/organization/i);
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);
    await expect(requireOrganizationContext({ id: 'user-a', organizationId: 'org-a' })).rejects.toThrow(/organization/i);
  });
});
