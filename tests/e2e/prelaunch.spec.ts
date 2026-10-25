import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';

async function useEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('codeline_lang', 'en'));
}

async function expectNoCriticalAccessibilityFindings(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test.describe.configure({ mode: 'serial' });

test('public critical routes render and pass automated accessibility checks', async ({ page }) => {
  await useEnglish(page);
  for (const route of ['/', '/pricing', '/login', '/forgot-password', '/onboarding?plan=growth', '/legal/privacy']) {
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('body')).toBeVisible();
    await expectNoCriticalAccessibilityFindings(page);
  }
});

test('pricing interval, direction, and representative responsive widths work', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/pricing', { waitUntil: 'networkidle' });
  const monthly = page.getByRole('button', { name: 'Monthly', exact: true });
  const annual = page.getByRole('button', { name: 'Annual', exact: true });
  await expect(monthly).toHaveAttribute('aria-pressed', 'true');
  const monthlyPrices = await page.locator('[class*="planPrice"] strong').allTextContents();
  await annual.click();
  await expect(annual).toHaveAttribute('aria-pressed', 'true');
  await expect(monthly).toHaveAttribute('aria-pressed', 'false');
  const annualPrices = await page.locator('[class*="planPrice"] strong').allTextContents();
  expect(annualPrices).not.toEqual(monthlyPrices);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`).toBe(true);
  }

  await page.getByRole('button', { name: 'Switch Language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expectNoCriticalAccessibilityFindings(page);
});

test('login validation, keyboard focus, and password recovery are usable', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  let reachedLoginControl = false;
  for (let index = 0; index < 12; index += 1) {
    reachedLoginControl ||= await page.locator('#login-email').evaluate(element => element === document.activeElement);
    if (reachedLoginControl) break;
    await page.keyboard.press('Tab');
  }
  expect(reachedLoginControl).toBe(true);
  const email = page.locator('#login-email');
  await expect(email).toBeFocused();
  expect(await email.evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
  })).toBe(true);
  await email.fill('missing-browser-test@example.test');
  await page.locator('#login-password').fill('DefinitelyWrong123!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto('/forgot-password', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('unknown-browser-test@example.test');
  await page.getByRole('button', { name: 'Send Password Reset Link' }).click();
  await expect(page.getByText(/If an account exists/i)).toBeVisible();
  await expectNoCriticalAccessibilityFindings(page);
});

test('registration, onboarding, authenticated CRM routes, logout, and expiry restriction work', async ({ page }) => {
  await useEnglish(page);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userEmail = `browser-${suffix}@example.test`;
  const password = 'BrowserOnlyPassword123!';
  await page.goto('/onboarding?plan=starter', { waitUntil: 'networkidle' });
  await page.getByLabel('Your name').fill('Browser Acceptance User');
  await page.getByLabel('Email address').fill(userEmail);
  await page.getByLabel('Password (at least 8 characters)').fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Company or team name')).toBeVisible();
  const cookieNames = (await page.context().cookies()).map(cookie => cookie.name);
  expect(cookieNames).toContain('codeline_session');
  await expect(page.getByLabel('Company or team name')).toHaveValue('My workspace');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip and use recommended defaults' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Skip and use recommended defaults' }).click();
  await page.getByRole('button', { name: 'Accept setup' }).click();
  await page.getByRole('button', { name: 'Create my workspace' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
  await expect(page.locator('main')).toBeVisible();
  await expectNoCriticalAccessibilityFindings(page);

  for (const route of ['/clients', '/deals', '/tasks']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    expect(new URL(page.url()).pathname, route).toBe(route);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  }

  const profile = page.getByRole('button', { name: 'Profile' });
  await profile.click();
  await page.getByRole('button', { name: 'Logout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Logout' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('button').first()).toBeFocused();
  await dialog.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/login/);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
      include: { organizationMemberships: true },
    });
    const organizationId = user.organizationMemberships[0]?.organizationId;
    expect(organizationId).toBeTruthy();
    const expiredAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const trialStartedAt = new Date(expiredAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.platformSubscription.update({
      where: { organizationId },
      data: { status: 'EXPIRED', startsAt: trialStartedAt, trialStartedAt, endsAt: expiredAt, trialEndsAt: expiredAt },
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.locator('#login-email').fill(userEmail);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/trial-expired/, { timeout: 30_000 });
  await expect(page.locator('body')).toContainText(/trial|subscription/i);
});
