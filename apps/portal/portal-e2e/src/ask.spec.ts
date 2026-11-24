import {
  gotoStreamedPage,
  reloadStreamedPage,
  trackPageErrors,
} from '@aklapper/tooling/playwright';
import { expect, type Page, test } from '@playwright/test';

import { startIsolatedPortalWithoutAsk } from './ask-harness.ts';

const IS_MAINTENANCE_MODE = process.env['PORTAL_MAINTENANCE_MODE'] === 'true';
const IS_LIVE_DEPLOYMENT = Boolean(process.env['PORTAL_BASE_URL']?.trim());

async function waitForAskHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId('ask-workspace')).toHaveAttribute('data-hydrated', 'true');
}

test.describe('/ask end-to-end AI Q&A, JD Match, abstention, failure, quota, and recovery', () => {
  test('executes grounded Q&A, semantic abstention, and structured AI JD Match with telemetry', async ({
    page,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Ask Portfolio route is gated in maintenance mode');
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/ask');
    await waitForAskHydrated(page);
    await expect(page.getByTestId('ask-quota-meter')).toBeVisible();

    // Grounded starter Q&A via live Go ai-ask (never fallback provider)
    await page.getByTestId('ask-starter-0').click();
    await page.getByTestId('ask-qa-submit').click();
    await expect(page.getByTestId('ask-qa-transcript')).toBeVisible();
    const firstEntry = page.getByTestId('ask-qa-entry').first();
    await expect(firstEntry.locator('[data-grounded="true"]')).toBeVisible();
    await expect(firstEntry.getByTestId('ask-telemetry-line')).toContainText('local-llama-swap');
    await expect(firstEntry.getByTestId('ask-telemetry-line')).toContainText('gemma-4');
    expect(await firstEntry.innerText()).not.toContain('pg19-local-corpus');

    // Low semantic similarity triggers strict HTTP 200 abstention with zero citations
    await page
      .getByTestId('ask-question-input')
      .fill('xylophone underwater flamingo recipe quantum soup?');
    await page.getByTestId('ask-qa-submit').click();
    await expect(page.getByTestId('ask-qa-entry')).toHaveCount(2);
    const abstainedEntry = page.getByTestId('ask-qa-entry').first();
    await expect(abstainedEntry.locator('[data-grounded="false"]')).toBeVisible();
    await expect(abstainedEntry.locator('ul')).toHaveCount(0);

    // Structured AI JD Match evaluation (synonyms without static keywords) + telemetry strip
    await page.getByTestId('ask-tab-jd').click();
    await page
      .getByTestId('ask-jd-textarea')
      .fill(
        'Staff Platform Engineer focused on cloud-native service mesh, relational transactional persistence, streaming browser SSR, and semantic document retrieval.',
      );
    await page.getByTestId('ask-jd-submit').click();
    const jdResult = page.getByTestId('ask-jd-result');
    await expect(jdResult).toBeVisible();
    await expect(jdResult.getByText(/Grounded Match Score/i)).toBeVisible();
    await expect(jdResult.getByText(/Verified Strengths/i)).toBeVisible();
    await expect(jdResult.getByText(/Gaps \/ Unverified/i)).toBeVisible();
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('local-llama-swap');
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('gemma-4');
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('tokens: 320');
    expect(await page.locator('body').innerText()).not.toContain('pg19-local-corpus');

    expect(getErrors()).toEqual([]);
  });

  test('recovers an active delayed turn across page reload via /api/ask/turns/:attemptId without double-billing', async ({
    browser,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Ask Portfolio route is gated in maintenance mode');
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Cold-start delayed turn recovery test relies on mock upstream delay timing',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/ask');
      await waitForAskHydrated(page);
      await page
        .getByTestId('ask-question-input')
        .fill('Explain delayed cold-start recovery architecture across SSR and Go workers?');

      let askPostCount = 0;
      page.on('request', req => {
        if (req.url().includes('/ask') && req.method() === 'POST') {
          askPostCount += 1;
        }
      });

      const postRequestPromise = page.waitForRequest(
        req => req.url().includes('/ask') && req.method() === 'POST',
      );
      await page.getByTestId('ask-qa-submit').click();
      await postRequestPromise;

      // Wait briefly so PG19 turn reservation commits before closing browser request on reload
      await page.waitForTimeout(450);
      await reloadStreamedPage(page);
      await waitForAskHydrated(page);

      await expect(
        page.getByTestId('ask-turn-pending').or(page.getByTestId('ask-qa-transcript')),
      ).toBeVisible();
      await expect(page.getByTestId('ask-qa-transcript')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('ask-turn-pending')).toHaveCount(0);
      await expect(page.getByTestId('ask-quota-meter')).toContainText('1/5 turns');
      expect(askPostCount).toBe(1);
      expect(await page.locator('body').innerText()).not.toContain('pg19-local-corpus');
      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('fails closed with HTTP 503 error banner when AI_ASK_URL points to an unreachable port', async ({
    browser,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Ask Portfolio route is gated in maintenance mode');
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Unreachable upstream port isolation runs only against local managed E2E environment',
    );

    const isolatedPortal = await startIsolatedPortalWithoutAsk();
    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await page.goto(`${isolatedPortal.baseUrl}/ask`, { waitUntil: 'load' });
      await page.waitForFunction(
        () => document.querySelectorAll('div[hidden][id^="S:"]').length === 0,
      );
      await waitForAskHydrated(page);
      await expect(page.getByText(/offline · upstream unreachable/i)).toBeVisible();

      const responsePromise = page.waitForResponse(
        res => res.url().includes('/ask') && res.request().method() === 'POST',
      );
      await page.getByTestId('ask-starter-0').click();
      await page.getByTestId('ask-qa-submit').click();

      const res = await responsePromise;
      expect(res.status()).toBe(503);

      const banner = page.getByTestId('ask-error-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toHaveAttribute('role', 'alert');
      await expect(banner).toContainText('ERR_UPSTREAM_UNAVAILABLE');
      expect(await page.locator('body').innerText()).not.toContain('pg19-local-corpus');
      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
      await isolatedPortal.close();
    }
  });

  test('enforces 5-turn guest session quota and displays 429 error banner on 6th turn', async ({
    browser,
  }) => {
    test.skip(IS_MAINTENANCE_MODE, 'Ask Portfolio route is gated in maintenance mode');
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Quota exhaustion check is guarded off live production deployments',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/ask');
      await waitForAskHydrated(page);
      for (let turn = 1; turn <= 5; turn += 1) {
        await page
          .getByTestId('ask-question-input')
          .fill(`Quota verification question number ${turn} about Cloud Run SSR architecture?`);
        await page.getByTestId('ask-qa-submit').click();
        await expect(page.getByTestId('ask-qa-entry')).toHaveCount(turn);
      }
      await expect(page.getByTestId('ask-quota-meter')).toContainText('5/5 turns');

      await page
        .getByTestId('ask-question-input')
        .fill('Sixth portfolio question that exceeds guest session turn cap.');
      await page.getByTestId('ask-qa-submit').click();

      const banner = page.getByTestId('ask-error-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toHaveAttribute('role', 'alert');
      await expect(banner).toContainText('ERR_RATE_LIMITED');
      expect(await page.locator('body').innerText()).not.toContain('pg19-local-corpus');
      expect(getErrors()).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
