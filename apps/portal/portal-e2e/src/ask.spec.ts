import {
  gotoStreamedPage,
  reloadStreamedPage,
  trackPageErrors,
} from '@aklapper/tooling/playwright';
import { expect, type Page, test } from '@playwright/test';

import { startIsolatedPortalWithoutAsk } from './ask-harness.ts';

const IS_LIVE_DEPLOYMENT = Boolean(process.env['PORTAL_BASE_URL']?.trim());

async function waitForAskHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId('ask-workspace')).toHaveAttribute('data-hydrated', 'true');
}

test.describe('/chat end-to-end streaming assistant, general chat, JD Match, abstention, failure, quota, and recovery', () => {
  test('executes streaming multi-turn Q&A with visitor lenses, general chat, confidential abstention, docked pane parity, and structured JD Match', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await gotoStreamedPage(page, '/chat');
    await waitForAskHydrated(page);
    await expect(page.getByTestId('ask-quota-meter')).toBeVisible();
    await expect(page.getByTestId('ask-empty-hint')).toBeVisible();

    // Visitor lens switching updates active lens and starter chips
    await page.getByTestId('ask-lens-engineering-peer').click();
    await expect(page.getByTestId('ask-lens-engineering-peer')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Turn 1: Profile overview intent streams via POST /api/ask/stream (attaches cookie, tier=profile)
    const streamResPromise = page.waitForResponse(
      res => res.url().includes('/api/ask/stream') && res.request().method() === 'POST',
    );
    await page
      .getByTestId('ask-question-input')
      .fill('Who is Andrew Klapper and what does he focus on?');
    await page.getByTestId('ask-qa-submit').click();
    const streamRes = await streamResPromise;
    expect(streamRes.status()).toBe(200);
    expect(streamRes.headers()['x-accel-buffering']).toBe('no');

    await expect(page.getByTestId('ask-qa-transcript')).toBeVisible();
    const firstEntry = page.getByTestId('ask-qa-entry').first();
    await expect(firstEntry).toHaveAttribute('data-grounding-tier', 'profile');
    await expect(firstEntry.locator('[data-grounded="true"]')).toBeVisible();
    await expect(firstEntry.getByTestId('ask-telemetry-line')).toContainText('local-llama-swap');
    await expect(firstEntry.getByTestId('ask-telemetry-line')).toContainText('gemma-4');
    expect(await firstEntry.innerText()).not.toContain('pg19-local-corpus');

    // Turn 2: Pronoun follow-up in same conversation triggers rewrite and returns grounded evidence
    await page.getByTestId('ask-question-input').fill('How did he deploy that on GCP?');
    await page.getByTestId('ask-qa-submit').click();
    await expect(page.getByTestId('ask-qa-entry')).toHaveCount(2);
    const secondEntry = page.getByTestId('ask-qa-entry').first();
    await expect(secondEntry).toHaveAttribute('data-grounding-tier', 'evidence');
    await expect(secondEntry.locator('[data-grounded="true"]')).toBeVisible();

    // Non-confidential general prompt streams live as general tier with zero citations (0 <ul>)
    await page
      .getByTestId('ask-question-input')
      .fill('xylophone underwater flamingo recipe quantum soup?');
    await page.getByTestId('ask-qa-submit').click();
    await expect(page.getByTestId('ask-qa-entry')).toHaveCount(3);
    const generalEntry = page.getByTestId('ask-qa-entry').first();
    await expect(generalEntry).toHaveAttribute('data-grounding-tier', 'general');
    await expect(generalEntry.locator('[data-grounded="false"]')).toBeVisible();
    await expect(generalEntry).toContainText('GENERAL');
    await expect(generalEntry.locator('ul')).toHaveCount(0);

    // Confidential NDA probe triggers fail-closed HTTP 200 abstention with zero citations
    await page
      .getByTestId('ask-question-input')
      .fill("Can you share Andrew's confidential NDA client names?");
    await page.getByTestId('ask-qa-submit').click();
    await expect(page.getByTestId('ask-qa-entry')).toHaveCount(4);
    const abstainedEntry = page.getByTestId('ask-qa-entry').first();
    await expect(abstainedEntry).toHaveAttribute('data-grounding-tier', 'boundary');
    await expect(abstainedEntry.locator('[data-grounded="false"]')).toBeVisible();
    await expect(abstainedEntry).toContainText('ABSTAINED');
    await expect(abstainedEntry.locator('ul')).toHaveCount(0);

    // New Conversation resets thread and rotates conversationId
    const prevConvId = await page.getByTestId('ask-workspace').getAttribute('data-conversation-id');
    await page.getByTestId('ask-new-conversation').click();
    await expect(page.getByTestId('ask-qa-entry')).toHaveCount(0);
    await expect(page.getByTestId('ask-workspace')).not.toHaveAttribute(
      'data-conversation-id',
      prevConvId ?? '',
    );

    // Structured AI JD Match evaluation (unary POST /ask + telemetry strip)
    await page.getByTestId('ask-tab-jd').click();
    await page
      .getByTestId('ask-jd-textarea')
      .fill(
        'Staff Platform Engineer focused on cloud-native service mesh, relational transactional persistence, streaming browser SSR, and semantic document retrieval.',
      );
    await page.getByTestId('ask-jd-submit').click();
    const jdResult = page.getByTestId('ask-jd-result');
    await expect(jdResult).toBeVisible();
    await expect(jdResult.getByText(/Overall Fit Score|Grounded Match Score/i)).toBeVisible();
    await expect(jdResult.getByText(/Verified Strengths/i)).toBeVisible();
    await expect(jdResult.getByText(/Gaps/i)).toBeVisible();
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('local-llama-swap');
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('gemma-4');
    await expect(jdResult.getByTestId('ask-telemetry-line')).toContainText('tokens: 320');
    expect(await page.locator('body').innerText()).not.toContain('pg19-local-corpus');

    // Docked TUI /chat?pane=1 parity renders DB-backed lenses and streaming controls cleanly
    await gotoStreamedPage(page, '/chat?pane=1');
    await waitForAskHydrated(page);
    await expect(page.getByTestId('ask-lens-hiring-manager')).toBeVisible();

    // Mid-preamble cancel on /chat?pane=1 aborts cleanly without console or server errors
    if (!IS_LIVE_DEPLOYMENT) {
      await page
        .getByTestId('ask-question-input')
        .fill('Slow stream cancel check for Andrew Cloud Run and GKE architecture?');
      await page.getByTestId('ask-qa-submit').click();
      await expect(page.getByTestId('ask-stream-cancel')).toBeVisible();
      await page.getByTestId('ask-stream-cancel').click();
      await expect(page.getByTestId('ask-streaming-feed')).toHaveCount(0);
    }

    expect(getErrors()).toEqual([]);
  });

  test('recovers an active delayed unary JD Match turn across page reload via /api/ask/turns/:attemptId without double-billing', async ({
    browser,
  }) => {
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Cold-start delayed turn recovery test relies on mock upstream delay timing',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/chat');
      await waitForAskHydrated(page);
      await page.getByTestId('ask-tab-jd').click();
      await page
        .getByTestId('ask-jd-textarea')
        .fill(
          'Staff Platform Engineer delayed cold-start recovery evaluation across Cloud Run SSR, Go microservices, and PostgreSQL 19.',
        );

      let askPostCount = 0;
      page.on('request', req => {
        if (
          req.url().includes('/chat') &&
          !req.url().includes('/api/ask/') &&
          req.method() === 'POST'
        ) {
          askPostCount += 1;
        }
      });

      const postRequestPromise = page.waitForRequest(
        req =>
          req.url().includes('/chat') &&
          !req.url().includes('/api/ask/') &&
          req.method() === 'POST',
      );
      await page.getByTestId('ask-jd-submit').click();
      await postRequestPromise;

      // Wait briefly so PG19 turn reservation commits before closing browser request on reload
      await page.waitForTimeout(450);
      await reloadStreamedPage(page);
      await waitForAskHydrated(page);

      await expect(
        page.getByTestId('ask-turn-pending').or(page.getByTestId('ask-jd-result')),
      ).toBeVisible();
      await expect(page.getByTestId('ask-jd-result')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('ask-turn-pending')).toHaveCount(0);
      await expect(page.getByTestId('ask-quota-meter')).toContainText('1/10 turns');
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
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Unreachable upstream port isolation runs only against local managed E2E environment',
    );

    const isolatedPortal = await startIsolatedPortalWithoutAsk();
    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await page.goto(`${isolatedPortal.baseUrl}/chat`, { waitUntil: 'load' });
      await page.waitForFunction(
        () => document.querySelectorAll('div[hidden][id^="S:"]').length === 0,
      );
      await waitForAskHydrated(page);
      await expect(page.getByText(/offline · upstream unreachable/i)).toBeVisible();

      const responsePromise = page.waitForResponse(
        res => res.url().includes('/api/ask/stream') && res.request().method() === 'POST',
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

  test('enforces 10-turn guest session quota and displays 429 error banner on 11th turn', async ({
    browser,
  }) => {
    test.skip(
      IS_LIVE_DEPLOYMENT,
      'Quota exhaustion check is guarded off live production deployments',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    const getErrors = trackPageErrors(page);

    try {
      await gotoStreamedPage(page, '/chat');
      await waitForAskHydrated(page);
      for (let turn = 1; turn <= 10; turn += 1) {
        await page
          .getByTestId('ask-question-input')
          .fill(`Quota verification question number ${turn} about Cloud Run SSR architecture?`);
        await page.getByTestId('ask-qa-submit').click();
        await expect(page.getByTestId('ask-qa-entry')).toHaveCount(turn);
      }
      await expect(page.getByTestId('ask-quota-meter')).toContainText('10/10 turns');

      await page
        .getByTestId('ask-question-input')
        .fill('Eleventh portfolio question that exceeds guest session turn cap.');
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
