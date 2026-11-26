import { randomUUID } from 'node:crypto';

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
});
