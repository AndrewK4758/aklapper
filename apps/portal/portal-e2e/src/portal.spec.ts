import { assertSsrHealthz, gotoStreamedPage, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

test.describe('portal SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint @smoke', async ({ request }) => {
    await assertSsrHealthz(request, 'portal-ssr');
  });

  test('renders terminal-only greeter, opens tui and menu via commands and keybindings, and hides admin items @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full greeter and menu routes are gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');
    await expect(page).toHaveTitle(/^Andrew Klapper Portfolio$/);

    const commandInput = page.getByLabel('Terminal command input');
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toBeFocused();

    // TUI launcher window is hidden on initial entry — terminal is the only main item
    const tuiHeading = page.getByRole('heading', { name: /Andrew Klapper — Portfolio/i });
    await expect(tuiHeading).toHaveCount(0);

    // Zero zsh or p10k references in rendered portal content
    const initialBodyText = await page.locator('body').innerText();
    expect(initialBodyText).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);

    // Clean DB-driven `ls` directory listing without Unix permission columns or trailing `/`
    expect(initialBodyText).not.toMatch(/drwxr-xr-x|-rw-r--r--|menu\//);
    await expect(page.getByText(/menu\s+# Site menu/)).toBeVisible();
    await expect(page.getByText(/tui\s+# TUI version/)).toBeVisible();
    await expect(page.getByText(/cadence\s+# Agentic workflow example/)).toBeVisible();
    await expect(page.getByText(/ask\s+# Ask about my work/)).toBeVisible();
    await expect(page.getByText(/agensi\s+# Published AI skills/)).toBeVisible();
    await expect(page.getByText(/contact\s+# Connect with me/)).toBeVisible();
    await expect(page.getByText(/changes-in-progress\s+# Maintenance preview/)).toBeVisible();

    // Typing `ls` produces the same clean DB-driven listing
    await commandInput.fill('ls');
    await commandInput.press('Enter');
    await expect(page.getByText(/contact\s+# Connect with me/)).toHaveCount(2);

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

    // `tui` command takes over the current pane in-place without splitting, and Escape returns to shell
    await commandInput.fill('whoami');
    await commandInput.press('Enter');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    await commandInput.fill('tui');
    await commandInput.press('Enter');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    await expect(page.locator('[data-pane-kind="tui"]')).toBeVisible();
    await expect(page.locator('section[data-docked="true"][data-floating="false"]')).toBeVisible();
    await expect(page.locator('[data-resize-handle="true"]')).toHaveCount(0);
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tuiHeading).toHaveCount(0);
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    // Footer includes Sitemap link
    const sitemapLink = page.locator('footer').getByRole('link', { name: 'Sitemap' });
    await expect(sitemapLink).toBeVisible();
    await expect(sitemapLink).toHaveAttribute('href', '/sitemap.xml');

    // Alt+T toggles the TUI launcher in-place on the active pane
    await page.keyboard.press('Alt+t');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    await expect(page.locator('[data-pane-kind="tui"]')).toBeVisible();
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Alt+t');
    await expect(tuiHeading).toHaveCount(0);
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();

    // Ctrl+Shift+O splits a new terminal pane; `tui` takes over tty2 in-place, Escape returns tty2 to shell, exit closes tty2
    await page.keyboard.press('Control+Shift+O');
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    const splitPaneInput = page.getByLabel('Terminal command input', { exact: true });
    await splitPaneInput.fill('tui');
    await splitPaneInput.press('Enter');
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    await expect(tuiHeading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tuiHeading).toHaveCount(0);
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    await splitPaneInput.fill('exit');
    await splitPaneInput.press('Enter');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();

    // `menu` command opens /menu in-place while keeping URL at /
    await commandInput.fill('menu');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Module Menu/i })).toBeVisible();
    await expect(page.getByText(/CADENCE Builder/i)).toBeVisible();
    await expect(page.getByText(/cadence-admin/i)).toHaveCount(0);

    // Keybinding `1` on /menu pushes /cadence in-place, Escape pops back to /menu, q exits straight to shell
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/CADENCE Builder — Artifact Sandbox/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Module Menu/i })).toBeVisible();
    await page.keyboard.press('q');
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '0');

    expect(getErrors()).toEqual([]);
  });

  test('navigates to /cadence and renders sandboxed artifact preview iframe @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'CADENCE builder route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/cadence');
    await expect(page.getByText(/CADENCE Builder — Artifact Sandbox/i)).toBeVisible();
    await expect(page.getByText(/On-demand/i)).toBeVisible();

    const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', /.+/);

    // Ctrl+Shift+O opens a separate terminal pane directly alongside the CADENCE TUI
    await page.keyboard.press('Control+Shift+O');
    await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
    await expect(frame).toBeVisible();
    const splitInput = page.getByLabel('Terminal command input', { exact: true });
    await splitInput.fill('whoami');
    await splitInput.press('Enter');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();
    await page.keyboard.press('Alt+Shift+KeyW');
    await expect(page.locator('[data-pane-count="1"]')).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('renders standalone /changes-in-progress maintenance shell without main nav @smoke', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/changes-in-progress');
    await expect(page.getByRole('heading', { name: /Site Updates in Progress/i })).toBeVisible();
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

    // Launch /contact TUI explicitly via `contact --tui` (stays in-pane on `/`)
    await gotoStreamedPage(page, '/');
    const commandInput = page.getByLabel('Terminal command input');
    await expect(commandInput).toBeFocused();
    await commandInput.fill('contact --tui');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');

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

    await gotoStreamedPage(page, '/');
    const terminalSection = page.locator('section[aria-label="Interactive Terminal tty1"]');
    const promptInput = page.getByLabel('Terminal command input', { exact: true });
    await expect(promptInput).toBeFocused();

    // Bare `contact` stays on `/` in terminal mode — never navigates to /contact or opens TUI
    await promptInput.fill('contact');
    await promptInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(terminalSection).toHaveAttribute('data-form-mode', 'contact');
    await expect(page.getByRole('heading', { name: /Andrew Klapper — Portfolio/i })).toHaveCount(0);
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

  test('renders /agensi storefront with Base UI tag filter, search filter, and outbound Agensi CTA @smoke', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Agensi storefront route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/menu');
    await expect(page.getByTestId('menu-deploy-status-cadence')).toBeVisible();
    await expect(page.getByTestId('menu-deploy-status-ask')).toBeVisible();
    await expect(page.getByTestId('menu-deploy-status-contact')).toBeVisible();

    await page.keyboard.press('3');
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '2');

    const skillCards = page.locator('[data-testid^="agensi-card-"]');
    const emptyState = page.getByTestId('agensi-empty-state');
    await expect(skillCards.first().or(emptyState)).toBeVisible();

    if ((await skillCards.count()) > 0) {
      const firstCta = page.locator('[data-testid^="agensi-cta-"]').first();
      await expect(firstCta).toHaveAttribute('href', /agensi\.io/);

      const firstTag = page.locator('[data-testid^="agensi-tag-"]').first();
      if ((await firstTag.count()) > 0) {
        await expect(firstTag).toBeVisible();
        await firstTag.click();
        await expect(skillCards.first()).toBeVisible();
      }

      await page.getByTestId('agensi-search-input').fill('zz-no-skill-matches-this');
      await expect(emptyState).toBeVisible();
    }

    expect(getErrors()).toEqual([]);
  });

  test('executes live /cadence CHORD 4-phase build, updates sandboxed iframe, and approves gate', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'CADENCE builder route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/cadence');
    await expect(page.getByTestId('cadence-quota-meter')).toBeVisible();
    await page
      .getByTestId('cadence-prompt-input')
      .fill('Build a Solar Forge latency gauge showing Cloud Run and GKE scale-from-zero pods.');
    await page.getByTestId('cadence-run-submit').click();

    await expect(page.getByTestId('cadence-active-run')).toBeVisible();
    await expect(page.getByTestId('cadence-turn-triage')).toBeVisible();
    await expect(page.getByTestId('cadence-turn-spec')).toBeVisible();
    await expect(page.getByTestId('cadence-turn-build')).toBeVisible();
    await expect(page.getByTestId('cadence-turn-gate')).toBeVisible();
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('pending');

    const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');

    await page.getByTestId('cadence-gate-approve').click();
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('approved');
    await expect(page.getByTestId('cadence-run-history')).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('streams public-only events from /api/cluster/stream and rejects /contact honeypot spam', async ({
    request,
  }) => {
    test.skip(
      IS_MAINTENANCE_MODE,
      'Public cluster SSE and contact routes are gated in maintenance mode',
    );

    const sseRes = await request.get('/api/cluster/stream');
    expect(sseRes.status()).toBe(200);
    expect(sseRes.headers()['content-type']).toContain('text/event-stream');
    const sseBody = await sseRes.text();
    expect(sseBody).toContain('portfolio-public');
    expect(sseBody).not.toContain('cadence-admin');

    const spamRes = await request.post('/api/contact', {
      multipart: {
        name: 'Bot User',
        email: 'bot@example.com',
        message: 'Automated submission attempting to fill the hidden honeypot.',
        website: 'https://spam.example.invalid',
      },
    });
    expect(spamRes.status()).toBe(400);
  });

  test('renders DB-backed help without Ghostty references and validates every workspace keybind action', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Workspace keybindings are tested in full portal mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');

    const workspace = page.locator('[data-pane-count]');
    const commandInput = page.getByLabel('Terminal command input', { exact: true });
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toBeFocused();
    const getPaneStyleVar = async (paneId: string, prop: string) =>
      page.evaluate(
        ({ id, cssVar }) => {
          const pane = document.querySelector(`[data-pane-id="${id}"]`);
          const slot = pane?.parentElement as HTMLElement | null;
          return slot?.style.getPropertyValue(cssVar).trim() ?? '';
        },
        { id: paneId, cssVar: prop },
      );
    const getActivePaneId = async () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-tab-active="true"] [data-pane-id][data-active="true"]')
            ?.getAttribute('data-pane-id') ?? '',
      );

    // 1. Header shortcut hint and DB-backed `help` output contain zero Ghostty references
    await expect(page.locator('header')).toContainText('split');
    await commandInput.fill('help');
    await commandInput.press('Enter');
    await expect(page.getByText(/Split panes & tabs \(keybindings & commands\):/i)).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/ghostty/i);

    // 2. Split right: Control+Shift+} (BracketRight), Control+Shift+O, Alt+Shift+D
    await page.keyboard.press('Control+Shift+BracketRight');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-x')).toBe('0.5');

    // 3. Resize active vertical split: Alt+Shift+ArrowRight -> 0.55, Alt+Shift+ArrowLeft -> 0.5
    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.55');
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');

    // 4. Equalize split sizes: resize to 0.6 then equalize via Control+Alt+Shift+E and Control+Shift+=
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.6');
    await page.keyboard.press('Control+Alt+Shift+KeyE');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');

    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.55');
    await page.keyboard.press('Control+Shift+Equal');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');

    // 5. Swap split panes: Control+Alt+Shift+ArrowLeft swaps pane-2 to left (x=0), ArrowRight swaps back
    await page.keyboard.press('Control+Alt+Shift+ArrowLeft');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-x')).toBe('0');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-x')).toBe('0.5');
    await page.keyboard.press('Control+Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-x')).toBe('0.5');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-x')).toBe('0');

    // 6. Rotate split orientation: Control+Alt+Shift+R flips vertical -> horizontal -> vertical
    await page.keyboard.press('Control+Alt+Shift+KeyR');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('1');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-h')).toBe('0.5');
    await page.keyboard.press('Control+Alt+Shift+KeyR');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-h')).toBe('1');

    // 7. Split down: Control+Shift+{ (BracketLeft) creates pane-3 below pane-2
    await page.keyboard.press('Control+Shift+BracketLeft');
    await expect(workspace).toHaveAttribute('data-pane-count', '3');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-h')).toBe('0.5');
    expect(await getPaneStyleVar('pane-3', '--sf-pane-y')).toBe('0.5');

    // 8. Directional focus: Control+Alt+ArrowUp -> pane-2, ArrowDown -> pane-3, ArrowLeft -> pane-1, ArrowRight -> right col
    await page.keyboard.press('Control+Alt+ArrowUp');
    expect(await getActivePaneId()).toBe('pane-2');
    await page.keyboard.press('Control+Alt+ArrowDown');
    expect(await getActivePaneId()).toBe('pane-3');
    await page.keyboard.press('Control+Alt+ArrowLeft');
    expect(await getActivePaneId()).toBe('pane-1');
    await page.keyboard.press('Control+Alt+ArrowRight');
    expect(['pane-2', 'pane-3']).toContain(await getActivePaneId());

    // 9. Zoom toggle: Control+Shift+Enter zooms and unzooms
    await page.keyboard.press('Control+Shift+Enter');
    await expect(workspace).toHaveAttribute('data-zoomed', 'true');
    await page.keyboard.press('Control+Shift+Enter');
    await expect(workspace).toHaveAttribute('data-zoomed', 'false');

    // 10. Detach active split pane to a new tab: Control+Alt+Shift+T
    await page.keyboard.press('Control+Alt+Shift+KeyT');
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');
    await expect(workspace).toHaveAttribute('data-pane-count', '1');

    // 11. New tab (Alt+Shift+T) and rename tab (Alt+Shift+A + Enter)
    await page.keyboard.press('Alt+Shift+KeyT');
    await expect(workspace).toHaveAttribute('data-tab-count', '3');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-3');
    await page.keyboard.press('Alt+Shift+KeyA');
    const renameInput = page.getByLabel('Rename tab');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('keybind-lab');
    await renameInput.press('Enter');
    await expect(page.getByRole('tab', { name: 'keybind-lab' })).toBeVisible();

    // 12. Switch tabs: Alt+1, Alt+2, Alt+9, Alt+], Alt+[
    await page.keyboard.press('Alt+1');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await page.keyboard.press('Alt+2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');
    await page.keyboard.press('Alt+9');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-3');
    await page.keyboard.press('Alt+BracketRight');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await page.keyboard.press('Alt+BracketLeft');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-3');

    // 13. Close tab-3 (MRU returns to tab-1 with 2 panes), close split pane in tab-1 via Alt+Shift+W,
    //     then switch to tab-2 and close tab-2 via Alt+Shift+W
    await page.keyboard.press('Alt+Shift+KeyW');
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    await page.keyboard.press('Alt+Shift+KeyW');
    await expect(workspace).toHaveAttribute('data-pane-count', '1');
    await page.keyboard.press('Alt+2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');
    await page.keyboard.press('Alt+Shift+KeyW');
    await expect(workspace).toHaveAttribute('data-tab-count', '1');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await expect(workspace).toHaveAttribute('data-pane-count', '1');

    // 14. TUI in-place toggle via Alt+T and close via Escape
    await page.keyboard.press('Alt+t');
    await expect(workspace).toHaveAttribute('data-pane-count', '1');
    await expect(page.locator('[data-pane-kind="tui"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '0');

    // 15. Alt+M opens /menu in-place while keeping URL at /
    await page.keyboard.press('Alt+m');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Module Menu/i })).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('supports explicit split/tab escape hatches, focus-scoped pane controls, and deep-link return', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Workspace navigation is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');
    const workspace = page.locator('[data-pane-count]');
    const commandInput = page.getByLabel('Terminal command input', { exact: true });

    // CLI --split opens a right split pane with /menu while keeping pane-1 in shell
    await commandInput.fill('menu --split');
    await commandInput.press('Enter');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    const pane2 = page.locator('[data-pane-id="pane-2"]');
    await expect(pane2).toHaveAttribute('data-active', 'true');
    await pane2.getByRole('link', { name: /Agensi/i }).click();
    await expect(pane2).toHaveAttribute('data-tui-depth', '2');

    // Focus pane-1, hover pane-2 (must NOT steal focus), press Escape (must NOT pop pane-2)
    const pane1 = page.locator('[data-pane-id="pane-1"]');
    await pane1.click();
    await expect(pane1).toHaveAttribute('data-active', 'true');
    await pane2.hover();
    await expect(pane1).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('Escape');
    await expect(pane2).toHaveAttribute('data-tui-depth', '2');

    // Clicking Go back inside unfocused pane-2 both focuses pane-2 and pops it to /menu
    await pane2.getByRole('button', { name: 'Go back' }).click();
    await expect(pane2).toHaveAttribute('data-active', 'true');
    await expect(pane2).toHaveAttribute('data-tui-depth', '1');
    await expect(pane2.getByRole('heading', { name: /Module Menu/i })).toBeVisible();

    // Shift+Click opens a split pane; Ctrl+Click opens a new tab
    await pane2.getByRole('link', { name: /Agensi/i }).click({ modifiers: ['Control'] });
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');

    // Direct SSR deep-link to /agensi initializes pane-1 and returns to / on Exit TUI
    await gotoStreamedPage(page, '/agensi');
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');
    await page.getByRole('button', { name: 'Exit TUI' }).click();
    await expect(page).toHaveURL(/\/$/);

    expect(getErrors()).toEqual([]);
  });

  test('persists guest session cookie on fresh-context in-pane /ask and /cadence loads @smoke', async ({
    browser,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Ask and CADENCE routes are gated in maintenance mode');
    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/');
      const commandInput = page.getByLabel('Terminal command input', { exact: true });
      await expect(commandInput).toBeFocused();

      // Open /ask in-pane from a fresh context (no prior ak_guest_session cookie)
      await commandInput.fill('cd ask');
      await commandInput.press('Enter');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');

      // Wait for /ask view to load and verify guest cookie persistence
      await expect(page.getByRole('button', { name: /Ask|Submit|Run/i }).first()).toBeVisible();
      const cookies = await context.cookies();
      expect(cookies.some(cookie => cookie.name === 'ak_guest_session')).toBe(true);

      // Exit back to shell and open /cadence in-pane
      await page.getByRole('button', { name: 'Exit TUI' }).click();
      await commandInput.fill('cadence');
      await commandInput.press('Enter');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText(/CADENCE Builder — Artifact Sandbox/i)).toBeVisible();

      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('emits streaming SSR headers and serves complete onAllReady HTML to search crawlers', async ({
    request,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Crawler SSR route check is gated in maintenance mode');

    const browserRes = await request.get('/menu', {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/135.0.0.0',
      },
    });
    expect(browserRes.status()).toBe(200);
    expect(browserRes.headers()['x-accel-buffering']).toBe('no');
    expect(browserRes.headers()['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);

    const botRes = await request.get('/menu', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    expect(botRes.status()).toBe(200);
    expect(botRes.headers()['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    const botHtml = await botRes.text();
    expect(botHtml).toContain('CADENCE Builder');
    expect(botHtml).toContain('data-testid="menu-deploy-status-cadence"');
    expect(botHtml).not.toContain('Loading launch menu...');
    expect(botHtml).not.toContain('Initializing Solar Forge workspace...');
    expect(botHtml).not.toContain('aria-busy="true"');
    expect(botHtml).not.toMatch(/<div hidden="" id="S:/);
  });
});
