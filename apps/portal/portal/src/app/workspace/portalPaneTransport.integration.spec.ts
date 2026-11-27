// @vitest-environment node

import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

import type { ContactActionResult, PortalAskLoaderData } from '@aklapper/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPortalServer } from '../../server';
import { isAskStreamLoaderEnvelope } from '../pane-loader';
import {
  createSingleFetchPaneTransport,
  resetGuestSessionBarrierForTest,
} from './portalPaneTransport';

const DIST_SERVER_ENTRY = resolve(import.meta.dirname, '../../../dist/server/index.js');

describe('portalPaneTransport live HTTP single-fetch fault classification', () => {
  let baseUrl = '';
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    if (url.startsWith('/agensi.data')) {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end('<html><body>502 Bad Gateway from proxy</body></html>');
      return;
    }
    if (url.startsWith('/contact.data') && req.method === 'POST') {
      res.writeHead(504, { 'content-type': 'text/plain' });
      res.end('Gateway Timeout');
      return;
    }
    if (url.startsWith('/cadence.data')) {
      res.writeHead(204, {
        'X-Remix-Redirect': '/contact',
        'X-Remix-Status': '302',
      });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  beforeAll(async () => {
    await new Promise<void>(resolveListen => {
      server.listen(0, '127.0.0.1', () => resolveListen());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolveClose => {
      server.close(() => resolveClose());
    });
  });

  beforeEach(() => {
    resetGuestSessionBarrierForTest();
  });

  it('settles bare HTTP 502 without X-Remix-Response to wire-safe ERR_UPSTREAM_UNAVAILABLE StreamResult without throwing', async () => {
    const transport = createSingleFetchPaneTransport({ baseUrl });
    const envelope = await transport.load('/agensi', new AbortController().signal);
    const settled = await envelope.payload;

    expect(settled).toMatchObject({
      ok: false,
      error: {
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 502,
      },
    });
    expect(JSON.stringify(settled)).not.toContain('502 Bad Gateway from proxy');
  });

  it('classifies HTTP 204 X-Remix-Redirect and POST HTTP 504 fail-closed over live HTTP', async () => {
    const transport = createSingleFetchPaneTransport({ baseUrl });
    const redirectEnv = await transport.load('/cadence', new AbortController().signal);
    const redirectSettled = await redirectEnv.payload;
    expect(redirectSettled.ok).toBe(false);

    const fd = new FormData();
    fd.set('name', 'Ada');
    const postRes = await transport.submitAction<ContactActionResult>('/contact', fd);
    expect(postRes).toMatchObject({
      ok: false,
      code: 'ERR_STREAM_TIMEOUT',
      source: 'server',
      fieldErrors: {},
    });
  });
});

describe.runIf(existsSync(DIST_SERVER_ENTRY))(
  'portalPaneTransport live Fastify SSR .data integration',
  () => {
    let baseUrl = '';
    let closeServer: (() => Promise<void>) | null = null;

    beforeAll(async () => {
      const portalServer = await createPortalServer({
        host: '127.0.0.1',
        port: 0,
      });
      const address = await portalServer.start();
      baseUrl = address;
      closeServer = () => portalServer.app.close();
    });

    afterAll(async () => {
      if (closeServer) {
        await closeServer();
      }
    });

    beforeEach(() => {
      resetGuestSessionBarrierForTest();
    });

    it('decodes live Fastify SSR /chat.data?pane=1 dual deferred streams and emits Set-Cookie ak_guest_session', async () => {
      const seenSetCookies: string[] = [];
      const transport = createSingleFetchPaneTransport({
        baseUrl,
        fetchImpl: async (input, init) => {
          const response = await fetch(input, init);
          const cookie = response.headers.get('set-cookie');
          if (cookie) {
            seenSetCookies.push(cookie);
          }
          return response;
        },
      });

      const envelope = await transport.load<PortalAskLoaderData>(
        '/chat',
        new AbortController().signal,
      );

      expect(seenSetCookies.some(cookie => cookie.includes('ak_guest_session='))).toBe(true);
      expect(isAskStreamLoaderEnvelope(envelope)).toBe(true);

      const settledPayload = await envelope.payload;
      expect(settledPayload).toHaveProperty('ok');
      const settledStatus = isAskStreamLoaderEnvelope(envelope)
        ? await envelope.askStatusPayload
        : null;
      expect(settledStatus).toHaveProperty('ok');
    });

    it('decodes live Fastify SSR POST /contact.data responses via submitAction', async () => {
      const transport = createSingleFetchPaneTransport({ baseUrl });
      const fd = new FormData();
      fd.set('name', '');
      fd.set('email', 'not-an-email');
      fd.set('message', 'hi');

      const result = await transport.submitAction<ContactActionResult>('/contact', fd);
      expect(result.ok).toBe(false);
      const failed = result as Extract<ContactActionResult, { ok: false }>;
      expect(['ERR_VALIDATION', 'ERR_DB_UNAVAILABLE']).toContain(failed.code);
      expect(failed.correlationId).toMatch(/\S+/);
      expect(failed.formError ?? Object.values(failed.fieldErrors).join('')).toMatch(/\S+/);
    });

    it('returns zero-DB HTTP 404 with noindex/nofollow, matching X-Correlation-Id, no JSON-LD, JSON /api/* 404, bot onAllReady, and case-insensitive /Contact 200', async () => {
      // Desktop GET /changes-in-progress -> 404 HTML
      const desktopRes = await fetch(`${baseUrl}/changes-in-progress`, {
        headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      });
      expect(desktopRes.status).toBe(404);
      const desktopCorr = desktopRes.headers.get('x-correlation-id');
      expect(desktopCorr).toMatch(/\S+/);
      const desktopHtml = await desktopRes.text();
      expect(desktopHtml).toContain(`content="${desktopCorr}"`);
      expect(desktopHtml).toContain(desktopCorr ?? '');
      expect(desktopHtml.match(/<meta[^>]+name="robots"[^>]*>/gi)).toHaveLength(1);
      expect(desktopHtml).toContain('name="robots" content="noindex, nofollow"');
      expect(desktopHtml).toContain('name="googlebot" content="noindex, nofollow"');
      expect(desktopHtml).not.toContain('application/ld+json');
      expect(desktopHtml).toContain('Return Home');

      // Mobile GET /nonexistent-route/nested/ -> 404 preserving mobile viewport
      const mobileRes = await fetch(`${baseUrl}/nonexistent-route/nested/`, {
        headers: {
          'sec-ch-ua-mobile': '?1',
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
      });
      expect(mobileRes.status).toBe(404);
      const mobileHtml = await mobileRes.text();
      expect(mobileHtml).toContain('data-viewport="mobile-portrait"');
      expect(mobileHtml).toContain('name="robots" content="noindex, nofollow"');
      expect(mobileHtml).toContain('name="googlebot" content="noindex, nofollow"');
      expect(mobileHtml).not.toContain('application/ld+json');

      // Bot crawler GET /changes-in-progress -> 404 without hidden Suspense swap chunks
      const botRes = await fetch(`${baseUrl}/changes-in-progress`, {
        headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
      });
      expect(botRes.status).toBe(404);
      const botHtml = await botRes.text();
      expect(botHtml).toContain('name="robots" content="noindex, nofollow"');
      expect(botHtml).toContain('name="googlebot" content="noindex, nofollow"');
      expect(botHtml).not.toContain('<template id="B:');

      // Unmatched GET and POST /api/* -> 404 application/json PublicAppError
      for (const method of ['GET', 'POST'] as const) {
        const apiRes = await fetch(`${baseUrl}/api/nonexistent-endpoint`, { method });
        expect(apiRes.status).toBe(404);
        expect(apiRes.headers.get('content-type')).toContain('application/json');
        const apiCorr = apiRes.headers.get('x-correlation-id');
        expect(apiCorr).toMatch(/\S+/);
        const apiBody = (await apiRes.json()) as {
          code: string;
          status: number;
          correlationId: string;
        };
        expect(apiBody.code).toBe('ERR_NOT_FOUND');
        expect(apiBody.status).toBe(404);
        expect(apiBody.correlationId).toBe(apiCorr);
      }

      // Case-insensitive and percent-encoded navigable routes -> 200 OK with PortalRootShell (index, follow)
      for (const navigablePath of ['/Contact', '/%63ontact', '/%63hat']) {
        const navRes = await fetch(`${baseUrl}${navigablePath}`);
        expect(navRes.status).toBe(200);
        const navHtml = await navRes.text();
        expect(navHtml).toContain('name="robots" content="index, follow"');
        expect(navHtml).toContain('name="googlebot" content="index, follow"');
        expect(navHtml).not.toContain('name="googlebot" content="noindex, nofollow"');
        expect(navHtml).toContain('<header');
      }

      // POST to retired /changes-in-progress and Single Fetch .data endpoint -> 404 ERR_NOT_FOUND (never 405 or route-id leak)
      for (const postPath of ['/changes-in-progress', '/changes-in-progress.data']) {
        const postRes = await fetch(`${baseUrl}${postPath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'probe=1',
        });
        expect(postRes.status).toBe(404);
        expect(postRes.headers.get('x-correlation-id')).toMatch(/\S+/);
        const postBody = await postRes.text();
        expect(postBody).toContain('ERR_NOT_FOUND');
        expect(postBody).not.toMatch(/Method Not Allowed|did not provide an [`']?action/i);
        expect(postBody).not.toContain('ERR_INTERNAL');
      }

      // Stale /_root.data returns 404 and malformed /%ZZ fails closed (400/404) without 500 or URIError
      const staleRootRes = await fetch(`${baseUrl}/_root.data`);
      expect(staleRootRes.status).toBe(404);
      expect(await staleRootRes.text()).not.toContain('ERR_INTERNAL');

      const malformedRes = await fetch(`${baseUrl}/%ZZ`);
      expect([400, 404]).toContain(malformedRes.status);
      expect(await malformedRes.text()).not.toContain('ERR_INTERNAL');

      // Burst of 50 concurrent 404 probes completes cleanly without DB pool saturation
      const burstResponses = await Promise.all(
        Array.from({ length: 50 }, (_, idx) => fetch(`${baseUrl}/bot-probe-${idx + 1}`)),
      );
      expect(burstResponses.every(res => res.status === 404)).toBe(true);
    });
  },
);
