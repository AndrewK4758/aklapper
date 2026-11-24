import { assertSsrHealthz, trackPageErrors } from '@aklapper/shared-utils/playwright';
import { expect, test } from '@playwright/test';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';

test.describe('portal SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'portal-ssr');
  });

  test('renders tty1 greeter, runs zsh terminal commands, and hides admin items on /menu', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Full greeter and menu routes are gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/andrew-k\.us \/\/ Solar Forge Terminal/i);
    await expect(
      page.getByRole('heading', { name: /Solar Forge Agentic Terminal/i }),
    ).toBeVisible();

    const commandInput = page.getByLabel('Zsh command input');
    await expect(commandInput).toBeVisible();

    await commandInput.fill('whoami');
    await commandInput.press('Enter');
    await expect(page.getByText('guest@andrew-k.us (tty1)')).toBeVisible();

    await commandInput.fill('invalid-cmd');
    await commandInput.press('Enter');
    await expect(page.getByText(/zsh: command not found: invalid-cmd/i)).toBeVisible();

    await page.getByRole('link', { name: /Enter as Guest/i }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole('heading', { name: /Launch Menu/i })).toBeVisible();
    await expect(page.getByText(/CADENCE Builder/i)).toBeVisible();
    await expect(page.getByText(/cadence-admin/i)).toHaveCount(0);

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

    const commandInput = page.getByLabel('Zsh command input');
    await commandInput.fill('stack');
    await commandInput.press('Enter');
    await expect(page.getByText(/Cloud Run \(edge SSR\)/i)).toBeVisible();

    expect(getErrors()).toEqual([]);
  });
});
