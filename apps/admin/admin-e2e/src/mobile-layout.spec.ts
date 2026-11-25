import { randomUUID } from 'node:crypto';

import {
  gotoStreamedPage,
  trackPageErrors,
  waitForStreamedReveal,
} from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

import {
  buildIsolatedTestIp,
  cleanupIsolatedAuthState,
  HAS_DATABASE_URL,
  seedIsolatedAdmin,
  sha256Hex,
} from './admin-helpers.js';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertNativeVerticalScroll(page: import('@playwright/test').Page): Promise<void> {
  const scrollMetrics = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const scrollHeight = document.documentElement.scrollHeight;
    const innerHeight = window.innerHeight;
    window.scrollTo(0, 220);
    return {
      scrollHeight,
      innerHeight,
      scrollY: window.scrollY,
    };
  });
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.innerHeight);
  expect(scrollMetrics.scrollY).toBeGreaterThan(0);
}

test.describe('admin mobile TUI workspace and adaptive layout', () => {
  test('keeps unauthenticated /login standalone without mobile TUI dock at 390x844 @smoke', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoStreamedPage(page, '/login', { waitUntil: 'networkidle' });

    await expect(page.locator('html')).toHaveAttribute('data-viewport', 'mobile-portrait');
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    await expect(page.locator('[data-mobile-tui-dock="true"]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    expect(getErrors()).toEqual([]);
  });

  test('renders portrait TUI dock, stacked CMS tabs, landscape rail, and desktop parity for authenticated admin', async ({
    page,
  }, testInfo) => {
    test.skip(!HAS_DATABASE_URL, 'Requires DATABASE_URL for isolated admin credential seeding');

    const getErrors = trackPageErrors(page);
    const projectName = testInfo.project.name;
    const handle = `e2e-mob-${projectName}-${Date.now()}-${randomUUID().slice(0, 6)}`.toLowerCase();
    const password = `E2eMobPass-${randomUUID()}`;
    const testIp = buildIsolatedTestIp(projectName, 7 + (testInfo.retry % 3));
    const rateKeys = [
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
    ];

    await seedIsolatedAdmin(handle, password);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoStreamedPage(page, '/login', { waitUntil: 'networkidle' });

      await page.getByLabel('Admin Handle', { exact: true }).fill(handle);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in with Password' }).click();

      await expect(page.getByRole('button', { name: 'Continue to Console' })).toBeVisible();
      await page.getByRole('button', { name: 'Continue to Console' }).click();
      await expect(page).toHaveURL(/\/$/);
      await waitForStreamedReveal(page);

      // Portrait bottom TUI dock & 44px+ targets
      await expect(page.locator('html')).toHaveAttribute('data-viewport', 'mobile-portrait');
      const bottomDock = page.locator('[data-mobile-tui-dock="true"]');
      await expect(bottomDock).toBeVisible();
      await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);
      for (const label of ['Home', 'CMS', 'Inbox', 'Ops', 'Stats']) {
        const link = bottomDock.getByRole('link', { name: label, exact: true });
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      // Check all authenticated Admin routes in portrait with zero horizontal overflow
      for (const route of [
        { path: '/cms', label: 'CMS', expectScroll: true },
        { path: '/inbox', label: 'Inbox', expectScroll: false },
        { path: '/ops', label: 'Ops', expectScroll: true },
        { path: '/analytics', label: 'Stats', expectScroll: false },
      ]) {
        await gotoStreamedPage(page, route.path);
        await waitForStreamedReveal(page);
        await expect(
          bottomDock.getByRole('link', { name: route.label, exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await assertNoHorizontalOverflow(page);
        if (route.expectScroll) {
          await assertNativeVerticalScroll(page);
        }
      }

      // Portrait overflow sheet exposes Quotas and Sign Out
      await page.getByRole('button', { name: 'Open workspace menu' }).click();
      const overflowSheet = page.locator('[data-mobile-overflow-sheet="true"]');
      await expect(overflowSheet).toBeVisible();
      await expect(overflowSheet.getByRole('link', { name: 'Quotas', exact: true })).toBeVisible();
      await expect(
        overflowSheet.getByRole('button', { name: 'Sign Out', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Close workspace menu' }).click();

      // Landscape 844x390 switches to collapsible left rail with Quotas & Sign Out in rail footer
      await page.setViewportSize({ width: 844, height: 390 });
      await gotoStreamedPage(page, '/ops');
      await waitForStreamedReveal(page);

      await expect(page.locator('html')).toHaveAttribute('data-viewport', 'mobile-landscape');
      const rail = page.locator('[data-mobile-rail="true"]');
      await expect(rail).toBeVisible();
      await expect(page.locator('[data-mobile-tui-dock="true"]')).toHaveCount(0);

      const collapsedBox = await rail.boundingBox();
      expect(collapsedBox?.width ?? 0).toBeGreaterThanOrEqual(52);
      expect(collapsedBox?.width ?? 0).toBeLessThanOrEqual(72);

      await page.getByRole('button', { name: 'Expand navigation rail' }).click();
      await expect(rail).toHaveAttribute('data-expanded', 'true');
      const railFooter = page.locator('[data-mobile-rail-footer="true"]');
      await expect(railFooter.getByRole('link', { name: 'Quotas', exact: true })).toBeVisible();
      await expect(railFooter.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertNativeVerticalScroll(page);

      // Desktop 1280x800 restores unmodified desktop admin shell
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoStreamedPage(page, '/');
      await waitForStreamedReveal(page);
      await expect(page.locator('html')).toHaveAttribute('data-viewport', 'desktop');
      await expect(page.locator('[data-mobile-tui-dock="true"]')).toHaveCount(0);
      await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();

      // Sign out from portrait mobile overflow sheet via POST /api/auth/logout
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Open workspace menu' }).click();
      await page
        .locator('[data-mobile-overflow-sheet="true"]')
        .getByRole('button', { name: 'Sign Out', exact: true })
        .click();
      await page.waitForURL(/\/login$/, { waitUntil: 'networkidle' });

      expect(getErrors()).toEqual([]);
    } finally {
      await cleanupIsolatedAuthState([handle], rateKeys);
    }
  });
});
