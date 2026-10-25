/* Run with PLAYWRIGHT_MODULE and AXE_MODULE pointing to locally available QA
 * tools. No browser/test packages are added to the application dependencies.
 * MARKETING_QA_URL, MARKETING_QA_OUTPUT, CHROME_EXECUTABLE are optional. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = require(process.env.AXE_MODULE || '@axe-core/playwright').default;
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const output = process.env.MARKETING_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'codeline-marketing-qa', 'screenshots');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const url = process.env.MARKETING_QA_URL || 'http://localhost:3001';
  const results = process.env.MARKETING_QA_SKIP_MATRIX ? JSON.parse(await fs.readFile(path.join(output, 'results.json'), 'utf8')) : [];
  try {
    for (const language of (process.env.MARKETING_QA_SKIP_MATRIX ? [] : ['en', 'ar'])) for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
      await context.addInitScript(({ language, theme }) => { localStorage.setItem('codeline_lang', language); localStorage.setItem('theme', theme); }, { language, theme });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(({ language, theme }) => document.documentElement.lang === language && document.documentElement.classList.contains(theme), { language, theme });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('header').count(), 1);
      assert.equal(await page.locator('footer').count(), 1);
      assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(overflow.scroll <= overflow.viewport, JSON.stringify(overflow));
      const anchors = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(href => !document.getElementById(href.slice(1))));
      assert.deepEqual(anchors, []);
      const previewButtons = page.locator('button[aria-controls="product-preview-panel"]');
      for (let i = 0; i < 3; i++) { await previewButtons.nth(i).click(); assert.equal(await previewButtons.nth(i).getAttribute('aria-pressed'), 'true'); }
      await previewButtons.first().click();
      const summary = page.locator('details summary').first();
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('details').first().getAttribute('open'), '');
      await page.keyboard.press('Enter');
      if (device !== 'desktop') {
        const menu = page.locator('button[aria-controls="marketing-mobile-nav"]');
        await menu.click(); assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        assert.ok(await page.locator('#marketing-mobile-nav a[href="/onboarding"]').isVisible());
        await page.keyboard.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      }
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const name = `${language}-${theme}-${device}`;
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      await page.locator('#pricing').screenshot({ path: path.join(output, `${name}-pricing.png`) });
      await page.locator('main > section').first().screenshot({ path: path.join(output, `${name}-hero.png`) });
      results.push({ name, status: response.status(), overflow, errors, accessibility: accessibility.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(name, 'errors:', errors.length, 'a11y:', accessibility.violations.length);
      await context.close();
    }
    // Extra widths cover compact phones and breakpoint transitions.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const width of [320, 360, 720, 1050, 1051, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    }
    // Public destinations stay accessible without authentication.
    for (const route of ['/pricing', '/onboarding?plan=starter', '/onboarding?plan=growth', '/onboarding?plan=scale', '/login']) {
      const response = await page.goto(url + route, { waitUntil: 'networkidle', timeout: 120000 });
      assert.equal(response.status(), 200, route);
      assert.ok(new URL(page.url()).pathname === route.split('?')[0], `Unexpected redirect: ${page.url()}`);
    }
    await page.goto(url + '/pricing', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(output, 'pricing-page.png'), fullPage: true });
    // Walk the real setup screens without creating records or submitting signup.
    const setupContext = await browser.newContext();
    await setupContext.addInitScript(() => localStorage.setItem('codeline_lang', 'en'));
    const setupPage = await setupContext.newPage();
    await setupPage.goto(url + '/onboarding?plan=starter', { waitUntil: 'networkidle' });
    await setupPage.waitForFunction(() => document.documentElement.lang === 'en');
    for (const [index, value] of ['QA workspace', 'QA reviewer', 'review@example.test', 'ExamplePassword123!', 'ExamplePassword123!'].entries()) {
      await setupPage.locator('input').nth(index).fill(value);
    }
    await setupPage.getByRole('button', { name: 'Continue', exact: true }).click();
    await setupPage.getByRole('button', { name: 'Continue', exact: true }).click();
    const starter = setupPage.getByRole('button').filter({ hasText: 'Starter' });
    assert.ok((await starter.getAttribute('class')).includes('border-violet-500'), 'Selected plan lost in onboarding');
    await setupContext.close();
    // Exercise the actual language/theme controls and localStorage persistence.
    await page.goto(url, { waitUntil: 'networkidle' });
    const current = await page.locator('html').getAttribute('lang');
    await page.getByRole('button', { name: 'Switch Language', exact: true }).click();
    await page.waitForFunction(lang => document.documentElement.lang === lang, current === 'ar' ? 'en' : 'ar');
    assert.equal(await page.locator('html').getAttribute('lang'), current === 'ar' ? 'en' : 'ar');
    const before = await page.locator('html').getAttribute('class');
    await page.locator('header button').filter({ has: page.locator('svg.lucide-moon, svg.lucide-sun') }).click();
    assert.notEqual(await page.locator('html').getAttribute('class'), before);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(lang => document.documentElement.lang === lang, current === 'ar' ? 'en' : 'ar');
    assert.equal(await page.locator('html').getAttribute('lang'), current === 'ar' ? 'en' : 'ar');
    const sales = await page.locator('#pricing a[href^="mailto:"]').getAttribute('href');
    assert.ok(sales.startsWith('mailto:info@codeline.jo'));
    await context.close();
    // System dark mode must toggle to light on the first click.
    const systemContext = await browser.newContext({ colorScheme: 'dark' });
    await systemContext.addInitScript(() => localStorage.setItem('theme', 'system'));
    const systemPage = await systemContext.newPage();
    await systemPage.goto(url, { waitUntil: 'networkidle' });
    await systemPage.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await systemPage.locator('header button').filter({ has: systemPage.locator('svg.lucide-moon, svg.lucide-sun') }).click();
    await systemPage.waitForFunction(() => document.documentElement.classList.contains('light'));
    assert.ok(await systemPage.locator('html').evaluate(el => el.classList.contains('light')));
    await systemContext.close();
  } finally {
    await browser.close();
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  }
  assert.ok(results.every(result => !result.errors.length && !result.accessibility.length), 'Browser or accessibility findings; inspect results.json');
  console.log('All marketing checks passed. Artifacts:', output);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
