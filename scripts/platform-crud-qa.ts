import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import prisma from '../src/lib/db/prisma';
import { PlatformAdminService } from '../src/server/services/PlatformAdminService';
import type { UserSession } from '../src/types';

loadEnvConfig(process.cwd());
const suffix = crypto.randomUUID();
const ids: Partial<Record<'organization' | 'user' | 'plan' | 'subscription' | 'integration' | 'support' | 'setting', string>> = {};

async function platformUser(): Promise<UserSession> {
  const admin = await prisma.user.findFirstOrThrow({
    where: { isActive: true, isPlatformAdmin: true, role: { name: 'SUPER_ADMIN' }, organizationMemberships: { some: { status: 'ACTIVE', role: { name: 'SUPER_ADMIN' } } } },
    include: { role: true, department: true, organizationMemberships: { where: { status: 'ACTIVE' }, include: { organization: true } } },
  });
  const membership = admin.organizationMemberships[0];
  return { id: admin.id, name: admin.name, email: admin.email, role: 'SUPER_ADMIN', isPlatformAdmin: true, roleDisplayName: admin.role.displayName, departmentId: admin.departmentId, departmentName: admin.department.name, permissions: [], organizationId: membership.organizationId, organizationName: membership.organization.name };
}

async function cleanup() {
  if (ids.user) await prisma.user.deleteMany({ where: { id: ids.user } });
  if (ids.integration) await prisma.externalIntegration.deleteMany({ where: { id: ids.integration } });
  if (ids.support) await prisma.platformSupportCase.deleteMany({ where: { id: ids.support } });
  if (ids.subscription) await prisma.platformSubscription.deleteMany({ where: { id: ids.subscription } });
  if (ids.plan) await prisma.platformPlan.deleteMany({ where: { id: ids.plan } });
  if (ids.setting) await prisma.platformSetting.deleteMany({ where: { id: ids.setting } });
  if (ids.organization) {
    await prisma.department.deleteMany({ where: { organizationId: ids.organization } });
    await prisma.organization.deleteMany({ where: { id: ids.organization } });
  }
}

async function main() {
  const database = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname), 'CRUD QA requires a local database');
  const admin = await platformUser();
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

  ids.organization = await PlatformAdminService.save(admin, 'organizations', null, { name: 'Platform CRUD QA', slug: `platform-crud-${suffix}`, language: 'en', timezone: 'Asia/Riyadh', currency: 'SAR', isActive: true });
  await PlatformAdminService.save(admin, 'organizations', ids.organization, { name: 'Platform CRUD QA updated', slug: `platform-crud-${suffix}`, language: 'ar', timezone: 'Asia/Riyadh', currency: 'SAR', isActive: true });
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: ids.organization } })).language, 'ar');

  ids.user = await PlatformAdminService.save(admin, 'users', null, { name: 'Platform CRUD user', email: `platform-crud-${suffix}@example.test`, phone: '', organizationId: ids.organization, departmentId: '', roleId: role.id, password: 'PlatformCrudPassword123!', isActive: true });
  await PlatformAdminService.save(admin, 'users', ids.user, { name: 'Platform CRUD user updated', email: `platform-crud-${suffix}@example.test`, phone: '+966500000000', organizationId: ids.organization, departmentId: '', roleId: role.id, password: '', isActive: false });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids.user } })).isActive, false);

  ids.plan = await PlatformAdminService.save(admin, 'plans', null, { slug: `qa-${suffix}`, name: 'QA Plan', descriptionEn: 'QA', descriptionAr: 'اختبار', monthlyPrice: 25, annualDiscountPercent: 10, userLimit: 5, features: 'crm, tasks', availability: 'self_serve', recommended: false, isActive: true });
  ids.subscription = await PlatformAdminService.save(admin, 'subscriptions', null, { organizationId: ids.organization, planId: ids.plan, status: 'TRIAL', billingInterval: 'monthly', startsAt: new Date().toISOString(), endsAt: '', notes: 'QA' });
  ids.integration = await PlatformAdminService.save(admin, 'integrations', null, { organizationId: ids.organization, provider: 'SMTP', accountEmail: `mail-${suffix}@example.test`, accessToken: 'qa-secret', refreshToken: '', tokenExpiresAt: '', scopes: 'email', host: 'smtp.example.test', port: 587, useTls: true });
  ids.support = await PlatformAdminService.save(admin, 'support', null, { organizationId: ids.organization, subject: 'QA support case', description: 'Created by platform CRUD QA', contactEmail: `support-${suffix}@example.test`, status: 'OPEN', priority: 'NORMAL', resolution: '' });
  ids.setting = await PlatformAdminService.save(admin, 'settings', null, { key: 'support_email', value: `support-${suffix}@example.test` });

  const searches = { organizations: suffix, users: suffix, plans: suffix, subscriptions: 'QA Plan', integrations: suffix, support: suffix, settings: 'support_email' } as const;
  for (const resource of ['organizations', 'users', 'plans', 'subscriptions', 'integrations', 'support', 'settings'] as const) {
    const result = await PlatformAdminService.list(admin, resource, searches[resource], 1);
    assert.ok(result.records.length >= 1, `${resource} create/list failed`);
  }
  await assert.rejects(() => PlatformAdminService.list({ ...admin, isPlatformAdmin: false }, 'organizations'), /Forbidden/);

  await PlatformAdminService.remove(admin, 'users', ids.user); delete ids.user;
  await PlatformAdminService.remove(admin, 'integrations', ids.integration); delete ids.integration;
  await PlatformAdminService.remove(admin, 'support', ids.support); delete ids.support;
  await PlatformAdminService.remove(admin, 'subscriptions', ids.subscription); delete ids.subscription;
  await PlatformAdminService.remove(admin, 'plans', ids.plan); delete ids.plan;
  await PlatformAdminService.remove(admin, 'settings', ids.setting); delete ids.setting;
  await PlatformAdminService.remove(admin, 'organizations', ids.organization); delete ids.organization;
  console.log(JSON.stringify({ resources: 7, create: 'passed', read: 'passed', update: 'passed', delete: 'passed', authorization: 'passed' }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
