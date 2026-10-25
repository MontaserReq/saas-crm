import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const authState = vi.hoisted(() => ({ current: null as any }));
vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn(async () => authState.current),
  getCurrentUser: vi.fn(async () => authState.current),
  hashPassword: vi.fn(async () => 'replacement-password-hash'),
  verifyPassword: vi.fn(async () => true),
  createSession: vi.fn(async () => undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: vi.fn(async () => undefined) } }));

import prisma from '@/lib/db/prisma';
import { listUserPermissionsAction, updateUserPermissionsAction } from '@/server/actions/admin';
import {
  disableUserAction,
  enableUserAction,
  getLoginSessionsAction,
  getUserForEditAction,
  updateUserAction,
} from '@/server/actions/users';

const run = process.env.RUN_PLATFORM_ADMIN_BOUNDARY_DB === '1';

describe.skipIf(!run)('database-backed tenant boundary for platform administrators', () => {
  const suffix = crypto.randomUUID();
  const ids = {
    organization: `platform-boundary-org-${suffix}`,
    department: `platform-boundary-dept-${suffix}`,
    adminRole: `platform-boundary-admin-role-${suffix}`,
    memberRole: `platform-boundary-member-role-${suffix}`,
    tenantAdmin: `platform-boundary-admin-${suffix}`,
    platformAdmin: `platform-boundary-platform-${suffix}`,
    managedUser: `platform-boundary-managed-${suffix}`,
    platformSession: `platform-boundary-platform-session-${suffix}`,
    managedSession: `platform-boundary-managed-session-${suffix}`,
    permission: `platform-boundary-permission-${suffix}`,
  };
  let platformAdminRoleId = '';
  let createdPlatformAdminRole = false;

  const permissions = [
    'users.update', 'users.disable', 'users.enable', 'users.manage_roles',
    'users.manage_permissions', 'users.view_sessions', 'users.manage_access_restrictions',
    'users.manage_reporting',
  ];
  const tenantActor = () => ({
    id: ids.tenantAdmin,
    name: 'Tenant administrator',
    email: `tenant-admin-${suffix}@example.test`,
    role: 'ADMIN',
    isPlatformAdmin: false,
    roleDisplayName: 'Tenant administrator',
    departmentId: ids.department,
    departmentName: 'Boundary department',
    organizationId: ids.organization,
    organizationName: 'Boundary organization',
    permissions,
    sessionId: `tenant-actor-session-${suffix}`,
  });
  const platformActor = () => ({
    ...tenantActor(),
    id: ids.platformAdmin,
    email: `platform-admin-${suffix}@example.test`,
    role: 'PLATFORM_ADMIN',
    isPlatformAdmin: true,
    roleDisplayName: 'Platform Admin',
  });
  const updateInput = (override: Record<string, unknown> = {}) => ({
    name: 'Protected platform administrator',
    email: `platform-admin-${suffix}@example.test`,
    phone: null,
    password: '',
    roleId: platformAdminRoleId,
    departmentId: ids.department,
    reportsToUserId: null,
    isActive: true,
    accessMode: 'ANY_IP',
    allowedIps: [],
    ...override,
  });

  async function protectedState() {
    return {
      account: await prisma.user.findUniqueOrThrow({
        where: { id: ids.platformAdmin },
        select: { name: true, email: true, passwordHash: true, roleId: true, isActive: true, accessMode: true, allowedIps: true },
      }),
      permissions: await prisma.userPermission.findMany({ where: { userId: ids.platformAdmin }, select: { permissionId: true }, orderBy: { permissionId: 'asc' } }),
      sessions: await prisma.loginSession.findMany({ where: { userId: ids.platformAdmin }, select: { id: true, logoutAt: true, expiresAt: true }, orderBy: { id: 'asc' } }),
    };
  }

  async function expectDeniedAndUnchanged(operation: () => Promise<{ success: boolean }>) {
    const before = await protectedState();
    await expect(operation()).resolves.toMatchObject({ success: false });
    expect(await protectedState()).toEqual(before);
  }

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    await prisma.$connect();

    let platformAdminRole = await prisma.role.findUnique({ where: { name: 'PLATFORM_ADMIN' } });
    if (!platformAdminRole) {
      platformAdminRole = await prisma.role.create({ data: { name: 'PLATFORM_ADMIN', displayName: 'Platform Admin', isSystem: true } });
      createdPlatformAdminRole = true;
    }
    platformAdminRoleId = platformAdminRole.id;
    await prisma.organization.create({ data: { id: ids.organization, name: 'Platform boundary organization', slug: `platform-boundary-${suffix}` } });
    await prisma.department.create({ data: { id: ids.department, organizationId: ids.organization, name: 'Boundary department', code: `PLATFORM_BOUNDARY_${suffix}` } });
    await prisma.role.createMany({ data: [
      { id: ids.adminRole, name: `PLATFORM_BOUNDARY_ADMIN_${suffix}`, displayName: 'Boundary admin' },
      { id: ids.memberRole, name: `PLATFORM_BOUNDARY_MEMBER_${suffix}`, displayName: 'Boundary member' },
    ] });
    await prisma.permission.create({ data: { id: ids.permission, code: `platform_boundary.${suffix}`, name: 'Boundary permission', module: 'users' } });
    await prisma.user.createMany({ data: [
      { id: ids.tenantAdmin, name: 'Tenant administrator', email: `tenant-admin-${suffix}@example.test`, passwordHash: 'tenant-hash', roleId: ids.adminRole, departmentId: ids.department },
      { id: ids.platformAdmin, name: 'Protected platform administrator', email: `platform-admin-${suffix}@example.test`, passwordHash: 'platform-hash', roleId: platformAdminRoleId, departmentId: ids.department, isPlatformAdmin: true },
      { id: ids.managedUser, name: 'Managed tenant user', email: `managed-user-${suffix}@example.test`, passwordHash: 'managed-hash', roleId: ids.memberRole, departmentId: ids.department },
    ] });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: ids.organization, userId: ids.tenantAdmin, roleId: ids.adminRole, status: 'ACTIVE' },
      { organizationId: ids.organization, userId: ids.platformAdmin, roleId: platformAdminRoleId, status: 'ACTIVE' },
      { organizationId: ids.organization, userId: ids.managedUser, roleId: ids.memberRole, status: 'ACTIVE' },
    ] });
    await prisma.userPermission.create({ data: { userId: ids.platformAdmin, permissionId: ids.permission } });
    await prisma.loginSession.createMany({ data: [
      { id: ids.platformSession, userId: ids.platformAdmin, ipAddress: '127.0.0.1', expiresAt: new Date(Date.now() + 60_000) },
      { id: ids.managedSession, userId: ids.managedUser, ipAddress: '127.0.0.1', expiresAt: new Date(Date.now() + 60_000) },
    ] });
  }, 30_000);

  beforeEach(async () => {
    authState.current = tenantActor();
    await prisma.user.update({ where: { id: ids.platformAdmin }, data: { name: 'Protected platform administrator', email: `platform-admin-${suffix}@example.test`, passwordHash: 'platform-hash', roleId: platformAdminRoleId, isActive: true, accessMode: 'ANY_IP', allowedIps: null } });
    await prisma.userPermission.deleteMany({ where: { userId: ids.platformAdmin } });
    await prisma.userPermission.create({ data: { userId: ids.platformAdmin, permissionId: ids.permission } });
    await prisma.loginSession.update({ where: { id: ids.platformSession }, data: { logoutAt: null, expiresAt: new Date(Date.now() + 60_000) } });
  });

  afterAll(async () => {
    await prisma.loginSession.deleteMany({ where: { userId: { in: [ids.platformAdmin, ids.managedUser] } } });
    await prisma.userPermission.deleteMany({ where: { userId: ids.platformAdmin } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: ids.organization } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.tenantAdmin, ids.platformAdmin, ids.managedUser] } } });
    await prisma.permission.deleteMany({ where: { id: ids.permission } });
    await prisma.department.deleteMany({ where: { id: ids.department } });
    await prisma.organization.deleteMany({ where: { id: ids.organization } });
    await prisma.role.deleteMany({ where: { id: { in: [ids.adminRole, ids.memberRole] } } });
    if (createdPlatformAdminRole) await prisma.role.deleteMany({ where: { id: platformAdminRoleId, users: { none: {} }, organizationMembers: { none: {} } } });
    await prisma.$disconnect();
  }, 30_000);

  it('denies sensitive account and session reads without changing state', async () => {
    await expectDeniedAndUnchanged(() => getUserForEditAction(ids.platformAdmin));
    await expectDeniedAndUnchanged(() => getLoginSessionsAction(ids.platformAdmin));
    await expectDeniedAndUnchanged(() => listUserPermissionsAction(ids.platformAdmin));
  });

  it('denies tenant-admin email and password changes without revoking sessions', async () => {
    await expectDeniedAndUnchanged(() => updateUserAction(ids.platformAdmin, updateInput({ email: `changed-${suffix}@example.test` })));
    await expectDeniedAndUnchanged(() => updateUserAction(ids.platformAdmin, updateInput({ password: 'replacement-password' })));
  });

  it('denies tenant-admin role and direct-permission changes', async () => {
    await expectDeniedAndUnchanged(() => updateUserAction(ids.platformAdmin, updateInput({ roleId: ids.memberRole })));
    await expectDeniedAndUnchanged(() => updateUserPermissionsAction(ids.platformAdmin, []));
    await expectDeniedAndUnchanged(() => updateUserAction(ids.platformAdmin, updateInput({ directPermissionIds: [] })));
  });

  it('denies disablement without changing the account or its session', async () => {
    await expectDeniedAndUnchanged(() => disableUserAction(ids.platformAdmin));
  });

  it('denies reactivation without changing the account or its session', async () => {
    await prisma.user.update({ where: { id: ids.platformAdmin }, data: { isActive: false } });
    await expectDeniedAndUnchanged(() => enableUserAction(ids.platformAdmin));
  });

  it('allows supported platform-super-admin reads and non-credential edits', async () => {
    authState.current = platformActor();
    await expect(getUserForEditAction(ids.platformAdmin)).resolves.toMatchObject({ success: true });
    await expect(getLoginSessionsAction(ids.platformAdmin)).resolves.toMatchObject({ success: true });
    await expect(updateUserAction(ids.platformAdmin, updateInput({ name: 'Authorized platform edit' }))).resolves.toMatchObject({ success: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.platformAdmin } })).name).toBe('Authorized platform edit');
    expect((await prisma.loginSession.findUniqueOrThrow({ where: { id: ids.platformSession } })).logoutAt).toBeNull();
  });

  it('revokes active sessions after an authorized tenant credential change', async () => {
    await prisma.loginSession.update({ where: { id: ids.managedSession }, data: { logoutAt: null, expiresAt: new Date(Date.now() + 60_000) } });
    const result = await updateUserAction(ids.managedUser, {
      name: 'Managed tenant user',
      email: `managed-user-${suffix}@example.test`,
      phone: null,
      password: 'new-managed-password',
      roleId: ids.memberRole,
      departmentId: ids.department,
      reportsToUserId: null,
      isActive: true,
      accessMode: 'ANY_IP',
      allowedIps: [],
    });
    expect(result.success).toBe(true);
    expect((await prisma.loginSession.findUniqueOrThrow({ where: { id: ids.managedSession } })).logoutAt).not.toBeNull();
  });
});
