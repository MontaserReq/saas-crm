import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAN_USER_LIMIT_REACHED, PLAN_USER_LIMIT_UNAVAILABLE } from '@/lib/platform/userCapacity';

const { db, requireAuth, hashPassword, hasPermission, requireOrganizationId, isPlatformSuperAdmin, canManageProtectedAccount, auditLog, revalidatePath, PERMISSIONS } = vi.hoisted(() => ({
  db: {} as Record<string, any>,
  requireAuth: vi.fn(),
  hashPassword: vi.fn(),
  hasPermission: vi.fn(),
  requireOrganizationId: vi.fn(),
  isPlatformSuperAdmin: vi.fn(),
  canManageProtectedAccount: vi.fn(),
  auditLog: vi.fn(),
  revalidatePath: vi.fn(),
  PERMISSIONS: {
    USERS_CREATE: 'users.create', USERS_UPDATE: 'users.update', USERS_ENABLE: 'users.enable', USERS_DISABLE: 'users.disable',
    USERS_MANAGE_REPORTING: 'users.manage_reporting', USERS_MANAGE_ROLES: 'users.manage_roles', USERS_MANAGE_ACCESS_RESTRICTIONS: 'users.manage_access', USERS_MANAGE_PERMISSIONS: 'users.manage_permissions',
  },
}));

vi.mock('@/lib/db/prisma', () => ({ default: db }));
vi.mock('@/lib/auth/session', () => ({ requireAuth, hashPassword }));
vi.mock('@/lib/permissions', () => ({ hasPermission, PERMISSIONS }));
vi.mock('@/lib/auth/organization', () => ({ requireOrganizationId }));
vi.mock('@/lib/security/platform', () => ({ canManageProtectedAccount, isProtectedPlatformAccount: vi.fn(), isPlatformSuperAdmin }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: auditLog } }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { createUserAction, enableUserAction } from '@/server/actions/users';

const input = (email = 'new@example.test') => ({
  name: 'New User', email, password: 'password', roleId: 'role-member', departmentId: 'dept-a', isActive: true, accessMode: 'ANY_IP', allowedIps: [],
});

function configureDatabase(options: { initialMembers?: number; userLimit?: number | null; planActive?: boolean; subscription?: boolean; organization?: boolean; membershipFailure?: boolean } = {}) {
  let members = options.initialMembers ?? 0;
  const createdUsers: string[] = [];
  let nextId = 1;
  let transactionTail = Promise.resolve();
  const order: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => { order.push('lock'); return options.organization === false ? [] : [{ id: 'org-a' }]; }),
    platformSubscription: {
      findUnique: vi.fn(async () => {
        order.push('subscription');
        return options.subscription === false ? null : { plan: { userLimit: options.userLimit === undefined ? 2 : options.userLimit, isActive: options.planActive !== false } };
      }),
    },
    organizationMember: {
      count: vi.fn(async () => { order.push('count'); return members; }),
      create: vi.fn(async () => {
        order.push('membership');
        if (options.membershipFailure) throw new Error('MEMBERSHIP_WRITE_FAILED');
        members += 1;
        return { id: `member-${members}` };
      }),
    },
    user: {
      create: vi.fn(async () => {
        order.push('user');
        const id = `user-${nextId++}`;
        createdUsers.push(id);
        return { id, name: 'New User', email: 'new@example.test', phone: null, roleId: 'role-member', departmentId: 'dept-a', reportsToUserId: null, isActive: true };
      }),
      update: vi.fn(async () => ({ id: 'disabled-user', name: 'Disabled User', email: 'disabled@example.test', isActive: true })),
    },
  };
  Object.assign(db, {
    department: { findFirst: vi.fn().mockResolvedValue({ id: 'dept-a' }) },
    role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-member', name: 'MEMBER' }) },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({ id: 'disabled-user', isActive: false, isPlatformAdmin: false, role: { name: 'MEMBER' } }),
    },
    permission: { count: vi.fn() },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const membersBefore = members;
      const usersBefore = createdUsers.length;
      try { return await callback(tx); }
      catch (error) { members = membersBefore; createdUsers.splice(usersBefore); throw error; }
      finally { release(); }
    }),
  });
  return { tx, order, createdUsers, memberCount: () => members };
}

