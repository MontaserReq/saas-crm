import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';
import { CompanyStatisticsService } from '@/server/services/CompanyStatisticsService';
import { resolveSubscriptionFeatures } from '@/lib/platform/entitlements';
import { addUtcCalendarMonths } from '@/lib/platform/upgrades';
import type { UserSession } from '@/types';

const run = process.env.RUN_PLAN_UPGRADES_DB === '1';
if (run) loadEnvConfig(process.cwd());
const suffix = randomUUID(); const orgIds: string[] = []; const userIds: string[] = [];
const policyKeys = ['paid_subscription_start_policy', 'paid_subscription_monthly_months', 'paid_subscription_annual_months'];
const previousSettings = new Map<string, { id: string; value: string }>();
let a: UserSession, b: UserSession, admin: UserSession;
let starter: string, growth: string, scale: string, roleId: string, createdRole = false;

describe.skipIf(!run)('PostgreSQL manual payment and subscription activation lifecycle', () => {
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Integration tests require a local database');
    let role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!role) { role = await prisma.role.create({ data: { name: 'ADMIN', displayName: 'Administrator', isSystem: true } }); createdRole = true; }
    roleId = role.id;
    const configuredSettings = await prisma.platformSetting.findMany({ where: { key: { in: policyKeys } } });
    const configuredValues = new Map(configuredSettings.map(setting => [setting.key, setting.value]));
    expect(configuredValues.get('paid_subscription_start_policy')).toBe('payment_confirmation');
    expect(configuredValues.get('paid_subscription_monthly_months')).toBe('1');
    expect(configuredValues.get('paid_subscription_annual_months')).toBe('12');
    for (const setting of configuredSettings) previousSettings.set(setting.key, { id: setting.id, value: setting.value });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[0] }, update: { value: 'payment_confirmation' }, create: { key: policyKeys[0], value: 'payment_confirmation' } });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[1] }, update: { value: '1' }, create: { key: policyKeys[1], value: '1' } });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[2] }, update: { value: '12' }, create: { key: policyKeys[2], value: '12' } });
    for (const label of ['a', 'b', 'admin']) {
      const org = await prisma.organization.create({ data: { name: `Payment QA ${suffix} ${label}`, slug: `payment-qa-${suffix}-${label}`, currency: 'USD' } }); orgIds.push(org.id);
      const department = await prisma.department.create({ data: { organizationId: org.id, name: 'QA', code: `PAYMENT_QA_${suffix}_${label}` } });
      const user = await prisma.user.create({ data: { name: `Payment QA ${label}`, email: `payment-${suffix}-${label}@example.test`, phone: label === 'a' ? '+962790000000' : null, passwordHash: 'test-no-login', roleId, departmentId: department.id, organizationMemberships: { create: { organizationId: org.id, roleId } } } }); userIds.push(user.id);
      const session = { ...user, organizationId: org.id, role: label === 'admin' ? 'PLATFORM_ADMIN' : 'ADMIN', isPlatformAdmin: label === 'admin', permissions: [] } as unknown as UserSession;
      if (label === 'a') a = session; else if (label === 'b') b = session; else admin = session;
    }
    starter = (await prisma.platformPlan.findUniqueOrThrow({ where: { slug: 'starter' } })).id;
    growth = (await prisma.platformPlan.findUniqueOrThrow({ where: { slug: 'growth' } })).id;
    scale = (await prisma.platformPlan.findUniqueOrThrow({ where: { slug: 'scale' } })).id;
  }, 30000);

  beforeEach(async () => {
    await prisma.planUpgradeRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.platformSubscription.upsert({ where: { organizationId: a.organizationId! }, create: { organizationId: a.organizationId!, planId: starter, status: 'ACTIVE', billingInterval: 'monthly', startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86400000) }, update: { planId: starter, status: 'ACTIVE', billingInterval: 'monthly', startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86400000), trialStartedAt: null, trialEndsAt: null } });
    await prisma.platformSubscription.deleteMany({ where: { organizationId: b.organizationId! } });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[0] }, update: { value: 'payment_confirmation' }, create: { key: policyKeys[0], value: 'payment_confirmation' } });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[1] }, update: { value: '1' }, create: { key: policyKeys[1], value: '1' } });
    await prisma.platformSetting.upsert({ where: { key: policyKeys[2] }, update: { value: '12' }, create: { key: policyKeys[2], value: '12' } });
  });

  afterAll(async () => {
    const where = { organizationId: { in: orgIds } };
    await prisma.planUpgradeRequest.deleteMany({ where }); await prisma.auditLog.deleteMany({ where });
    await prisma.platformSubscription.deleteMany({ where }); await prisma.client.deleteMany({ where });
    await prisma.organizationMember.deleteMany({ where }); await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.department.deleteMany({ where }); await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    for (const key of policyKeys) { const previous = previousSettings.get(key); if (previous) await prisma.platformSetting.upsert({ where: { key }, update: { value: previous.value }, create: { id: previous.id, key, value: previous.value } }); else await prisma.platformSetting.deleteMany({ where: { key } }); }
    if (createdRole) await prisma.role.deleteMany({ where: { id: roleId, users: { none: {} }, organizationMembers: { none: {} } } });
    await prisma.$disconnect();
  }, 30000);

  async function requestGrowth(interval: 'monthly' | 'annual' = 'monthly') {
    await PlanUpgradeService.request(a, { planId: growth, billingInterval: interval, reason: 'Manual payment test' });
    return prisma.planUpgradeRequest.findFirstOrThrow({ where: { organizationId: a.organizationId, status: 'PENDING_PAYMENT' } });
  }

  it('snapshots authoritative price and currency, rejects client commercial fields, and isolates tenant history', async () => {
    const request = await requestGrowth('annual');
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { id: growth } });
    expect(request).toMatchObject({ requestedById: a.id, planId: growth, billingInterval: 'annual', status: 'PENDING_PAYMENT', currencySnapshot: 'JOD', pricingVersionSnapshot: plan.pricingVersion });
    expect(request.priceSnapshot?.equals(plan.annualPrice!)).toBe(true);
    expect((await PlanUpgradeService.workspace(a)).requests).toHaveLength(1);
    expect((await PlanUpgradeService.workspace(b)).requests).toHaveLength(0);
    await expect(PlanUpgradeService.request(a, { planId: scale, billingInterval: 'monthly', price: 0, currency: 'XXX', organizationId: b.organizationId })).rejects.toThrow();
  });

  it('serializes simultaneous submissions to exactly one open request', async () => {
    const results = await Promise.allSettled([1, 2].map(() => PlanUpgradeService.request(a, { planId: growth, billingInterval: 'monthly' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.planUpgradeRequest.count({ where: { organizationId: a.organizationId, status: 'PENDING_PAYMENT' } })).toBe(1);
  });

  it('keeps a pending request non-entitling and allows an expired trial to request its configured plan', async () => {
    const started = new Date(Date.now() - 8 * 86400000); const ended = new Date(started.getTime() + 7 * 86400000);
    await prisma.platformSubscription.update({ where: { organizationId: a.organizationId! }, data: { planId: starter, status: 'EXPIRED', startsAt: started, endsAt: ended, trialStartedAt: started, trialEndsAt: ended } });
    await PlanUpgradeService.request(a, { planId: starter, billingInterval: 'monthly' });
    expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } })).status).toBe('EXPIRED');
    expect((await prisma.planUpgradeRequest.findFirstOrThrow({ where: { organizationId: a.organizationId! } })).status).toBe('PENDING_PAYMENT');
  });

  it('blocks tenant administrators from confirming payment before database writes', async () => {
    const request = await requestGrowth();
    await expect(PlanUpgradeService.confirmPayment(a, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: request.currencySnapshot!, reference: '', note: '' })).rejects.toThrow('FORBIDDEN');
    expect((await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('PENDING_PAYMENT');
  });

  it('validates amount and currency and rolls back failed confirmation', async () => {
    const request = await requestGrowth();
    await expect(PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: '0.01', currency: request.currencySnapshot!, reference: 'bad', note: '' })).rejects.toThrow('PAYMENT_MISMATCH');
    await expect(PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: 'USD', reference: 'bad', note: '' })).rejects.toThrow('PAYMENT_MISMATCH');
    expect(await prisma.planUpgradeRequest.findUnique({ where: { id: request.id } })).toMatchObject({ status: 'PENDING_PAYMENT', paymentConfirmedAt: null, paymentConfirmedById: null });
    expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } })).planId).toBe(starter);
  });

  it('confirms and activates atomically with persisted entitlements and an attributable audit trail', async () => {
    const request = await requestGrowth('annual');
    const result = await PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: request.currencySnapshot!, reference: 'BANK-REF-1', note: 'Verified transfer' });
    expect(result.status).toBe('ACTIVATED');
    const activated = await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } });
    const subscription = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! }, include: { plan: true } });
    expect(activated).toMatchObject({ status: 'ACTIVATED', paymentConfirmedById: admin.id, confirmedCurrency: 'JOD', paymentReference: 'BANK-REF-1', activatedSubscriptionId: subscription.id });
    expect(Number(activated.confirmedAmount)).toBe(Number(request.priceSnapshot));
    expect(subscription).toMatchObject({ planId: growth, status: 'ACTIVE', billingInterval: 'annual' });
    expect(subscription.startsAt.getTime()).toBe(activated.paymentConfirmedAt!.getTime());
    expect(subscription.endsAt!.getTime()).toBe(addUtcCalendarMonths(activated.paymentConfirmedAt!, 12).getTime());
    expect(resolveSubscriptionFeatures(subscription)).toContain('workflows');
    expect(await prisma.auditLog.count({ where: { organizationId: a.organizationId!, actorId: admin.id, action: { in: ['MANUAL_PAYMENT_CONFIRMED', 'SUBSCRIPTION_ACTIVATED'] }, entityId: request.id } })).toBe(2);
  });

  it('makes repeated confirmation idempotent without extending the paid period', async () => {
    const request = await requestGrowth(); const amount = request.priceSnapshot!.toFixed(2); const currency = request.currencySnapshot!;
    await PlanUpgradeService.confirmPayment(admin, { id: request.id, amount, currency, reference: 'IDEMPOTENT', note: '' });
    const before = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } });
    expect(before.endsAt!.getTime()).toBe(addUtcCalendarMonths(before.startsAt, 1).getTime());
    await expect(PlanUpgradeService.confirmPayment(admin, { id: request.id, amount, currency, reference: 'IGNORED', note: 'ignored' })).resolves.toMatchObject({ status: 'ACTIVATED' });
    const after = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } });
    expect(after.startsAt.getTime()).toBe(before.startsAt.getTime()); expect(after.endsAt?.getTime()).toBe(before.endsAt?.getTime());
    expect(await prisma.auditLog.count({ where: { organizationId: a.organizationId!, action: 'SUBSCRIPTION_ACTIVATED', entityId: request.id } })).toBe(1);
  });

  it('keeps request pricing immutable when the catalog changes before confirmation', async () => {
    const request = await requestGrowth('annual');
    const original = await prisma.platformPlan.findUniqueOrThrow({ where: { id: growth } });
    try {
      await prisma.platformPlan.update({ where: { id: growth }, data: { annualPrice: original.annualPrice!.add(1), pricingVersion: { increment: 1 }, isActive: false } });
      const result = await PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: request.currencySnapshot!, reference: 'IMMUTABLE', note: '' });
      expect(result.status).toBe('ACTIVATED');
      const persisted = await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(persisted.priceSnapshot?.equals(original.annualPrice!)).toBe(true);
      expect(persisted.pricingVersionSnapshot).toBe(original.pricingVersion);
      expect(persisted.confirmedAmount?.equals(original.annualPrice!)).toBe(true);
    } finally {
      await prisma.platformPlan.update({ where: { id: growth }, data: { annualPrice: original.annualPrice, pricingVersion: original.pricingVersion, isActive: original.isActive } });
    }
  });

  it('renews the same plan idempotently from the paid end date without losing access time', async () => {
    const before = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } });
    await PlanUpgradeService.request(a, { planId: starter, billingInterval: 'monthly', reason: 'Renew early' });
    const request = await prisma.planUpgradeRequest.findFirstOrThrow({ where: { organizationId: a.organizationId!, status: 'PENDING_PAYMENT' } });
    await PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: request.currencySnapshot!, reference: 'RENEWAL', note: '' });
    const after = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } });
    expect(after.startsAt.getTime()).toBe(before.startsAt.getTime());
    expect(after.endsAt?.getTime()).toBe(addUtcCalendarMonths(before.endsAt!, 1).getTime());
    expect((await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } })).activatedSubscriptionId).toBe(after.id);
    expect(await prisma.auditLog.count({ where: { organizationId: a.organizationId!, action: 'SUBSCRIPTION_RENEWED', entityId: request.id } })).toBe(1);
  });

  it('cancels without shortening the paid period and preserves access until expiry', async () => {
    const before = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! }, include: { plan: true } });
    await PlatformAdminService.save(admin, 'subscriptions', before.id, { organizationId: before.organizationId, planId: before.planId, status: 'CANCELLED', billingInterval: before.billingInterval, startsAt: before.startsAt.toISOString(), endsAt: new Date(before.startsAt.getTime() + 1000).toISOString(), notes: 'Cancelled' });
    const cancelled = await prisma.platformSubscription.findUniqueOrThrow({ where: { id: before.id }, include: { plan: true } });
    expect(cancelled.endsAt?.getTime()).toBe(before.endsAt?.getTime());
    expect(cancelled.status).toBe('CANCELLED');
    expect(resolveSubscriptionFeatures(cancelled)).toContain('deals');
    await PlatformAdminService.save(admin, 'subscriptions', cancelled.id, { organizationId: cancelled.organizationId, planId: cancelled.planId, status: 'CANCELLED', billingInterval: cancelled.billingInterval, startsAt: cancelled.startsAt.toISOString(), endsAt: new Date(cancelled.startsAt.getTime() + 2000).toISOString(), notes: 'Edited note' });
    expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { id: cancelled.id } })).endsAt?.getTime()).toBe(before.endsAt?.getTime());
    await expect(PlatformAdminService.remove(admin, 'subscriptions', cancelled.id)).rejects.toThrow('cannot be deleted');
  });

  it('records payment safely without activating when billing policy is unresolved', async () => {
    const trialStartedAt = new Date(Date.now() - 8 * 86400000); const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 86400000);
    await prisma.platformSubscription.update({ where: { organizationId: a.organizationId! }, data: { planId: starter, status: 'EXPIRED', startsAt: trialStartedAt, endsAt: trialEndsAt, trialStartedAt, trialEndsAt } });
    const request = await requestGrowth();
    await prisma.platformSetting.deleteMany({ where: { key: { in: policyKeys } } });
    const result = await PlanUpgradeService.confirmPayment(admin, { id: request.id, amount: request.priceSnapshot!.toFixed(2), currency: request.currencySnapshot!, reference: '', note: '' });
    expect(result.status).toBe('PAYMENT_CONFIRMED');
    expect(await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } })).toMatchObject({ planId: starter, status: 'EXPIRED', startsAt: trialStartedAt, endsAt: trialEndsAt });
    expect((await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('PAYMENT_CONFIRMED');
    await expect(PlanUpgradeService.activateConfirmed(admin, { id: request.id })).rejects.toThrow('BILLING_POLICY_REQUIRED');
  });

  it('rejects without activating, allows a later request, and blocks direct plan assignment', async () => {
    const request = await requestGrowth();
    await PlanUpgradeService.decide(admin, { id: request.id, decision: 'REJECTED', reviewNote: 'Transfer not received' });
    expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: a.organizationId! } })).planId).toBe(starter);
    expect((await prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('REJECTED');
    await expect(PlanUpgradeService.request(a, { planId: scale, billingInterval: 'monthly' })).resolves.toBeUndefined();
    await expect(PlanUpgradeService.assign(admin, { organizationId: a.organizationId, planId: scale, billingInterval: 'monthly' })).rejects.toThrow('PAYMENT_CONFIRMATION_REQUIRED');
  });

  it('lets only a Platform Admin publish exact prices and versions financial changes', async () => {
    const slug = `pricing-qa-${suffix}`;
    const input = { slug, name: 'Pricing QA', descriptionEn: 'Initial', descriptionAr: '', monthlyPrice: '100.00', annualPrice: '1000.00', currency: 'JOD', userLimit: 5, features: 'crm', availability: 'self_serve' as const, recommended: false, isActive: true };
    await expect(PlatformAdminService.save(a, 'plans', null, input)).rejects.toThrow('Forbidden');
    const id = await PlatformAdminService.save(admin, 'plans', null, input);
    try {
      const created = await prisma.platformPlan.findUniqueOrThrow({ where: { id } });
      expect(created).toMatchObject({ pricingVersion: 1, catalogRevision: 1, currency: 'JOD' });
      await PlatformAdminService.save(admin, 'plans', id, { ...input, descriptionEn: 'Non-financial change' });
      const nonFinancial = await prisma.platformPlan.findUniqueOrThrow({ where: { id } });
      expect(nonFinancial).toMatchObject({ pricingVersion: 1, catalogRevision: 2 });
      await PlatformAdminService.save(admin, 'plans', id, { ...input, descriptionEn: 'Non-financial change', annualPrice: '999.00' });
      const financial = await prisma.platformPlan.findUniqueOrThrow({ where: { id } });
      expect(financial).toMatchObject({ pricingVersion: 2, catalogRevision: 3 });
      expect(financial.annualPrice?.toFixed(2)).toBe('999.00');
      expect((await getPublishedPlatformPlans()).find(plan => plan.id === slug)).toMatchObject({ monthlyPrice: '100.00', annualPrice: '999.00', currency: 'JOD', pricingVersion: 2 });
      expect(await prisma.auditLog.count({ where: { actorId: admin.id, entityType: 'Platform:plans', entityId: id, action: { in: ['PLATFORM_CREATED', 'PLATFORM_UPDATED'] } } })).toBe(3);
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'Platform:plans', entityId: id } });
      await prisma.platformPlan.delete({ where: { id } });
    }
  });

  it('counts live company records without including deleted or foreign-company data', async () => {
    await prisma.client.createMany({ data: [{ organizationId: a.organizationId!, name: 'Live client' }, { organizationId: a.organizationId!, name: 'Deleted client', deletedAt: new Date() }, { organizationId: b.organizationId!, name: 'Foreign client' }] });
    const data = await CompanyStatisticsService.detail(admin, a.organizationId!);
    expect(data?.counts.clients).toBe(1); expect(data?.counts.activeMembers).toBe(1); expect(data?.members.map(member => member.id)).toEqual([a.id]);
    expect((await CompanyStatisticsService.list(admin, suffix, 1)).total).toBe(3);
    await expect(CompanyStatisticsService.detail(a, b.organizationId!)).rejects.toThrow('FORBIDDEN');
  });
});
