// Local browser QA with one isolated tenant. Only its exact IDs are cleaned up.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PrismaClient } = require('@prisma/client');
const { loadEnvConfig } = require('@next/env');
const { SignJWT } = require('jose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
loadEnvConfig(process.cwd());
const db = new PrismaClient();
const output = process.env.CRM_QA_OUTPUT || path.join(os.tmpdir(), 'codeline-crm-pages-qa');
const url = process.env.CRM_QA_URL || 'http://localhost:3002';
const suffix = crypto.randomUUID();
let organizationId, userId, browser;

async function fixture() {
  const organization = await db.organization.create({ data: { name: 'CRM design QA', slug: `crm-design-qa-${suffix}` } });
  organizationId = organization.id;
  const department = await db.department.create({ data: { organizationId, name: 'Design QA', code: `QA_${suffix}` } });
  const role = await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const user = await db.user.create({ data: { email: `crm-design-${suffix}@example.test`, name: 'QA reviewer', roleId: role.id, departmentId: department.id, passwordHash: await bcrypt.hash(crypto.randomUUID(), 10) } });
  userId = user.id;
  await db.organizationMember.create({ data: { organizationId, userId, roleId: role.id, status: 'ACTIVE' } });
  const permissions = await db.permission.findMany({ where: { code: { in: ['schools.view', 'schools.create', 'deals.view', 'deals.create', 'deals.update', 'pipelines.view', 'tasks.view', 'tasks.create', 'tasks.update'] } } });
  assert.equal(permissions.length, 9);
  await db.userPermission.createMany({ data: permissions.map(permission => ({ userId, permissionId: permission.id })) });
  const session = await db.loginSession.create({ data: { userId, expiresAt: new Date(Date.now() + 3600000) } });
  const token = await new SignJWT({ id: userId, sessionId: session.id, organizationId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const pipeline = await db.pipeline.create({ data: { organizationId, name: 'مسار المبيعات', isDefault: true, stages: { create: ['تواصل جديد', 'تحديد الاحتياجات', 'عرض السعر', 'الاتفاق', 'ناجحة', 'غير ناجحة'].map((name, order) => ({ organizationId, name, order, type: order === 4 ? 'WON' : order === 5 ? 'LOST' : 'OPEN', probability: [10, 30, 55, 80, 100, 0][order] })) } }, include: { stages: { orderBy: { order: 'asc' } } } });
  const clients = [];
  for (const [index, name] of ['شركة المدار الرقمية', 'مؤسسة آفاق للتدريب', 'شركة بيت العمر', 'شركة حلول الأعمال', 'عمر خالد'].entries()) clients.push(await db.client.create({ data: { organizationId, name, type: index === 4 ? 'INDIVIDUAL' : 'COMPANY', status: index === 2 ? 'PROSPECT' : 'ACTIVE', email: `contact${index}@example.test`, phone: '+962790000000', createdById: userId } }));
  await db.contact.create({ data: { organizationId, clientId: clients[0].id, firstName: 'رنا', lastName: 'أحمد', email: 'rana@example.test' } });
  for (const [index, title] of ['تطوير منصة العملاء', 'برنامج التدريب السنوي', 'خدمات الاستشارات', 'اتفاقية الدعم الفني', 'حل إدارة المبيعات', 'مشروع الموقع الإلكتروني'].entries()) await db.deal.create({ data: { organizationId, title, clientId: clients[index % clients.length].id, pipelineId: pipeline.id, stageId: pipeline.stages[index].id, status: index === 4 ? 'WON' : index === 5 ? 'LOST' : 'OPEN', ownerId: userId, createdById: userId, value: (index + 1) * 1500, currency: 'JOD', probability: pipeline.stages[index].probability, expectedCloseDate: new Date(Date.now() + 5 * 86400000) } });
  const linkedDeal = await db.deal.findFirstOrThrow({ where: { organizationId }, select: { id: true } });
  for (const [index, title] of ['متابعة عرض السعر', 'تجهيز خطة التدريب', 'مراجعة متطلبات العميل', 'إرسال الاتفاقية', 'الاتصال بمسؤول المشروع', 'تنسيق الاجتماع القادم'].entries()) await db.crmTask.create({ data: { organizationId, title, clientId: clients[index % clients.length].id, dealId: index === 0 ? linkedDeal.id : undefined, status: index === 4 ? 'COMPLETED' : index === 2 ? 'IN_PROGRESS' : 'TODO', priority: index === 0 ? 'URGENT' : index === 1 ? 'HIGH' : 'MEDIUM', dueDate: new Date(Date.now() + (index - 1) * 86400000), ownerId: userId, assignedUserId: userId, createdById: userId } });
  return { token, pipeline };
}

async function main() {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  await fs.mkdir(output, { recursive: true });
  const { token, pipeline } = await fixture();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  for (const language of ['ar', 'en']) {
    const ar = language === 'ar';
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'codeline_session', value: token, url, httpOnly: true, sameSite: 'Lax' }]);
    await context.addInitScript(language => { localStorage.setItem('codeline_lang', language); localStorage.setItem('theme', 'light'); }, language);
    const page = await context.newPage(); page.setDefaultTimeout(30000); const errors = [];
    const dealResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', async response => {
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/deals') {
        dealResponses.push(await response.text().catch(() => ''));
      }
    });
    for (const route of ['clients', 'deals', 'tasks']) {
      await page.goto(`${url}/${route}`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(language => document.documentElement.lang === language, language);
      for (const theme of ['light', 'dark']) for (const width of [320, 390, 820, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme); await page.waitForTimeout(220);
        const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
        if (overflow.scroll > overflow.viewport) {
          await page.screenshot({ path: path.join(output, `${route}-overflow.png`), fullPage: true });
          console.log(JSON.stringify(await page.locator('main').evaluateAll(elements => elements.map(element => ({ classes: element.className, width: element.getBoundingClientRect().width, scroll: element.scrollWidth })))));
          console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => { const r = element.getBoundingClientRect(); return r.width > innerWidth + 100 && getComputedStyle(element).position === 'fixed'; }).map(element => ({ tag: element.tagName, classes: element.className, rect: { width: element.getBoundingClientRect().width, left: element.getBoundingClientRect().left }, overflow: getComputedStyle(element).overflowX })))));
        }
        assert.ok(overflow.scroll <= overflow.viewport, `${route}: overflow at ${width} (${overflow.scroll})`);
        assert.equal(await page.locator('html').getAttribute('dir'), ar ? 'rtl' : 'ltr');
        await page.screenshot({ path: path.join(output, `${route}-${language}-${theme}-${width}.png`), fullPage: true });
        results.push({ route, language, theme, width, overflow: false });
      }
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => document.documentElement.classList.remove('dark'));
      if (route === 'clients') {
        await page.getByRole('button', { name: ar ? 'إضافة عميل' : 'Add customer', exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(ar ? 'اسم العميل' : 'Customer name', { exact: true }).fill(`QA customer ${language}`);
        await dialog.getByLabel(ar ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)').fill(`${language}@example.test`);
        await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(output, `client-modal-${language}.png`), fullPage: true });
        await dialog.getByRole('button', { name: ar ? 'حفظ العميل' : 'Save customer', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('link', { name: `QA customer ${language}`, exact: true }).first().waitFor();
        assert.equal(await db.client.count({ where: { organizationId, name: `QA customer ${language}` } }), 1);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByRole('button', { name: ar ? 'عرض البطاقات' : 'Card view', exact: true }).click();
        await page.screenshot({ path: path.join(output, `clients-${language}-cards.png`), fullPage: true });
      } else if (route === 'deals') {
        await page.getByRole('button', { name: ar ? 'إضافة صفقة' : 'Add deal', exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(ar ? 'عنوان الصفقة' : 'Deal title').fill(`QA deal ${language}`);
        await dialog.getByLabel(ar ? 'القيمة (اختياري)' : 'Value (optional)').fill('2500');
        await dialog.getByRole('button', { name: ar ? 'حفظ الصفقة' : 'Save deal', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('link', { name: `QA deal ${language}`, exact: true }).waitFor();
        await page.getByLabel(`${ar ? 'نقل الصفقة' : 'Move deal'}: QA deal ${language}`, { exact: true }).selectOption(pipeline.stages[1].id);
        await page.waitForFunction(title => [...document.querySelectorAll('section')].some(section => section.querySelector('h2')?.textContent?.includes('تحديد الاحتياجات') && section.textContent.includes(title)), `QA deal ${language}`);
        assert.equal((await db.deal.findFirstOrThrow({ where: { organizationId, title: `QA deal ${language}` } })).stageId, pipeline.stages[1].id);
        await page.getByRole('button', { name: ar ? 'الجدول' : 'Table', exact: true }).click();
        await page.screenshot({ path: path.join(output, `deals-${language}-table.png`), fullPage: true });
        const deal = await db.deal.findFirstOrThrow({ where: { organizationId, title: `QA deal ${language}` } });
        await page.goto(`${url}/deals/${deal.id}`, { waitUntil: 'networkidle' });
        assert.ok(!(await page.content()).includes('passwordHash'), 'Deal detail must contain only public member data');
      } else {
        await page.getByRole('button', { name: ar ? 'إضافة مهمة' : 'Add task', exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(ar ? 'عنوان المهمة' : 'Task title').fill(`QA task ${language}`);
        await dialog.getByLabel(ar ? 'الأولوية' : 'Priority', { exact: true }).selectOption('HIGH');
        await dialog.getByRole('button', { name: ar ? 'حفظ المهمة' : 'Save task', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: `${ar ? 'إكمال المهمة' : 'Complete task'}: QA task ${language}`, exact: true }).last().click();
        await page.getByRole('status').filter({ hasText: ar ? 'تم إكمال المهمة بنجاح.' : 'Task completed.' }).waitFor();
        assert.equal((await db.crmTask.findFirstOrThrow({ where: { organizationId, title: `QA task ${language}` } })).status, 'COMPLETED');
        await page.getByRole('button', { name: ar ? 'المكتملة' : 'Completed', exact: false }).first().click();
        await page.getByRole('link', { name: `QA task ${language}`, exact: true }).last().waitFor();
        const task = await db.crmTask.findFirstOrThrow({ where: { organizationId, assignedUserId: userId, dealId: { not: null } } });
        await page.goto(`${url}/tasks/${task.id}`, { waitUntil: 'networkidle' });
        assert.ok(!(await page.content()).includes('passwordHash'), 'Task detail must contain only public member data');
      }
      console.log(language, route, 'visual and action checks passed');
    }
    assert.deepEqual(errors, []);
    assert.ok(dealResponses.length > 0);
    assert.ok(dealResponses.every(body => !body.includes('passwordHash')), 'Deal responses must not contain account credentials');
    await context.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length} layout checks passed. Screenshots: ${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (organizationId) {
    const where = { organizationId };
    await db.workflowExecution.deleteMany({ where }); await db.auditLog.deleteMany({ where });
    await db.crmTask.deleteMany({ where }); await db.deal.deleteMany({ where }); await db.contact.deleteMany({ where }); await db.client.deleteMany({ where });
    await db.pipelineStage.deleteMany({ where }); await db.pipeline.deleteMany({ where }); await db.organizationMember.deleteMany({ where });
    if (userId) await db.user.deleteMany({ where: { id: userId, email: `crm-design-${suffix}@example.test` } });
    await db.department.deleteMany({ where }); await db.organization.delete({ where: { id: organizationId } });
  }
  await db.$disconnect();
});
