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
    await expect(page).toHaveTitle(/^Andrew Klapper Portfolio$/);

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

    // Footer includes Sitemap link
    const sitemapLink = page.locator('footer').getByRole('link', { name: 'Sitemap' });
    await expect(sitemapLink).toBeVisible();
    await expect(sitemapLink).toHaveAttribute('href', '/sitemap.xml');

    // Alt+T toggles TUI window open and closed
    await page.keyboard.press('Alt+t');
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Alt+t');
    await expect(tuiHeading).toHaveCount(0);

    // Ghostty Ctrl+Shift+O splits a new terminal pane which can open its own TUI, then exit closes it
    await page.keyboard.press('Control+Shift+O');
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    const splitPaneInput = page.getByLabel('Terminal command input', { exact: true });
    await splitPaneInput.fill('tui');
    await splitPaneInput.press('Enter');
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tuiHeading).toHaveCount(0);
    await splitPaneInput.fill('exit');
    await splitPaneInput.press('Enter');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();

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

    // Ghostty Ctrl+Shift+O opens a separate terminal pane directly alongside the CADENCE TUI
    await page.keyboard.press('Control+Shift+O');
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    await expect(frame).toBeVisible();
    const splitInput = page.getByLabel('Terminal command input', { exact: true });
    await splitInput.fill('whoami');
    await splitInput.press('Enter');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();
    await page.keyboard.press('Control+Shift+W');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();

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

  test('renders /contact recursive TUI form with client, server, and Postgres 19 validation', async ({
    page,
    request,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Contact route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    // Launch /contact TUI explicitly via `contact --tui`
    await page.goto('/');
    const commandInput = page.getByLabel('Terminal command input');
    await commandInput.fill('contact --tui');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/contact$/);

    // Recursive nested fieldsets rendered from Postgres JSON schema
    await expect(page.locator('fieldset')).toHaveCount(3);
    await expect(page.getByText(/01 \/\/ Sender Identity/i)).toBeVisible();
    await expect(page.getByText(/01\.1 \/\/ Optional Callback Channel/i)).toBeVisible();
    await expect(page.getByText(/02 \/\/ Message & Attachment/i)).toBeVisible();

    // Client-side custom validation blocks empty submission
    await page.getByRole('button', { name: /Transmit Message/i }).click();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Message is required')).toBeVisible();

    // Fill required fields + optional phone + optional file attachment
    await page.getByLabel(/Name/i).fill('Grace Hopper');
    await page.getByLabel(/Email/i).fill('grace.hopper@example.com');
    await page.getByLabel(/Phone/i).fill('+1 (555) 867-5309');
    await page
      .getByLabel(/^Message\b/i)
      .fill('Testing end-to-end recursive TUI contact form persistence in Postgres 19.');
    await page.getByLabel(/File/i).setInputFiles({
      name: 'compiler-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('FLOW-MATIC specification notes'),
    });
    await expect(page.getByText(/▸ compiler-notes\.txt/i)).toBeVisible();

    // Submit and verify Postgres 19 transmission receipt
    await page.getByRole('button', { name: /Transmit Message/i }).click();
    const receipt = page.getByTestId('contact-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt.getByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/i)).toBeVisible();
    await expect(receipt.getByText(/Grace Hopper <grace\.hopper@example\.com>/i)).toBeVisible();
    await expect(receipt.getByText(/compiler-notes\.txt/i)).toBeVisible();

    // Server-side validation rejects invalid direct multipart POST bypassing client JS
    const badServerResponse = await request.post('/contact', {
      multipart: {
        name: 'A',
        email: 'not-an-email',
        phone: 'bad-phone',
        message: 'short',
      },
    });
    expect(badServerResponse.status()).toBe(400);

    expect(getErrors()).toEqual([]);
  });

  test('runs contact form inline in terminal mode without jumping to TUI and persists to Postgres 19', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Contact route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    const terminalSection = page.locator('section[aria-label="Interactive Terminal tty1"]');
    const promptInput = page.getByLabel('Terminal command input', { exact: true });

    // Bare `contact` stays on `/` in terminal mode — never navigates to /contact or opens TUI
    await promptInput.fill('contact');
    await promptInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(terminalSection).toHaveAttribute('data-form-mode', 'contact');
    await expect(page.getByRole('heading', { name: /Solar Forge Agentic Terminal/i })).toHaveCount(
      0,
    );
    await expect(page.getByText(/┌─ 01 \/\/ Sender Identity/)).toBeVisible();

    // Walk Name -> Email -> Phone (skip) -> Message (Shift+Enter + Escape guard) -> File (skip) -> Review -> Send
    await promptInput.fill('Ada Lovelace');
    await promptInput.press('Enter');
    await promptInput.fill('ada.terminal@example.com');
    await promptInput.press('Enter');
    await expect(page.getByText(/├─ 01\.1 \/\/ Optional Callback Channel/)).toBeVisible();
    await promptInput.press('Enter');

    await expect(page.getByText(/┌─ 02 \/\/ Message & Attachment/)).toBeVisible();
    const messageBox = page.locator('textarea[aria-label="Terminal command input"]');
    await expect(messageBox).toBeVisible();
    await messageBox.fill('Line one from terminal mode');
    await messageBox.press('Shift+Enter');
    await messageBox.pressSequentially('Line two persisted to Postgres 19.');
    // Escape must be ignored so drafted message is never discarded
    await messageBox.press('Escape');
    await expect(messageBox).toHaveValue(
      'Line one from terminal mode\nLine two persisted to Postgres 19.',
    );
    await messageBox.press('Enter');

    // File step: press Enter to skip
    await expect(page.getByRole('button', { name: '[attach file]' })).toBeVisible();
    await promptInput.press('Enter');

    // Review summary & confirm send
    await expect(
      page.getByText(/┌─ Review Transmission \/\/ Ready for PostgreSQL 19/),
    ).toBeVisible();
    await promptInput.fill('y');
    await promptInput.press('Enter');

    // Stays on `/` and prints Postgres 19 receipt in scrollback, returning to normal shell
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19 \(201 Created\)/),
    ).toBeVisible();
    await expect(page.getByText(/Ada Lovelace <ada\.terminal@example\.com>/)).toBeVisible();
    await expect(terminalSection).not.toHaveAttribute('data-form-mode', 'contact');

    // Normal shell commands immediately work again, plus one-shot CLI flags
    await promptInput.fill(
      'contact --name "Alan Turing" --email "alan.cli@example.com" --message "One-shot terminal CLI submission to Postgres 19."',
    );
    await promptInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Alan Turing <alan\.cli@example\.com>/)).toBeVisible();

    expect(getErrors()).toEqual([]);
  });
});
