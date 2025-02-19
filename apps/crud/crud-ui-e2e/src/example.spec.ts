import { test, expect } from '@playwright/test';

const homeTitleText = 'Media Data Manager';

test.describe('Crud-UI e2e Test', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');
    const titleText = await page.getByTestId('home-page-title').textContent();

    expect(titleText).toMatch(homeTitleText);
  });
});
