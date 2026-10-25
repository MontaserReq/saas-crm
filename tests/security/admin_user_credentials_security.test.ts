import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  requireAuth,
  hashPassword,
  hasPermission,
  requireOrganizationId,
  canManageProtectedAccount,
  isPlatformSuperAdmin,
  auditLog,
  revalidatePath,
} = vi.hoisted(() => ({
  db: {} as Record<string, any>,
  requireAuth: vi.fn(),
  hashPassword: vi.fn(),
  hasPermission: vi.fn(),
  requireOrganizationId: vi.fn(),
  canManageProtectedAccount: vi.fn(),
  isPlatformSuperAdmin: vi.fn(),
  auditLog: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ default: db }));
vi.mock('@/lib/auth/session', () => ({ requireAuth, hashPassword, verifyPassword: vi.fn(), createSession: vi.fn() }));
vi.mock('@/lib/permissions', () => ({
  hasPermission,
  PERMISSIONS: {
    USERS_UPDATE: 'users.update',
    USERS_ENABLE: 'users.enable',
    USERS_DISABLE: 'users.disable',
    USERS_MANAGE_ACCESS_RESTRICTIONS: 'users.manage_access_restrictions',
    USERS_MANAGE_ROLES: 'users.manage_roles',
    USERS_MANAGE_REPORTING: 'users.manage_reporting',
    USERS_MANAGE_PERMISSIONS: 'users.manage_permissions',
  },
}));
vi.mock('@/lib/auth/organization', () => ({ requireOrganizationId }));
vi.mock('@/lib/security/platform', () => ({
  canManageProtectedAccount,
  isProtectedPlatformAccount: vi.fn(),
  isPlatformSuperAdmin,
}));
vi.mock('@/lib/platform/userCapacity', () => ({ assertOrganizationUserCapacity: vi.fn() }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: vi.fn(), RATE_LIMIT_POLICY_CONFIG: {} }));
vi.mock('@/lib/security/request', () => ({ getRequestContext: vi.fn() }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: auditLog } }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { updateUserAction } from '@/server/actions/users';

const existingUser = {
  name: 'Managed User',
  email: 'managed@example.test',
  phone: null,
  roleId: 'role-member',
  departmentId: 'dept-a',
  isActive: true,
  accessMode: 'ANY_IP',
  allowedIps: '[]',
  reportsToUserId: null,
  userPermissions: [],
  isPlatformAdmin: false,
  role: { name: 'MEMBER' },
};

const input = (changes: { email?: string; password?: string } = {}) => ({
  name: existingUser.name,
  email: changes.email ?? existingUser.email,
  phone: existingUser.phone,
  password: changes.password ?? '',
  roleId: existingUser.roleId,
  departmentId: existingUser.departmentId,
  isActive: true,
  accessMode: 'ANY_IP',
  allowedIps: [],
  reportsToUserId: null,
});

describe('administrator credential updates and session invalidation', () => {
  let tx: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ id: 'actor-a', sessionId: 'actor-session', organizationId: 'org-a', permissions: ['users.update'] });
    requireOrganizationId.mockReturnValue('org-a');
    hasPermission.mockReturnValue(true);
    canManageProtectedAccount.mockReturnValue(true);
    isPlatformSuperAdmin.mockReturnValue(false);
    hashPassword.mockResolvedValue('new-hash');
    auditLog.mockResolvedValue(undefined);

    tx = {
      user: {
        update: vi.fn(async ({ where, data }: any) => ({
          id: where.id,
          ...existingUser,
          ...data,
          allowedIps: data.allowedIps ?? existingUser.allowedIps,
        })),
      },
      userPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
      loginSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    Object.assign(db, {
      user: { findFirst: vi.fn().mockResolvedValue(existingUser) },
      department: { findFirst: vi.fn().mockResolvedValue({ id: 'dept-a' }) },
      role: { findUnique: vi.fn() },
      permission: { count: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });
  });

  it('preserves all sessions for an email-only change', async () => {
    const result = await updateUserAction('managed-user', input({ email: 'renamed@example.test' }));

    expect(result.success).toBe(true);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(tx.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it('invalidates all active target sessions for a password-only change made by another administrator', async () => {
    const result = await updateUserAction('managed-user', input({ password: 'new-password' }));

    expect(result.success).toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'new-hash' }) }));
    expect(tx.loginSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'managed-user', logoutAt: null },
      data: { logoutAt: expect.any(Date) },
    });
  });

  it('uses password policy when email and password change together', async () => {
    const result = await updateUserAction('managed-user', input({ email: 'renamed@example.test', password: 'new-password' }));

    expect(result.success).toBe(true);
    expect(tx.loginSession.updateMany).toHaveBeenCalledOnce();
    expect(tx.loginSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'managed-user', logoutAt: null },
      data: { logoutAt: expect.any(Date) },
    });
  });

  it('fails the action when session invalidation fails inside the credential transaction', async () => {
    tx.loginSession.updateMany.mockRejectedValueOnce(new Error('SESSION_INVALIDATION_FAILED'));

    expect(await updateUserAction('managed-user', input({ password: 'new-password' }))).toEqual({
      success: false,
      error: 'SESSION_INVALIDATION_FAILED',
    });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledOnce();
    expect(auditLog).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('preserves the current session when an administrator changes their own password', async () => {
    requireAuth.mockResolvedValue({ id: 'managed-user', sessionId: 'current-session', organizationId: 'org-a', permissions: ['users.update'] });

    const result = await updateUserAction('managed-user', input({ password: 'new-password' }));

    expect(result.success).toBe(true);
    expect(tx.loginSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'managed-user', logoutAt: null, id: { not: 'current-session' } },
      data: { logoutAt: expect.any(Date) },
    });
  });
});
