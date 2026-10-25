import { afterEach, describe, expect, it, vi } from 'vitest';
import { expandPlanFeatures, filterPermissionsForPlan, hasPlanFeature, isRouteIncluded, navigationModulesForFeatures, READ_ONLY_GRACE_MS, resolveSubscriptionAccess, resolveSubscriptionFeatures } from '@/lib/platform/entitlements';
import { hasPermission } from '@/lib/permissions';

describe('plan feature entitlements', () => {
  afterEach(() => vi.useRealTimers());
  it('expands legacy plan bundles into exact application features', () => {
    const starter = expandPlanFeatures(['crm', 'tasks', 'permissions', 'reports', 'ai-limited']);
    expect(starter).toEqual(expect.arrayContaining(['dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tickets', 'reports', 'ai_assistant']));
    expect(starter).not.toContain('workflows'); expect(starter).not.toContain('ai_research');
    const growth = expandPlanFeatures(['crm', 'tasks', 'permissions-advanced', 'analytics', 'workflows', 'integrations', 'audit-expanded', 'ai-expanded']);
    expect(growth).toEqual(expect.arrayContaining(['workflows', 'integrations', 'audit_logs', 'ai_assistant', 'ai_research']));
  });
  it('uses the current plan as the route and navigation source of truth', () => {
    const starter = expandPlanFeatures(['crm', 'tasks']);
    expect(isRouteIncluded('/deals/123', starter)).toBe(true);
    expect(isRouteIncluded('/settings/workflows', starter)).toBe(false);
    expect(isRouteIncluded('/ai-school-research', starter)).toBe(false);
    expect(navigationModulesForFeatures(starter)).toContain('deals');
    expect(navigationModulesForFeatures(starter)).not.toContain('reports');
  });
  it('removes server permissions on downgrade and restores them on upgrade', () => {
    const rolePermissions = ['deals.view', 'tickets.create', 'workflows.view', 'ai_research.run', 'organization_settings.view'];
    const starter = expandPlanFeatures(['crm', 'tasks']);
    const growth = expandPlanFeatures(['crm', 'tasks', 'workflows', 'ai-expanded']);
    expect(filterPermissionsForPlan(rolePermissions, starter)).toEqual(['deals.view', 'tickets.create', 'organization_settings.view']);
    expect(filterPermissionsForPlan(rolePermissions, growth)).toEqual(rolePermissions);
    expect(filterPermissionsForPlan(rolePermissions, null)).toEqual(['organization_settings.view']);
    expect(filterPermissionsForPlan(['future_paid_feature.use'], null)).toEqual([]);
  });
  it('supports precise feature removal and fails closed for missing commercial state', () => {
    expect(hasPlanFeature({ planFeatures: ['clients'] }, 'clients')).toBe(true);
    expect(hasPlanFeature({ planFeatures: ['clients'] }, 'leads')).toBe(false);
    expect(hasPlanFeature({ planFeatures: null }, 'workflows')).toBe(false);
    expect(isRouteIncluded('/settings/workflows', null)).toBe(false);
  });
  it('grants configured features only for a valid active plan or explicit unexpired trial', () => {
    const plan = { features: JSON.stringify(['crm', 'workflows']), isActive: true };
    const now = new Date('2026-10-14T12:00:00Z');
    const base = { startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: null, plan };
    expect(resolveSubscriptionFeatures({ ...base, status: 'ACTIVE' }, now)).toContain('workflows');
    expect(resolveSubscriptionAccess({ ...base, status: 'PAST_DUE' }, now).readOnly).toBe(true);
    expect(resolveSubscriptionAccess({ ...base, status: 'CANCELLED' }, now).readOnly).toBe(true);
    expect(resolveSubscriptionAccess({ ...base, status: 'EXPIRED' }, now).features).toContain('workflows');
    expect(resolveSubscriptionAccess({ ...base, status: 'TRIAL' }, now).state).toBe('TRIAL_EXPIRED');
    expect(resolveSubscriptionFeatures({ ...base, status: 'TRIAL', endsAt: new Date('2026-10-15T00:00:00Z') }, now)).toContain('workflows');
    expect(resolveSubscriptionAccess({ ...base, status: 'TRIAL', endsAt: new Date('2026-10-15T00:00:00Z') }, now).state).toBe('TRIAL_EXPIRING');
    expect(resolveSubscriptionAccess({ ...base, status: 'TRIAL', endsAt: new Date('2026-10-15T12:00:00Z') }, now).state).toBe('TRIAL_EXPIRING');
    expect(resolveSubscriptionAccess({ ...base, status: 'TRIAL', endsAt: new Date('2026-10-15T12:00:00.001Z') }, now).state).toBe('ACTIVE_TRIAL');
    expect(resolveSubscriptionAccess({ ...base, status: 'TRIAL', endsAt: new Date('2026-10-13T00:00:00Z') }, now)).toMatchObject({ state: 'TRIAL_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionFeatures(null, now)).toEqual(['dashboard']);
    expect(resolveSubscriptionFeatures({ ...base, status: 'ACTIVE', plan: { features: 'not-json', isActive: true } }, now)).toEqual(['dashboard']);
  });
  it('removes mutating permissions but preserves authorized reads in read-only commercial states', () => {
    const user = { role: 'ADMIN', isPlatformAdmin: false, workspaceReadOnly: true, permissions: ['deals.view', 'deals.create', 'schools.export', 'schools.import'] } as any;
    expect(hasPermission(user, 'deals.view')).toBe(true);
    expect(hasPermission(user, 'schools.export')).toBe(true);
    expect(hasPermission(user, 'deals.create')).toBe(false);
    expect(hasPermission(user, 'schools.import')).toBe(false);
  });

  it('keeps expired trial and paid subscriptions read-only for exactly 72 hours', () => {
    const end = new Date('2026-10-20T00:00:00.000Z');
    const plan = { features: JSON.stringify(['crm']), isActive: true };
    const trial = { status: 'TRIAL', startsAt: new Date('2026-10-01T00:00:00.000Z'), endsAt: end, trialEndsAt: end, plan };
    const paid = { status: 'ACTIVE', startsAt: new Date('2026-10-01T00:00:00.000Z'), endsAt: end, plan };
    expect(resolveSubscriptionAccess(trial, new Date(end.getTime() - 1)).state).toBe('TRIAL_EXPIRING');
    expect(resolveSubscriptionAccess(trial, end)).toMatchObject({ state: 'TRIAL_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(trial, new Date(end.getTime() + 1)).state).toBe('TRIAL_READ_ONLY_GRACE');
    expect(resolveSubscriptionAccess(trial, new Date(end.getTime() + READ_ONLY_GRACE_MS - 1))).toMatchObject({ state: 'TRIAL_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(trial, new Date(end.getTime() + READ_ONLY_GRACE_MS))).toMatchObject({ state: 'TRIAL_EXPIRED', readOnly: true });
    expect(resolveSubscriptionAccess(trial, new Date(end.getTime() + READ_ONLY_GRACE_MS + 1))).toMatchObject({ state: 'TRIAL_EXPIRED', readOnly: true });
    expect(resolveSubscriptionAccess(paid, new Date(end.getTime() - 1))).toMatchObject({ state: 'PAID_ACTIVE', readOnly: false });
    expect(resolveSubscriptionAccess(paid, end)).toMatchObject({ state: 'PAID_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(paid, new Date(end.getTime() + 1))).toMatchObject({ state: 'PAID_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(paid, new Date(end.getTime() + READ_ONLY_GRACE_MS - 1))).toMatchObject({ state: 'PAID_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(paid, new Date(end.getTime() + READ_ONLY_GRACE_MS))).toMatchObject({ state: 'PAID_EXPIRED', readOnly: true });
    expect(resolveSubscriptionAccess(paid, new Date(end.getTime() + READ_ONLY_GRACE_MS + 1))).toMatchObject({ state: 'PAID_EXPIRED', readOnly: true });
  });

  it('retains paid access for a cancelled subscription through its paid end date', () => {
    const end = new Date('2026-11-20T00:00:00.000Z');
    const cancelled = { status: 'CANCELLED', startsAt: new Date('2026-10-20T00:00:00.000Z'), endsAt: end, plan: { features: JSON.stringify(['crm']), isActive: true } };
    expect(resolveSubscriptionAccess(cancelled, new Date(end.getTime() - 1))).toMatchObject({ state: 'PAID_ACTIVE', readOnly: false });
    expect(resolveSubscriptionAccess(cancelled, end)).toMatchObject({ state: 'PAID_READ_ONLY_GRACE', readOnly: true });
    expect(resolveSubscriptionAccess(cancelled, new Date(end.getTime() + READ_ONLY_GRACE_MS))).toMatchObject({ state: 'PAID_EXPIRED', readOnly: true });
  });

  it('preserves trial identity after persistence changes the status to EXPIRED', () => {
    const end = new Date('2026-10-20T00:00:00.000Z');
    const plan = { features: JSON.stringify(['crm']), isActive: true };
    const expiredTrial = { status: 'EXPIRED', startsAt: new Date('2026-10-13T00:00:00.000Z'), endsAt: end, trialEndsAt: end, plan };
    const expiredPaid = { ...expiredTrial, startsAt: new Date('2026-09-20T00:00:00.000Z'), trialEndsAt: new Date('2026-09-01T00:00:00.000Z') };
    expect(resolveSubscriptionAccess(expiredTrial, end).state).toBe('TRIAL_READ_ONLY_GRACE');
    expect(resolveSubscriptionAccess(expiredTrial, new Date(end.getTime() + READ_ONLY_GRACE_MS)).state).toBe('TRIAL_EXPIRED');
    expect(resolveSubscriptionAccess(expiredPaid, end).state).toBe('PAID_READ_ONLY_GRACE');
    expect(resolveSubscriptionAccess({ ...expiredPaid, status: 'PAST_DUE' }, end).state).toBe('PAID_READ_ONLY_GRACE');
    expect(resolveSubscriptionAccess({ ...expiredPaid, status: 'CANCELLED' }, new Date(end.getTime() + READ_ONLY_GRACE_MS)).state).toBe('PAID_EXPIRED');
  });

  it('fails closed for missing or inconsistent timestamps and inactive plans', () => {
    const now = new Date('2026-10-20T00:00:00.000Z');
    const plan = { features: JSON.stringify(['crm']), isActive: true };
    const startsAt = new Date('2026-10-01T00:00:00.000Z');
    expect(resolveSubscriptionAccess(null, now)).toMatchObject({ state: 'UNASSIGNED', readOnly: true });
    expect(resolveSubscriptionAccess({ status: 'ACTIVE', startsAt, endsAt: null, plan: { ...plan, isActive: false } }, now)).toMatchObject({ state: 'UNASSIGNED', readOnly: true });
    expect(resolveSubscriptionAccess({ status: 'TRIAL', startsAt, endsAt: null, plan }, now)).toMatchObject({ state: 'TRIAL_EXPIRED', readOnly: true });
    expect(resolveSubscriptionAccess({ status: 'EXPIRED', startsAt, endsAt: null, trialEndsAt: null, plan }, now)).toMatchObject({ state: 'PAID_EXPIRED', readOnly: true });
  });

  it('uses the supplied server time even when the client clock disagrees', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T00:00:00.000Z'));
    const end = new Date('2026-10-20T00:00:00.000Z');
    const serverNow = new Date(end.getTime() + 1);
    const access = resolveSubscriptionAccess({ status: 'TRIAL', startsAt: new Date('2026-10-13T00:00:00.000Z'), endsAt: end, trialEndsAt: end, plan: { features: '[]', isActive: true } }, serverNow);
    expect(access).toMatchObject({ state: 'TRIAL_READ_ONLY_GRACE', readOnly: true });
  });
});
