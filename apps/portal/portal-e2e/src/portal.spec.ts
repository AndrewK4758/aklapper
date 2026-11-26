import { assertSsrHealthz, gotoStreamedPage, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

test.describe('portal SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint @smoke', async ({ request }) => {
    await assertSsrHealthz(request, 'portal-ssr');
  });

  test('renders terminal-only greeter, opens tui and menu via commands and keybindings, and hides admin items @smoke', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop multi-pane workspace journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');
    await expect(page).toHaveTitle(/^Andrew Klapper Portfolio$/);

    const commandInput = page.getByLabel('Terminal command input');
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toBeFocused();

    // TUI launcher window is hidden on initial entry — terminal is the only main item
    const tuiHeading = page.getByRole('heading', { name: /Andrew Klapper — Portfolio/i });
    await expect(tuiHeading).toHaveCount(0);

    // Zero zsh, p10k, References, phone, or postal ZIP references in rendered portal content
    const initialBodyText = await page.locator('body').innerText();
    expect(initialBodyText).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);
    expect(initialBodyText).not.toMatch(/\bReferences\b/i);
    expect(initialBodyText).not.toMatch(/\(\d{3}\)\s*\d{3}-\d{4}/);
    expect(initialBodyText).not.toMatch(/\bGA\s+\d{5}\b/);

    // Greyscale portrait and resume summary render between first `ls` prompt bar and active input prompt bar
    const companion = page.locator('[data-terminal-companion="true"]');
    await expect(companion).toBeVisible();
    const portraitImg = companion.locator('[data-terminal-portrait="true"] img');
    await expect(portraitImg).toBeVisible();
    await expect
      .poll(() =>
        portraitImg.evaluate(img => {
          const el = img as HTMLImageElement;
          return el.complete && el.naturalWidth > 0;
        }),
      )
      .toBe(true);

    const layoutOrder = await page.evaluate(() => {
      const logViewport = document.querySelector('[role="log"]') as HTMLElement | null;
      const companionEl = document.querySelector('[data-terminal-companion="true"]');
      const activeForm = document.querySelector('[data-terminal-root="true"] form');
      const firstEcho = document.querySelector('[data-terminal-root="true"] [class*="entry"]');
      return {
        scrollTop: logViewport?.scrollTop ?? -1,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        companionInsideFirstEntry: Boolean(
          firstEcho && companionEl && firstEcho.contains(companionEl),
        ),
        companionBeforeForm: Boolean(
          companionEl &&
          activeForm &&
          companionEl.compareDocumentPosition(activeForm) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        brokenAboutLinks: document.querySelectorAll('a[href="/about"]').length,
      };
    });
    expect(layoutOrder.scrollTop).toBe(0);
    expect(layoutOrder.scrollWidth).toBeLessThanOrEqual(layoutOrder.innerWidth);
    expect(layoutOrder.companionInsideFirstEntry).toBe(true);
    expect(layoutOrder.companionBeforeForm).toBe(true);
    expect(layoutOrder.brokenAboutLinks).toBe(0);

    await expect(
      companion.getByText('Senior Full-Stack & Systems Engineer · Marietta, GA'),
    ).toBeVisible();
    await expect(companion.getByRole('link', { name: 'andrew@andrew-k.us' })).toHaveAttribute(
      'href',
      'mailto:andrew@andrew-k.us',
    );
    await expect(companion.getByRole('link', { name: 'github.com/AndrewK4758' })).toHaveAttribute(
      'href',
      'https://github.com/AndrewK4758',
    );
    for (const highlight of [
      'Build Technology Group',
      'Gitasy',
      'CADENCE',
      'Ghostty Union',
      'Gemma 4 fine-tuning',
      'Woodstock Developers Group',
    ]) {
      expect(initialBodyText).toContain(highlight);
    }

    // Clean DB-driven `ls` directory listing without Unix permission columns or trailing `/`
    expect(initialBodyText).not.toMatch(/drwxr-xr-x|-rw-r--r--|menu\//);
    await expect(page.getByText(/about\s+# Resume & platform services guide/)).toBeVisible();
    await expect(page.getByText(/tui\s+# TUI version/)).toBeVisible();
    await expect(page.getByText(/cadence\s+# Agentic workflow example/)).toBeVisible();
    await expect(page.getByText(/chat\s+# Chat with Andrew's AI/)).toBeVisible();
    await expect(page.getByText(/agensi\s+# Published AI skills/)).toBeVisible();
    await expect(page.getByText(/contact\s+# Connect with me/)).toBeVisible();
    expect(initialBodyText).not.toContain('changes-in-progress');
    expect(initialBodyText).not.toMatch(/Maintenance preview/i);

    // Retired route command stays on "/" and reports unknown route
    await commandInput.fill('cd changes-in-progress');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/no such route|unknown|not found/i)).toBeVisible();

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

    // Ctrl+L clears scrollback and portrait companion cleanly; subsequent `ls` prints terse listing only
    await commandInput.press('Control+l');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toHaveCount(0);
    await expect(page.locator('[data-terminal-companion="true"]')).toHaveCount(0);
    await commandInput.fill('ls');
    await commandInput.press('Enter');
    await expect(page.getByText(/tui\s+# TUI version/)).toBeVisible();
    await expect(page.locator('[data-terminal-companion="true"]')).toHaveCount(0);

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

    // Alt+Shift+D splits a new terminal pane; `tui` takes over tty2 in-place, Escape returns tty2 to shell, exit closes tty2
    await page.keyboard.press('Alt+Shift+KeyD');
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

    // `tui` command opens the TUI launcher in-place while keeping URL at /
    await commandInput.fill('tui');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Andrew Klapper — Portfolio/i })).toBeVisible();
    await expect(page.getByText(/CADENCE Builder/i)).toBeVisible();
    await expect(page.getByText(/cadence-admin/i)).toHaveCount(0);
    await expect(page.getByText(/Maintenance Preview/i)).toHaveCount(0);

    // Clicking CADENCE Builder from primary TUI navigates to /cadence; Escape exits back to /
    await page.getByRole('link', { name: /CADENCE Builder/i }).click();
    await expect(page).toHaveURL(/\/cadence$/);
    await expect(
      page.getByText(/CADENCE Builder — Interactive Multi-Artifact Showcase/i),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '0');

    expect(getErrors()).toEqual([]);
  });

  test('navigates to /cadence and renders sandboxed artifact preview iframe @smoke', async ({
    page,
  }, testInfo) => {
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/cadence');
    await expect(
      page.getByText(/CADENCE Builder — Interactive Multi-Artifact Showcase/i),
    ).toBeVisible();
    const goldenStrip = page.getByTestId('cadence-golden-strip');
    await expect(goldenStrip).toBeVisible();
    await expect(goldenStrip.locator('button[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByTestId('cadence-golden-readonly-pill')).toHaveCount(0);

    const firstShowcase = goldenStrip.locator('button').first();
    await firstShowcase.click();
    await expect(firstShowcase).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('cadence-execution-mode-badge')).toContainText(
      /Golden Showcase/i,
    );
    await expect(page.getByTestId('cadence-golden-readonly-pill')).toBeVisible();

    const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', /.+/);

    if (testInfo.project.name !== 'mobile-chrome') {
      // Alt+Shift+D opens a separate terminal pane directly alongside the CADENCE TUI
      await page.keyboard.press('Alt+Shift+KeyD');
      await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
      await expect(frame).toBeVisible();
      const splitInput = page.getByLabel('Terminal command input', { exact: true });
      await splitInput.fill('whoami');
      await splitInput.press('Enter');
      await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();
      await page.keyboard.press('Alt+Shift+KeyW');
      await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    }

    expect(getErrors()).toEqual([]);
  });

  test('returns standalone HTTP 404 with noindex SEO, zero status polling, and clean recovery for retired and unknown routes @smoke', async ({
    page,
    request,
  }, testInfo) => {
    const getErrors = trackPageErrors(page);
    const disallowedNotFoundRequests: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/runtime/status')) {
        disallowedNotFoundRequests.push(`${req.method()} ${url}`);
        return;
      }
      if (url.includes('/api/analytics/ingest') && req.method() === 'POST') {
        try {
          const payload = req.postDataJSON() as {
            events?: Array<{ type?: string; name?: string }>;
          } | null;
          if (payload?.events?.some(ev => ev.type === 'error')) {
            disallowedNotFoundRequests.push(`POST ${url} (client_error)`);
          }
        } catch {
          // Ignore non-JSON beacon bodies
        }
      }
    });

    for (const unmatchedPath of ['/changes-in-progress', '/nonexistent-route']) {
      disallowedNotFoundRequests.length = 0;
      const res = await page.goto(unmatchedPath, { waitUntil: 'load' });
      expect(res?.status()).toBe(404);
      const correlationId = res?.headers()['x-correlation-id'] ?? '';
      expect(correlationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);

      const errorCard = page.locator('[data-error-code="ERR_NOT_FOUND"]');
      await expect(errorCard).toBeVisible();
      await expect(errorCard).toHaveAttribute('data-http-status', '404');
      await expect(errorCard).toContainText(correlationId);
      await expect(page.locator('header')).toHaveCount(0);
      await expect(page.locator('footer')).toHaveCount(0);
      await expect(page.locator('[data-pane-count]')).toHaveCount(0);

      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveCount(1);
      await expect(robotsMeta).toHaveAttribute('content', 'noindex, nofollow');
      const googlebotMeta = page.locator('meta[name="googlebot"]');
      await expect(googlebotMeta).toHaveCount(1);
      await expect(googlebotMeta).toHaveAttribute('content', 'noindex, nofollow');
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

      // Allow hydration effects to settle and confirm zero 404 runtime polling or client-error telemetry
      await page.waitForTimeout(250);
      expect(disallowedNotFoundRequests).toEqual([]);
    }

    // Clicking Return Home from the hydrated 404 page transitions cleanly to "/" with full workspace shell & indexable SEO
    await page.getByRole('link', { name: 'Return Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('Terminal command input')).toBeVisible();
    if (testInfo.project.name === 'mobile-chrome') {
      await expect(page.locator('[data-mobile-tui-header="true"]')).toBeVisible();
    } else {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('[data-pane-count="1"]')).toBeVisible();
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');

    // Unmatched /api/* endpoints return JSON PublicAppError 404 without HTML
    for (const method of ['get', 'post'] as const) {
      const apiRes = await request[method]('/api/nonexistent-endpoint');
      expect(apiRes.status()).toBe(404);
      expect(apiRes.headers()['content-type']).toContain('application/json');
      const apiCorr = apiRes.headers()['x-correlation-id'] ?? '';
      expect(apiCorr).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
      expect(await apiRes.json()).toMatchObject({
        code: 'ERR_NOT_FOUND',
        status: 404,
        correlationId: apiCorr,
      });
    }

    // Sitemap and robots.txt omit /changes-in-progress
    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    expect(await sitemapRes.text()).not.toContain('changes-in-progress');
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    expect(await robotsRes.text()).not.toContain('changes-in-progress');

    expect(getErrors()).toEqual([]);
  });

  test('renders /contact recursive TUI form with client, server, and Postgres 19 validation', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop in-pane contact --tui journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const getErrors = trackPageErrors(page);

    // Launch /contact TUI explicitly via `contact --tui` (navigates primary pane to /contact)
    await gotoStreamedPage(page, '/');
    const commandInput = page.getByLabel('Terminal command input');
    await expect(commandInput).toBeFocused();
    await commandInput.fill('contact --tui');
    await commandInput.press('Enter');
    await expect(page).toHaveURL(/\/contact$/);
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
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop workspace terminal form journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
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
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop in-pane hotkey navigation journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/agensi');
    await expect(page).toHaveURL(/\/agensi$/);

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
    browser,
    page,
    request,
  }) => {
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/cadence');
    await expect(page.getByTestId('cadence-quota-meter')).toBeVisible();

    const selectTrigger = page.getByTestId('cadence-preset-select');
    await expect(selectTrigger).toBeVisible();
    const fastSwitch = page.getByTestId('cadence-fast-mode-switch');
    await expect(fastSwitch).toHaveAttribute('aria-checked', 'false');
    await fastSwitch.click();
    await expect(fastSwitch).toHaveAttribute('aria-checked', 'true');

    // Dropdown lists all 5 seeded CADENCE methodology showcases plus the custom option.
    await selectTrigger.click();
    await expect(
      page.getByRole('option', { name: /CHORD Behavioral Decomposition Workbench/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Change-Tier Blast-Radius & Gate Matrix/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Expand\/Contract Zero-Downtime Migration Blueprint/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /5-Boundary Resilience & Chaos Audit/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Spec Challenge & Empirical Proof Ledger/i }),
    ).toBeVisible();
    const customOption = page.getByRole('option', { name: /^Custom Prompt$/i });
    await expect(customOption).toBeVisible();

    // Selecting a catalog preset populates its starter prompt; switching to Custom keeps user edits.
    await page
      .getByRole('option', { name: /Expand\/Contract Zero-Downtime Migration Blueprint/i })
      .click();
    const promptInput = page.getByTestId('cadence-prompt-input');
    await expect(promptInput).toHaveValue(/Expand\/Contract|Zero-Downtime|migration/i);

    await selectTrigger.click();
    await customOption.click();

    await promptInput.fill('  ab ');
    await expect(page.getByTestId('cadence-run-submit')).toBeDisabled();

    const customPrompt =
      'Build a Solar Forge latency gauge showing Cloud Run and GKE scale-from-zero pods.';
    await promptInput.fill(customPrompt);

    const streamResponsePromise = page.waitForResponse(
      res =>
        /\/api\/cadence\/runs\/[^/]+\/stream$/.test(res.url()) && res.request().method() === 'GET',
    );
    await page.getByTestId('cadence-run-submit').click();

    const streamResponse = await streamResponsePromise;
    expect(streamResponse.status()).toBe(200);
    expect(streamResponse.headers()['content-type']).toContain('text/event-stream');
    const streamRunIdMatch = /\/api\/cadence\/runs\/([^/]+)\/stream$/.exec(streamResponse.url());
    expect(streamRunIdMatch?.[1]).toBeTruthy();
    const createdRunId = streamRunIdMatch?.[1] ?? '';

    await expect(page.getByTestId('cadence-active-run')).toBeVisible();
    await expect(page.getByTestId('cadence-turn-triage')).toHaveAttribute(
      'data-status',
      'completed',
    );
    await expect(page.getByTestId('cadence-turn-spec')).toHaveAttribute('data-status', 'completed');
    await page.getByTestId('cadence-spec-approve').click();
    await expect(page.getByTestId('cadence-turn-build')).toHaveAttribute(
      'data-status',
      'completed',
    );
    await expect(page.getByTestId('cadence-turn-gate')).toHaveAttribute('data-status', 'completed');
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('pending');
    await expect(page.getByTestId('cadence-quota-meter')).toContainText('1/10 turns');

    const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    const srcdoc = (await frame.getAttribute('srcdoc')) ?? '';
    expect(srcdoc).toContain('scale-from-zero pods');
    expect(srcdoc).not.toContain('allow-same-origin');
    const previewFrame = page.frameLocator('iframe[title="CADENCE Artifact Preview"]');
    await expect(previewFrame.locator('body')).toContainText('scale-from-zero pods');
    await expect(async () => {
      await previewFrame.locator('#ping-btn').click();
      await expect(previewFrame.locator('#probe-val')).toContainText('#1');
    }).toPass();

    await page.getByTestId('cadence-gate-approve').click();
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('approved');
    await expect(page.getByTestId('cadence-run-history')).toBeVisible();

    // Reload recovers persisted approved run from PG19 without double-charging guest quota.
    await page.reload();
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('approved');
    await expect(page.getByTestId('cadence-quota-meter')).toContainText('1/10 turns');
    await expect(page.getByTestId('cadence-run-history')).toBeVisible();

    // Missing cookie -> 401 with zero Set-Cookie; foreign cookie session -> 403.
    const unauthRes = await request.get(`/api/cadence/runs/${createdRunId}/stream`);
    expect(unauthRes.status()).toBe(401);
    expect(unauthRes.headers()['set-cookie']).toBeUndefined();

    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await gotoStreamedPage(otherPage, '/cadence');
      const otherStreamRes = await otherPage.request.get(
        `/api/cadence/runs/${createdRunId}/stream`,
      );
      expect(otherStreamRes.status()).toBe(403);
    } finally {
      await otherContext.close();
    }

    expect(getErrors()).toEqual([]);
  });

  test('runs cadence from primary terminal to /cadence with Select Escape guard and approves gate', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop docked pane journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');
    const commandInput = page.getByLabel('Terminal command input', { exact: true });
    await expect(commandInput).toBeFocused();
    await commandInput.fill('cadence');
    await commandInput.press('Enter');

    await expect(page).toHaveURL(/\/cadence$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');
    const selectTrigger = page.getByTestId('cadence-preset-select');
    await expect(selectTrigger).toBeVisible();

    // Opening Select listbox and pressing Escape dismisses only the listbox without leaving /cadence.
    await selectTrigger.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page).toHaveURL(/\/cadence$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');
    await expect(page.getByTestId('cadence-prompt-input')).toBeVisible();

    await selectTrigger.click();
    await page.getByRole('option', { name: /Change-Tier Blast-Radius & Gate Matrix/i }).click();
    await page.getByTestId('cadence-run-submit').click();

    await expect(page.getByTestId('cadence-turn-triage')).toHaveAttribute(
      'data-status',
      'completed',
    );
    await page.getByTestId('cadence-spec-approve').click();
    await expect(page.getByTestId('cadence-turn-gate')).toHaveAttribute('data-status', 'completed');
    await page.getByTestId('cadence-gate-approve').click();
    await expect(page.getByTestId('cadence-gate-verdict')).toContainText('approved');
    await expect(page).toHaveURL(/\/cadence$/);

    // Pressing Escape when popup is closed cleanly exits /cadence back to shell at /.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '0');

    expect(getErrors()).toEqual([]);
  });

  test('sanitizes unsafe markup and enforces 429 quota exhaustion cleanly', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/cadence');
      const selectTrigger = page.getByTestId('cadence-preset-select');
      await selectTrigger.click();
      await page.getByRole('option', { name: /^Custom Prompt$/i }).click();

      const promptInput = page.getByTestId('cadence-prompt-input');
      await promptInput.fill(
        'Render probe <iframe src="https://evil.example"></iframe> <script>alert(1)</script>',
      );
      await page.getByTestId('cadence-run-submit').click();
      await expect(page.getByTestId('cadence-quota-meter')).toContainText('1/10 turns');
      await page.getByTestId('cadence-spec-approve').click();
      await expect(page.getByTestId('cadence-gate-verdict')).toContainText('pending');
      await expect(page.getByTestId('cadence-turn-gate')).toHaveAttribute(
        'data-status',
        'completed',
      );

      const frame = page.locator('iframe[title="CADENCE Artifact Preview"]');
      await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
      const srcdoc = (await frame.getAttribute('srcdoc')) ?? '';
      expect(srcdoc).not.toContain('<iframe');
      expect(srcdoc).not.toContain('<script>alert(1)</script>');
      expect(srcdoc).toContain('&lt;iframe');

      // Exhaust remaining 9 session turns cleanly (10-turn guest cap), then assert 11th triggers 429 error banner.
      for (let i = 2; i <= 10; i += 1) {
        await promptInput.fill(`Quota exhaustion build run number ${i} telemetry gauge`);
        await page.getByTestId('cadence-run-submit').click();
        await expect(page.getByTestId('cadence-quota-meter')).toContainText(`${i}/10 turns`);
        await page.getByTestId('cadence-spec-approve').click();
        await expect(page.getByTestId('cadence-turn-gate')).toHaveAttribute(
          'data-status',
          'completed',
        );
      }

      await promptInput.fill('Eleventh attempt should hit atomic session turn limit');
      await page.getByTestId('cadence-run-submit').click();
      await expect(page.getByTestId('cadence-error-banner')).toBeVisible();
      await expect(page.getByTestId('cadence-quota-meter')).toContainText('10/10 turns');

      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('returns runtime health JSON from /api/runtime/status and rejects /contact honeypot spam', async ({
    request,
  }) => {
    const statusRes = await request.get('/api/runtime/status');
    expect(statusRes.status()).toBe(200);
    expect(statusRes.headers()['content-type']).toContain('application/json');
    const statusJson = (await statusRes.json()) as {
      runtime?: string;
      services?: Array<{ service: string }>;
    };
    expect(['cloud-run', 'docker']).toContain(statusJson.runtime);
    expect(Array.isArray(statusJson.services)).toBe(true);
    expect(statusJson.services?.some(s => s.service === 'portal')).toBe(true);

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
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop workspace keybindings; handheld journeys are covered in mobile-layout.spec.ts',
    );
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

    // 1. Header shortcut hint and DB-backed `help` output contain only browser-safe bindings and zero stale chords
    await expect(page.locator('header')).toContainText('split');
    await commandInput.fill('help');
    await commandInput.press('Enter');
    const helpOutput = page.locator('[data-terminal-root="true"] pre').filter({
      hasText: /Split panes & tabs \(keybindings & commands\):/i,
    });
    await expect(helpOutput).toBeVisible();
    const headerAndHelpText = `${await page.locator('header').innerText()}\n${await helpOutput.innerText()}`;
    expect(headerAndHelpText).not.toMatch(
      /ghostty|Ctrl\+Shift\+O|\bCmd\+D\b|\bCtrl\+W\b|\bCtrl\+N\b|\bAlt\+1\.\.9\b/i,
    );

    // 1b. Single-pane/single-tab disabled shortcuts are contained with zero stray characters in prompt
    await commandInput.focus();
    await page.keyboard.press('Alt+BracketRight');
    await page.keyboard.press('Alt+Shift+Digit1');
    await page.keyboard.press('Alt+Shift+KeyR');
    await expect(commandInput).toHaveValue('');

    // 2. Split right: Control+Shift+} (BracketRight); tty2 does not duplicate the home portrait companion
    await page.keyboard.press('Control+Shift+BracketRight');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    await expect(
      page.locator('[data-pane-tty="tty2"] [data-terminal-companion="true"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-terminal-companion="true"]')).toHaveCount(1);
    const splitOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(splitOverflow.scrollWidth).toBeLessThanOrEqual(splitOverflow.innerWidth);
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-x')).toBe('0.5');

    // 3. Resize active vertical split: Alt+Shift+ArrowRight -> 0.55, Alt+Shift+ArrowLeft -> 0.5
    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.55');
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');

    // 4. Equalize split sizes: resize to 0.6 then equalize via Control+Alt+Shift+E
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.6');
    await page.keyboard.press('Control+Alt+Shift+KeyE');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-w')).toBe('0.5');

    // 5. Swap split panes: Alt+Shift+H swaps pane-2 to left (x=0), Alt+Shift+L swaps back
    await page.keyboard.press('Alt+Shift+KeyH');
    expect(await getPaneStyleVar('pane-2', '--sf-pane-x')).toBe('0');
    expect(await getPaneStyleVar('pane-1', '--sf-pane-x')).toBe('0.5');
    await page.keyboard.press('Alt+Shift+KeyL');
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

    // 8. Directional focus: Alt+K -> pane-2, Alt+J -> pane-3, Alt+H -> pane-1, Alt+L -> right col
    await page.keyboard.press('Alt+KeyK');
    expect(await getActivePaneId()).toBe('pane-2');
    await page.keyboard.press('Alt+KeyJ');
    expect(await getActivePaneId()).toBe('pane-3');
    await page.keyboard.press('Alt+KeyH');
    expect(await getActivePaneId()).toBe('pane-1');
    await page.keyboard.press('Alt+KeyL');
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

    // 11. New tab (Alt+Shift+N) and rename tab (F2 + Enter)
    await page.keyboard.press('Alt+Shift+KeyN');
    await expect(workspace).toHaveAttribute('data-tab-count', '3');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-3');
    await page.keyboard.press('F2');
    const renameInput = page.getByLabel('Rename tab');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('keybind-lab');
    await renameInput.press('Enter');
    await expect(page.getByRole('tab', { name: 'keybind-lab' })).toBeVisible();

    // 12. Switch tabs: Alt+Shift+1, Alt+Shift+2, Alt+Shift+9, Alt+], Alt+[
    await page.keyboard.press('Alt+Shift+Digit1');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-1');
    await page.keyboard.press('Alt+Shift+Digit2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');
    await page.keyboard.press('Alt+Shift+Digit9');
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
    await page.keyboard.press('Alt+Shift+Digit2');
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

    expect(getErrors()).toEqual([]);
  });

  test('supports explicit split/tab escape hatches, focus-scoped pane controls, and deep-link return', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop split/tab escape hatches; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/');
    const workspace = page.locator('[data-pane-count]');
    const commandInput = page.getByLabel('Terminal command input', { exact: true });

    // CLI --split opens a right split pane with TUI launcher while keeping pane-1 in shell
    await commandInput.fill('tui --split');
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

    // Clicking Go back inside unfocused pane-2 both focuses pane-2 and pops it to TUI launcher
    await pane2.getByRole('button', { name: 'Go back' }).click();
    await expect(pane2).toHaveAttribute('data-active', 'true');
    await expect(pane2).toHaveAttribute('data-tui-depth', '1');
    await expect(pane2.getByRole('heading', { name: /Andrew Klapper — Portfolio/i })).toBeVisible();

    // Shift+Click opens a split pane; Ctrl+Click opens a new tab
    await pane2.getByRole('link', { name: /Agensi/i }).click({ modifiers: ['Control'] });
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-active-tab', 'tab-2');

    // Direct SSR deep-link to /agensi preserves global tabs/splits, initializes pane-1, and returns to / on Exit TUI
    await gotoStreamedPage(page, '/agensi');
    await expect(workspace).toHaveAttribute('data-tab-count', '2');
    await expect(workspace).toHaveAttribute('data-pane-count', '2');
    await expect(page.locator('[data-pane-id="pane-1"]')).toHaveAttribute('data-tui-depth', '1');
    await page.locator('[data-pane-id="pane-1"]').getByRole('button', { name: 'Exit TUI' }).click();
    await expect(page).toHaveURL(/\/$/);

    expect(getErrors()).toEqual([]);
  });

  test('persists guest session cookie on fresh-context in-pane /chat and /cadence loads @smoke', async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop in-pane navigation journey; handheld journeys are covered in mobile-layout.spec.ts',
    );
    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/');
      const commandInput = page.getByLabel('Terminal command input', { exact: true });
      await expect(commandInput).toBeFocused();

      // Open /chat in a secondary split from a fresh context (stays on / and sets ak_guest_session)
      await commandInput.fill('chat --split');
      await commandInput.press('Enter');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('[data-pane-id="pane-2"]')).toHaveAttribute('data-tui-depth', '1');

      // Wait for secondary /chat view to load and verify guest cookie persistence
      await expect(page.getByTestId('ask-qa-submit')).toBeVisible();
      const cookies = await context.cookies();
      expect(cookies.some(cookie => cookie.name === 'ak_guest_session')).toBe(true);

      // Primary terminal `cadence` navigates to real /cadence route while secondary /chat split persists
      await page.locator('[data-pane-id="pane-1"]').click();
      await commandInput.fill('cadence');
      await commandInput.press('Enter');
      await expect(page).toHaveURL(/\/cadence$/);
      await expect(
        page.getByText(/CADENCE Builder — Interactive Multi-Artifact Showcase/i),
      ).toBeVisible();
      await expect(
        page.locator('[data-pane-id="pane-2"]').getByTestId('ask-qa-submit'),
      ).toBeVisible();

      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('emits streaming SSR headers and serves complete onAllReady HTML to search crawlers', async ({
    request,
  }) => {
    const browserRes = await request.get('/cadence', {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/135.0.0.0',
      },
    });
    expect(browserRes.status()).toBe(200);
    expect(browserRes.headers()['x-accel-buffering']).toBe('no');
    expect(browserRes.headers()['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);

    const botRes = await request.get('/cadence', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    expect(botRes.status()).toBe(200);
    expect(botRes.headers()['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    const botHtml = await botRes.text();
    expect(botHtml).toContain('CADENCE Builder');
    expect(botHtml).not.toContain('Loading sandbox builder...');
    expect(botHtml).not.toContain('Initializing Solar Forge workspace...');
    expect(botHtml).not.toContain('aria-busy="true"');
    expect(botHtml).not.toMatch(/<div hidden="" id="S:/);
  });

  test('renders sanitized /about SSR resume, portrait, Services Guide, pane docking, and terminal navigation @smoke', async ({
    page,
    request,
  }, testInfo) => {
    const getErrors = trackPageErrors(page);

    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    expect(await sitemapRes.text()).toContain('<loc>https://andrew-k.us/about</loc>');

    await gotoStreamedPage(page, '/about');
    await expect(page).toHaveTitle(/About Andrew Klapper/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about$/);

    await expect(page.getByRole('heading', { name: 'Andrew Klapper', exact: true })).toBeVisible();
    await expect(
      page.getByText('Senior Full-Stack & Systems Engineer', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Marietta, GA', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'andrew@andrew-k.us' }).first()).toBeVisible();
    await expect(page.locator('[data-terminal-portrait="true"] img')).toBeVisible();

    // Full sanitized resume sections & Services Guide
    await expect(
      page.getByRole('heading', {
        name: 'Software Engineer | Build Technology Group',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Hardware Interfacing Platform', { exact: true })).toBeVisible();
    await expect(page.getByText('Legacy ERP Modernization', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Software Engineer | Gitasy', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Owner | Shipping Services & Logistics LLC',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Ghostty Union - Native Linux Terminal Emulator',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Instructor & Mentor | Woodstock Developers Group',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Kennesaw State University', { exact: true })).toBeVisible();

    await expect(page.getByTestId('about-service-link-chat')).toHaveAttribute('href', '/chat');
    await expect(page.getByTestId('about-service-link-agensi')).toHaveAttribute('href', '/agensi');
    await expect(page.getByTestId('about-service-link-cadence')).toHaveAttribute(
      'href',
      '/cadence',
    );
    await expect(page.getByTestId('about-contact-cta')).toHaveAttribute('href', '/contact');

    // Privacy hygiene on live rendered /about HTML
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\bref(?:erence)?s\b/i);
    expect(bodyText).not.toMatch(/(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}/);
    expect(bodyText).not.toMatch(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/);
    expect(bodyText).not.toMatch(/\b\d{5}-\d{4}\b/);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

    if (testInfo.project.name !== 'mobile-chrome') {
      // Desktop header About active indicator
      await expect(
        page.locator('header').getByRole('link', { name: 'About', exact: true }),
      ).toHaveAttribute('aria-current', 'page');

      // Clicking Services Guide link in primary pane updates browser URL
      await page.getByTestId('about-service-link-agensi').click();
      await expect(page).toHaveURL(/\/agensi$/);

      // Navigate via terminal `cd about`, then return to `/` and dock `/about` in a secondary split pane
      await gotoStreamedPage(page, '/');
      const commandInput = page.getByLabel('Terminal command input', { exact: true });
      await commandInput.fill('cd about');
      await commandInput.press('Enter');
      await expect(page).toHaveURL(/\/about$/);

      await gotoStreamedPage(page, '/');
      await page.getByRole('button', { name: 'Open Pane' }).click();
      await page.getByRole('menuitem', { name: 'About (Split)' }).click();
      await expect(page.locator('[data-pane-count="2"]')).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      const secondaryPane = page.locator('[data-pane-id]').nth(1);
      await expect(
        secondaryPane.getByRole('heading', { name: 'Andrew Klapper', exact: true }),
      ).toBeVisible();

      // Clicking a service card inside secondary split pane transitions that pane without changing URL
      await secondaryPane.getByTestId('about-service-link-agensi').click();
      await expect(secondaryPane.getByTestId('agensi-search-input')).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
    }

    expect(getErrors()).toEqual([]);
  });
});
