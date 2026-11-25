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
        'X-Remix-Redirect': '/changes-in-progress',
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
  },
);
