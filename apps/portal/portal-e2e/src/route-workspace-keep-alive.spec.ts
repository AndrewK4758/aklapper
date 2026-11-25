import {
  gotoStreamedPage,
  reloadStreamedPage,
  trackPageErrors,
} from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

test.describe('portal global desktop workspace persistence and header launcher', () => {
  test('persists global tabs, custom titles, and secondary panes across SPA route transitions and hard reload', async ({
    page,
  }, testInfo) => {
    test.skip(IS_MAINTENANCE_MODE, 'Global desktop workspace is bypassed in maintenance mode');
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop global workspace journey; handheld journeys are covered in mobile-layout.spec.ts',
    );

    const getErrors = trackPageErrors(page);
    const hydrationWarnings: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (/hydrat/i.test(text) && (msg.type() === 'error' || msg.type() === 'warning')) {
        hydrationWarnings.push(text);
      }
    });

    await gotoStreamedPage(page, '/');

    const workspace = page.locator('[data-pane-count]');
    await expect(workspace).toBeVisible();
    await expect(page.locator('[data-route-workspace]')).toHaveCount(0);

    // Run commands in primary terminal ("pane-1") so command history persists across reload
    const pane1 = page.locator('[data-pane-id="pane-1"]');
    const commandInput = pane1.getByLabel('Terminal command input', { exact: true });
    await expect(commandInput).toBeVisible();
    await commandInput.fill('whoami');
    await commandInput.press('Enter');
    await expect(pane1.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    await commandInput.fill('ls');
    await commandInput.press('Enter');

    // Create Tab 2 and rename it to "ops"
    await page.keyboard.press('Alt+Shift+N');
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await page.keyboard.press('F2');
    const renameInput = page.getByLabel('Rename tab');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('ops');
    await renameInput.press('Enter');
    await expect(page.getByRole('tab', { name: /ops/i })).toBeVisible();

    // Return to pinned host Tab 1 and launch /chat in a split via the header Open Pane menu
    await page.getByRole('tab', { name: /tty1/i }).click();
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');

    const openPaneButton = page.getByRole('button', { name: 'Open Pane' });
    await openPaneButton.click();
    await page.getByRole('menuitem', { name: 'Chat (Split)' }).click();

    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    // Tab 2 ("ops") allocated pane-2, so splitting Tab 1 creates pane-3 (tty3)
    const chatSplitPane = page.locator('[data-pane-id="pane-3"]');
    await expect(chatSplitPane.getByTestId('ask-question-input')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // Switch via SPA header email link to /contact: zero hidden layers, Tab 2 "ops" & /chat split survive
    await page.locator('header a[href="/contact"]').click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.locator('[data-route-workspace]')).toHaveCount(0);
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    await expect(page.getByRole('tab', { name: /ops/i })).toBeVisible();
    await expect(pane1.locator('textarea').first()).toBeVisible();
    await expect(chatSplitPane.getByTestId('ask-question-input')).toBeVisible();

    // Opening header Open Pane menu and pressing Escape dismisses menu without exiting /contact
    await openPaneButton.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page).toHaveURL(/\/contact$/);

    // Launch /agensi in a new tab from /contact (URL stays /contact, active tab becomes tab-3)
    await openPaneButton.click();
    await page.getByRole('menuitem', { name: 'Agensi (Tab)' }).click();
    await expect(workspace).toHaveAttribute('data-tab-count', '3');
    await expect(page).toHaveURL(/\/contact$/);

    // Clicking brand link to "/" from secondary Tab 3 auto-activates pinned primary host Tab 1
    await page.locator('header a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await expect(workspace).toHaveAttribute('data-tab-count', '3');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');

    // Verify global v1:global storage key and absence of legacy per-route keys
    const storageKeys = await page.evaluate(() => Object.keys(window.sessionStorage));
    expect(storageKeys).toContain('aklapper.portal.workspace.v1:global');
    expect(
      storageKeys.some(
        key =>
          key.startsWith('aklapper.portal.workspace.v1:') &&
          key !== 'aklapper.portal.workspace.v1:global',
      ),
    ).toBe(false);

    // Hard browser reload restores tabs, custom title, secondary /chat split, and command history cleanly
    await reloadStreamedPage(page);
    await expect(page.locator('[data-route-workspace]')).toHaveCount(0);
    await expect(workspace).toHaveAttribute('data-tab-count', '3');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    await expect(page.getByRole('tab', { name: /ops/i })).toBeVisible();
    await expect(
      page.locator('[data-pane-id="pane-3"]').getByTestId('ask-question-input'),
    ).toBeVisible();

    const reloadedPane1 = page.locator('[data-pane-id="pane-1"]');
    await reloadedPane1.click();
    const reloadedInput = reloadedPane1.getByLabel('Terminal command input', { exact: true });
    await expect(reloadedInput).toBeVisible();
    await reloadedInput.press('ArrowUp');
    await expect(reloadedInput).toHaveValue('ls');
    await reloadedInput.press('ArrowUp');
    await expect(reloadedInput).toHaveValue('whoami');

    expect(hydrationWarnings).toEqual([]);
    expect(getErrors()).toEqual([]);
  });
});
