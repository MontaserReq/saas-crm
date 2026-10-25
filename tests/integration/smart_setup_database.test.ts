import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnvConfig } from '@next/env';
import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { OnboardingService } from '@/server/services/OnboardingService';
import { initialSetup, readSetupState } from '@/lib/onboarding/templates';
import { PERMISSIONS } from '@/lib/permissions';
import { expandPlanFeatures } from '@/lib/platform/entitlements';
import type { UserSession } from '@/types';

const mocks = vi.hoisted(() => ({ cookies: new Map<string, string>(), session: vi.fn(), auth: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => mocks.cookies.has(key) ? { value: mocks.cookies.get(key) } : undefined, set: (key: string, value: string) => { mocks.cookies.set(key, value); } }) }));
vi.mock('@/lib/security/request', () => ({ getRequestContext: async () => ({ ipAddress: '127.0.0.1', userAgent: 'smart-setup-test' }), parseAllowedIps: () => [] }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: async () => ({ allowed: true }), consumeRateLimit: vi.fn(), peekRateLimit: vi.fn(), RATE_LIMIT_POLICY_CONFIG: { login: { limit: 10, windowSeconds: 900 } } }));
vi.mock('@/lib/auth/session', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/auth/session')>(), createSession: mocks.session, requireAuth: mocks.auth }));
import { registerOrganizationAction } from '@/server/actions/auth';
import { saveOnboardingAction } from '@/server/actions/onboarding';
import { updateLeadAction } from '@/server/actions/crm';

const run = process.env.RUN_SMART_SETUP_DB === '1';
if (run) loadEnvConfig(process.cwd());
const suffix = crypto.randomUUID();
const orgIds: string[] = [];
const attemptIds = new Set<string>();
let a: UserSession, b: UserSession;
let previousDefaultPlan: { id: string; value: string } | null = null;
let createdAdminRole = false;
let createdLeadUpdatePermission = false;
let createdAdminLeadUpdateGrant = false;
let adminRoleId = '';
let leadUpdatePermissionId = '';
const inactivePlanSlug = `inactive-signup-test-${suffix}`;

async function register(label: string) {
  mocks.cookies.clear();
  const result = await registerOrganizationAction({ workspace: `Setup test ${label}`, name: 'Setup test owner', email: `setup-${suffix}-${label}@example.test`, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!', language: 'en' });
  const attempt = mocks.cookies.get('codeline_signup_attempt'); if (attempt) attemptIds.add(attempt);
  if (!result.success || !result.state) throw new Error(result.error || 'Registration failed');
  const session = mocks.session.mock.calls.at(-1)![0] as UserSession;
  if (session.organizationId && !orgIds.includes(session.organizationId)) orgIds.push(session.organizationId);
  const subscription = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: session.organizationId }, include: { plan: true } });
  session.planFeatures = expandPlanFeatures(subscription.plan.features);
  session.planName = subscription.plan.name;
  session.planSlug = subscription.plan.slug;
  expect(session.role).toBe('ADMIN'); expect(session.permissions).toContain(PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE);
  return session;
}
async function draft(user: UserSession, industry = 'services', priority = 'sales') {
  const state = initialSetup(user.id, 'Test company', 'en');
  await prisma.organizationSettings.update({ where: { organizationId: user.organizationId }, data: { onboardingState: JSON.stringify(state) } });
  return OnboardingService.save(user, { answers: { ...state.answers, industry, priority }, step: 3 });
}

