import { assertSsrHealthz, trackPageErrors } from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

const E2E_BOOTSTRAP_TOKEN =
  process.env['ADMIN_BOOTSTRAP_TOKEN'] || 'e2e-bootstrap-token-local-only';

test.describe('admin SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'admin-ssr');
  });

  test('redirects unauthenticated requests for / and /analytics to /login', async ({ page }) => {
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toHaveCount(0);

    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics$/);
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('completes full WebAuthn bootstrap registration, protected navigation, sign-out, and passkey sign-in', async ({
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

    try {
      // 1. Navigating to /analytics while logged out redirects to /login?next=%2Fanalytics
      await page.goto('/analytics');
      await expect(page).toHaveURL(/\/login\?next=%2Fanalytics$/);

      // 2. Register bootstrap passkey via Chromium virtual authenticator
      await page.getByRole('tab', { name: 'Bootstrap Passkey' }).click();
      const handleInput = page.getByLabel('Admin Handle');
      await handleInput.fill(handle);
      await page.getByLabel('Bootstrap Token').fill(E2E_BOOTSTRAP_TOKEN);
      await page.getByRole('button', { name: 'Register Bootstrap Passkey' }).click();

      // 3. Lands on protected /analytics view with verified session
      await expect(page).toHaveURL(/\/analytics$/);
      await expect(page.getByText(/First-Party Visitor Analytics \/\/ Postgres 19/i)).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();
      await expect(page.getByText('Passkey Verified')).toBeVisible();

      // 4. Navigates to / Admin Operations Console
      await page.getByRole('link', { name: /admin\.andrew-k\.us :: cadence-admin/i }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();

      // 5. Sign Out revokes session and re-engages the route guard
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await expect(page).toHaveURL(/\/login$/);

      await page.goto('/');
      await expect(page).toHaveURL(/\/login$/);

      // 6. Sign back in with the registered passkey
      await page.getByLabel('Admin Handle').fill(handle);
      await page.getByRole('button', { name: 'Sign in with Passkey' }).click();

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
      await expect(page.getByText(`${handle}@admin`)).toBeVisible();

      expect(getErrors()).toEqual([]);
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    }
  });
});
