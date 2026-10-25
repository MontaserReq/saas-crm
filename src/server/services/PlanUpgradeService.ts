import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { activationInput, addUtcCalendarMonths, assignmentInput, decisionInput, isPlanUpgrade, paymentConfirmationInput, subscriptionSupportInput, upgradeInput } from '@/lib/platform/upgrades';
import { UserSession } from '@/types';
import { planFeatureDisplay, resolveSubscriptionAccess } from '@/lib/platform/entitlements';

const OPEN_REQUEST_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED'];
const ALLOWED_REQUEST_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ACTIVATED', 'REJECTED', 'CANCELLED'] as const;

export function requirePlatformAuthority(user: UserSession) {
  if (!isPlatformSuperAdmin(user)) throw new Error('FORBIDDEN');
}

async function lockOrganization(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new Error('ORGANIZATION_NOT_FOUND');
}

function priceFor(plan: { monthlyPrice: Prisma.Decimal | null; annualPrice: Prisma.Decimal | null }, billingInterval: string) {
  const price = billingInterval === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  if (price === null) throw new Error('PLAN_PRICING_UNAVAILABLE');
  return price.toDecimalPlaces(2);
}

async function configuredPeriodMonths(tx: Prisma.TransactionClient, interval: string) {
  const periodKey = interval === 'annual' ? 'paid_subscription_annual_months' : 'paid_subscription_monthly_months';
  const settings = await tx.platformSetting.findMany({ where: { key: { in: ['paid_subscription_start_policy', periodKey] } }, select: { key: true, value: true } });
  const values = new Map(settings.map(setting => [setting.key, setting.value]));
  if (values.get('paid_subscription_start_policy') !== 'payment_confirmation') return null;
  const months = Number(values.get(periodKey));
  return Number.isInteger(months) && months > 0 && months <= 120 ? months : null;
}

