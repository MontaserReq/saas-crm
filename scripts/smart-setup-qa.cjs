// Local-only QA. PLAYWRIGHT_MODULE points to an existing browser package.
// Every fixture is tagged and removed by its exact user/organization IDs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const prefix = `smart-qa-${crypto.randomUUID()}`;
const output = process.env.SMART_SETUP_QA_OUTPUT || path.join(os.tmpdir(), 'codeline-smart-setup-qa');
const url = process.env.SMART_SETUP_QA_URL || 'http://localhost:3002';
const attempts = new Set();
const results = [];

async function main() {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const language of ['en', 'ar']) {
      const ar = language === 'ar';
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(language => { localStorage.setItem('codeline_lang', language); localStorage.setItem('theme', 'light'); }, language);
      const page = await context.newPage(); const errors = [];
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.message));
      const start = Date.now();
      await page.goto(url + '/onboarding', { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(language => document.documentElement.lang === language, language);
      await page.locator('input[name="name"]').fill('QA owner');
      await page.locator('input[name="email"]').fill(`${prefix}-${language}@example.test`);
      await page.locator('input[name="password"]').fill('SmartQaPassword123!');
      await page.locator('input[name="confirmPassword"]').fill('SmartQaPassword123!');
      await page.getByRole('button', { name: ar ? 'إنشاء الحساب' : 'Create account', exact: true }).click();
      await page.locator('input[name="workspace"]').waitFor({ timeout: 60000 });
      console.log(language, 'account created');
      const attempt = (await context.cookies()).find(cookie => cookie.name === 'codeline_signup_attempt'); if (attempt) attempts.add(attempt.value);
      await page.locator('input[name="workspace"]').fill(ar ? 'أكاديمية تجربة' : 'QA Estate');
      await page.locator(`label:has(input[value="${ar ? 'education' : 'real_estate'}"])`).click();
      await page.getByRole('status').filter({ hasText: ar ? 'تم حفظ التقدم' : 'Progress saved' }).waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('input[name="workspace"]').inputValue(), ar ? 'أكاديمية تجربة' : 'QA Estate');
      assert.equal(await page.locator(`input[type="radio"][value="${ar ? 'education' : 'real_estate'}"]`).isChecked(), true);
      const reopened = await browser.newContext({ storageState: await context.storageState() });
      const reopenedPage = await reopened.newPage(); await reopenedPage.goto(url + '/onboarding', { waitUntil: 'networkidle' });
      assert.equal(await reopenedPage.locator('input[name="workspace"]').inputValue(), ar ? 'أكاديمية تجربة' : 'QA Estate'); await reopened.close();
      for (let step = 1; step <= 4; step++) {
        console.log(language, 'checking step', step);
        for (const theme of ['light', 'dark']) for (const width of [320, 390, 820, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
          // Let the declared color transition finish before visual inspection.
          await page.waitForTimeout(220);
          assert.equal(await page.locator('main').getAttribute('dir'), ar ? 'rtl' : 'ltr');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} step ${step} overflow at ${width}`);
          const unlabeled = await page.locator('input,select,textarea').evaluateAll(controls => controls.filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length);
          assert.equal(unlabeled, 0);
          await page.screenshot({ path: path.join(output, `${language}-step-${step}-${theme}-${width}.png`), fullPage: true });
          results.push({ language, step, theme, width, overflow: false, unlabeled });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
        if (step === 1) {
          await page.getByRole('button', { name: ar ? 'التالي' : 'Continue', exact: true }).click();
          await page.locator('input[type="checkbox"][value="pipelines"]').waitFor();
        } else if (step === 2) {
          if (ar) { await page.locator('input[value="leads"]').uncheck(); await page.locator('input[value="pipelines"]').uncheck(); await page.locator('input[value="support"]').check(); await page.getByRole('button', { name: 'التالي', exact: true }).click(); }
          else await page.getByRole('button', { name: 'Skip and use recommended defaults' }).click();
          await page.getByRole('button', { name: ar ? 'اعتماد الإعداد' : 'Accept setup', exact: true }).waitFor();
        } else if (step === 3) {
          if (ar) await page.getByLabel('العملاء المحتملون', { exact: true }).check();
          else {
            await page.getByText('Adjust stages (optional)', { exact: true }).click();
            await page.getByLabel('Stage 1', { exact: true }).fill('Incoming inquiry');
            await page.getByLabel('Customer requests', { exact: true }).check();
          }
          await page.getByRole('button', { name: ar ? 'اعتماد الإعداد' : 'Accept setup', exact: true }).click();
          await page.reload({ waitUntil: 'networkidle' });
          await page.getByRole('button', { name: ar ? 'أنشئ مساحة عملي' : 'Create my workspace', exact: true }).waitFor();
          if (!ar) assert.ok(await page.getByText('Incoming inquiry', { exact: true }).count());
        } else {
          await page.getByRole('button', { name: ar ? 'أنشئ مساحة عملي' : 'Create my workspace', exact: true }).click();
          await page.waitForURL('**/dashboard', { timeout: 60000 });
        }
      }
      const elapsedMs = Date.now() - start;
      await page.getByRole('button', { name: ar ? 'إخفاء قائمة البداية' : 'Dismiss checklist', exact: true }).click();
      await page.getByRole('button', { name: ar ? 'استئناف خطوات البداية' : 'Resume getting started', exact: true }).waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: ar ? 'استئناف خطوات البداية' : 'Resume getting started', exact: true }).click();
      await page.getByLabel(ar ? 'أضف أول عميل محتمل' : 'Add your first potential customer').fill('QA real record');
      await page.getByRole('button', { name: ar ? 'إضافة العميل' : 'Add customer', exact: true }).click();
      await page.getByRole('status').filter({ hasText: ar ? 'تم حفظ أول عميل' : 'Your first customer is saved' }).waitFor();
      await page.screenshot({ path: path.join(output, `${language}-dashboard.png`), fullPage: true });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: `${prefix}-${language}@example.test` }, include: { organizationMemberships: true } });
      const organizationId = user.organizationMemberships[0].organizationId;
      assert.equal(await prisma.lead.count({ where: { organizationId } }), 1);
      assert.equal(await prisma.auditLog.count({ where: { organizationId, action: 'WORKSPACE_PROVISIONED' } }), 1);
      assert.equal(await prisma.auditLog.count({ where: { organizationId, action: 'ONBOARDING_CRM_ENTERED' } }), 1);
      if (!ar) assert.equal((await prisma.pipelineStage.findFirstOrThrow({ where: { organizationId, order: 0 } })).name, 'Incoming inquiry');
      assert.equal(await prisma.auditLog.count({ where: { organizationId, action: 'ONBOARDING_FIRST_USEFUL_ACTION' } }), 1);
      const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId } });
      await page.goto(url + '/leads/' + lead.id, { waitUntil: 'networkidle' });
      await page.getByLabel(ar ? 'الدورة المطلوبة' : 'Property of interest').fill(ar ? 'دورة البرمجة' : 'City apartment');
      await page.getByRole('button', { name: ar ? 'حفظ التفاصيل' : 'Save details', exact: true }).click();
      await page.getByRole('status').filter({ hasText: ar ? 'تم حفظ التفاصيل' : 'Details saved' }).waitFor();
      assert.equal(await prisma.customFieldValue.count({ where: { organizationId, entityId: lead.id } }), 1);
      await page.goto(url + '/dashboard', { waitUntil: 'networkidle' });
      if (ar) assert.equal(await page.locator('aside a[href="/deals"]').count(), 0);
      else assert.ok(await page.locator('aside a[href="/deals"]').count() > 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('button[aria-expanded="false"]').filter({ has: page.locator('svg.lucide-menu') }).click();
      await page.getByRole('dialog').waitFor();
      assert.ok(await page.getByRole('dialog').locator('a[href="/leads"]').count() > 0);
      if (ar) assert.equal(await page.getByRole('dialog').locator('a[href="/deals"]').count(), 0);
      await page.keyboard.press('Escape');
      await page.goto(url + '/settings', { waitUntil: 'networkidle' });
      await page.getByLabel(ar ? 'فرص البيع' : 'Sales opportunities', { exact: true }).uncheck();
      await page.getByRole('button', { name: ar ? 'حفظ القائمة' : 'Save menu', exact: true }).click();
      await page.getByRole('status').filter({ hasText: ar ? 'تم حفظ القائمة' : 'Menu saved' }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('aside a[href="/deals"]').length === 0);
      assert.equal(await page.locator('aside a[href="/deals"]').count(), 0);
      assert.equal(await prisma.lead.count({ where: { organizationId } }), 1);
      assert.deepEqual(errors, []);
      results.push({ language, journey: 'signup → resume → provision → real record → revise menu', elapsedMs, errors });
      await context.close();
      console.log(language, 'journey passed', `${(elapsedMs / 1000).toFixed(1)}s (automated; includes screenshots)`);
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log('Visual checks:', results.filter(result => result.step).length, 'output:', output);
  } finally {
    await browser.close();
    const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } }, include: { organizationMemberships: true } });
    const userIds = users.map(user => user.id); const organizationIds = users.flatMap(user => user.organizationMemberships.map(member => member.organizationId));
    if (organizationIds.length) {
      const where = { organizationId: { in: organizationIds } };
      await prisma.auditLog.deleteMany({ where }); await prisma.notification.deleteMany({ where: { OR: [where, { entityId: { in: organizationIds }, type: 'ORGANIZATION_SIGNUP' }] } });
      await prisma.workflowExecution.deleteMany({ where }); await prisma.lead.deleteMany({ where });
      await prisma.customFieldValue.deleteMany({ where }); await prisma.customFieldDefinition.deleteMany({ where }); await prisma.pipelineStage.deleteMany({ where }); await prisma.pipeline.deleteMany({ where });
      await prisma.organizationMember.deleteMany({ where }); await prisma.user.deleteMany({ where: { id: { in: userIds }, email: { startsWith: prefix } } });
      await prisma.department.deleteMany({ where }); await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (attempts.size) await prisma.auditLog.deleteMany({ where: { entityId: { in: [...attempts] }, action: 'SIGNUP_STARTED' } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
