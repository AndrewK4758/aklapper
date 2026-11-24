import { assertSsrHealthz, trackPageErrors } from '@aklapper/shared-utils/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

test.describe('portal SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'portal-ssr');
  });

  test('renders terminal-only greeter, opens tui and menu via commands and keybindings, and hides admin items', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full greeter and menu routes are gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/andrew-k\.us \/\/ Solar Forge Terminal/i);

    const commandInput = page.getByLabel('Terminal command input');
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toBeFocused();

    // TUI launcher window is hidden on initial entry — terminal is the only main item
    const tuiHeading = page.getByRole('heading', { name: /Solar Forge Agentic Terminal/i });
    await expect(tuiHeading).toHaveCount(0);

    // Zero zsh or p10k references in rendered portal content
    const initialBodyText = await page.locator('body').innerText();
    expect(initialBodyText).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);

    // Tab autocomplete + command execution + unknown command message without zsh prefix
    await commandInput.fill('who');
    await commandInput.press('Tab');
    await expect(commandInput).toHaveValue('whoami');
    await commandInput.press('Enter');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    // Up-arrow history recall & Ctrl+C cancel
    await commandInput.press('ArrowUp');
    await expect(commandInput).toHaveValue('whoami');
    await commandInput.press('Control+c');
    await expect(commandInput).toHaveValue('');
    await expect(page.getByText('whoami^C')).toBeVisible();

    // Unknown command
    await commandInput.fill('invalid-cmd');
    await commandInput.press('Enter');
    await expect(page.getByText(/command not found: invalid-cmd/i)).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);

    // Ctrl+L clears scrollback
    await commandInput.press('Control+l');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toHaveCount(0);

    // `tui` command opens the TUI launcher window, and Escape closes it
    await commandInput.fill('tui');
    await commandInput.press('Enter');
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tuiHeading).toHaveCount(0);

    // Alt+T toggles TUI window open and closed
    await page.keyboard.press('Alt+t');
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Alt+t');
    await expect(tuiHeading).toHaveCount(0);

    // `menu` command navigates to /menu
    await commandInput.fill('menu');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole('heading', { name: /Launch Menu/i })).toBeVisible();
    await expect(page.getByText(/CADENCE Builder/i)).toBeVisible();
    await expect(page.getByText(/cadence-admin/i)).toHaveCount(0);

    // Keybinding `1` on /menu launches /cadence, and Escape returns to /
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/cadence$/);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);

    expect(getErrors()).toEqual([]);
  });

  test('navigates to /cadence and renders sandboxed artifact preview iframe', async ({ page }) => {
    test.skip(IS_MAINTENANCE_MODE, 'CADENCE builder route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.goto('/cadence');
    await expect(page.getByText(/CADENCE Builder \/\/ portfolio-public/i)).toBeVisible();
    await expect(page.getByText(/0\/1 replicas/i)).toBeVisible();

    const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', /.+/);

    expect(getErrors()).toEqual([]);
  });

  test('renders standalone /changes-in-progress maintenance shell without main nav', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.goto('/changes-in-progress');
    await expect(page.getByRole('heading', { name: /Changes in Progress/i })).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);

    const commandInput = page.getByLabel('Terminal command input');
    await commandInput.fill('stack');
    await commandInput.press('Enter');
    await expect(page.getByText(/Cloud Run \(edge SSR\)/i)).toBeVisible();

    expect(getErrors()).toEqual([]);
  });
});
