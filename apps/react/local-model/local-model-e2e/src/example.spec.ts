import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  expect(await page.locator('h1').innerText()).toContain('AI Chatbot w/ RAG, Web Search, and History');
});
