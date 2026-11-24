import { createHash, createHmac, randomUUID } from 'node:crypto';

import { createDb, createDbPool, seedAdminUserFromEnv } from '@aklapper/db';
import { assertSsrHealthz, trackPageErrors } from '@aklapper/tooling/playwright';
import { type CDPSession, expect, type Page, test } from '@playwright/test';

const HAS_DATABASE_URL = Boolean(process.env['DATABASE_URL']?.trim());
const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PROJECT_IP_OCTET: Readonly<Record<string, number>> = {
  chromium: 10,
  firefox: 20,
  webkit: 30,
  'mobile-chrome': 40,
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

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

function buildIsolatedTestIp(projectName: string, offset: number): string {
  const base = PROJECT_IP_OCTET[projectName] ?? 50;
  return `198.51.100.${base + offset}`;
}

async function seedIsolatedAdmin(handle: string, password: string): Promise<void> {
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedAdminUserFromEnv(db, {
      ADMIN_HANDLE: handle,
      ADMIN_PASSWORD: password,
    });
  } finally {
    await pool.end();
  }
}

async function cleanupIsolatedAuthState(handles: string[], scopeKeys: string[]): Promise<void> {
  if (!HAS_DATABASE_URL) return;
  const pool = createDbPool();
  try {
    if (handles.length > 0) {
      await pool.query('DELETE FROM users WHERE handle = ANY($1::text[])', [handles]);
    }
    if (scopeKeys.length > 0) {
      await pool.query('DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[])', [
        scopeKeys,
      ]);
    }
  } finally {
    await pool.end();
  }
}

async function attachVirtualAuthenticator(page: Page): Promise<{
  cdp: CDPSession;
  authenticatorId: string;
}> {
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
  return { cdp, authenticatorId };
}

test.describe('admin SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'admin-ssr');
  });

  test('guards protected pages, renders unified login UI without bootstrap tab, and rejects unauthenticated registration', async ({
    page,
    request,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.goto('/');
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
    let maintenanceToggledOn = false;
    let originalGuestMaxTurns: string | null = null;

    await seedIsolatedAdmin(handle, password);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    try {
      if (isChromiumDesktop) {
        authenticator = await attachVirtualAuthenticator(page);
      }

      // 1. Navigating to /analytics while logged out redirects to /login?next=%2Fanalytics
      await page.goto('/analytics');
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
      await expect(page.getByText(/First-Party Visitor Analytics \/\/ Postgres 19/i)).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      await expect(page.getByText('Passkey Verified')).toBeVisible();

      // 5. Navigate to Overview and test Security Settings Drawer (TOTP QR SVG + verification)
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();

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
      await page.waitForURL(/\/login$/, { waitUntil: 'load' });

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
        const maintSwitch = page.getByRole('switch', { name: 'Maintenance Mode' });
        await expect(maintSwitch).toBeVisible();
        if ((await maintSwitch.getAttribute('aria-checked')) !== 'true') {
          await maintSwitch.click();
          maintenanceToggledOn = true;
          await expect(page.getByText(/Maintenance mode is now ON/i)).toBeVisible();
          await page.reload();
          await expect(page.getByRole('switch', { name: 'Maintenance Mode' })).toHaveAttribute(
            'aria-checked',
            'true',
          );
          await page.getByRole('switch', { name: 'Maintenance Mode' }).click();
          await expect(page.getByText(/Maintenance mode is now OFF/i)).toBeVisible();
          maintenanceToggledOn = false;
        }

        await page.getByRole('tab', { name: /Agensi & Presets/i }).click();
        await expect(page.locator('iframe[sandbox="allow-scripts"]')).toBeVisible();

        await page.getByRole('link', { name: 'Inbox', exact: true }).click();
        await expect(page).toHaveURL(/\/inbox$/);
        await page.getByLabel('Search Submissions').fill('no-such-submission-99999');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page).toHaveURL(/\/inbox\?q=no-such-submission-99999$/);

        await page.getByRole('link', { name: 'Quotas', exact: true }).click();
        await expect(page).toHaveURL(/\/quotas$/);
        const guestCard = page.locator('form', { hasText: 'Role Policy: guest' });
        const turnsInput = guestCard.getByLabel('Max Turns / Session');
        originalGuestMaxTurns = await turnsInput.inputValue();
        await turnsInput.fill(String(Number(originalGuestMaxTurns || '5') + 1));
        await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();
        await guestCard.getByLabel('Max Turns / Session').fill(originalGuestMaxTurns);
        await guestCard.getByRole('button', { name: 'Save guest Policy' }).click();
        await expect(page.getByText(/Updated guest quota policy/i)).toBeVisible();
        originalGuestMaxTurns = null;

        await page.getByRole('link', { name: 'Ops', exact: true }).click();
        await expect(page).toHaveURL(/\/ops$/);
        await page.getByRole('button', { name: 'Wake cadence-admin' }).click();
        await expect(
          page.getByText(
            /Simulated wake queued for cadence-admin|Wake signal delivered to cadence-admin/i,
          ),
        ).toBeVisible();

        // Sign out and sign back in via discoverable passkey (blank handle)
        await page.getByRole('button', { name: 'Sign Out' }).click();
        await page.waitForURL(/\/login$/, { waitUntil: 'load' });
        await page.getByRole('button', { name: 'Sign in with Passkey' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(
          page.getByRole('heading', { name: /Admin Operations Console/i }),
        ).toBeVisible();
        await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      }

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
