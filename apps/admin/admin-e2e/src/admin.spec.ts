import { randomUUID } from 'node:crypto';

import { createDbPool } from '@aklapper/db';
import {
  assertSsrHealthz,
  gotoStreamedPage,
  trackPageErrors,
  waitForStreamedReveal,
} from '@aklapper/tooling/playwright';
import { type CDPSession, expect, test } from '@playwright/test';

import {
  attachVirtualAuthenticator,
  buildIsolatedTestIp,
  cleanupIsolatedAuthState,
  generateSixDigitTotp,
  HAS_DATABASE_URL,
  seedIsolatedAdmin,
  sha256Hex,
} from './admin-helpers.js';

test.describe('admin SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint @smoke', async ({ request }) => {
    await assertSsrHealthz(request, 'admin-ssr');
  });

  test('guards protected pages, renders unified login UI without bootstrap tab, and rejects unauthenticated registration @smoke', async ({
    page,
    request,
  }) => {
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toHaveCount(0);

    await expect(page.getByLabel('Admin Handle', { exact: true })).toHaveAttribute(
      'autocomplete',
      'username webauthn',
    );
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Passkey' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bootstrap/i })).toHaveCount(0);
    await expect(page.getByLabel(/Bootstrap Token/i)).toHaveCount(0);

    for (const protectedPath of ['/analytics', '/cms', '/inbox', '/quotas', '/ops']) {
      await gotoStreamedPage(page, protectedPath, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(protectedPath)}$`),
      );
      await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    }

    const loginRes = await request.get('/login');
    expect(loginRes.status()).toBe(200);
    expect(loginRes.headers()['x-accel-buffering']).toBe('no');
    expect(loginRes.headers()['x-frame-options']).toMatch(/sameorigin/i);
    expect(loginRes.headers()['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);

    const attachmentRes = await request.get(
      '/inbox/11111111-1111-4111-8111-111111111111/attachment',
    );
    expect(attachmentRes.status()).toBe(401);

    const runtimeStatusRes = await request.get('/api/ops/runtime/status');
    expect(runtimeStatusRes.status()).toBe(401);

    const unauthReg = await request.post('/api/auth/passkey/register/options', { data: {} });
    expect(unauthReg.status()).toBe(401);

    const forgedBootstrapReg = await request.post('/api/auth/passkey/register/options', {
      headers: { 'x-bootstrap-token': 'forged-legacy-token' },
      data: { handle: 'admin' },
    });
    expect(forgedBootstrapReg.status()).toBe(401);

    expect(getErrors()).toEqual([]);
  });

  test('completes isolated password login, Create Passkey / skip flow, TOTP QR 2FA, and console routes', async ({
    page,
  }, testInfo) => {
    test.skip(!HAS_DATABASE_URL, 'Requires DATABASE_URL for isolated admin credential seeding');
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop admin shell journey; handheld journeys are covered in mobile-layout.spec.ts',
    );

    const getErrors = trackPageErrors(page);
    const projectName = testInfo.project.name;
    const isChromiumDesktop = projectName === 'chromium';
    const handle = `e2e-${projectName}-${Date.now()}-${randomUUID().slice(0, 6)}`.toLowerCase();
    const password = `E2ePass-${randomUUID()}`;
    const testIp = buildIsolatedTestIp(projectName, 1 + (testInfo.retry % 5));
    const rateKeys = [
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
      `auth:totp:ip:${sha256Hex(testIp)}`,
    ];

    let authenticator: { cdp: CDPSession; authenticatorId: string } | null = null;
    const quotaCleanupState: { originalGuestMaxTurns: string | null } = {
      originalGuestMaxTurns: null,
    };

    await seedIsolatedAdmin(handle, password);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    try {
      if (isChromiumDesktop) {
        authenticator = await attachVirtualAuthenticator(page);
      }

      // 1. Navigating to /analytics while logged out redirects to /login?next=%2Fanalytics
      await gotoStreamedPage(page, '/analytics', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/login\?next=%2Fanalytics$/);

      // 2. Sign in with seeded password credentials
      await page.getByLabel('Admin Handle', { exact: true }).fill(handle);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in with Password' }).click();

      // 3. Post-login Create Passkey step appears for zero-passkey user
      const createPasskeyBtn = page.getByRole('button', { name: 'Create Passkey' });
      const continueBtn = page.getByRole('button', { name: 'Continue to Console' });
      await expect(createPasskeyBtn).toBeVisible();
      await expect(continueBtn).toBeVisible();

      if (isChromiumDesktop) {
        await createPasskeyBtn.click();
      } else {
        await continueBtn.click();
      }

      // 4. Lands on /analytics with authenticated admin chrome
      await expect(page).toHaveURL(/\/analytics$/);
      await waitForStreamedReveal(page);
      await expect(
        page.getByRole('region', { name: /First-Party Visitor Analytics/i }),
      ).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      await expect(page.getByText('Passkey Verified')).toBeVisible();

      // 5. Navigate to Overview and test Security Settings Drawer (TOTP QR SVG + verification)
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
      await expect(page.getByText('Portal Maintenance')).toHaveCount(0);

      await page.getByRole('button', { name: 'Security Settings' }).click();
      await expect(
        page.getByRole('heading', { name: /Passkey & TOTP Security Settings/i }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Enroll TOTP 2FA' }).click();

      const qrSvg = page.getByRole('img', { name: 'TOTP 2FA QR Code' });
      await expect(qrSvg).toBeVisible();
      const secretEl = page.getByTestId('totp-secret');
      await expect(secretEl).toBeVisible();
      await expect(page.getByTestId('totp-uri')).toContainText('otpauth://totp/');

      const secret = (await secretEl.innerText()).trim();
      const totpCode = generateSixDigitTotp(secret);
      await page.getByLabel('6-Digit Verification Code').fill(totpCode);
      await page.getByRole('button', { name: 'Verify & Enable TOTP' }).click();
      await expect(page.getByText(/TOTP 2FA verified and enabled/i)).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();

      // 6. Verify Password + TOTP 2FA step-up sign-in after Sign Out
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/\/login$/, { waitUntil: 'networkidle' });
      await waitForStreamedReveal(page);

      await page.getByLabel('Admin Handle', { exact: true }).fill(handle);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in with Password' }).click();

      await expect(page.getByLabel(/2FA Verification Code/i)).toBeVisible();
      await page.getByLabel(/2FA Verification Code/i).fill(generateSixDigitTotp(secret));
      await page.getByRole('button', { name: 'Verify 2FA Code' }).click();

      if (!isChromiumDesktop) {
        await expect(page.getByRole('button', { name: 'Continue to Console' })).toBeVisible();
        await page.getByRole('button', { name: 'Continue to Console' }).click();
      }

      await expect(page).toHaveURL(/\/$/);
      await waitForStreamedReveal(page);
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();

      // Disable TOTP cleanly and test discoverable passkey + all 6 admin console routes on Chromium
      await page.getByRole('button', { name: 'Security Settings' }).click();
      await page.getByRole('button', { name: 'Disable TOTP 2FA' }).click();
      await expect(page.getByText(/TOTP 2FA disabled/i)).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();

      if (isChromiumDesktop) {
        await page.getByRole('link', { name: 'Analytics', exact: true }).click();
        await page.getByRole('link', { name: '24h' }).click();
        await expect(page).toHaveURL(/\/analytics\?window=24h$/);
        await expect(page.getByText('LCP', { exact: true })).toBeVisible();

        await page.getByRole('link', { name: 'CMS', exact: true }).click();
        await expect(page).toHaveURL(/\/cms$/);
        await expect(page.getByRole('region', { name: /PostgreSQL 19 CMS/i })).toBeVisible();
        await page.setViewportSize({ width: 1920, height: 1080 });
        const layoutMetrics = await page.evaluate(() => {
          const cmsRegion = document.querySelector('main section[aria-label^="PostgreSQL 19 CMS"]');
          const contentContainer = cmsRegion?.parentElement ?? document.querySelector('main');
          return {
            mainWidth: contentContainer
              ? Math.round(contentContainer.getBoundingClientRect().width)
              : 0,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          };
        });
        expect(layoutMetrics.mainWidth).toBeGreaterThan(1080);
        expect(layoutMetrics.mainWidth).toBeLessThanOrEqual(1760);
        expect(layoutMetrics.scrollWidth).toBeLessThanOrEqual(layoutMetrics.innerWidth);

        await expect(page.getByLabel('Qdrant RAG Corpus Note (Markdown)')).toBeVisible();
        await expect(page.getByLabel('Live site content preview')).toHaveCount(0);

        // Verify portal-home structured sub-editors, desktop/mobile live preview portrait load, privacy 422 guard, and save persistence
        await page.getByRole('button', { name: /portal-home/i }).click();
        const portraitSrcInput = page.getByLabel('Portrait Source Path');
        const bioInput = page.getByLabel('Engineering Bio');
        await expect(portraitSrcInput).toHaveValue('/images/andrew-klapper-portrait.webp');
        const originalBio = await bioInput.inputValue();

        await page.getByRole('button', { name: 'Show Preview', exact: true }).click();
        const livePreview = page.getByLabel('Live site content preview');
        await expect(livePreview).toBeVisible();
        const previewPortrait = livePreview.locator('[data-terminal-portrait="true"] img');
        await expect(previewPortrait).toBeVisible();
        await expect
          .poll(() =>
            previewPortrait.evaluate(img => {
              const el = img as HTMLImageElement;
              return el.complete && el.naturalWidth > 0;
            }),
          )
          .toBe(true);
        await expect(livePreview.locator('form')).toHaveCount(0);
        await page.getByRole('button', { name: 'Mobile', exact: true }).click();
        await expect(page.locator('[data-preview-viewport="mobile"]')).toBeVisible();
        await page.getByRole('button', { name: 'Desktop', exact: true }).click();

        // Privacy 422 rejection on portal-home blocks synthetic phone / postal ZIP without echoing sensitive literals
        await bioInput.fill(`${originalBio} Reach (555) 010-1234 in Marietta, GA 99999.`);
        await page.getByRole('button', { name: 'Save Site Content', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('ERR_CONSTRAINT');
        expect(await page.getByRole('alert').innerText()).not.toContain('(555) 010-1234');

        // Clean save persists across reload, then restore original bio cleanly
        const updatedBio = `${originalBio} Verified CMS round-trip.`;
        try {
          await bioInput.fill(updatedBio);
          await page.getByRole('button', { name: 'Save Site Content', exact: true }).click();
          await expect(page.getByText(/Saved site_content key "portal-home"/i)).toBeVisible();
          await gotoStreamedPage(page, '/cms');
          await page.getByRole('button', { name: /portal-home/i }).click();
          await expect(page.getByLabel('Engineering Bio')).toHaveValue(updatedBio);
        } finally {
          await page.getByLabel('Engineering Bio').fill(originalBio);
          await page.getByRole('button', { name: 'Save Site Content', exact: true }).click();
          await expect(page.getByText(/Saved site_content key "portal-home"/i)).toBeVisible();
        }

        await page.getByRole('button', { name: 'Raw JSON', exact: true }).click();
        await expect(page.getByLabel('Raw Metadata JSON')).toBeVisible();
        await page.getByRole('button', { name: 'Form', exact: true }).click();
        await page.getByRole('button', { name: /portal-contact/i }).click();
        await expect(page.getByText('Contact Form Builder')).toBeVisible();

        // Verify AdminRootShell isolation (no portal /about nav link) and portal-about structured editor + live preview + 422 privacy gate
        await expect(page.locator('header').getByRole('link', { name: 'About' })).toHaveCount(0);
        await page.getByRole('button', { name: /portal-about/i }).click();
        const skillCategoryInput = page.getByLabel('Skill Group 1 Category');
        await expect(skillCategoryInput).toBeVisible();
        const originalCategory = await skillCategoryInput.inputValue();
        await skillCategoryInput.fill('Core Languages');

        await page.getByRole('button', { name: 'Show Preview', exact: true }).click();
        const previewAside = page.getByLabel('Live site content preview');
        await expect(previewAside).toBeVisible();
        await expect(previewAside).toContainText('Core Languages');
        await expect(previewAside).toContainText('andrew@andrew-k.us');
        expect(await previewAside.locator('form').count()).toBe(0);
        expect(await previewAside.locator('iframe').count()).toBe(0);

        await page.getByRole('button', { name: 'Mobile', exact: true }).click();
        await expect(previewAside.locator('[data-preview-viewport="mobile"]')).toBeVisible();
        await page.getByRole('button', { name: 'Desktop', exact: true }).click();

        // Restore category and verify privacy rejection (synthetic phone + ZIP) returns HTTP 422 without saving
        await skillCategoryInput.fill(originalCategory);
        const markdownTextarea = page.getByLabel('Qdrant RAG Corpus Note (Markdown)');
        const originalMarkdown = await markdownTextarea.inputValue();
        await markdownTextarea.fill(
          'Synthetic blocked contact (555) 010-1234 in Marietta, GA 30062',
        );
        await page.getByRole('button', { name: 'Save Site Content' }).click();
        await expect(page.getByRole('alert')).toContainText(/privacy sanitization policy/i);

        // Restore clean note and persist valid save
        await markdownTextarea.fill(originalMarkdown);
        await page.getByRole('button', { name: 'Save Site Content' }).click();
        await expect(page.getByText(/Saved site_content key "portal-about"/i)).toBeVisible();

        // Verify retired maintenance/roadmap controls are removed while Qdrant Re-Index remains intact
        await expect(page.getByRole('tab', { name: 'Site Content', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Terminal', exact: true })).toBeVisible();
        await expect(page.getByRole('switch', { name: /Maintenance Mode/i })).toHaveCount(0);
        await expect(
          page.getByText(/Rebuild Progress|Roadmap Milestones|portal-maintenance/i),
        ).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Re-Index Qdrant Corpus' })).toBeVisible();

        await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
        await expect(page.getByText(/portal-maintenance|Roadmap Milestones/i)).toHaveCount(0);

        await page.getByRole('tab', { name: /Agensi & Presets/i }).click();
        await expect(page.getByRole('heading', { name: /Creator Agensi Cache/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sync Agensi Catalog' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save Agensi Skill' })).toHaveCount(0);
        await expect(page.locator('iframe[sandbox="allow-scripts"]')).toBeVisible();

        // Career Dossiers Studio: paste-import, save draft, publish, privacy 422 gate, cleanup delete
        await page.getByRole('tab', { name: /Career Dossiers/i }).click();
        const dossierStudio = page.getByRole('region', { name: 'Career Dossier Studio' });
        await expect(dossierStudio).toBeVisible();
        const e2eSlug = `e2e-dossier-${Date.now()}`;
        await dossierStudio
          .getByLabel('Markdown paste import')
          .fill(
            `# E2E Cloud Platform\nKind: architecture\nDomain: Cloud Platform\nRole: Principal Architect\nTimeframe: 2025\nSkills: Go, PostgreSQL 19, gRPC\n\nAnonymized platform engineering overview.\n\n## Database Reliability\nReversible Drizzle migrations and atomic locks.\n`,
          );
        await dossierStudio.getByRole('button', { name: 'Parse Markdown into Form' }).click();
        await dossierStudio.getByRole('textbox', { name: 'Slug' }).fill(e2eSlug);
        await expect(dossierStudio.getByTestId('dossier-validation-gate')).toHaveAttribute(
          'data-gate-status',
          'pass',
        );
        await dossierStudio.getByRole('button', { name: 'Save Sanitized Draft' }).click();
        await expect(
          page.getByText(new RegExp(`Saved draft career dossier "${e2eSlug}"`)),
        ).toBeVisible();

        const createdActions = dossierStudio.getByLabel(`Actions for ${e2eSlug}`);
        await expect(createdActions).toBeVisible();
        await createdActions.getByRole('button', { name: 'Publish' }).click();
        await expect(
          page.getByText(new RegExp(`Published career dossier "${e2eSlug}"`)),
        ).toBeVisible();

        // Privacy 422 gate blocks synthetic secret & denylist term without echoing literals
        await dossierStudio
          .locator('textarea[name="summaryBody"]')
          .fill(
            'Blocked SyntheticConfidentialClientX and credential AKIAIOSFODNN7EXAMPLE must never persist.',
          );
        await dossierStudio.getByRole('button', { name: 'Save Sanitized Draft' }).click();
        await expect(page.getByRole('alert')).toContainText('ERR_CONSTRAINT');
        await expect(dossierStudio.getByTestId('dossier-validation-gate')).toHaveAttribute(
          'data-gate-status',
          'fail',
        );
        const visibleBannerText = await page.getByRole('alert').innerText();
        const visibleGateText = await dossierStudio
          .getByTestId('dossier-validation-gate')
          .innerText();
        expect(`${visibleBannerText} ${visibleGateText}`).not.toContain(
          'SyntheticConfidentialClientX',
        );
        expect(`${visibleBannerText} ${visibleGateText}`).not.toContain('AKIAIOSFODNN7EXAMPLE');

        await createdActions.getByRole('button', { name: 'Delete' }).click();
        await expect(
          page.getByText(new RegExp(`Deleted career dossier "${e2eSlug}"`)),
        ).toBeVisible();

        await page.getByRole('link', { name: 'Inbox', exact: true }).click();
        await expect(page).toHaveURL(/\/inbox$/);
        await page.getByLabel('Search Submissions').fill('no-such-submission-99999');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page).toHaveURL(/\/inbox\?q=no-such-submission-99999$/);

        await page.getByRole('link', { name: 'Quotas', exact: true }).click();
        await expect(page).toHaveURL(/\/quotas$/);
        const guestCard = page.locator('form', { hasText: 'Role Policy: guest' });
        const turnsInput = guestCard.getByLabel('Max Turns / Session');
        const originalGuestMaxTurns = await turnsInput.inputValue();
        quotaCleanupState.originalGuestMaxTurns = originalGuestMaxTurns;
        await turnsInput.fill(String(Number(originalGuestMaxTurns || '5') + 1));
        await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();
        await guestCard.getByLabel('Max Turns / Session').fill(originalGuestMaxTurns);
        await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();
        quotaCleanupState.originalGuestMaxTurns = null;

        await page.getByRole('link', { name: 'Ops', exact: true }).click();
        await expect(page).toHaveURL(/\/ops$/);
        const runtimeHealthRegion = page.getByRole('region', {
          name: 'Cloud Run / Docker Runtime Health',
        });
        await expect(runtimeHealthRegion).toBeVisible();
        await expect(page.getByRole('button', { name: /Wake/i })).toHaveCount(0);
        await page.getByRole('button', { name: 'Refresh Health' }).click();
        await expect(runtimeHealthRegion.getByText(/Cloud Run|Docker/i).first()).toBeVisible();

        // Sign out and sign back in via discoverable passkey (blank handle)
        await page.getByRole('button', { name: 'Sign Out' }).click();
        await page.waitForURL(/\/login$/, { waitUntil: 'load' });
        await waitForStreamedReveal(page);
        await page.getByRole('button', { name: 'Sign in with Passkey' }).click();
        await expect(page).toHaveURL(/\/$/);
        await waitForStreamedReveal(page);
        await expect(
          page.getByRole('heading', { name: /Admin Operations Console/i }),
        ).toBeVisible();
        await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      }

      expect(getErrors()).toEqual([]);
    } finally {
      if (quotaCleanupState.originalGuestMaxTurns !== null) {
        try {
          await gotoStreamedPage(page, '/quotas');
          const guestCard = page.locator('form', { hasText: 'Role Policy: guest' });
          await guestCard
            .getByLabel('Max Turns / Session')
            .fill(quotaCleanupState.originalGuestMaxTurns);
          await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        } catch {
          // best-effort cleanup
        }
      }
      if (authenticator) {
        await authenticator.cdp.send('WebAuthn.removeVirtualAuthenticator', {
          authenticatorId: authenticator.authenticatorId,
        });
      }
      await cleanupIsolatedAuthState([handle], rateKeys);
    }
  });

  test('enforces HTTP 429 RATE_LIMITED with Retry-After on repeated invalid password attempts', async ({
    request,
  }, testInfo) => {
    test.skip(!HAS_DATABASE_URL, 'Requires DATABASE_URL for isolated rate-limit verification');

    const projectName = testInfo.project.name;
    const handle = `e2e-rl-${projectName}-${Date.now()}-${randomUUID().slice(0, 6)}`.toLowerCase();
    const testIp = buildIsolatedTestIp(projectName, 6);
    const rateKeys = [
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
    ];

    try {
      for (let i = 0; i < 10; i += 1) {
        const res = await request.post('/api/auth/password/login', {
          headers: { 'x-forwarded-for': testIp },
          data: { handle, password: 'invalid-password' },
        });
        expect(res.status()).toBe(401);
      }

      const throttled = await request.post('/api/auth/password/login', {
        headers: { 'x-forwarded-for': testIp },
        data: { handle, password: 'invalid-password' },
      });
      expect(throttled.status()).toBe(429);
      expect(Number(throttled.headers()['retry-after'])).toBeGreaterThan(0);
      expect(await throttled.json()).toMatchObject({
        statusCode: 429,
        error: 'RATE_LIMITED',
      });
    } finally {
      await cleanupIsolatedAuthState([], rateKeys);
    }
  });

  test('cross-filters visitor analytics, deep-links Contact badge to /inbox Visitor Context strip, and removes PII on inbox delete', async ({
    page,
  }, testInfo) => {
    test.skip(!HAS_DATABASE_URL, 'Requires DATABASE_URL for analytics + inbox verification');

    const getErrors = trackPageErrors(page);
    const projectName = testInfo.project.name;
    const suffix = `${projectName}-${Date.now()}-${randomUUID().slice(0, 6)}`.toLowerCase();
    const handle = `e2e-an-${suffix}`;
    const password = `E2ePass-${randomUUID()}`;
    const testIp = buildIsolatedTestIp(projectName, 8);
    const rateKeys = [
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
    ];

    const humanSessionId = `sess_e2e_human_${suffix}`;
    const botSessionId = `sess_e2e_bot_${suffix}`;
    const adminSessionId = `sess_e2e_admin_${suffix}`;
    const guestSessionId = `guest_e2e_${suffix}`;
    const askAttemptId = randomUUID();
    const contactName = `Ada E2E ${suffix}`;
    const contactEmail = `ada-${suffix}@example.com`;
    const orgName = `E2E Org ${suffix}`;
    const refSource = `linkedin-${suffix}.example`;
    const campaignTag = `camp_${suffix.slice(0, 20)}`;
    const promptExcerpt = `Evaluate distributed Go and GCP experience ${suffix}`;
    let submissionId = '';

    await seedIsolatedAdmin(handle, password);
    const pool = createDbPool();
    try {
      const nowIso = new Date().toISOString();
      await pool.query(
        `INSERT INTO analytics_sessions (
           session_id, app, is_bot, ip_hash, visitor_hash, guest_session_id,
           referrer, referrer_host, referrer_category, landing_path,
           ref_param, utm_source, utm_campaign,
           country, region, city, timezone, asn, asn_org,
           device_type, os_name, browser_name, started_at, last_seen_at
         ) VALUES
           ($1, 'portal', false, $2, $3, $4,
            $5, $6, 'social', '/about',
            $7, 'linkedin', $7,
            'US', 'GA', 'Atlanta', 'America/New_York', 64512, $8,
            'desktop', 'macOS', 'Chrome', $9::timestamptz, $9::timestamptz),
           ($10, 'portal', true, $11, $12, NULL,
            NULL, $6, 'social', '/about',
            NULL, NULL, NULL,
            'US', 'CA', 'Mountain View', 'America/Los_Angeles', 15169, 'Google LLC',
            'bot', 'Linux', 'Googlebot', $9::timestamptz, $9::timestamptz),
           ($13, 'admin', false, $14, $15, NULL,
            NULL, $6, 'direct', '/analytics',
            NULL, NULL, NULL,
            'US', 'GA', 'Atlanta', 'America/New_York', 64512, $8,
            'desktop', 'macOS', 'Chrome', $9::timestamptz, $9::timestamptz)`,
        [
          humanSessionId,
          sha256Hex(`ip:${suffix}`).slice(0, 32),
          sha256Hex(`vis:${suffix}`).slice(0, 32),
          guestSessionId,
          `https://${refSource}/feed/1`,
          refSource,
          campaignTag,
          orgName,
          nowIso,
          botSessionId,
          sha256Hex(`botip:${suffix}`).slice(0, 32),
          sha256Hex(`botvis:${suffix}`).slice(0, 32),
          adminSessionId,
          sha256Hex(`admip:${suffix}`).slice(0, 32),
          sha256Hex(`admvis:${suffix}`).slice(0, 32),
        ],
      );

      // 1 page_view + 4 web_vitals + 1 pane_open + 1 about_outbound_click to prove Top Paths ignores CWV
      await pool.query(
        `INSERT INTO analytics_events (session_id, type, name, path, value, metadata_json, created_at)
         VALUES
           ($1, 'page_view', 'portal_page_view', '/about', NULL, '{"app":"portal","navigation":"ssr"}'::jsonb, $2::timestamptz),
           ($1, 'web_vital', 'LCP', '/about', 1100, '{}'::jsonb, $2::timestamptz),
           ($1, 'web_vital', 'INP', '/about', 45, '{}'::jsonb, $2::timestamptz),
           ($1, 'web_vital', 'CLS', '/about', 0.01, '{}'::jsonb, $2::timestamptz),
           ($1, 'web_vital', 'TTFB', '/about', 90, '{}'::jsonb, $2::timestamptz),
           ($1, 'interaction', 'pane_open', '/about', NULL, '{"surface":"desktop"}'::jsonb, $2::timestamptz),
           ($1, 'interaction', 'about_outbound_click', '/about', NULL, '{"target":"github"}'::jsonb, $2::timestamptz)`,
        [humanSessionId, nowIso],
      );

      await pool.query(
        `INSERT INTO ask_turns (
           attempt_id, session_id, role, mode, prompt_hash, status,
           tokens_reserved, tokens_used, correlation_id, prompt_text,
           created_at, updated_at, lease_expires_at, expires_at
         ) VALUES (
           $1, $2, 'guest', 'jd_match', $3, 'completed',
           420, 420, $4, $5,
           $6::timestamptz, $6::timestamptz, $6::timestamptz + interval '1 minute', $6::timestamptz + interval '15 minutes'
         )`,
        [
          askAttemptId,
          guestSessionId,
          sha256Hex(promptExcerpt),
          `corr-ask-${suffix}`,
          promptExcerpt,
          nowIso,
        ],
      );

      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO contact_submissions (
           name, email, message, analytics_session_id, guest_session_id, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
         RETURNING id::text AS id`,
        [
          contactName,
          contactEmail,
          'Interested in discussing distributed Go and TypeScript systems.',
          humanSessionId,
          guestSessionId,
          nowIso,
        ],
      );
      submissionId = inserted.rows[0]!.id;
    } finally {
      await pool.end();
    }

    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    try {
      const analyticsUrl = `/analytics?window=7d&country=US&source=${encodeURIComponent(refSource)}&identified=true`;
      await gotoStreamedPage(page, analyticsUrl, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/login\?next=/);

      await page.getByLabel('Admin Handle', { exact: true }).fill(handle);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in with Password' }).click();

      const continueBtn = page.getByRole('button', { name: 'Continue to Console' });
      await expect(continueBtn).toBeVisible();
      await continueBtn.click();

      await expect(page).toHaveURL(
        new RegExp(`/analytics\\?.*source=${refSource.replaceAll('.', '\\.')}`),
      );
      await waitForStreamedReveal(page);

      // Top Paths reports 1 view for /about (not 5 inflated by 4 CWV samples)
      const topPathsSection = page.locator('section', { hasText: 'Top Paths' }).first();
      await expect(topPathsSection).toBeVisible();
      const aboutRow = topPathsSection.locator('tbody tr', { hasText: '/about' }).first();
      await expect(aboutRow.locator('td').nth(1)).toHaveText('1');
      await expect(aboutRow.locator('td').nth(2)).toHaveText('1');

      // Recent Visitors shows location, ASN org, expandable trail, and Contact Name badge
      const recentVisitors = page.getByTestId('analytics-recent-visitors');
      await expect(recentVisitors).toContainText('Atlanta, GA, US');
      await expect(recentVisitors).toContainText(orgName);
      await recentVisitors.locator('summary').first().click();
      await expect(recentVisitors).toContainText('about_outbound_click');

      // Visitor Q&A / JD Match feed renders durable redacted excerpt
      const askFeed = page.getByTestId('analytics-ask-feed');
      await expect(askFeed).toContainText('JD Match');
      await expect(askFeed).toContainText(promptExcerpt);

      // Click Contact Name badge -> deep-link /inbox?selected=<uuid> with compact Visitor Context strip
      const contactBadge = page.getByTestId(`visitor-contact-link-${submissionId}`);
      await expect(contactBadge).toBeVisible();
      await contactBadge.click();

      await expect(page).toHaveURL(new RegExp(`/inbox\\?selected=${submissionId}$`));
      await waitForStreamedReveal(page);
      const detail = page.getByRole('article', { name: 'Selected submission detail' });
      await expect(detail).toContainText(contactName);

      const visitorContext = page.getByTestId('inbox-visitor-context');
      await expect(visitorContext).toContainText('Atlanta, GA, US');
      await expect(visitorContext).toContainText(orgName);
      await expect(visitorContext).toContainText(refSource);
      await expect(visitorContext).toContainText(campaignTag);
      await expect(visitorContext).toContainText('/about');
      await expect(visitorContext).toContainText(promptExcerpt);

      // Delete the submission in /inbox and verify PII disappears immediately from /analytics while anonymous session persists
      await page.getByRole('button', { name: 'Delete Submission' }).click();
      await page.getByRole('button', { name: 'Confirm Delete' }).click();
      await expect(page.getByText(/Contact submission deleted from PostgreSQL 19/i)).toBeVisible();

      await gotoStreamedPage(
        page,
        `/analytics?window=7d&country=US&source=${encodeURIComponent(refSource)}`,
        { waitUntil: 'networkidle' },
      );
      await waitForStreamedReveal(page);
      const bodyAfterDelete = await page.locator('body').innerText();
      expect(bodyAfterDelete).not.toContain(contactName);
      expect(bodyAfterDelete).not.toContain(contactEmail);
      await expect(page.getByTestId('analytics-recent-visitors')).toContainText(orgName);

      expect(getErrors()).toEqual([]);
    } finally {
      const cleanupPool = createDbPool();
      try {
        if (submissionId) {
          await cleanupPool.query('DELETE FROM contact_submissions WHERE id = $1::uuid', [
            submissionId,
          ]);
        }
        await cleanupPool.query('DELETE FROM ask_turns WHERE attempt_id = $1', [askAttemptId]);
        await cleanupPool.query(
          'DELETE FROM analytics_sessions WHERE session_id = ANY($1::text[])',
          [[humanSessionId, botSessionId, adminSessionId]],
        );
      } finally {
        await cleanupPool.end();
      }
      await cleanupIsolatedAuthState([handle], rateKeys);
    }
  });
});
