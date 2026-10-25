import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import type { UserSession } from '@/types';

const cookieState = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => cookieState.token ? { value: cookieState.token } : undefined, set: vi.fn(), delete: vi.fn() }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prisma from '@/lib/db/prisma';
import { getCurrentUser, signToken } from '@/lib/auth/session';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { createDepartmentAction } from '@/server/actions/admin';

const run = process.env.RUN_AUTH_MEMBERSHIP_DB === '1';

describe.skipIf(!run)('database-backed membership and session revocation', () => {
  const suffix = crypto.randomUUID();
  const oldSecret = process.env.AUTH_SECRET;
  const fixture = {
    orgAId: `auth-org-a-${suffix}`,
    orgBId: `auth-org-b-${suffix}`,
    deptAId: `auth-dept-a-${suffix}`,
    deptBId: `auth-dept-b-${suffix}`,
    userId: `auth-user-${suffix}`,
    sessionId: `auth-session-${suffix}`,
    roleId: `auth-role-${suffix}`,
    permissionId: '',
    planId: `auth-plan-${suffix}`,
  };
  const createdDepartmentIds: string[] = [];
  let permissionExisted = false;

  const tokenPayload = (): UserSession => ({
    id: fixture.userId,
    name: 'Database auth actor',
    email: `auth-${suffix}@example.test`,
    role: 'ADMIN',
    isPlatformAdmin: false,
    roleDisplayName: 'Database Auth Admin',
    departmentId: fixture.deptAId,
    departmentName: 'Database Auth Department A',
    organizationId: fixture.orgBId,
    organizationName: 'Spoofed tenant B',
    permissions: ['departments.manage'],
    sessionId: fixture.sessionId,
  });

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    process.env.AUTH_SECRET = 'database-membership-security-test-secret-2026';
    await prisma.$connect();
    const existingPermission = await prisma.permission.findUnique({ where: { code: 'departments.manage' } });
    permissionExisted = Boolean(existingPermission);
    const permission = existingPermission ?? await prisma.permission.create({ data: { code: 'departments.manage', name: 'Manage departments', module: 'departments' } });
    fixture.permissionId = permission.id;
    await prisma.role.create({ data: { id: fixture.roleId, name: `AUTH_DB_ADMIN_${suffix}`, displayName: 'Database Auth Admin', rolePermissions: { create: { permissionId: permission.id } } } });
    await prisma.platformPlan.create({ data: { id: fixture.planId, slug: `auth-db-plan-${suffix}`, name: 'Database auth test plan', features: '["permissions"]', availability: 'self_serve' } });
    await prisma.organization.createMany({ data: [
      { id: fixture.orgAId, name: 'Database Auth Org A', slug: `auth-db-org-a-${suffix}` },
      { id: fixture.orgBId, name: 'Database Auth Org B', slug: `auth-db-org-b-${suffix}` },
    ] });
    await prisma.department.createMany({ data: [
      { id: fixture.deptAId, organizationId: fixture.orgAId, name: 'Database Auth Department A', code: `AUTH_A_${suffix}` },
      { id: fixture.deptBId, organizationId: fixture.orgBId, name: 'Database Auth Department B', code: `AUTH_B_${suffix}` },
    ] });
    await prisma.user.create({ data: { id: fixture.userId, name: 'Database auth actor', email: `auth-${suffix}@example.test`, passwordHash: 'test-only', roleId: fixture.roleId, departmentId: fixture.deptAId } });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: fixture.orgAId, userId: fixture.userId, roleId: fixture.roleId, status: 'ACTIVE' },
      { organizationId: fixture.orgBId, userId: fixture.userId, roleId: fixture.roleId, status: 'SUSPENDED' },
    ] });
    await prisma.platformSubscription.create({ data: { organizationId: fixture.orgAId, planId: fixture.planId, status: 'ACTIVE' } });
    await prisma.loginSession.create({ data: { id: fixture.sessionId, userId: fixture.userId, expiresAt: new Date(Date.now() + 60_000) } });
  }, 30000);

  beforeEach(async () => {
    await prisma.user.update({ where: { id: fixture.userId }, data: { isActive: true } });
    await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: fixture.orgAId, userId: fixture.userId } }, data: { status: 'ACTIVE' } });
    await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: fixture.orgBId, userId: fixture.userId } }, data: { status: 'SUSPENDED' } });
    await prisma.loginSession.update({ where: { id: fixture.sessionId }, data: { logoutAt: null, expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.platformSubscription.update({ where: { organizationId: fixture.orgAId }, data: { status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: null, trialStartedAt: null, trialEndsAt: null } });
    cookieState.token = await signToken(tokenPayload());
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } } });
    if (createdDepartmentIds.length) await prisma.department.deleteMany({ where: { id: { in: createdDepartmentIds } } });
    await prisma.loginSession.deleteMany({ where: { userId: fixture.userId } });
    await prisma.organizationMember.deleteMany({ where: { userId: fixture.userId } });
    await prisma.user.deleteMany({ where: { id: fixture.userId } });
    await prisma.department.deleteMany({ where: { id: { in: [fixture.deptAId, fixture.deptBId] } } });
    await prisma.platformSubscription.deleteMany({ where: { organizationId: fixture.orgAId } });
    await prisma.organization.deleteMany({ where: { id: { in: [fixture.orgAId, fixture.orgBId] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: fixture.roleId } });
    await prisma.role.deleteMany({ where: { id: fixture.roleId } });
    await prisma.platformPlan.deleteMany({ where: { id: fixture.planId } });
    if (!permissionExisted && fixture.permissionId) await prisma.permission.deleteMany({ where: { id: fixture.permissionId } });
    await prisma.$disconnect();
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  }, 30000);

  it('allows an active member with a valid session while ignoring a spoofed tenant identifier', async () => {
    const current = await getCurrentUser();
    expect(current).toMatchObject({ id: fixture.userId, organizationId: fixture.orgAId, permissions: ['departments.manage'] });
    await expect(requireOrganizationContext(current!)).resolves.toMatchObject({ id: fixture.orgAId });
    const result = await createDepartmentAction({ name: 'Authorized database action', code: `SEC_ACTION_${Date.now()}`, isActive: true });
    expect(result.success).toBe(true);
    const department = (result as any).department;
    createdDepartmentIds.push(department.id);
    expect(department.organizationId).toBe(fixture.orgAId);
    expect(await prisma.department.count({ where: { id: department.id, organizationId: fixture.orgBId } })).toBe(0);
  });

  it('blocks subsequent privileged access when membership is suspended or removed', async () => {
    const previouslyAuthorized = await getCurrentUser();
    expect(previouslyAuthorized).not.toBeNull();
    await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: fixture.orgAId, userId: fixture.userId } }, data: { status: 'REMOVED' } });
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(requireOrganizationContext(previouslyAuthorized!)).rejects.toThrow('membership');
    expect((await createDepartmentAction({ name: 'Blocked membership action', code: `BLOCKED_MEMBER_${Date.now()}`, isActive: true })).success).toBe(false);
    expect(await prisma.department.count({ where: { organizationId: fixture.orgBId, code: { startsWith: 'BLOCKED_MEMBER_' } } })).toBe(0);
  });

  it('blocks privileged access immediately when the user is inactive', async () => {
    await prisma.user.update({ where: { id: fixture.userId }, data: { isActive: false } });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect((await createDepartmentAction({ name: 'Blocked inactive action', code: `BLOCKED_USER_${Date.now()}`, isActive: true })).success).toBe(false);
  });

  it('blocks privileged access for revoked and expired database sessions', async () => {
    await prisma.loginSession.update({ where: { id: fixture.sessionId }, data: { logoutAt: new Date() } });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect((await createDepartmentAction({ name: 'Blocked revoked action', code: `BLOCKED_REVOKED_${Date.now()}`, isActive: true })).success).toBe(false);

    await prisma.loginSession.update({ where: { id: fixture.sessionId }, data: { logoutAt: null, expiresAt: new Date(Date.now() - 1_000) } });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect((await prisma.loginSession.findUniqueOrThrow({ where: { id: fixture.sessionId } })).logoutAt).not.toBeNull();
  });

  it('marks an expired trial and blocks writes while preserving authenticated tenant read context', async () => {
    const trialStartedAt = new Date(Date.now() - 8 * 86400000);
    const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 86400000);
    await prisma.platformSubscription.update({ where: { organizationId: fixture.orgAId }, data: { status: 'TRIAL', startsAt: trialStartedAt, endsAt: trialEndsAt, trialStartedAt, trialEndsAt } });
    const current = await getCurrentUser();
    expect(current).toMatchObject({ organizationId: fixture.orgAId, workspaceAccessState: 'TRIAL_READ_ONLY_GRACE', workspaceReadOnly: true });
    await expect(requireOrganizationContext(current!)).resolves.toMatchObject({ id: fixture.orgAId });
    const code = `BLOCKED_EXPIRED_${Date.now()}`;
    expect((await createDepartmentAction({ name: 'Blocked expired trial action', code, isActive: true })).success).toBe(false);
    expect(await prisma.department.count({ where: { organizationId: fixture.orgAId, code } })).toBe(0);
    expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: fixture.orgAId } })).status).toBe('EXPIRED');
  });
});
