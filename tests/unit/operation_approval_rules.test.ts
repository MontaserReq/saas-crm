import { describe, expect, it } from 'vitest';
import { OperationApprovalService, parseApprovalRules } from '@/server/services/OperationApprovalService';
import type { UserSession } from '@/types';

const session = (role: UserSession['role'], permissions: string[] = []): UserSession => ({
  id: 'user-1',
  name: 'Test User',
  email: 'user@example.test',
  role,
  roleDisplayName: role,
  departmentId: 'department-1',
  departmentName: 'Operations',
  organizationId: 'organization-1',
  permissions,
});

describe('configurable operation approvals', () => {
  it('merges stored rules with safe disabled defaults', () => {
    const rules = parseApprovalRules(JSON.stringify({ CLIENT: { CREATE: true } }));
    expect(rules.CLIENT).toEqual({ CREATE: true, UPDATE: false, DELETE: false });
    expect(rules.DEAL).toEqual({ CREATE: false, UPDATE: false, DELETE: false });
  });

  it('falls back to disabled rules for malformed configuration', () => {
    const rules = parseApprovalRules('{invalid');
    expect(Object.values(rules).every((operations) => Object.values(operations).every((enabled) => enabled === false))).toBe(true);
  });

  it('lets company and platform admins execute directly while regular members require configured policy evaluation', () => {
    expect(OperationApprovalService.canBypass(session('SUPER_ADMIN'))).toBe(true);
    expect(OperationApprovalService.canBypass(session('PLATFORM_ADMIN'))).toBe(true);
    expect(OperationApprovalService.canBypass(session('MEMBER'))).toBe(false);
    expect(OperationApprovalService.canBypass(session('ADMIN', ['approval_requests.decide']))).toBe(true);
  });
});
