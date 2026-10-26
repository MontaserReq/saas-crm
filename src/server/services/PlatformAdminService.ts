import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { encryptSecret } from '@/lib/integrations/oauth';
import { readSetupState } from '@/lib/onboarding/templates';
import { DEFAULT_MODULES, DEFAULT_CLIENT_TYPES, DEFAULT_LEAD_STATUSES, DEFAULT_TICKET_PRIORITIES } from './OrganizationConfigService';
import type { UserSession } from '@/types';
import type { PlatformResource, PlatformRecord, PlatformSectionData, PlatformStats } from '@/lib/platform/types';
import { organizationInput, userInput, planInput, subscriptionInput, trialActivationInput, integrationInput, supportInput, settingInput } from '@/lib/platform/validation';
import { areKnownPlanFeatureTokens, expandPlanFeatures, parseFeatureOverrides } from '@/lib/platform/entitlements';
import { getPlatformDefaults } from './PlatformCatalogService';
import { assertOrganizationUserCapacity } from '@/lib/platform/userCapacity';

export function requirePlatformAdmin(user: UserSession) {
  if (!isPlatformSuperAdmin(user)) throw new Error('Forbidden');
}
const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
const split = (value: string) => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
function normalizeFeatureOverrideTokens(value: string): string[] {
  const tokens = split(value);
  if (!areKnownPlanFeatureTokens(tokens)) throw new Error('One or more feature overrides are not supported');
  return expandPlanFeatures(tokens).filter(feature => feature !== 'dashboard');
}
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

async function audit(tx: Prisma.TransactionClient, user: UserSession, resource: string, id: string, operation: string, details: Record<string, unknown> = {}) {
  await tx.auditLog.create({ data: { organizationId: user.organizationId, actorId: user.id, action: `PLATFORM_${operation.toUpperCase()}`, entityType: `Platform:${resource}`, entityId: id, metadata: JSON.stringify({ resource, operation, ...details }) } });
}

