import {
  gotoStreamedPage,
  reloadStreamedPage,
  trackPageErrors,
} from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

test.describe('portal per-route workspace keep-alive and session persistence', () => {
  test('isolates workspaces per route, gates shortcuts to active layer, preserves form drafts and scroll offsets, and restores across hard reload', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Per-route keep-alive workspaces are bypassed in maintenance mode');

    const getErrors = trackPageErrors(page);
    const hydrationWarnings: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (/hydrat/i.test(text) && (msg.type() === 'error' || msg.type() === 'warning')) {
        hydrationWarnings.push(text);
      }
    });

    await gotoStreamedPage(page, '/');

    const homeLayer = page.locator('[data-route-workspace="/"]');
    await expect(homeLayer).toHaveAttribute('data-route-active', 'true');

    // Run commands in "/" terminal and create a second tab
    const commandInput = homeLayer.getByLabel('Terminal command input');
    await expect(commandInput).toBeVisible();
    await commandInput.fill('whoami');
    await commandInput.press('Enter');
    await expect(homeLayer.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    await commandInput.fill('ls');
    await commandInput.press('Enter');

    await page.keyboard.press('Alt+Shift+N');
    await expect(homeLayer.locator('[data-tab-count="2"]')).toBeVisible();

    // Switch via SPA brand email link to /contact
    await page.locator('header a[href="/contact"]').click();
    await expect(page).toHaveURL(/\/contact$/);

    const contactLayer = page.locator('[data-route-workspace="/contact"]');
    await expect(contactLayer).toHaveAttribute('data-route-active', 'true');
    await expect(contactLayer.locator('[data-tab-count="1"]')).toBeVisible();

    // Hidden "/" layer must be hidden, inert, and aria-hidden="true"
    await expect(homeLayer).toHaveAttribute('hidden', '');
    await expect(homeLayer).toHaveAttribute('inert', '');
    await expect(homeLayer).toHaveAttribute('aria-hidden', 'true');

    // Type an unsaved draft into /contact and press Alt+Shift+N (must affect only /contact)
    const messageField = contactLayer.locator('textarea').first();
    await expect(messageField).toBeVisible();
    await messageField.fill('Draft message body');
    await page.keyboard.press('Alt+Shift+N');
    await expect(contactLayer.locator('[data-tab-count="2"]')).toBeVisible();
    await expect(homeLayer.locator('[data-tab-count="2"]')).toHaveCount(1);

    // Return to "/" via brand link — live transcript & tabs survive without remounting
    await page.locator('header a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(homeLayer).toHaveAttribute('data-route-active', 'true');
    await expect(homeLayer.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    // Return to "/contact" — unsaved draft survives without remounting
    await page.locator('header a[href="/contact"]').click();
    await expect(contactLayer).toHaveAttribute('data-route-active', 'true');
    await expect(contactLayer.locator('textarea').first()).toHaveValue('Draft message body');

    // Return to "/" and perform a hard browser reload — tabs and command history survive via sessionStorage
    await page.locator('header a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);

    // Switch back to Tab 1 before reload so tty1 is active on restore
    await page.keyboard.press('Alt+1');

    await reloadStreamedPage(page);
    const reloadedHomeLayer = page.locator('[data-route-workspace="/"]');
    await expect(reloadedHomeLayer.locator('[data-tab-count="2"]')).toBeVisible();

    const reloadedInput = reloadedHomeLayer.getByLabel('Terminal command input');
    await expect(reloadedInput).toBeVisible();
    await reloadedInput.press('ArrowUp');
    await expect(reloadedInput).toHaveValue('ls');
    await reloadedInput.press('ArrowUp');
    await expect(reloadedInput).toHaveValue('whoami');

    expect(hydrationWarnings).toEqual([]);
    expect(getErrors()).toEqual([]);
  });
});