describe.skipIf(!run)('Smart Setup PostgreSQL registration, provisioning and isolation', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    await prisma.$connect();
    let adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' }, select: { id: true } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: 'ADMIN', displayName: 'Administrator', isSystem: true }, select: { id: true } });
      createdAdminRole = true;
    }
    adminRoleId = adminRole.id;
    let leadUpdatePermission = await prisma.permission.findUnique({ where: { code: PERMISSIONS.SCHOOLS_UPDATE }, select: { id: true } });
    if (!leadUpdatePermission) {
      leadUpdatePermission = await prisma.permission.create({ data: { code: PERMISSIONS.SCHOOLS_UPDATE, name: 'Update CRM records', module: 'schools' }, select: { id: true } });
      createdLeadUpdatePermission = true;
    }
    leadUpdatePermissionId = leadUpdatePermission.id;
    const existingGrant = await prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: adminRole.id, permissionId: leadUpdatePermission.id } } });
    if (!existingGrant) {
      await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: leadUpdatePermission.id } });
      createdAdminLeadUpdateGrant = true;
    }
    const starter = await prisma.platformPlan.findFirst({ where: { slug: 'starter', isActive: true }, select: { id: true } });
    if (!starter) throw new Error('The migrated Starter plan catalog fixture is required');
    previousDefaultPlan = await prisma.platformSetting.findUnique({ where: { key: 'signup_default_plan_slug' }, select: { id: true, value: true } });
    if (previousDefaultPlan?.value !== 'starter') throw new Error('The approved Starter trial-entitlement policy migration is required');
    await prisma.platformSetting.upsert({ where: { key: 'signup_default_plan_slug' }, update: { value: 'starter' }, create: { key: 'signup_default_plan_slug', value: 'starter' } });
    await prisma.platformPlan.create({ data: { slug: inactivePlanSlug, name: 'Inactive signup test plan', features: '["crm"]', availability: 'self_serve', isActive: false } });
    a = await register('a'); b = await register('b');
  }, 30000);
  beforeEach(() => mocks.auth.mockResolvedValue(a));
  afterAll(async () => {
    if (orgIds.length) {
      const where = { organizationId: { in: orgIds } };
      await prisma.auditLog.deleteMany({ where }); await prisma.notification.deleteMany({ where: { OR: [where, { entityId: { in: orgIds }, type: 'ORGANIZATION_SIGNUP' }] } });
      await prisma.lead.deleteMany({ where }); await prisma.client.deleteMany({ where });
      await prisma.customFieldDefinition.deleteMany({ where }); await prisma.pipelineStage.deleteMany({ where }); await prisma.pipeline.deleteMany({ where });
      await prisma.platformSubscription.deleteMany({ where });
      const members = await prisma.organizationMember.findMany({ where, select: { userId: true } });
      await prisma.organizationMember.deleteMany({ where });
      await prisma.user.deleteMany({ where: { id: { in: members.map(member => member.userId) }, email: { startsWith: `setup-${suffix}-` } } });
      await prisma.department.deleteMany({ where }); await prisma.organization.deleteMany({ where: { id: { in: orgIds }, name: { startsWith: 'Setup test' } } });
      // Names can be changed by setup; these IDs are exclusively fixtures created above.
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    if (attemptIds.size) await prisma.auditLog.deleteMany({ where: { action: 'SIGNUP_STARTED', entityId: { in: [...attemptIds] } } });
    if (previousDefaultPlan) await prisma.platformSetting.upsert({ where: { key: 'signup_default_plan_slug' }, update: { value: previousDefaultPlan.value }, create: { id: previousDefaultPlan.id, key: 'signup_default_plan_slug', value: previousDefaultPlan.value } });
    else await prisma.platformSetting.deleteMany({ where: { key: 'signup_default_plan_slug' } });
    await prisma.platformPlan.deleteMany({ where: { slug: inactivePlanSlug } });
    if (createdAdminLeadUpdateGrant) await prisma.rolePermission.deleteMany({ where: { roleId: adminRoleId, permissionId: leadUpdatePermissionId } });
    if (createdAdminRole) await prisma.role.deleteMany({ where: { name: 'ADMIN', users: { none: {} }, organizationMembers: { none: {} } } });
    if (createdLeadUpdatePermission) await prisma.permission.deleteMany({ where: { id: leadUpdatePermissionId, rolePermissions: { none: {} }, userPermissions: { none: {} } } });
    await prisma.$disconnect();
  }, 30000);
  it('fails closed for missing, invalid, and inactive signup plans without partial entitlements', async () => {
    for (const [label, planValue] of [['missing', null], ['invalid', `missing-${suffix}`], ['inactive', inactivePlanSlug]] as const) {
      if (planValue === null) await prisma.platformSetting.deleteMany({ where: { key: 'signup_default_plan_slug' } });
      else await prisma.platformSetting.upsert({ where: { key: 'signup_default_plan_slug' }, update: { value: planValue }, create: { key: 'signup_default_plan_slug', value: planValue } });
      mocks.cookies.clear();
      const email = `setup-${suffix}-plan-${label}@example.test`;
      const before = { organizations: await prisma.organization.count(), subscriptions: await prisma.platformSubscription.count() };
      const result = await registerOrganizationAction({ workspace: `Plan ${label}`, name: 'Plan test owner', email, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!', language: 'en' });
      const attempt = mocks.cookies.get('codeline_signup_attempt'); if (attempt) attemptIds.add(attempt);
      expect(result).toMatchObject({ success: false, error: 'SIGNUP_PLAN_UNAVAILABLE' });
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(await prisma.organization.count()).toBe(before.organizations);
      expect(await prisma.platformSubscription.count()).toBe(before.subscriptions);
    }
    await prisma.platformSetting.upsert({ where: { key: 'signup_default_plan_slug' }, update: { value: 'starter' }, create: { key: 'signup_default_plan_slug', value: 'starter' } });
  });
  it('uses an explicitly configured active plan for a transactional tenant-isolated signup', async () => {
    const c = await register('configured-plan');
    const subscription = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: c.organizationId }, include: { plan: true } });
    expect(subscription).toMatchObject({ status: 'TRIAL', plan: { slug: 'starter', isActive: true } });
    expect(subscription.trialStartedAt).not.toBeNull();
    expect(subscription.trialEndsAt).not.toBeNull();
    expect(subscription.startsAt.getTime()).toBe(subscription.trialStartedAt!.getTime());
    expect(subscription.endsAt!.getTime()).toBe(subscription.trialEndsAt!.getTime());
    expect(subscription.trialEndsAt!.getTime() - subscription.trialStartedAt!.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(subscription.status).not.toBe('ACTIVE');
    expect(c.planFeatures).toEqual(expandPlanFeatures(subscription.plan.features));
    expect(await prisma.platformSubscription.count({ where: { organizationId: { not: c.organizationId }, organization: { members: { some: { userId: c.id } } } } })).toBe(0);
  }, 15000);
  it('creates one tenant, an ADMIN owner and resumable persisted progress', async () => {
    expect((await OnboardingService.get(a)).state).toMatchObject({ ownerId: a.id, status: 'PENDING', step: 1 });
    expect(await prisma.organizationMember.count({ where: { userId: a.id, status: 'ACTIVE' } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).isPlatformAdmin).toBe(false);
    await draft(a, 'real_estate');
    expect((await OnboardingService.get(a)).state?.answers.industry).toBe('real_estate');
  });
  it('recovers a lost signup response without creating another organization', async () => {
    const count = await prisma.organization.count();
    const before = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId } });
    const result = await registerOrganizationAction({ workspace: 'Ignored retry', name: 'Ignored retry', email: a.email, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!' });
    expect(result.success).toBe(true); expect(await prisma.organization.count()).toBe(count);
    const after = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId } });
    expect(after.trialStartedAt?.getTime()).toBe(before.trialStartedAt?.getTime());
    expect(after.trialEndsAt?.getTime()).toBe(before.trialEndsAt?.getTime());
    expect(mocks.session.mock.calls.at(-1)![0].id).toBe(a.id);
    const attempt = mocks.cookies.get('codeline_signup_attempt'); if (attempt) attemptIds.add(attempt);
  });
  it('recovers account creation when setting the login cookie fails', async () => {
    const input = { workspace: 'Setup test session-retry', name: 'Setup test owner', email: `setup-${suffix}-session-retry@example.test`, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!' };
    mocks.cookies.clear(); mocks.session.mockRejectedValueOnce(new Error('INJECTED_COOKIE_FAILURE'));
    expect((await registerOrganizationAction(input)).success).toBe(false);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email }, include: { organizationMemberships: true } });
    const organizationId = user.organizationMemberships[0].organizationId; orgIds.push(organizationId);
    const attempt = mocks.cookies.get('codeline_signup_attempt'); if (attempt) attemptIds.add(attempt);
    const recovered = await registerOrganizationAction(input);
    expect(recovered.success).toBe(true); expect(recovered.state?.ownerId).toBe(user.id);
    expect(await prisma.organizationMember.count({ where: { userId: user.id } })).toBe(1);
  });
  it('keeps concurrent registration tied to one account and tenant', async () => {
    const input = { workspace: 'Setup test parallel', name: 'Setup test owner', email: `setup-${suffix}-parallel@example.test`, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!' };
    const responses = await Promise.all([registerOrganizationAction(input), registerOrganizationAction(input)]);
    expect(responses.every(response => response.success)).toBe(true);
    expect(responses[0].state?.ownerId).toBe(responses[1].state?.ownerId);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email }, include: { organizationMemberships: true, userPermissions: { include: { permission: true } } } });
    orgIds.push(user.organizationMemberships[0].organizationId);
    expect(user.organizationMemberships).toHaveLength(1);
    expect(user.userPermissions.some(grant => grant.permission.code.startsWith('roles.') || grant.permission.code === 'users.manage_roles')).toBe(false);
    const attempt = mocks.cookies.get('codeline_signup_attempt'); if (attempt) attemptIds.add(attempt);
  });
  it('rejects client-assigned roles and organization IDs before registration', async () => {
    for (const patch of [{ roleId: 'platform-role' }, { organizationId: b.organizationId }]) {
      const result = await registerOrganizationAction({ workspace: 'Invalid', name: 'Invalid owner', email: `invalid-${suffix}@example.test`, password: 'SetupTestPassword123!', confirmPassword: 'SetupTestPassword123!', ...patch } as any);
      expect(result.success).toBe(false);
    }
    expect(await prisma.user.count({ where: { email: `invalid-${suffix}@example.test` } })).toBe(0);
  });
  it('denies unauthorized actions, non-owners and spoofed cross-tenant sessions', async () => {
    await expect(OnboardingService.save({ ...a, permissions: [] }, { answers: initialSetup(a.id, 'Example', 'en').answers, step: 1 })).rejects.toThrow('Forbidden');
    await expect(OnboardingService.get({ ...a, organizationId: b.organizationId })).rejects.toThrow('membership');
    await expect(OnboardingService.complete({ ...a, organizationId: b.organizationId }, {})).rejects.toThrow('membership');
    await expect(OnboardingService.save(a, { answers: initialSetup(a.id, 'Example', 'en').answers, step: 1, organizationId: b.organizationId })).rejects.toThrow();
    mocks.auth.mockRejectedValueOnce(new Error('Unauthorized'));
    expect((await saveOnboardingAction({ answers: {}, step: 1 })).success).toBe(false);
    const original = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: b.organizationId } });
    await prisma.organizationSettings.update({ where: { organizationId: b.organizationId }, data: { onboardingState: JSON.stringify(initialSetup(a.id, 'Example', 'en')) } });
    await expect(OnboardingService.complete(b, {})).rejects.toThrow('Forbidden');
    await prisma.organizationSettings.update({ where: { organizationId: b.organizationId }, data: { onboardingState: original.onboardingState } });
  });
  it('provisions multiple industries and makes concurrent retries idempotent', async () => {
    await draft(a, 'real_estate'); await draft(b, 'education');
    const outcomes = await Promise.all([OnboardingService.complete(a, {}), OnboardingService.complete(a, {}), OnboardingService.complete(b, {})]);
    expect(outcomes.every(state => state.status === 'COMPLETE')).toBe(true);
    expect(await prisma.pipeline.count({ where: { organizationId: a.organizationId } })).toBe(1);
    expect(await prisma.pipelineStage.count({ where: { organizationId: a.organizationId } })).toBe(6);
    expect(await prisma.customFieldDefinition.count({ where: { organizationId: a.organizationId } })).toBe(1);
    expect((await prisma.customFieldDefinition.findFirstOrThrow({ where: { organizationId: b.organizationId } })).key).toBe('course_interest');
    expect(await prisma.auditLog.count({ where: { organizationId: a.organizationId, action: 'WORKSPACE_PROVISIONED' } })).toBe(1);
    expect((await OnboardingService.get(a)).modules).toContain('calendar');
  });
  it('rolls back partial failures and safely recovers the original draft', async () => {
    const c = await register('failure'); await draft(c, 'technology');
    const spy = vi.spyOn(prisma, '$transaction');
    const originalTransaction = prisma.$transaction.bind(prisma);
    spy.mockImplementationOnce(async (callback: any, options: any) => originalTransaction(async tx => {
      const wrapped = Object.create(tx);
      wrapped.customFieldDefinition = { ...tx.customFieldDefinition, upsert: async () => { throw new Error('INJECTED_FIELD_FAILURE'); } };
      return callback(wrapped);
    }, options));
    await expect(OnboardingService.complete(c, {})).rejects.toThrow('INJECTED_FIELD_FAILURE'); spy.mockRestore();
    expect((await OnboardingService.get(c)).state?.status).toBe('PENDING');
    expect(await prisma.pipeline.count({ where: { organizationId: c.organizationId } })).toBe(0);
    expect((await OnboardingService.get(c)).modules).toHaveLength(0);
    expect((await OnboardingService.complete(c, {})).status).toBe('COMPLETE');
    expect(await prisma.auditLog.count({ where: { organizationId: c.organizationId, action: 'WORKSPACE_PROVISIONING_FAILED' } })).toBe(1);
  });
  it('supports skipped defaults, Arabic stages and the standard option', async () => {
    const c = await register('standard'); const state = initialSetup(c.id, 'شركة تجريبية', 'ar');
    await OnboardingService.save(c, { answers: state.answers, step: 3, skipped: true });
    expect((await OnboardingService.complete(c, { standard: true })).standard).toBe(true);
    expect(await prisma.customFieldDefinition.count({ where: { organizationId: c.organizationId } })).toBe(0);
    expect((await prisma.pipelineStage.findFirstOrThrow({ where: { organizationId: c.organizationId, order: 0 } })).name).toBe('جديد');
    expect(await prisma.lead.count({ where: { organizationId: c.organizationId } })).toBe(0);
  });
  it('retains existing organizations and records and rejects setup reapplication', async () => {
    const c = await register('legacy');
    await prisma.organizationSettings.update({ where: { organizationId: c.organizationId }, data: { onboardingState: null, enabledModules: '["dashboard","tickets"]' } });
    expect((await OnboardingService.get(c)).state).toBe(null);
    await expect(OnboardingService.complete(c, {})).rejects.toThrow('Forbidden');
    const completed = await OnboardingService.complete(a, { standard: true });
    expect(completed.standard).toBe(false); // Completed setup is immutable; revisions use existing settings.
    expect(await prisma.pipelineStage.count({ where: { organizationId: a.organizationId } })).toBe(6);
  });
  it('records the first persisted useful action once without sensitive metadata', async () => {
    const lead = await prisma.lead.create({ data: { organizationId: a.organizationId!, name: 'Fixture record' } });
    await Promise.all([OnboardingService.firstUsefulAction(a, 'Lead', lead.id), OnboardingService.firstUsefulAction(a, 'Lead', lead.id)]);
    const events = await prisma.auditLog.findMany({ where: { organizationId: a.organizationId, action: 'ONBOARDING_FIRST_USEFUL_ACTION' } });
    expect(events).toHaveLength(1); expect(JSON.parse(events[0].metadata!)).toHaveProperty('workspaceToActionMs');
    expect(events[0].metadata).not.toContain(a.email);
    expect(readSetupState((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: a.organizationId } })).onboardingState)?.firstUsefulAt).toBeTruthy();
  });
  it('persists recommended text-field values through the existing action and rejects foreign records', async () => {
    const own = await prisma.lead.create({ data: { organizationId: a.organizationId!, name: 'Own fixture' } });
    const foreign = await prisma.lead.create({ data: { organizationId: b.organizationId!, name: 'Foreign fixture' } });
    mocks.auth.mockResolvedValueOnce({ ...a, permissions: a.permissions.filter(code => code !== PERMISSIONS.SCHOOLS_UPDATE) });
    expect((await updateLeadAction(own.id, { customFields: { property_interest: 'Apartment' } })).success).toBe(false);
    expect((await updateLeadAction(foreign.id, { customFields: { property_interest: 'Apartment' } })).success).toBe(false);
    expect(await prisma.customFieldValue.count({ where: { entityId: foreign.id } })).toBe(0);
    expect((await updateLeadAction(own.id, { customFields: { invented_field: 'Apartment' } })).success).toBe(false);
    expect((await updateLeadAction(own.id, { customFields: { property_interest: 'Apartment' } })).success).toBe(true);
    expect((await prisma.customFieldValue.findFirstOrThrow({ where: { organizationId: a.organizationId, entityId: own.id } })).valueText).toBe('Apartment');
  });
  it('persists combined goals, edits and checklist state without reapplying setup', async () => {
    const c = await register('custom');
    const state = (await OnboardingService.get(c)).state!;
    const answers = { ...state.answers, description: 'Private business context', goals: ['customers', 'pipelines', 'tasks', 'support'], modules: ['dashboard', 'clients', 'leads', 'deals', 'pipelines', 'tasks', 'tickets'], pipelineStages: ['Incoming', 'Contract'] };
    await OnboardingService.save(c, { answers, step: 4 });
    expect((await OnboardingService.get(c)).state?.answers.description).toBe(answers.description);
    await OnboardingService.complete(c, {});
    expect((await prisma.pipelineStage.findMany({ where: { organizationId: c.organizationId }, orderBy: { order: 'asc' } })).map(stage => stage.name)).toEqual(['Incoming', 'Contract', 'Won', 'Lost']);
    await OnboardingService.checklist(c, { task: 'pipeline', completed: true });
    await OnboardingService.checklist(c, { dismissed: true });
    expect((await OnboardingService.get(c)).state).toMatchObject({ status: 'COMPLETE', checklistDismissed: true, checklistCompleted: ['pipeline'] });
    await OnboardingService.checklist(c, { dismissed: false });
    await Promise.all([OnboardingService.entered(c), OnboardingService.entered(c)]);
    expect(await prisma.auditLog.count({ where: { organizationId: c.organizationId, action: 'ONBOARDING_CRM_ENTERED' } })).toBe(1);
    expect(await prisma.pipeline.count({ where: { organizationId: c.organizationId } })).toBe(1);
    const events = await prisma.auditLog.findMany({ where: { organizationId: c.organizationId } });
    expect(events.every(event => !event.metadata?.includes(answers.description))).toBe(true);
    const provisioned = events.find(event => event.action === 'WORKSPACE_PROVISIONED')!;
    expect(JSON.parse(provisioned.metadata!).customized).toBe(true);
    await expect(OnboardingService.checklist({ ...c, organizationId: a.organizationId }, { dismissed: true })).rejects.toThrow('membership');
  });
  it('rejects unsupported and client-assigned plans before any setup writes', async () => {
    const c = await register('validation');
    const answers = (await OnboardingService.get(c)).state!.answers;
    for (const patch of [{ modules: ['dashboard', 'properties'] }, { planId: 'enterprise' }, { goals: ['projects'] }, { pipelineStages: ['Duplicate', 'duplicate'] }]) await expect(OnboardingService.save(c, { answers: { ...answers, ...patch }, step: 4 })).rejects.toThrow();
    await expect(OnboardingService.complete(c, { planId: 'enterprise' })).rejects.toThrow();
    await expect(OnboardingService.checklist(c, { dismissed: true })).rejects.toThrow('Finish');
    expect((await OnboardingService.get(c)).state?.step).toBe(1);
    expect(await prisma.pipeline.count({ where: { organizationId: c.organizationId } })).toBe(0);
  });
  it('preserves existing pipelines, field definitions and configured priorities', async () => {
    const c = await register('preserve'); await draft(c, 'services');
    const pipeline = await prisma.pipeline.create({ data: { organizationId: c.organizationId!, name: 'Existing', isActive: true, isDefault: true } });
    await prisma.customFieldDefinition.create({ data: { organizationId: c.organizationId!, entityType: 'LEAD', key: 'service_interest', label: 'Existing label', fieldType: 'TEXT' } });
    await prisma.organizationSettings.update({ where: { organizationId: c.organizationId }, data: { leadStatuses: '["EXISTING"]', ticketPriorities: '[{"key":"LOW","label":"Existing"}]' } });
    await OnboardingService.complete(c, {});
    expect(await prisma.pipeline.count({ where: { organizationId: c.organizationId } })).toBe(1);
    expect(await prisma.pipelineStage.count({ where: { pipelineId: pipeline.id } })).toBe(0);
    expect((await prisma.customFieldDefinition.findFirstOrThrow({ where: { organizationId: c.organizationId } })).label).toBe('Existing label');
    expect((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: c.organizationId } })).leadStatuses).toBe('["EXISTING"]');
  });

});