export class PlatformAdminService {
  static async activateTrial(user: UserSession, raw: unknown) {
    requirePlatformAdmin(user);
    const input = trialActivationInput.parse(raw);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async tx => {
      const organization = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { id: true, name: true, isActive: true } });
      if (!organization) throw new Error('Organization not found');
      if (!organization.isActive) throw new Error('Activate the organization before starting a trial');
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE`;

      const plan = await tx.platformPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, name: true } });
      if (!plan) throw new Error('Select an active plan for the trial');

      const existing = await tx.platformSubscription.findUnique({ where: { organizationId: input.organizationId }, select: { id: true, status: true, endsAt: true } });
      if (existing && ['ACTIVE', 'CANCELLED'].includes(existing.status) && (!existing.endsAt || existing.endsAt > now)) {
        throw new Error('A paid subscription is still active for this organization');
      }
      await tx.planUpgradeRequest.updateMany({
        where: { organizationId: input.organizationId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED'] } },
        data: { status: 'CANCELLED', reviewedById: user.id, reviewedAt: now, reviewNote: 'Superseded by a platform-granted free trial.' },
      });

      const subscription = await tx.platformSubscription.upsert({
        where: { organizationId: input.organizationId },
        create: {
          organizationId: input.organizationId,
          planId: plan.id,
          status: 'TRIAL',
          billingInterval: 'monthly',
          startsAt: now,
          endsAt: trialEndsAt,
          trialStartedAt: now,
          trialEndsAt,
          notes: `Manual trial activated for ${input.durationDays} day(s) by platform administrator`,
        },
        update: {
          planId: plan.id,
          status: 'TRIAL',
          billingInterval: 'monthly',
          startsAt: now,
          endsAt: trialEndsAt,
          trialStartedAt: now,
          trialEndsAt,
          notes: `Manual trial activated for ${input.durationDays} day(s) by platform administrator`,
        },
      });
      await tx.auditLog.create({ data: { organizationId: organization.id, actorId: user.id, action: 'PLATFORM_TRIAL_ACTIVATED', entityType: 'PlatformSubscription', entityId: subscription.id, metadata: JSON.stringify({ organizationId: organization.id, planId: plan.id, planName: plan.name, durationDays: input.durationDays, startsAt: now.toISOString(), endsAt: trialEndsAt.toISOString(), previousStatus: existing?.status ?? null }) } });
      return { id: subscription.id, endsAt: trialEndsAt.toISOString() };
    }, { maxWait: 10000, timeout: 20000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async stats(user: UserSession): Promise<PlatformStats> {
    requirePlatformAdmin(user);
    const [organizations, activeOrganizations, users, activeUsers, integrations, auditEvents, openTickets, supportCases, activeSubscriptions, newOrganizations] = await Promise.all([
      prisma.organization.count(), prisma.organization.count({ where: { isActive: true } }), prisma.user.count(), prisma.user.count({ where: { isActive: true } }),
      prisma.externalIntegration.count(), prisma.auditLog.count(), prisma.ticket.count({ where: { status: { notIn: ['COMPLETED', 'CLOSED'] } } }),
      prisma.platformSupportCase.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }), prisma.platformSubscription.count({ where: { status: { in: ['TRIAL', 'ACTIVE'] } } }),
      prisma.organization.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    ]);
    return { organizations, activeOrganizations, users, activeUsers, integrations, auditEvents, openTickets, supportCases, activeSubscriptions, newOrganizations };
  }

  static async list(user: UserSession, resource: PlatformResource, search = '', requestedPage = 1, monitoring = false): Promise<PlatformSectionData> {
    requirePlatformAdmin(user);
    const page = Math.max(1, Math.min(100000, Math.floor(requestedPage) || 1));
    const q = search.trim().slice(0, 100);
    const pageSize = 20;
    let total = 0, records: PlatformRecord[] = [];
    const options = { organizations: [], roles: [], departments: [], plans: [] } as PlatformSectionData['options'];
    const stats = await this.stats(user);
    if (!monitoring) {
      [options.organizations, options.roles, options.departments, options.plans] = await Promise.all([
        prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.role.findMany({ where: { name: { not: 'PLATFORM_ADMIN' } }, orderBy: { displayName: 'asc' }, select: { id: true, name: true, displayName: true } }).then(items => items.map(item => ({ id: item.id, name: item.displayName }))),
        prisma.department.findMany({ where: { organizationId: { not: null }, isActive: true }, select: { id: true, name: true, organizationId: true } }).then(items => items.map(item => ({ id: item.id, name: item.name, organizationId: item.organizationId! }))),
        prisma.platformPlan.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      ]);
      const pagination = { skip: (page - 1) * pageSize, take: pageSize };
      switch (resource) {
        case 'organizations': {
          const where = q ? { OR: [{ name: contains(q) }, { slug: contains(q) }] } : {};
          const [count, rows] = await Promise.all([prisma.organization.count({ where }), prisma.organization.findMany({ where, ...pagination, orderBy: { createdAt: 'desc' }, include: { settings: { select: { onboardingState: true, featureOverrides: true } }, platformSubscription: { select: { plan: { select: { name: true } } } }, _count: { select: { members: true } } } })]);
          total = count; records = rows.map(row => { const overrides = parseFeatureOverrides(row.settings?.featureOverrides); return { id: row.id, name: row.name, slug: row.slug, language: row.language, timezone: row.timezone, currency: row.currency, isActive: row.isActive, members: row._count.members, planName: row.platformSubscription?.plan.name ?? '', featureEnable: overrides.enable.join(', '), featureDisable: overrides.disable.join(', '), createdAt: iso(row.createdAt), onboardingStatus: readSetupState(row.settings?.onboardingState)?.status ?? 'LEGACY' }; }); break;
        }
        case 'users': {
          const where = q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : {};
          const [count, rows] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, ...pagination, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, phone: true, isActive: true, isPlatformAdmin: true, roleId: true, departmentId: true, lastLoginAt: true, role: { select: { name: true, displayName: true } }, organizationMemberships: { where: { status: 'ACTIVE' }, select: { organizationId: true, organization: { select: { name: true } } } } } })]);
          total = count; records = rows.map(row => ({ id: row.id, name: row.name, email: row.email, phone: row.phone, roleId: row.roleId, roleName: row.role.displayName, departmentId: row.departmentId, organizationId: row.organizationMemberships[0]?.organizationId ?? '', organizationName: row.organizationMemberships.map(item => item.organization.name).join(', '), isActive: row.isActive, protected: row.isPlatformAdmin || row.role.name === 'PLATFORM_ADMIN', lastLoginAt: iso(row.lastLoginAt) })); break;
        }
        case 'plans': {
          const where = q ? { OR: [{ name: contains(q) }, { slug: contains(q) }] } : {};
          const [count, rows] = await Promise.all([prisma.platformPlan.count({ where }), prisma.platformPlan.findMany({ where, ...pagination, orderBy: { createdAt: 'asc' }, include: { _count: { select: { subscriptions: true } } } })]);
          total = count; records = rows.map(row => ({ id: row.id, slug: row.slug, name: row.name, descriptionEn: row.descriptionEn, descriptionAr: row.descriptionAr, monthlyPrice: row.monthlyPrice?.toFixed(2) ?? null, annualPrice: row.annualPrice?.toFixed(2) ?? null, currency: row.currency, pricingVersion: row.pricingVersion, catalogRevision: row.catalogRevision, userLimit: row.userLimit, features: (JSON.parse(row.features) as string[]).join(', '), availability: row.availability, recommended: row.recommended, isActive: row.isActive, subscriptions: row._count.subscriptions })); break;
        }
        case 'subscriptions': {
          const where = q ? { OR: [{ organization: { name: contains(q) } }, { plan: { name: contains(q) } }, { status: contains(q) }] } : {};
          const [count, rows] = await Promise.all([prisma.platformSubscription.count({ where }), prisma.platformSubscription.findMany({ where, ...pagination, orderBy: { createdAt: 'desc' }, include: { organization: { select: { name: true } }, plan: { select: { name: true } } } })]);
          total = count; records = rows.map(row => ({ id: row.id, organizationId: row.organizationId, organizationName: row.organization.name, planId: row.planId, planName: row.plan.name, status: row.status, billingInterval: row.billingInterval, startsAt: iso(row.startsAt), endsAt: iso(row.endsAt), notes: row.notes })); break;
        }
        case 'integrations': {
          const where = q ? { OR: [{ provider: contains(q) }, { accountEmail: contains(q) }, { organization: { name: contains(q) } }] } : {};
          const [count, rows] = await Promise.all([prisma.externalIntegration.count({ where }), prisma.externalIntegration.findMany({ where, ...pagination, orderBy: { updatedAt: 'desc' }, select: { id: true, organizationId: true, provider: true, accountEmail: true, tokenExpiresAt: true, scopes: true, metadata: true, updatedAt: true, organization: { select: { name: true } } } })]);
          total = count; records = rows.map(row => { const meta = row.provider === 'SMTP' && row.metadata ? JSON.parse(row.metadata) : {}; return { id: row.id, organizationId: row.organizationId, organizationName: row.organization.name, provider: row.provider, accountEmail: row.accountEmail, tokenExpiresAt: iso(row.tokenExpiresAt), scopes: (JSON.parse(row.scopes) as string[]).join(', '), host: typeof meta.host === 'string' ? meta.host : '', port: typeof meta.port === 'number' ? meta.port : 587, useTls: meta.useTls !== false, updatedAt: iso(row.updatedAt) }; }); break;
        }
        case 'support': {
          const where = q ? { OR: [{ subject: contains(q) }, { contactEmail: contains(q) }, { organization: { name: contains(q) } }] } : {};
          const [count, rows] = await Promise.all([prisma.platformSupportCase.count({ where }), prisma.platformSupportCase.findMany({ where, ...pagination, orderBy: { createdAt: 'desc' }, include: { organization: { select: { name: true } } } })]);
          total = count; records = rows.map(row => ({ id: row.id, organizationId: row.organizationId, organizationName: row.organization?.name ?? '', subject: row.subject, description: row.description, contactEmail: row.contactEmail, status: row.status, priority: row.priority, resolution: row.resolution, createdAt: iso(row.createdAt) })); break;
        }
        case 'settings': {
          const where = q ? { key: contains(q) } : {};
          const [count, rows] = await Promise.all([prisma.platformSetting.count({ where }), prisma.platformSetting.findMany({ where, ...pagination, orderBy: { key: 'asc' } })]);
          total = count; records = rows.map(row => ({ id: row.id, key: row.key, value: row.value, updatedAt: iso(row.updatedAt) })); break;
        }
      }
    }
    let health: PlatformSectionData['health'] = null;
    if (monitoring) { const start = Date.now(); await prisma.$queryRaw`SELECT 1`; health = { databaseMs: Date.now() - start, googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), microsoftConfigured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) }; }
    return { records, total, page, pageSize, search: q, resource, options, stats, health, defaults: await getPlatformDefaults() };
  }

  static async save(user: UserSession, resource: PlatformResource, id: string | null, input: unknown) {
    requirePlatformAdmin(user);
    return prisma.$transaction(async tx => {
      let recordId: string;
      let auditDetails: Record<string, unknown> = {};
      switch (resource) {
        case 'organizations': {
          const data = organizationInput.parse(input);
          const { featureEnable, featureDisable, ...organizationData } = data;
          const enabledFeatures = normalizeFeatureOverrideTokens(featureEnable);
          const disabledFeatures = normalizeFeatureOverrideTokens(featureDisable);
          const overlap = enabledFeatures.filter(feature => disabledFeatures.includes(feature));
          if (overlap.length) throw new Error('A feature cannot be enabled and disabled for the same company');
          const existing = id ? await tx.organization.findUniqueOrThrow({ where: { id }, select: { slug: true } }) : null;
          if (existing && existing.slug !== data.slug) throw new Error('The company code is immutable after registration');
          if (id === user.organizationId && !data.isActive) throw new Error('Your current platform workspace cannot be suspended');
          const row = id ? await tx.organization.update({ where: { id }, data: organizationData }) : await tx.organization.create({ data: { ...organizationData, settings: { create: { enabledModules: JSON.stringify(DEFAULT_MODULES), clientTypes: JSON.stringify(DEFAULT_CLIENT_TYPES), leadStatuses: JSON.stringify(DEFAULT_LEAD_STATUSES), ticketPriorities: JSON.stringify(DEFAULT_TICKET_PRIORITIES), featureOverrides: JSON.stringify({ enable: enabledFeatures, disable: disabledFeatures }) } } } });
          if (id) await tx.organizationSettings.upsert({ where: { organizationId: id }, create: { organizationId: id, featureOverrides: JSON.stringify({ enable: enabledFeatures, disable: disabledFeatures }) }, update: { featureOverrides: JSON.stringify({ enable: enabledFeatures, disable: disabledFeatures }) } });
          if (id && !data.isActive) { const members = await tx.organizationMember.findMany({ where: { organizationId: id }, select: { userId: true } }); await tx.loginSession.updateMany({ where: { userId: { in: members.map(item => item.userId) }, logoutAt: null }, data: { logoutAt: new Date() } }); }
          recordId = row.id; break;
        }
        case 'users': {
          const data = userInput.parse(input);
          if (data.isActive) await assertOrganizationUserCapacity(tx, data.organizationId, id ? { excludeUserId: id } : undefined);
          const existing = id ? await tx.user.findUniqueOrThrow({ where: { id }, include: { role: true, organizationMemberships: { where: { status: 'ACTIVE' } } } }) : null;
          if (existing?.isPlatformAdmin || existing?.role.name === 'PLATFORM_ADMIN') throw new Error('Platform administrator accounts are protected');
          if (id === user.id) throw new Error('Your current account is protected');
          if (existing && (existing.organizationMemberships.length !== 1 || existing.organizationMemberships[0].organizationId !== data.organizationId)) throw new Error('An existing user cannot be moved to another workspace');
          const role = await tx.role.findUniqueOrThrow({ where: { id: data.roleId } });
          if (role.name === 'PLATFORM_ADMIN') throw new Error('Platform administrator roles cannot be assigned here');
          await tx.organization.findUniqueOrThrow({ where: { id: data.organizationId } });
          let departmentId = data.departmentId;
          if (departmentId) { const department = await tx.department.findFirst({ where: { id: departmentId, organizationId: data.organizationId, isActive: true } }); if (!department) throw new Error('Select a department in this workspace'); }
          else { const department = await tx.department.findFirst({ where: { organizationId: data.organizationId, isActive: true }, orderBy: { createdAt: 'asc' } }); departmentId = department?.id ?? (await tx.department.create({ data: { organizationId: data.organizationId, name: 'Management', code: `PLATFORM_${crypto.randomUUID()}` } })).id; }
          if (!id && !data.password) throw new Error('A password is required for a new user');
          const passwordHash = data.password ? await hashPassword(data.password) : undefined;
          const userData = { name: data.name, email: data.email, phone: data.phone || null, roleId: role.id, departmentId, isActive: data.isActive, ...(passwordHash ? { passwordHash } : {}) };
          const row = id ? await tx.user.update({ where: { id }, data: userData }) : await tx.user.create({ data: { ...userData, passwordHash: passwordHash!, isPlatformAdmin: false } });
          await tx.organizationMember.upsert({ where: { organizationId_userId: { organizationId: data.organizationId, userId: row.id } }, create: { organizationId: data.organizationId, userId: row.id, roleId: role.id, status: 'ACTIVE' }, update: { roleId: role.id } });
          if (id) { if (existing?.roleId !== role.id) await tx.userPermission.deleteMany({ where: { userId: id } }); await tx.loginSession.updateMany({ where: { userId: id, logoutAt: null }, data: { logoutAt: new Date() } }); }
          recordId = row.id; break;
        }
        case 'plans': {
          const parsed = planInput.parse(input);
          const features = split(parsed.features);
          if (!areKnownPlanFeatureTokens(features)) throw new Error('One or more plan features are not supported');
          const existing = id ? await tx.platformPlan.findUniqueOrThrow({ where: { id } }) : null;
          if (existing && existing.slug !== parsed.slug) throw new Error('The plan code is immutable after publication');
          const monthlyPrice = parsed.monthlyPrice === null ? null : new Prisma.Decimal(parsed.monthlyPrice);
          const annualPrice = parsed.annualPrice === null ? null : new Prisma.Decimal(parsed.annualPrice);
          const financialChanged = Boolean(existing && (existing.monthlyPrice?.toFixed(2) !== monthlyPrice?.toFixed(2) || existing.annualPrice?.toFixed(2) !== annualPrice?.toFixed(2) || existing.currency !== parsed.currency));
          const serializedFeatures = JSON.stringify(features);
          const catalogChanged = Boolean(existing && (financialChanged || existing.slug !== parsed.slug || existing.name !== parsed.name || existing.descriptionEn !== parsed.descriptionEn || existing.descriptionAr !== parsed.descriptionAr || existing.userLimit !== parsed.userLimit || existing.features !== serializedFeatures || existing.availability !== parsed.availability || existing.recommended !== parsed.recommended || existing.isActive !== parsed.isActive));
          const data = { ...parsed, monthlyPrice, annualPrice, annualDiscountPercent: null, features: serializedFeatures, ...(existing ? { pricingVersion: financialChanged ? existing.pricingVersion + 1 : existing.pricingVersion, catalogRevision: catalogChanged ? existing.catalogRevision + 1 : existing.catalogRevision } : { pricingVersion: 1, catalogRevision: 1 }) };
          const row = id ? await tx.platformPlan.update({ where: { id }, data }) : await tx.platformPlan.create({ data });
          auditDetails = { pricingChanged: financialChanged, pricingVersion: row.pricingVersion, catalogRevision: row.catalogRevision, currency: row.currency, monthlyPrice: row.monthlyPrice?.toFixed(2) ?? null, annualPrice: row.annualPrice?.toFixed(2) ?? null };
          recordId = row.id; break;
        }
        case 'subscriptions': {
          const parsed = subscriptionInput.parse(input);
          let data = { ...parsed, startsAt: parsed.startsAt! };
          if (data.status === 'ACTIVE') throw new Error('Use an activation request and confirmed manual payment to activate a subscription');
          if (data.status === 'TRIAL') throw new Error('Trials can only be created atomically during eligible workspace signup');
          await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${data.organizationId} FOR UPDATE`;
          const plan = await tx.platformPlan.findUniqueOrThrow({ where: { id: data.planId } });
          const existing = id ? await tx.platformSubscription.findUniqueOrThrow({ where: { id } }) : null;
          if (existing && existing.organizationId !== data.organizationId) throw new Error('Subscriptions cannot be moved between workspaces');
          if (!plan.isActive && existing?.planId !== data.planId) throw new Error('Select an active plan');
          if (existing?.status === 'CANCELLED' && existing.endsAt && existing.endsAt > new Date() && data.status !== 'CANCELLED') throw new Error('A cancelled paid subscription cannot change before its paid end date');
          if (existing && ['ACTIVE', 'CANCELLED'].includes(existing.status) && data.status === 'CANCELLED') {
            if (!existing.endsAt) throw new Error('A paid end date is required before cancellation');
            data = { ...data, planId: existing.planId, billingInterval: existing.billingInterval === 'annual' ? 'annual' : 'monthly', startsAt: existing.startsAt, endsAt: existing.endsAt };
            auditDetails = { cancellationEffectiveAt: existing.endsAt.toISOString(), retainedPaidAccess: true };
          }
          await tx.planUpgradeRequest.updateMany({ where: { organizationId: data.organizationId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED'] } }, data: { status: 'CANCELLED', reviewedById: user.id, reviewedAt: new Date(), reviewNote: 'Superseded by a platform subscription update.' } });
          const row = id ? await tx.platformSubscription.update({ where: { id }, data }) : await tx.platformSubscription.create({ data }); recordId = row.id; break;
        }
        case 'integrations': {
          const parsed = integrationInput.parse(input);
          const existing = id ? await tx.externalIntegration.findUniqueOrThrow({ where: { id } }) : null;
          if ((!existing || existing.provider !== parsed.provider || existing.organizationId !== parsed.organizationId) && !parsed.accessToken) throw new Error('Credentials are required for a new connection or provider');
          if (existing && existing.organizationId !== parsed.organizationId) throw new Error('Connections cannot be moved between workspaces');
          const data = { organizationId: parsed.organizationId, provider: parsed.provider, accountEmail: parsed.accountEmail, scopes: JSON.stringify(split(parsed.scopes)), tokenExpiresAt: parsed.tokenExpiresAt, metadata: parsed.provider === 'SMTP' ? JSON.stringify({ host: parsed.host, port: parsed.port, useTls: parsed.useTls }) : null, ...(parsed.accessToken ? { accessTokenEncrypted: encryptSecret(parsed.accessToken) } : {}), ...(parsed.refreshToken ? { refreshTokenEncrypted: encryptSecret(parsed.refreshToken) } : {}) };
          const row = id ? await tx.externalIntegration.update({ where: { id }, data }) : await tx.externalIntegration.create({ data: { ...data, accessTokenEncrypted: encryptSecret(parsed.accessToken) } }); recordId = row.id; break;
        }
        case 'support': {
          const data = supportInput.parse(input);
          const existing = id ? await tx.platformSupportCase.findUniqueOrThrow({ where: { id } }) : null;
          if (existing && (
            existing.organizationId !== data.organizationId ||
            existing.subject !== data.subject ||
            (existing.description ?? '') !== data.description ||
            (existing.contactEmail ?? '') !== data.contactEmail
          )) throw new Error('The original support request is immutable');
          const mutableData = { status: data.status, priority: data.priority, resolution: data.resolution };
          const row = id ? await tx.platformSupportCase.update({ where: { id }, data: mutableData }) : await tx.platformSupportCase.create({ data });
          recordId = row.id;
          auditDetails = { status: data.status, priority: data.priority, replied: Boolean(data.resolution.trim()) };
          break;
        }
        case 'settings': {
          const data = settingInput.parse(input);
          const existing = id ? await tx.platformSetting.findUniqueOrThrow({ where: { id } }) : null;
          if (existing && existing.key !== data.key) throw new Error('Setting keys are immutable');
          if (existing?.key === 'paid_subscription_start_policy' && existing.value !== data.value) throw new Error('The payment-confirmation start policy is fixed');
          const row = id ? await tx.platformSetting.update({ where: { id }, data }) : await tx.platformSetting.create({ data }); recordId = row.id; break;
        }
      }
      await audit(tx, user, resource, recordId, id ? 'updated' : 'created', auditDetails);
      return recordId;
    }, { maxWait: 10000, timeout: 20000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async remove(user: UserSession, resource: PlatformResource, id: string) {
    requirePlatformAdmin(user);
    await prisma.$transaction(async tx => {
      switch (resource) {
        case 'organizations':
          if (id === user.organizationId) throw new Error('Your current platform workspace cannot be deleted');
          if (await tx.organizationMember.count({ where: { organizationId: id } })) throw new Error('This workspace has members. Suspend it instead or remove its members first');
          await tx.department.deleteMany({ where: { organizationId: id, users: { none: {} }, tickets: { none: {} }, taskTypes: { none: {} }, managers: { none: {} } } });
          await tx.organization.delete({ where: { id } }); break;
        case 'users': {
          const target = await tx.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
          if (id === user.id || target.isPlatformAdmin || target.role.name === 'PLATFORM_ADMIN') throw new Error('Platform administrator accounts are protected');
          await tx.user.delete({ where: { id } }); break;
        }
        case 'plans': await tx.platformPlan.delete({ where: { id } }); break;
        case 'subscriptions': throw new Error('Subscription history cannot be deleted. Cancel the subscription instead');
        case 'integrations': await tx.externalIntegration.delete({ where: { id } }); break;
        case 'support': await tx.platformSupportCase.delete({ where: { id } }); break;
        case 'settings': await tx.platformSetting.delete({ where: { id } }); break;
      }
      await audit(tx, user, resource, id, 'deleted');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