async function activateConfirmed(tx: Prisma.TransactionClient, user: UserSession, request: Prisma.PlanUpgradeRequestGetPayload<object>) {
  if (request.status === 'ACTIVATED') return 'ACTIVATED' as const;
  if (request.status !== 'PAYMENT_CONFIRMED' || !request.paymentConfirmedAt || request.confirmedAmount === null || !request.confirmedCurrency) throw new Error('PAYMENT_NOT_CONFIRMED');
  if (request.priceSnapshot === null || !request.currencySnapshot || !request.confirmedAmount.equals(request.priceSnapshot) || request.confirmedCurrency !== request.currencySnapshot) throw new Error('PAYMENT_MISMATCH');
  const target = await tx.platformPlan.findUnique({ where: { id: request.planId } });
  if (!target) throw new Error('PLAN_UNAVAILABLE');
  const months = await configuredPeriodMonths(tx, request.billingInterval);
  if (!months) return 'PAYMENT_CONFIRMED' as const;
  const current = await tx.platformSubscription.findUnique({ where: { organizationId: request.organizationId } });
  if ((current?.planId ?? null) !== request.fromPlanId) throw new Error('PLAN_CHANGED');
  const renewable = current && request.fromPlanId === request.planId && current.planId === request.planId && current.billingInterval === request.billingInterval && current.endsAt && current.endsAt > request.paymentConfirmedAt && ['ACTIVE', 'CANCELLED'].includes(current.status);
  const startsAt = renewable ? current.startsAt : request.paymentConfirmedAt;
  const periodStartsAt = renewable ? current.endsAt! : request.paymentConfirmedAt;
  const endsAt = addUtcCalendarMonths(periodStartsAt, months);
  const subscription = await tx.platformSubscription.upsert({
    where: { organizationId: request.organizationId },
    create: { organizationId: request.organizationId, planId: request.planId, billingInterval: request.billingInterval, status: 'ACTIVE', startsAt, endsAt, notes: request.paymentNote },
    update: { planId: request.planId, billingInterval: request.billingInterval, status: 'ACTIVE', startsAt, endsAt, notes: request.paymentNote },
  });
  await tx.planUpgradeRequest.update({ where: { id: request.id }, data: { status: 'ACTIVATED', activatedAt: new Date(), activatedSubscriptionId: subscription.id, reviewedById: user.id, reviewedAt: new Date(), reviewNote: renewable ? 'Payment confirmed and subscription renewed.' : 'Payment confirmed and subscription activated.' } });
  await tx.auditLog.create({ data: { organizationId: request.organizationId, actorId: user.id, action: renewable ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_ACTIVATED', entityType: 'PlanUpgradeRequest', entityId: request.id, metadata: JSON.stringify({ subscriptionId: subscription.id, planId: request.planId, billingInterval: request.billingInterval, amount: request.priceSnapshot.toFixed(2), currency: request.currencySnapshot, pricingVersion: request.pricingVersionSnapshot, startsAt: startsAt.toISOString(), periodStartsAt: periodStartsAt.toISOString(), endsAt: endsAt.toISOString() }) } });
  return 'ACTIVATED' as const;
}

export const PlanUpgradeService = {
  async workspace(user: UserSession) {
    const context = await requireOrganizationContext(user);
    const [subscription, plans, requests] = await Promise.all([
      prisma.platformSubscription.findUnique({ where: { organizationId: context.id }, include: { plan: true } }),
      prisma.platformPlan.findMany({ where: { isActive: true, availability: 'self_serve', monthlyPrice: { not: null }, annualPrice: { not: null } }, orderBy: { monthlyPrice: 'asc' } }),
      prisma.planUpgradeRequest.findMany({ where: { organizationId: context.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { plan: { select: { name: true } } } }),
    ]);
    const access = resolveSubscriptionAccess(subscription);
    const paidActive = access.state === 'PAID_ACTIVE';
    return {
      currency: plans[0]?.currency ?? 'JOD',
      subscription: subscription ? { plan: subscription.plan.name, status: subscription.status, billingInterval: subscription.billingInterval, startsAt: subscription.startsAt.toISOString(), endsAt: subscription.endsAt?.toISOString() ?? null, accessState: access.state, readOnly: access.readOnly, features: planFeatureDisplay(subscription.plan.features) } : null,
      plans: plans.filter(plan => !paidActive || plan.id === subscription?.planId || isPlanUpgrade(subscription?.plan ?? null, plan)).map(plan => ({ id: plan.id, name: plan.name, userLimit: plan.userLimit, monthlyPrice: plan.monthlyPrice!.toFixed(2), annualPrice: plan.annualPrice!.toFixed(2), currency: plan.currency, pricingVersion: plan.pricingVersion, features: planFeatureDisplay(plan.features) })),
      requests: requests.map(request => ({ id: request.id, plan: request.plan.name, status: request.status, billingInterval: request.billingInterval, priceSnapshot: request.priceSnapshot?.toFixed(2) ?? null, currencySnapshot: request.currencySnapshot, pricingVersionSnapshot: request.pricingVersionSnapshot, paymentConfirmedAt: request.paymentConfirmedAt?.toISOString() ?? null, activatedAt: request.activatedAt?.toISOString() ?? null, reviewNote: request.reviewNote, createdAt: request.createdAt.toISOString() })),
    };
  },

  async request(user: UserSession, raw: unknown) {
    const input = upgradeInput.parse(raw);
    const context = await requireOrganizationContext(user);
    await prisma.$transaction(async tx => {
      await lockOrganization(tx, context.id);
      if (await tx.planUpgradeRequest.findFirst({ where: { organizationId: context.id, status: { in: OPEN_REQUEST_STATUSES } } })) throw new Error('REQUEST_PENDING');
      const current = await tx.platformSubscription.findUnique({ where: { organizationId: context.id }, include: { plan: true } });
      const plan = await tx.platformPlan.findFirst({ where: { id: input.planId, isActive: true, availability: 'self_serve' } });
      if (!plan) throw new Error('PLAN_UNAVAILABLE');
      const currentAccess = resolveSubscriptionAccess(current);
      const renewal = current?.planId === plan.id;
      if (currentAccess.state === 'PAID_ACTIVE' && renewal && current!.billingInterval !== input.billingInterval) throw new Error('RENEWAL_INTERVAL_MISMATCH');
      if (currentAccess.state === 'PAID_ACTIVE' && !renewal && !isPlanUpgrade(current?.plan ?? null, plan)) throw new Error('UPGRADE_REQUIRED');
      const priceSnapshot = priceFor(plan, input.billingInterval);
      const request = await tx.planUpgradeRequest.create({ data: { ...input, organizationId: context.id, requestedById: user.id, fromPlanId: current?.planId ?? null, status: 'PENDING_PAYMENT', priceSnapshot, currencySnapshot: plan.currency, pricingVersionSnapshot: plan.pricingVersion } });
      await tx.auditLog.create({ data: { organizationId: context.id, actorId: user.id, action: renewal ? 'PLAN_RENEWAL_REQUESTED' : 'PLAN_ACTIVATION_REQUESTED', entityType: 'PlanUpgradeRequest', entityId: request.id, metadata: JSON.stringify({ planId: input.planId, billingInterval: input.billingInterval, price: priceSnapshot.toFixed(2), currency: plan.currency, pricingVersion: plan.pricingVersion }) } });
    });
  },

  async assign(user: UserSession, raw: unknown) {
    requirePlatformAuthority(user);
    assignmentInput.parse(raw);
    throw new Error('PAYMENT_CONFIRMATION_REQUIRED');
  },

  async decide(user: UserSession, raw: unknown) {
    requirePlatformAuthority(user);
    const input = decisionInput.parse(raw);
    await prisma.$transaction(async tx => {
      const initial = await tx.planUpgradeRequest.findUnique({ where: { id: input.id } });
      if (!initial) throw new Error('REQUEST_NOT_FOUND');
      await lockOrganization(tx, initial.organizationId);
      const request = await tx.planUpgradeRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (request.status !== 'PENDING_PAYMENT') throw new Error('REQUEST_REVIEWED');
      await tx.planUpgradeRequest.update({ where: { id: request.id }, data: { status: input.decision, reviewNote: input.reviewNote, reviewedAt: new Date(), reviewedById: user.id } });
      await tx.auditLog.create({ data: { organizationId: request.organizationId, actorId: user.id, action: `PLAN_ACTIVATION_${input.decision}`, entityType: 'PlanUpgradeRequest', entityId: request.id, metadata: JSON.stringify({ reason: input.reviewNote }) } });
    });
  },

  async confirmPayment(user: UserSession, raw: unknown) {
    requirePlatformAuthority(user);
    const input = paymentConfirmationInput.parse(raw);
    return prisma.$transaction(async tx => {
      const initial = await tx.planUpgradeRequest.findUnique({ where: { id: input.id } });
      if (!initial) throw new Error('REQUEST_NOT_FOUND');
      await lockOrganization(tx, initial.organizationId);
      let request = await tx.planUpgradeRequest.findUniqueOrThrow({ where: { id: input.id } });
      const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
      if (request.status === 'ACTIVATED') return { status: 'ACTIVATED' as const };
      if (request.status === 'PAYMENT_CONFIRMED') {
        if (request.confirmedAmount === null || !request.confirmedAmount.equals(amount) || request.confirmedCurrency !== input.currency) throw new Error('REQUEST_REVIEWED');
        return { status: await activateConfirmed(tx, user, request) };
      }
      if (request.status !== 'PENDING_PAYMENT') throw new Error('REQUEST_REVIEWED');
      if (request.priceSnapshot === null || !request.currencySnapshot || !request.priceSnapshot.equals(amount) || request.currencySnapshot !== input.currency) throw new Error('PAYMENT_MISMATCH');
      const target = await tx.platformPlan.findUnique({ where: { id: request.planId } });
      if (!target) throw new Error('PLAN_UNAVAILABLE');
      const confirmedAt = new Date();
      request = await tx.planUpgradeRequest.update({ where: { id: request.id }, data: { status: 'PAYMENT_CONFIRMED', confirmedAmount: amount, confirmedCurrency: input.currency, paymentReference: input.reference, paymentNote: input.note, paymentConfirmedAt: confirmedAt, paymentConfirmedById: user.id } });
      await tx.auditLog.create({ data: { organizationId: request.organizationId, actorId: user.id, action: 'MANUAL_PAYMENT_CONFIRMED', entityType: 'PlanUpgradeRequest', entityId: request.id, metadata: JSON.stringify({ amount: amount.toFixed(2), currency: input.currency, referenceRecorded: Boolean(input.reference) }) } });
      return { status: await activateConfirmed(tx, user, request) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async activateConfirmed(user: UserSession, raw: unknown) {
    requirePlatformAuthority(user);
    const input = activationInput.parse(raw);
    return prisma.$transaction(async tx => {
      const initial = await tx.planUpgradeRequest.findUnique({ where: { id: input.id } });
      if (!initial) throw new Error('REQUEST_NOT_FOUND');
      await lockOrganization(tx, initial.organizationId);
      const request = await tx.planUpgradeRequest.findUniqueOrThrow({ where: { id: input.id } });
      const status = await activateConfirmed(tx, user, request);
      if (status !== 'ACTIVATED') throw new Error('BILLING_POLICY_REQUIRED');
      return { status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async requestSupport(user: UserSession, raw: unknown) {
    const input = subscriptionSupportInput.parse(raw);
    const context = await requireOrganizationContext(user);
    const supportCase = await prisma.platformSupportCase.create({ data: { organizationId: context.id, subject: 'Subscription activation support', description: input.message, contactEmail: user.email, status: 'OPEN', priority: 'NORMAL' } });
    await prisma.auditLog.create({ data: { organizationId: context.id, actorId: user.id, action: 'SUBSCRIPTION_SUPPORT_REQUESTED', entityType: 'PlatformSupportCase', entityId: supportCase.id } });
  },

  async requests(user: UserSession, page = 1, requestedStatus = 'PENDING_PAYMENT') {
    requirePlatformAuthority(user);
    const status = requestedStatus === 'ALL' ? 'ALL' : (ALLOWED_REQUEST_STATUSES as readonly string[]).includes(requestedStatus) ? requestedStatus : 'PENDING_PAYMENT';
    const where = status === 'ALL' ? {} : { status };
    const [total, requests, groupedCounts] = await Promise.all([
      prisma.planUpgradeRequest.count({ where }),
      prisma.planUpgradeRequest.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * 20, take: 20, include: { organization: { select: { name: true, currency: true } }, plan: { select: { name: true } }, requestedBy: { select: { name: true, email: true, phone: true } } } }),
      prisma.planUpgradeRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(ALLOWED_REQUEST_STATUSES.map(item => [item, 0])) as Record<typeof ALLOWED_REQUEST_STATUSES[number], number>;
    groupedCounts.forEach(item => { if (item.status in counts) counts[item.status as typeof ALLOWED_REQUEST_STATUSES[number]] = item._count._all; });
    return { status, total, counts, requests: requests.map(request => ({ id: request.id, status: request.status, organizationId: request.organizationId, organization: request.organization.name, plan: request.plan.name, requester: request.requestedBy.name, email: request.requestedBy.email, phone: request.requestedBy.phone, reason: request.reason, reviewNote: request.reviewNote, billingInterval: request.billingInterval, priceSnapshot: request.priceSnapshot?.toFixed(2) ?? null, currencySnapshot: request.currencySnapshot, pricingVersionSnapshot: request.pricingVersionSnapshot, confirmedAmount: request.confirmedAmount?.toFixed(2) ?? null, confirmedCurrency: request.confirmedCurrency, paymentReference: request.paymentReference, paymentNote: request.paymentNote, paymentConfirmedAt: request.paymentConfirmedAt?.toISOString() ?? null, createdAt: request.createdAt.toISOString() })) };
  },
};