describe('server-side plan user limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ id: 'admin-a', organizationId: 'org-a', permissions: ['users.create'], role: 'ADMIN' });
    requireOrganizationId.mockReturnValue('org-a');
    hasPermission.mockImplementation((_user: unknown, permission: string) => permission === 'users.create');
    isPlatformSuperAdmin.mockReturnValue(false);
    canManageProtectedAccount.mockReturnValue(true);
    hashPassword.mockResolvedValue('hash');
    auditLog.mockResolvedValue(undefined);
  });

  it('allows creation below the limit and locks before counting and writing', async () => {
    const state = configureDatabase({ initialMembers: 1 });
    expect((await createUserAction(input())).success).toBe(true);
    expect(state.order).toEqual(['lock', 'subscription', 'count', 'user', 'membership']);
    expect(state.tx.organizationMember.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', status: 'ACTIVE', user: { isActive: true } } });
  });

  it.each([2, 3])('rejects creation at or above the limit (%s) without partial writes', async (initialMembers) => {
    const state = configureDatabase({ initialMembers });
    const result = await createUserAction(input());
    expect(result).toEqual({ success: false, error: PLAN_USER_LIMIT_REACHED });
    expect(state.tx.user.create).not.toHaveBeenCalled();
    expect(state.tx.organizationMember.create).not.toHaveBeenCalled();
    expect(state.createdUsers).toEqual([]);
    expect(state.memberCount()).toBe(initialMembers);
  });

  it.each([
    ['missing subscription', { subscription: false }],
    ['inactive plan', { planActive: false }],
    ['missing organization lock target', { organization: false }],
    ['invalid zero limit', { userLimit: 0 }],
  ] as const)('fails closed for %s', async (_label, options) => {
    const state = configureDatabase(options);
    expect(await createUserAction(input())).toEqual({ success: false, error: PLAN_USER_LIMIT_UNAVAILABLE });
    expect(state.tx.user.create).not.toHaveBeenCalled();
  });

  it('preserves the existing explicit null unlimited-plan policy', async () => {
    const state = configureDatabase({ initialMembers: 50, userLimit: null });
    expect((await createUserAction(input())).success).toBe(true);
    expect(state.tx.organizationMember.count).not.toHaveBeenCalled();
  });

  it('allows only one of two concurrent creations to consume the final seat', async () => {
    const state = configureDatabase({ initialMembers: 1 });
    const results = await Promise.all([createUserAction(input('first@example.test')), createUserAction(input('second@example.test'))]);
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => !result.success)).toEqual([expect.objectContaining({ error: PLAN_USER_LIMIT_REACHED })]);
    expect(state.tx.user.create).toHaveBeenCalledTimes(1);
    expect(state.memberCount()).toBe(2);
  });

  it('applies the same locked quota check when re-enabling a counted membership', async () => {
    const state = configureDatabase({ initialMembers: 2 });
    hasPermission.mockImplementation((_user: unknown, permission: string) => permission === 'users.enable');
    expect(await enableUserAction('disabled-user')).toEqual({ success: false, error: PLAN_USER_LIMIT_REACHED });
    expect(state.tx.organizationMember.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', status: 'ACTIVE', user: { isActive: true }, userId: { not: 'disabled-user' } },
    });
    expect(state.tx.user.update).not.toHaveBeenCalled();
  });

  it('reports a transaction failure and the transaction fixture rolls back staged writes', async () => {
    const state = configureDatabase({ initialMembers: 1, membershipFailure: true });
    expect(await createUserAction(input())).toEqual({ success: false, error: 'MEMBERSHIP_WRITE_FAILED' });
    expect(state.tx.user.create).toHaveBeenCalledOnce();
    expect(state.tx.organizationMember.create).toHaveBeenCalledOnce();
    expect(state.createdUsers).toEqual([]);
    expect(state.memberCount()).toBe(1);
  });

  it('wires the shared guard into every production path that can add a counted seat', () => {
    const users = fs.readFileSync(path.resolve(__dirname, '../../src/server/actions/users.ts'), 'utf8');
    const platform = fs.readFileSync(path.resolve(__dirname, '../../src/server/services/PlatformAdminService.ts'), 'utf8');
    expect(users.match(/assertOrganizationUserCapacity\(/g)).toHaveLength(3);
    expect(platform).toMatch(/case 'users':[\s\S]*?assertOrganizationUserCapacity\(tx, data\.organizationId/);
  });
});
