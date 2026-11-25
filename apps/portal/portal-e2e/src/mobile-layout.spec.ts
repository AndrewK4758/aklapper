import { gotoStreamedPage, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const innerScrollOffenders = Array.from(
      document.querySelectorAll('[class*="scrollViewport"], [class*="bodyViewport"]'),
    )
      .filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map(el => ({
        className: typeof el.className === 'string' ? el.className : '',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerScrollOffenders,
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.innerScrollOffenders).toEqual([]);
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

test.describe('portal mobile TUI workspace and adaptive layout', () => {
  test('renders portrait TUI status header, 44px+ bottom dock, bottom sheets, terminal accessory bar, and overflow-free routes at 390x844 @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal navigation is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoStreamedPage(page, '/');

    await expect(page.locator('html')).toHaveAttribute('data-viewport', 'mobile-portrait');
    const terminalInput = page.getByLabel('Terminal command input');
    await expect(terminalInput).toBeVisible();
    await expect(page.locator('[data-pane-count]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-tui-header="true"]')).toBeVisible();
    const bottomDock = page.locator('[data-mobile-tui-dock="true"]');
    await expect(bottomDock).toBeVisible();
    await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    // Verify 16px+ input font floor on mobile terminal input
    const inputFontSize = await terminalInput.evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );
    expect(inputFontSize).toBeGreaterThanOrEqual(16);

    // Focus terminal input -> reveals touch accessory bar and suppresses portrait bottom dock
    await terminalInput.focus();
    await expect(page.locator('[data-terminal-accessory-bar="true"]')).toBeVisible();
    await expect(bottomDock).toHaveCount(0);
    await terminalInput.blur();
    await expect(bottomDock).toBeVisible();

    // Verify primary bottom dock destinations and 44px+ touch targets
    for (const label of ['TUI', 'Menu', 'Ask', 'CAD', 'Mail']) {
      const link = bottomDock.getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Open Quick Launch bottom sheet and verify mobile sheet presentation
    await page.getByRole('button', { name: 'Open TUI Quick Launch' }).click();
    const quickLaunchSheet = page.locator('[data-mobile-quick-launch-sheet="true"]');
    await expect(quickLaunchSheet).toBeVisible();
    await expect(quickLaunchSheet).toHaveAttribute('data-mobile-sheet', 'true');
    await page.getByRole('button', { name: 'Close TUI quick launch' }).click();

    // Navigate across primary routes, verifying aria-current, overflow, and native scroll
    const routeChecks: ReadonlyArray<{ path: string; label: string; expectScroll: boolean }> = [
      { path: '/menu', label: 'Menu', expectScroll: false },
      { path: '/ask', label: 'Ask', expectScroll: false },
      { path: '/cadence', label: 'CAD', expectScroll: true },
      { path: '/contact', label: 'Mail', expectScroll: true },
    ];

    for (const check of routeChecks) {
      await gotoStreamedPage(page, check.path);
      await expect(
        bottomDock.getByRole('link', { name: check.label, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await assertNoHorizontalOverflow(page);
      if (check.expectScroll) {
        await assertNativeVerticalScroll(page);
      }
    }

    // Open overflow bottom sheet and navigate to /agensi
    await page.getByRole('button', { name: 'Open workspace menu' }).click();
    const overflowSheet = page.locator('[data-mobile-overflow-sheet="true"]');
    await expect(overflowSheet).toBeVisible();
    const agensiLink = overflowSheet.getByRole('link', { name: 'Agensi', exact: true });
    await expect(agensiLink).toBeVisible();
    await agensiLink.click();
    await expect(page).toHaveURL(/\/agensi$/);
    await assertNoHorizontalOverflow(page);

    // Verify /changes-in-progress renders overflow-free on mobile portrait
    await gotoStreamedPage(page, '/changes-in-progress');
    await assertNoHorizontalOverflow(page);

    expect(getErrors()).toEqual([]);
  });

  test('renders collapsible left rail and overflow-free routes in 844x390 landscape @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal navigation is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 844, height: 390 });
    await gotoStreamedPage(page, '/cadence');

    await expect(page.locator('html')).toHaveAttribute('data-viewport', 'mobile-landscape');
    const rail = page.locator('[data-mobile-rail="true"]');
    await expect(rail).toBeVisible();
    await expect(page.locator('[data-mobile-tui-dock="true"]')).toHaveCount(0);

    const collapsedBox = await rail.boundingBox();
    expect(collapsedBox?.width ?? 0).toBeGreaterThanOrEqual(52);
    expect(collapsedBox?.width ?? 0).toBeLessThanOrEqual(72);

    const railToggle = page.getByRole('button', { name: 'Expand navigation rail' });
    await expect(railToggle).toHaveAttribute('aria-expanded', 'false');
    await railToggle.click();
    await expect(rail).toHaveAttribute('data-expanded', 'true');

    const expandedBox = await rail.boundingBox();
    expect(expandedBox?.width ?? 0).toBeGreaterThan(collapsedBox?.width ?? 0);

    await assertNoHorizontalOverflow(page);
    await assertNativeVerticalScroll(page);

    for (const path of ['/contact', '/changes-in-progress']) {
      await gotoStreamedPage(page, path);
      await assertNoHorizontalOverflow(page);
    }

    expect(getErrors()).toEqual([]);
  });

  test('preserves unmodified desktop workspace shell at 1280x800', async ({ page }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full portal workspace is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoStreamedPage(page, '/');

    await expect(page.locator('html')).toHaveAttribute('data-viewport', 'desktop');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    await expect(page.locator('[data-mobile-tui-dock="true"]')).toHaveCount(0);
    await expect(page.locator('[data-mobile-rail="true"]')).toHaveCount(0);

    expect(getErrors()).toEqual([]);
  });
});
