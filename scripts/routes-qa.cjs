// Exercise real protected routes with an isolated local QA account.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const { SignJWT } = require('jose');
loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.ROUTES_QA_URL || 'http://localhost:3000';
const suffix = crypto.randomUUID();
let organizationId, departmentId, userId;

async function main() {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  const org = await db.organization.create({ data: { name: 'Routes QA', slug: `routes-qa-${suffix}` } });
  organizationId = org.id;
  const department = await db.department.create({ data: { organizationId, name: 'Routes QA', code: `ROUTES_QA_${suffix}` } });
  departmentId = department.id;
  const role = await db.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const user = await db.user.create({ data: { name: 'Routes QA', email: `routes-qa-${suffix}@example.test`, passwordHash: crypto.randomUUID(), roleId: role.id, departmentId, isPlatformAdmin: true } });
  userId = user.id;
  await db.organizationMember.create({ data: { organizationId, userId, roleId: role.id, status: 'ACTIVE' } });
  const session = await db.loginSession.create({ data: { userId, expiresAt: new Date(Date.now() + 3600000) } });
  const token = await new SignJWT({ id: userId, sessionId: session.id, organizationId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const client = await db.client.create({ data: { organizationId, name: 'Routes QA customer', type: 'COMPANY', createdById: userId } });
  const lead = await db.lead.create({ data: { organizationId, name: 'Routes QA lead', clientId: client.id } });
  const contact = await db.contact.create({ data: { organizationId, firstName: 'Routes QA contact', clientId: client.id } });
  const pipeline = await db.pipeline.create({ data: { organizationId, name: 'Routes QA pipeline', stages: { create: { organizationId, name: 'Open', order: 0 } } }, include: { stages: true } });
  const deal = await db.deal.create({ data: { organizationId, title: 'Routes QA deal', pipelineId: pipeline.id, stageId: pipeline.stages[0].id, ownerId: userId, createdById: userId, clientId: client.id, value: '123.45' } });
  const task = await db.crmTask.create({ data: { organizationId, title: 'Routes QA task', dealId: deal.id, clientId: client.id, createdById: userId } });
  const sections = ['organizations', 'signups', 'billing', 'users', 'integrations', 'health', 'support', 'analytics', 'settings'];
  const routes = process.env.ROUTES_QA_PATHS?.split(',') || ['/admin', ...sections.map(section => `/admin/platform/${section}`), '/dashboard', '/admin/users', '/admin/roles', '/admin/departments', '/admin/task-types', '/admin/analytics', '/admin/audit-logs', '/admin/approval-requests', '/settings', '/settings/message-templates', '/settings/ticket-priorities', '/settings/workflows', '/clients', '/leads', '/contacts', '/deals', '/tasks', '/pipelines', '/tickets', '/tickets?view=all', '/schools', '/calendar', '/proposals', '/proposals/new', '/ai-school-research', '/assignments', '/messages', '/todos', '/activity', '/profile', '/notifications', '/chat'];
  if (!process.env.ROUTES_QA_PATHS || process.env.ROUTES_QA_DETAILS === '1') routes.push(`/clients/${client.id}`, `/leads/${lead.id}`, `/contacts/${contact.id}`, `/deals/${deal.id}`, `/tasks/${task.id}`);
  const results = [];
  for (const route of routes) {
    const response = await fetch(`${base}${route}`, { headers: { Cookie: `codeline_session=${token}` }, redirect: 'manual', signal: AbortSignal.timeout(120000) });
    const html = await response.text();
    const failed = response.status >= 400 || /:E\{/.test(html) || html.includes('"digest"') || html.includes('NEXT_REDIRECT') || html.includes('Internal Server Error');
    const result = { route, status: response.status, location: response.headers.get('location'), failed };
    if (failed) {
      const output = path.join(os.tmpdir(), `routes-qa-${route.replace(/[^a-z0-9]/gi, '-')}.html`);
      await fs.writeFile(output, html.replaceAll(token, '[SESSION REDACTED]'));
      result.output = output;
    }
    results.push(result);
    console.log(JSON.stringify(result));
  }
  assert.ok(results.every(result => !result.failed && result.status === 200), 'Some routes failed or redirected');
  const search = await fetch(`${base}/api/global-search?q=Routes%20QA`, { headers: { Cookie: `codeline_session=${token}` } });
  assert.equal(search.status, 200);
  const found = (await search.json()).results;
  for (const [type, href] of [['Client', `/clients/${client.id}`], ['Lead', `/leads/${lead.id}`], ['Contact', `/contacts/${contact.id}`], ['Task', `/tasks/${task.id}`]]) {
    assert.equal(found.find(result => result.type === type)?.href, href);
  }
  for (const cookie of ['', 'codeline_session=expired-or-revoked']) {
    const response = await fetch(`${base}/login`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, 'Invalid sessions must be able to reach login');
  }
  const loggedIn = await fetch(`${base}/login`, { headers: { Cookie: `codeline_session=${token}` }, redirect: 'manual' });
  assert.equal(new URL(loggedIn.headers.get('location'), base).pathname, '/admin');
  const memberRole = await db.role.findUniqueOrThrow({ where: { name: 'MEMBER' } });
  await db.user.update({ where: { id: userId }, data: { roleId: memberRole.id, isPlatformAdmin: false } });
  await db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId } }, data: { roleId: memberRole.id } });
  for (const route of ['/admin', '/admin/platform/organizations', '/admin/users']) {
    const response = await fetch(`${base}${route}`, { headers: { Cookie: `codeline_session=${token}` }, redirect: 'manual' });
    assert.equal(new URL(response.headers.get('location'), base).pathname, '/dashboard', 'Workspace members must not enter platform administration');
  }
  console.log(JSON.stringify({ checked: routes.length, searchLinks: 'passed', sessionRouting: 'passed', platformAccess: 'passed' }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (organizationId) {
    await db.crmTask.deleteMany({ where: { organizationId } });
    await db.deal.deleteMany({ where: { organizationId } });
    await db.pipelineStage.deleteMany({ where: { organizationId } });
    await db.pipeline.deleteMany({ where: { organizationId } });
    await db.lead.deleteMany({ where: { organizationId } });
    await db.contact.deleteMany({ where: { organizationId } });
    await db.client.deleteMany({ where: { organizationId } });
  }
  if (userId) await db.user.delete({ where: { id: userId } });
  if (departmentId) await db.department.delete({ where: { id: departmentId } });
  if (organizationId) await db.organization.delete({ where: { id: organizationId } });
  await db.$disconnect();
});
