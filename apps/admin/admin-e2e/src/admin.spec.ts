import { assertSsrHealthz, trackPageErrors } from '@aklapper/shared-utils/playwright';
import { expect, test } from '@playwright/test';

test.describe('admin SSR end-to-end journeys', () => {
  test('serves healthy Fastify SSR /healthz endpoint', async ({ request }) => {
    await assertSsrHealthz(request, 'admin-ssr');
  });

  test('renders isolated passkey gate and navigates to /analytics telemetry view', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/admin\.andrew-k\.us \/\/ Solar Forge Ops/i);
    await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
    await expect(page.getByText(/Passkey Auth Required/i)).toBeVisible();

    await page.getByRole('link', { name: /Open Telemetry View/i }).click();
    await expect(page).toHaveURL(/\/analytics$/);
    await expect(page.getByText(/First-Party Visitor Analytics \/\/ Postgres 19/i)).toBeVisible();
    await expect(page.getByText(/node-api-analytics/i)).toBeVisible();

    await page.getByRole('link', { name: /admin\.andrew-k\.us :: cadence-admin/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();

    expect(getErrors()).toEqual([]);
  });
});
