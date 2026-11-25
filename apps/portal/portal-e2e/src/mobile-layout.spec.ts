import { gotoStreamedPage, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

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
    window.scrollTo(0, 240);
    return {
      scrollHeight,
      innerHeight,
      scrollY: window.scrollY,
    };
  });
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.innerHeight);
  expect(scrollMetrics.scrollY).toBeGreaterThan(0);
}

test.describe('portal mobile native layout and scrolling', () => {
  test('renders portrait compact header, 44px+ bottom nav, /agensi menu access, and native scroll at 390x844 @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal navigation is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoStreamedPage(page, '/');

    // Home renders direct terminal without multi-pane TerminalWorkspace
    await expect(page.getByLabel('Terminal command input')).toBeVisible();
    await expect(page.locator('[data-pane-count]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-header="true"]')).toBeVisible();
    await expect(page.locator('[data-mobile-bottom-nav="true"]')).toBeVisible();
    await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    // Verify 5 primary bottom nav destinations and 44px+ touch targets
    const bottomNav = page.locator('[data-mobile-bottom-nav="true"]');
    for (const label of ['Terminal', 'Menu', 'Ask', 'CADENCE', 'Contact']) {
      const link = bottomNav.getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Navigate across primary routes, verifying aria-current, overflow, and native scroll
    const routeChecks: ReadonlyArray<{ path: string; label: string; expectScroll: boolean }> = [
      { path: '/menu', label: 'Menu', expectScroll: false },
      { path: '/ask', label: 'Ask', expectScroll: false },
      { path: '/cadence', label: 'CADENCE', expectScroll: true },
      { path: '/contact', label: 'Contact', expectScroll: true },
    ];

    for (const check of routeChecks) {
      await gotoStreamedPage(page, check.path);
      await expect(bottomNav.getByRole('link', { name: check.label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await assertNoHorizontalOverflow(page);
      if (check.expectScroll) {
        await assertNativeVerticalScroll(page);
      }
    }

    // Open compact header overflow menu and navigate to /agensi
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const agensiLink = page
      .locator('[data-mobile-secondary-menu="true"]')
      .getByRole('link', { name: 'Agensi', exact: true });
    await expect(agensiLink).toBeVisible();
    await agensiLink.click();
    await expect(page).toHaveURL(/\/agensi$/);
    await assertNoHorizontalOverflow(page);

    expect(getErrors()).toEqual([]);
  });

  test('renders collapsible left rail with >=85% workspace height and native scroll in 844x390 landscape @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal navigation is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 844, height: 390 });
    await gotoStreamedPage(page, '/cadence');

    const rail = page.locator('[data-mobile-rail="true"]');
    await expect(rail).toBeVisible();
    await expect(page.locator('[data-mobile-bottom-nav="true"]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-header="true"]')).toHaveCount(0);

    const collapsedBox = await rail.boundingBox();
    expect(collapsedBox?.width ?? 0).toBeGreaterThanOrEqual(52);
    expect(collapsedBox?.width ?? 0).toBeLessThanOrEqual(72);

    const mainHeightRatio = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('[data-mobile-main="landscape"]');
      return main ? main.getBoundingClientRect().height / window.innerHeight : 0;
    });
    expect(mainHeightRatio).toBeGreaterThanOrEqual(0.85);

    const railToggle = page.getByRole('button', { name: 'Expand navigation rail' });
    await expect(railToggle).toHaveAttribute('aria-expanded', 'false');
    await railToggle.click();
    await expect(rail).toHaveAttribute('data-expanded', 'true');

    const expandedBox = await rail.boundingBox();
    expect(expandedBox?.width ?? 0).toBeGreaterThan(collapsedBox?.width ?? 0);

    await assertNoHorizontalOverflow(page);
    await assertNativeVerticalScroll(page);

    await gotoStreamedPage(page, '/contact');
    await assertNoHorizontalOverflow(page);
    await assertNativeVerticalScroll(page);

    expect(getErrors()).toEqual([]);
  });

  test('preserves unmodified desktop workspace shell at 1280x800', async ({ page }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal workspace is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoStreamedPage(page, '/');

    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    await expect(page.locator('[data-mobile-bottom-nav="true"]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);

    expect(getErrors()).toEqual([]);
  });
});
