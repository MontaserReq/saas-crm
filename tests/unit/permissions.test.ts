import { describe, it, expect } from 'vitest';
import { hasPermission, hasRole, requirePermission, PERMISSIONS } from '@/lib/permissions';
import { UserSession } from '@/types';

describe('RBAC & Permission Checking', () => {
  const superAdmin: UserSession = {
    id: 'user-super',
    name: 'Super Admin',
    email: 'super@codeline.jo',
    role: 'SUPER_ADMIN',
    roleDisplayName: 'Super Admin',
    departmentId: 'dept-1',
    departmentName: 'Management',
    permissions: [],
  };

  const member: UserSession = {
    id: 'user-member-1',
    name: 'Ahmad',
    email: 'ahmad@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-pr',
    departmentName: 'PR',
    permissions: [
      PERMISSIONS.TICKETS_VIEW_ASSIGNED,
      PERMISSIONS.TICKETS_MARK_SEEN,
      PERMISSIONS.TICKETS_ACCEPT,
      PERMISSIONS.TICKETS_REJECT,
      PERMISSIONS.TICKETS_ADD_NOTE,
      PERMISSIONS.TODO_MANAGE_OWN,
    ],
  };

  it('Super Admin automatically bypasses all permission checks', () => {
    expect(hasPermission(superAdmin, PERMISSIONS.USERS_CREATE)).toBe(true);
    expect(hasPermission(superAdmin, PERMISSIONS.TICKETS_VIEW_ALL)).toBe(true);
    expect(hasPermission(superAdmin, PERMISSIONS.AUDIT_LOGS_VIEW)).toBe(true);
  });

  it('Member has only explicitly granted permissions', () => {
    expect(hasPermission(member, PERMISSIONS.TICKETS_VIEW_ASSIGNED)).toBe(true);
    expect(hasPermission(member, PERMISSIONS.TICKETS_MARK_SEEN)).toBe(true);
    expect(hasPermission(member, PERMISSIONS.TICKETS_VIEW_ALL)).toBe(false);
    expect(hasPermission(member, PERMISSIONS.USERS_CREATE)).toBe(false);
    expect(hasPermission(member, PERMISSIONS.AUDIT_LOGS_VIEW)).toBe(false);
  });

  it('Role checking helper works accurately', () => {
    expect(hasRole(superAdmin, ['MEMBER'])).toBe(true); // Super admin inherits
    expect(hasRole(member, ['MEMBER'])).toBe(true);
    expect(hasRole(member, ['ADMIN'])).toBe(false);
  });

  it('central permission guard rejects revoked permissions and accepts grants', () => {
    expect(() => requirePermission(member, PERMISSIONS.TICKETS_VIEW_ASSIGNED)).not.toThrow();
    expect(() => requirePermission(member, PERMISSIONS.USERS_MANAGE_PERMISSIONS)).toThrow(/Forbidden/);
    expect(() => requirePermission(null, PERMISSIONS.TICKETS_VIEW_ASSIGNED)).toThrow(/Forbidden/);
  });
});
