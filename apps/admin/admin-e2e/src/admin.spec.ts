import { expect, test } from '@playwright/test';

test('admin console renders isolated passkey gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Admin Operations Console/i })).toBeVisible();
  await expect(page.getByText(/Passkey Auth Required/i)).toBeVisible();
});
