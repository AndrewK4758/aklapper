import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { createDb, createDbPool, deleteCreatorAgensiCache } from '@aklapper/db';
import { reserveLoopbackPort } from '@aklapper/tooling/e2e';
import { gotoStreamedPage } from '@aklapper/tooling/playwright';
import { expect, type Page, type TestInfo, test } from '@playwright/test';

const IS_LIVE_EXTERNAL_TARGET = Boolean(process.env['PORTAL_BASE_URL']?.trim());

async function runIsolatedAgensiSyncFlow(
  page: Page,
  testInfo: TestInfo,
  mode: 'json' | 'tsr_html',
): Promise<void> {
  const uniqueSuffix = `${testInfo.project.name.replaceAll(/[^a-z0-9-]/gi, '')}-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const creatorHandle = `e2e-agensi-${uniqueSuffix}`;
  const skillOneSlug = `creator-skill-a-${uniqueSuffix}`;
  const skillTwoSlug = `creator-skill-b-${uniqueSuffix}`;

  let simulateOutage = false;
  const mockAgensiServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
    if (simulateOutage) {
      res.statusCode = 503;
      res.end('Upstream maintenance');
      return;
    }
    if (mode === 'tsr_html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(
        `<!doctype html><html><body><script data-tsr-stream-part="">$R[0]=["creator-profile",${JSON.stringify(creatorHandle)}];$R[1]={slug:${JSON.stringify(skillOneSlug)},name:"Creator Skill Alpha",summary:"Published creator skill served via TSR HTML.",tags:["agents","e2e"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[2]={slug:${JSON.stringify(skillTwoSlug)},name:"Creator Skill Beta",summary:"Second published creator skill persisted to PostgreSQL.",tags:["go","e2e"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[3]={queryKey:$R[0],state:{data:{slug:${JSON.stringify(creatorHandle)},skills:[$R[1],$R[2]]}}};</script></body></html>`,
      );
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        slug: creatorHandle,
        verified: true,
        skills: [
          {
            slug: skillOneSlug,
            name: 'Creator Skill Alpha',
            summary: 'Published creator skill served during live sync.',
            tags: ['agents', 'e2e'],
            url: `https://agensi.io/skills/${skillOneSlug}`,
            sortOrder: 1,
          },
          {
            slug: skillTwoSlug,
            name: 'Creator Skill Beta',
            summary: 'Second published creator skill persisted to PostgreSQL.',
            tags: ['go', 'e2e'],
            url: `https://agensi.io/skills/${skillTwoSlug}`,
            sortOrder: 2,
          },
        ],
      }),
    );
  });

  mockAgensiServer.listen(0, '127.0.0.1');
  await once(mockAgensiServer, 'listening');
  const mockAddr = mockAgensiServer.address();
  if (!mockAddr || typeof mockAddr === 'string') {
    throw new Error('Failed to bind loopback mock Agensi server');
  }
  const mockBaseUrl = `http://127.0.0.1:${mockAddr.port}`;
  const ssrPort = await reserveLoopbackPort();
  const portalAppDir = resolve(import.meta.dirname, '../../portal');

  const logs: string[] = [];
  const child = spawn(process.execPath, ['--conditions=@aklapper/source', './src/server.ts'], {
    cwd: portalAppDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORTAL_HOST: '127.0.0.1',
      PORT: String(ssrPort),
      PORTAL_PORT: String(ssrPort),
      PORTAL_MAINTENANCE_MODE: 'false',
      SERVE_PRERENDERED_STATIC: 'false',
      AGENSI_API_BASE_URL: mockBaseUrl,
      AGENSI_API_KEY: '',
      AGENSI_CREATOR_HANDLE: creatorHandle,
      AGENSI_CACHE_TTL_SECONDS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));

  const ssrBaseUrl = `http://127.0.0.1:${ssrPort}`;
  const pool = createDbPool();
  const db = createDb(pool);

  try {
    const deadline = Date.now() + 15_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `Isolated portal SSR exited early (code=${String(child.exitCode)}):\n${logs.join('')}`,
        );
      }
      try {
        const healthRes = await fetch(`${ssrBaseUrl}/healthz`);
        if (healthRes.ok) {
          ready = true;
          break;
        }
      } catch {
        // Wait until SSR socket begins listening.
      }
      await delay(50);
    }
    expect(ready).toBe(true);

    // 1. Live sync load persists creator-owned skills
    await gotoStreamedPage(page, `${ssrBaseUrl}/agensi`);
    await expect(page.getByTestId(`agensi-card-${skillOneSlug}`)).toBeVisible();
    await expect(page.getByTestId(`agensi-card-${skillTwoSlug}`)).toBeVisible();
    await expect(page.getByTestId(`agensi-cta-${skillOneSlug}`)).toHaveAttribute(
      'href',
      `https://agensi.io/skills/${skillOneSlug}`,
    );
    await expect(page.getByTestId('agensi-catalog-meta')).toContainText('live sync');

    // 2. Outage with expired TTL=0 falls back cleanly to cached PG19 rows
    simulateOutage = true;
    await gotoStreamedPage(page, `${ssrBaseUrl}/agensi`);
    await expect(page.getByTestId(`agensi-card-${skillOneSlug}`)).toBeVisible();
    await expect(page.getByTestId(`agensi-card-${skillTwoSlug}`)).toBeVisible();
    await expect(page.getByText(/catalog · cached fallback/)).toBeVisible();
    await expect(page.getByTestId('agensi-catalog-meta')).toContainText('cached fallback');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise<void>(resolveExit => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolveExit();
        }, 4_000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolveExit();
        });
      });
    }
    await new Promise<void>(resolveClose => mockAgensiServer.close(() => resolveClose()));
    await deleteCreatorAgensiCache(db, creatorHandle).catch(() => {});
    await pool.end();
  }
}

test.describe('portal /agensi live sync & PG19 cache fallback', () => {
  test('syncs creator skills from JSON upstream and degrades gracefully to PG19 cache on HTTP 503 outage', async ({
    page,
  }, testInfo) => {
    if (IS_LIVE_EXTERNAL_TARGET) {
      if (process.env['PORTAL_MAINTENANCE_MODE'] === 'true') {
        await page.goto('/changes-in-progress');
        await expect(page.locator('body')).toBeVisible();
        return;
      }
      await page.goto('/agensi');
      await expect(
        page
          .locator('[data-testid^="agensi-card-"]')
          .first()
          .or(page.getByTestId('agensi-empty-state')),
      ).toBeVisible();
      return;
    }

    await runIsolatedAgensiSyncFlow(page, testInfo, 'json');
  });

  test('syncs creator skills from TSR HTML storefront and degrades gracefully to PG19 cache on HTTP 503 outage', async ({
    page,
  }, testInfo) => {
    test.skip(
      IS_LIVE_EXTERNAL_TARGET,
      'Loopback TSR HTML simulation runs against isolated local SSR.',
    );
    await runIsolatedAgensiSyncFlow(page, testInfo, 'tsr_html');
  });
});
