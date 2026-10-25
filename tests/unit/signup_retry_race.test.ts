import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSetup } from '@/lib/onboarding/templates';

const mocks = vi.hoisted(() => ({
  db: { platformSetting: { findUnique: vi.fn() }, platformSubscription: { findUniqueOrThrow: vi.fn() }, user: { findUnique: vi.fn() }, role: { findUnique: vi.fn() }, auditLog: { findFirst: vi.fn() }, loginSession: { create: vi.fn() }, userPermission: { findMany: vi.fn() }, $transaction: vi.fn() },
  verify: vi.fn(), session: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({ default: mocks.db }));
vi.mock('@/lib/auth/session', () => ({ verifyPassword: mocks.verify, hashPassword: vi.fn(), createSession: mocks.session, destroySession: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: '12345678-1234-1234-1234-123456789012' }), set: vi.fn() }) }));
vi.mock('@/lib/security/request', () => ({ getRequestContext: async () => ({ ipAddress: '127.0.0.1', userAgent: 'test' }), parseAllowedIps: vi.fn() }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: async () => ({ allowed: true }), consumeRateLimit: vi.fn(), peekRateLimit: vi.fn(), RATE_LIMIT_POLICY_CONFIG: { login: { limit: 10, windowSeconds: 900 } } }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: vi.fn() } }));
import { registerOrganizationAction } from '@/server/actions/auth';

const input = { workspace: 'Example workspace', name: 'Example owner', email: 'owner@example.test', password: 'ExamplePassword123!', confirmPassword: 'ExamplePassword123!' };
function owner(patch = {}) {
  return { id: 'owner', email: input.email, name: input.name, passwordHash: 'stored-hash', roleId: 'company-super-admin-role', isActive: true, isPlatformAdmin: false, accessMode: 'ANY_IP', department: { id: 'department', name: 'Management' }, organizationMemberships: [{ roleId: 'company-super-admin-role', organization: { id: 'organization', name: input.workspace, settings: { onboardingState: JSON.stringify(initialSetup('owner', input.workspace, 'en')) }, platformSubscription: { id: 'subscription' } } }], ...patch };
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.verify.mockResolvedValue(true);
  mocks.db.role.findUnique.mockResolvedValue({ id: 'company-super-admin-role', displayName: 'Company Super Admin', rolePermissions: [] });
  mocks.db.auditLog.findFirst.mockResolvedValue({ entityId: '12345678-1234-1234-1234-123456789012', createdAt: new Date() });
  mocks.db.userPermission.findMany.mockResolvedValue([{ permission: { code: 'organization_settings.manage' } }]);
  mocks.db.loginSession.create.mockResolvedValue({});
  const startsAt = new Date('2026-10-14T12:00:00.000Z');
  mocks.db.platformSubscription.findUniqueOrThrow.mockResolvedValue({
    status: 'TRIAL', startsAt, endsAt: new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    trialStartedAt: startsAt, trialEndsAt: new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    plan: { name: 'Configured trial plan', slug: 'configured-trial', features: '[]' },
  });
});

describe('credential-verified signup retry during concurrent account creation', () => {
  it('rechecks recovery when another request commits between the initial read and existence check', async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'owner' }).mockResolvedValue(owner());
    const result = await registerOrganizationAction(input);
    expect(result.success).toBe(true); expect(result.state?.ownerId).toBe('owner');
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.verify).toHaveBeenCalledWith(input.password, 'stored-hash');
    expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner', organizationId: 'organization', role: 'SUPER_ADMIN', isPlatformAdmin: false }));
  });
  it('does not mint a session when credentials differ from the committed account', async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'owner' }).mockResolvedValue(owner());
    mocks.verify.mockResolvedValue(false);
    expect((await registerOrganizationAction(input)).success).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('retains the restriction against recovering restricted-IP accounts', async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'owner' }).mockResolvedValue(owner({ accessMode: 'RESTRICTED_IPS' }));
    expect((await registerOrganizationAction(input)).success).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('does not recover or authorize an organization left without a subscription', async () => {
    const withoutSubscription = owner();
    withoutSubscription.organizationMemberships[0].organization.platformSubscription = null as any;
    mocks.db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'owner' }).mockResolvedValue(withoutSubscription);
    expect((await registerOrganizationAction(input)).success).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
