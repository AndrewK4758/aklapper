import { createHmac } from 'node:crypto';

import { assertSsrHealthz, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const E2E_BOOTSTRAP_TOKEN =
  process.env['ADMIN_BOOTSTRAP_TOKEN'] || 'e2e-bootstrap-token-local-only';

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSixDigitTotp(base32Secret: string): string {
  const normalized = base32Secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let acc = 0;
  let bits = 0;
  const keyBytes: number[] = [];
  for (const ch of normalized) {
    acc = (acc << 5) | RFC4648_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      keyBytes.push((acc >>> bits) & 0xff);
    }
  }
  const step = Math.floor(Date.now() / 30_000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', Buffer.from(keyBytes)).update(msg).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binCode =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binCode % 1_000_000).padStart(6, '0');
}

test.describe('admin SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'admin-ssr');
  });

  test('guards protected pages with /login redirects and returns HTTP 401 on protected resource routes', async ({
    page,
    request,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toHaveCount(0);

    for (const protectedPath of ['/analytics', '/cms', '/inbox', '/quotas', '/ops']) {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(protectedPath)}$`),
      );
      await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    }

    const attachmentRes = await request.get(
      '/inbox/11111111-1111-4111-8111-111111111111/attachment',
    );
    expect(attachmentRes.status()).toBe(401);

    const sseRes = await request.get('/api/ops/cluster/stream');
    expect(sseRes.status()).toBe(401);

    expect(getErrors()).toEqual([]);
  });

  test('completes WebAuthn auth, Security Settings TOTP flow, and all 6 Admin Operations Console sections', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'WebAuthn virtual authenticator requires Chromium CDP');

    const getErrors = trackPageErrors(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    const handle = `e2e-admin-${Date.now()}`;
    let maintenanceToggledOn = false;
    let originalGuestMaxTurns: string | null = null;

    try {
      // 1. Navigating to /analytics while logged out redirects to /login?next=%2Fanalytics
      await page.goto('/analytics');
      await expect(page).toHaveURL(/\/login\?next=%2Fanalytics$/);

      // 2. Register bootstrap passkey via Chromium virtual authenticator
      await page.getByRole('tab', { name: 'Bootstrap Passkey' }).click();
      const bootstrapPanel = page.getByRole('tabpanel', { name: 'Bootstrap Passkey' });
      await bootstrapPanel.getByLabel('Admin Handle').fill(handle);
      await bootstrapPanel.getByLabel('Bootstrap Token').fill(E2E_BOOTSTRAP_TOKEN);
      await bootstrapPanel.getByRole('button', { name: 'Register Bootstrap Passkey' }).click();

      // 3. Lands on /analytics with verified session & full nav
      await expect(page).toHaveURL(/\/analytics$/);
      await expect(page.getByText(/First-Party Visitor Analytics \/\/ Postgres 19/i)).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      await expect(page.getByText('Passkey Verified')).toBeVisible();

      // Switch analytics date windows and verify CWV cards
      await page.getByRole('link', { name: '24h' }).click();
      await expect(page).toHaveURL(/\/analytics\?window=24h$/);
      await expect(page.getByText('LCP', { exact: true })).toBeVisible();
      await expect(page.getByText('INP', { exact: true })).toBeVisible();
      await expect(page.getByText('CLS', { exact: true })).toBeVisible();
      await expect(page.getByText('TTFB', { exact: true })).toBeVisible();

      // 4. Navigate to / Overview Hub and test Security Settings Drawer (TOTP enroll -> verify -> disable)
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
      await expect(page.getByText('PostgreSQL 19', { exact: true })).toBeVisible();
      await expect(page.getByText('Daily Global AI Token Utilization')).toBeVisible();

      await page.getByRole('button', { name: 'Security Settings' }).click();
      await expect(
        page.getByRole('heading', { name: /Passkey & TOTP Security Settings/i }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Enroll TOTP 2FA' }).click();
      const secretEl = page.getByTestId('totp-secret');
      await expect(secretEl).toBeVisible();
      await expect(page.getByTestId('totp-uri')).toContainText('otpauth://totp/');

      const secret = (await secretEl.innerText()).trim();
      const totpCode = generateSixDigitTotp(secret);
      await page.getByLabel('6-Digit Verification Code').fill(totpCode);
      await page.getByRole('button', { name: 'Verify & Enable TOTP' }).click();
      await expect(page.getByText(/TOTP 2FA verified and enabled/i)).toBeVisible();

      // Disable TOTP cleanly so passkey-only re-login flow below works cleanly
      await page.getByRole('button', { name: 'Disable TOTP 2FA' }).click();
      await expect(page.getByText(/TOTP 2FA disabled/i)).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();

      // 5. Navigate to /cms -> test live Maintenance Mode Switch (ON -> reload -> OFF) + Presets preview
      await page.getByRole('link', { name: 'CMS', exact: true }).click();
      await expect(page).toHaveURL(/\/cms$/);
      const maintSwitch = page.getByRole('switch', { name: 'Maintenance Mode' });
      await expect(maintSwitch).toBeVisible();
      const initiallyChecked = (await maintSwitch.getAttribute('aria-checked')) === 'true';
      if (!initiallyChecked) {
        await maintSwitch.click();
        maintenanceToggledOn = true;
        await expect(page.getByText(/Maintenance mode is now ON/i)).toBeVisible();
        await page.reload();
        await expect(page.getByRole('switch', { name: 'Maintenance Mode' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        // Restore Portal Live immediately
        await page.getByRole('switch', { name: 'Maintenance Mode' }).click();
        await expect(page.getByText(/Maintenance mode is now OFF/i)).toBeVisible();
        maintenanceToggledOn = false;
      }

      // Inspect Agensi & Presets tab with SandboxedArtifactFrame
      await page.getByRole('tab', { name: /Agensi & Presets/i }).click();
      const presetFrame = page.locator('iframe[sandbox="allow-scripts"]');
      await expect(presetFrame).toBeVisible();

      // 6. Navigate to /inbox -> test search filter and authenticated attachment header contract if present
      await page.getByRole('link', { name: 'Inbox', exact: true }).click();
      await expect(page).toHaveURL(/\/inbox$/);
      await expect(page.getByText(/Contact Submissions Inbox/i)).toBeVisible();

      const downloadLinks = page.locator('a[href^="/inbox/"][href$="/attachment"]');
      if ((await downloadLinks.count()) > 0) {
        const href = await downloadLinks.first().getAttribute('href');
        if (href) {
          const dlRes = await page.request.get(href);
          expect(dlRes.status()).toBe(200);
          expect(dlRes.headers()['content-disposition']).toMatch(/^attachment; filename=/);
          expect(dlRes.headers()['x-content-type-options']).toBe('nosniff');
        }
      }

      await page.getByLabel('Search Submissions').fill('no-such-submission-99999');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page).toHaveURL(/\/inbox\?q=no-such-submission-99999$/);
      await expect(page.getByText(/No contact submissions match this filter/i)).toBeVisible();

      // 7. Navigate to /quotas -> update guest policy and restore original value
      await page.getByRole('link', { name: 'Quotas', exact: true }).click();
      await expect(page).toHaveURL(/\/quotas$/);
      const guestCard = page.locator('form', { hasText: 'Role Policy: guest' });
      const turnsInput = guestCard.getByLabel('Max Turns / Session');
      originalGuestMaxTurns = await turnsInput.inputValue();
      const bumpedTurns = String(Number(originalGuestMaxTurns || '5') + 1);
      await turnsInput.fill(bumpedTurns);
      await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
      await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();

      // Restore original guest max turns
      await guestCard.getByLabel('Max Turns / Session').fill(originalGuestMaxTurns);
      await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
      await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();
      originalGuestMaxTurns = null;

      // 8. Navigate to /ops -> verify dual-namespace SSE watcher and manual wake action
      await page.getByRole('link', { name: 'Ops', exact: true }).click();
      await expect(page).toHaveURL(/\/ops$/);
      await expect(
        page.getByRole('heading', { name: 'Namespace: portfolio-public' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Namespace: cadence-admin' })).toBeVisible();
      await page.getByRole('button', { name: 'Wake cadence-admin' }).click();
      await expect(
        page.getByText(
          /Simulated wake queued for cadence-admin|Wake signal delivered to cadence-admin/i,
        ),
      ).toBeVisible();

      // 9. Sign Out revokes session and re-engages the route guard
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await expect(page).toHaveURL(/\/login$/);

      await page.goto('/');
      await expect(page).toHaveURL(/\/login$/);

      // 10. Sign back in with the registered passkey
      const signInPanel = page.getByRole('tabpanel', { name: 'Passkey Sign In' });
      await signInPanel.getByLabel('Admin Handle').fill(handle);
      await signInPanel.getByRole('button', { name: 'Sign in with Passkey' }).click();

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();

      expect(getErrors()).toEqual([]);
    } finally {
      if (maintenanceToggledOn) {
        try {
          await page.goto('/cms');
          const sw = page.getByRole('switch', { name: 'Maintenance Mode' });
          if ((await sw.getAttribute('aria-checked')) === 'true') {
            await sw.click();
          }
        } catch {
          // best-effort cleanup
        }
      }
      if (originalGuestMaxTurns !== null) {
        try {
          await page.goto('/quotas');
          const guestCard = page.locator('form', { hasText: 'Role Policy: guest' });
          await guestCard.getByLabel('Max Turns / Session').fill(originalGuestMaxTurns);
          await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        } catch {
          // best-effort cleanup
        }
      }
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    }
  });
});
