import { expect, test } from '@playwright/test';

test('portal renders tty1 greeter and hides admin items from guest menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Solar Forge Agentic Terminal/i })).toBeVisible();
  await page.getByRole('link', { name: /Enter as Guest/i }).click();
  await expect(page.getByRole('heading', { name: /Launch Menu/i })).toBeVisible();
  await expect(page.getByText(/cadence-admin/i)).toHaveCount(0);
});
