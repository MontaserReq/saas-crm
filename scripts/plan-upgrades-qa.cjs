// Local-only UI verification; fixtures are removed by their exact IDs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const { SignJWT } = require('jose');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.PLAN_QA_URL || 'http://localhost:3004';
const suffix = randomUUID(); const orgIds = [], userIds = [];
const output = path.join(os.tmpdir(), 'codeline-plan-upgrades-qa');

async function account(platform) {
  const org = await db.organization.create({ data: { name: `Plan UI QA ${suffix} ${platform ? 'admin' : 'company'}`, slug: `plan-ui-${suffix}-${platform ? 'admin' : 'company'}` } }); orgIds.push(org.id);
  const role = await db.role.findUniqueOrThrow({ where: { name: platform ? 'SUPER_ADMIN' : 'ADMIN' } });
  const department = await db.department.create({ data: { organizationId: org.id, name: 'QA', code: `PLAN_UI_${randomUUID()}` } });
  const user = await db.user.create({ data: { name: 'Plan UI QA', email: `plan-ui-${randomUUID()}@example.test`, passwordHash: 'no-login-qa', roleId: role.id, departmentId: department.id, isPlatformAdmin: platform, organizationMemberships: { create: { organizationId: org.id, roleId: role.id } } } }); userIds.push(user.id);
  if (!platform) {
    const workflowPermission = await db.permission.findUniqueOrThrow({ where: { code: 'workflows.view' } });
    await db.userPermission.create({ data: { userId: user.id, permissionId: workflowPermission.id } });
  }
  const session = await db.loginSession.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
  const token = await new SignJWT({ id: user.id, sessionId: session.id, organizationId: org.id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET.trim()));
  return { org, token };
}

async function main() {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  const company = await account(false), admin = await account(true);
  const starter = await db.platformPlan.findUniqueOrThrow({ where: { slug: 'starter' } });
  const growth = await db.platformPlan.findUniqueOrThrow({ where: { slug: 'growth' } });
  await db.platformSubscription.create({ data: { organizationId: company.org.id, planId: starter.id, status: 'ACTIVE' } });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    await fs.mkdir(output, { recursive: true });
    const contexts = await Promise.all([company, admin].map(async item => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addCookies([{ name: 'codeline_session', value: item.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
      await context.addInitScript(() => localStorage.setItem('codeline_lang', 'en'));
      return context;
    }));
    const tenant = await contexts[0].newPage(), platform = await contexts[1].newPage();
    for (const page of [tenant, platform]) { page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.message)); }
    await tenant.goto(`${base}/settings/subscription`, { waitUntil: 'networkidle', timeout: 120000 });
    const requestForm = tenant.locator('form').filter({ hasText: 'Request a plan upgrade' });
    await requestForm.locator('select').nth(0).selectOption(growth.id);
    await requestForm.locator('select').nth(1).selectOption('annual');
    await requestForm.locator('textarea').fill('UI verification');
    await tenant.getByRole('button', { name: 'Send upgrade request', exact: true }).click();
    await tenant.getByText('Your organization’s request is being reviewed.', { exact: true }).waitFor();
    console.log('PASS: workspace member submitted upgrade request');
    await platform.goto(`${base}/admin/platform/upgrade-requests`, { waitUntil: 'networkidle', timeout: 120000 });
    const request = platform.locator('section').filter({ hasText: company.org.name });
    await request.getByLabel('Review note').fill('Approved in UI QA');
    await request.getByRole('button', { name: 'Approve & activate plan' }).click();
    await request.waitFor({ state: 'detached' });
    assert.equal((await db.platformSubscription.findUniqueOrThrow({ where: { organizationId: company.org.id } })).planId, growth.id);
    await tenant.reload({ waitUntil: 'networkidle' });
    await tenant.getByText('Growth', { exact: true }).first().waitFor();
    await tenant.getByRole('link', { name: 'Workflow automation', exact: true }).waitFor();
    await tenant.goto(`${base}/settings/workflows`, { waitUntil: 'networkidle', timeout: 120000 });
    await tenant.getByRole('heading', { name: 'Workflows', exact: true }).waitFor();
    console.log('PASS: platform approved request and tenant sees new plan');
    await platform.goto(`${base}/admin/platform/organizations/${company.org.id}`, { waitUntil: 'networkidle', timeout: 120000 });
    await platform.getByRole('heading', { name: 'Sales by currency & status' }).waitFor();
    const editor = platform.locator('form').filter({ hasText: 'Change company plan' });
    await editor.locator('select').nth(0).selectOption(starter.id);
    await editor.getByRole('button', { name: 'Save & activate plan' }).click();
    await editor.getByRole('status').getByText('Company plan updated.', { exact: true }).waitFor();
    assert.equal((await db.platformSubscription.findUniqueOrThrow({ where: { organizationId: company.org.id } })).planId, starter.id);
    await tenant.goto(`${base}/settings/workflows`, { waitUntil: 'networkidle', timeout: 120000 });
    await tenant.getByRole('heading', { name: 'This feature is not included in your plan', exact: true }).waitFor();
    assert.equal(await tenant.getByRole('link', { name: 'Workflow automation', exact: true }).count(), 0);
    console.log('PASS: administrator directly assigned company plan');
    for (const [language, width] of [['en', 1440], ['ar', 390]]) {
      if (await platform.evaluate(() => document.documentElement.lang) !== language) await platform.getByRole('button', { name: 'Switch Language' }).click();
      await platform.waitForFunction(expected => document.documentElement.lang === expected, language);
      await platform.setViewportSize({ width, height: 1000 });
      await platform.getByRole('heading', { name: language === 'ar' ? 'تعديل خطة الشركة' : 'Change company plan' }).waitFor();
      assert.ok(await platform.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Page overflows viewport');
      await platform.screenshot({ path: path.join(output, `company-${language}-${width}.png`), fullPage: true });
      console.log(`PASS: ${language} company statistics at ${width}px`);
    }
    await tenant.goto(`${base}/admin/platform/organizations/${company.org.id}`, { waitUntil: 'networkidle' });
    assert.equal(new URL(tenant.url()).pathname, '/dashboard');
    assert.deepEqual(errors, []);
    console.log('PASS: company member cannot open platform company statistics');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  const where = { organizationId: { in: orgIds } };
  await db.planUpgradeRequest.deleteMany({ where }); await db.auditLog.deleteMany({ where }); await db.platformSubscription.deleteMany({ where });
  await db.loginSession.deleteMany({ where: { userId: { in: userIds } } }); await db.organizationMember.deleteMany({ where });
  await db.user.deleteMany({ where: { id: { in: userIds } } }); await db.department.deleteMany({ where });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } }); await db.$disconnect();
});
