import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_AGENSI_CACHE_TTL_SECONDS,
  DEFAULT_AGENSI_CREATOR_HANDLE,
  DEFAULT_AGENSI_FETCH_TIMEOUT_MS,
  fetchAgensiCreatorCatalog,
  MAX_AGENSI_FETCH_TIMEOUT_MS,
  MAX_AGENSI_PAGES,
  resolveAgensiCatalogConfig,
} from '../src/agensi.ts';

async function startLoopbackServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind loopback server');
  }
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close(err => {
          if (err) rejectClose(err);
          else resolveClose();
        });
      }),
  };
}

describe('@aklapper/node-runtime/agensi adapter', () => {
  const servers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const close = servers.pop();
      if (close) await close();
    }
    vi.restoreAllMocks();
  });

  it('fetches paginated creator-owned published skills and supports live creator profile envelopes', async () => {
    const requestedUrls: string[] = [];
    const srv = await startLoopbackServer((req, res) => {
      requestedUrls.push(req.url ?? '');
      const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
      const cursor = parsed.searchParams.get('cursor');
      res.setHeader('content-type', 'application/json');
      res.setHeader('etag', '"creator-v1"');

      if (!cursor) {
        res.end(
          JSON.stringify({
            name: 'Andrew Klapper',
            slug: 'aklapper',
            verified: true,
            skills: [
              {
                slug: 'cadence-governed-agentic-sdlc-framework',
                name: 'CADENCE: Governed Agentic SDLC Framework',
                summary: 'Governed SDLC framework.',
                tags: ['sdlc', 'agents'],
                url: 'https://agensi.io/skills/cadence-governed-agentic-sdlc-framework',
                sortOrder: 2,
              },
              {
                slug: 'cadence-triage-risk-classifier',
                name: 'CADENCE Triage & Risk Classifier',
                summary: 'Classifies engineering tasks.',
                tags: ['triage'],
                url: 'https://agensi.io/skills/cadence-triage-risk-classifier',
                sortOrder: 1,
              },
            ],
            nextCursor: 'p2',
          }),
        );
        return;
      }

      res.end(
        JSON.stringify({
          slug: 'aklapper',
          verified: true,
          skills: [
            {
              slug: 'local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
              name: 'Local GPU Coprocessor Offload for Coding Agents (FastMCP)',
              summary: 'Local GPU FastMCP offload.',
              tags: ['mcp', 'local-llm'],
              url: 'https://agensi.io/skills/local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
              sortOrder: 3,
            },
          ],
          nextCursor: null,
        }),
      );
    });
    servers.push(srv.close);

    const result = await fetchAgensiCreatorCatalog(
      {
        baseUrl: srv.baseUrl,
        apiPath: '/api/creators/aklapper',
        creatorHandle: DEFAULT_AGENSI_CREATOR_HANDLE,
        timeoutMs: DEFAULT_AGENSI_FETCH_TIMEOUT_MS,
        maxPages: MAX_AGENSI_PAGES,
        allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
      },
      { correlationId: 'corr-101' },
    );

    expect(requestedUrls).toEqual(['/api/creators/aklapper', '/api/creators/aklapper?cursor=p2']);
    expect(result.ok).toBe(true);
    if (!result.ok || result.notModified) throw new Error('Expected live items result');
    expect(result.etag).toBe('"creator-v1"');
    expect(result.items.map(item => item.slug)).toEqual([
      'cadence-triage-risk-classifier',
      'cadence-governed-agentic-sdlc-framework',
      'local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
    ]);
    expect(
      result.items.every(
        item =>
          item.creatorHandle === 'aklapper' &&
          item.isPublished === true &&
          item.url.startsWith('https://agensi.io/'),
      ),
    ).toBe(true);
  });

  it('rejects foreign creators and unpublished drafts mixed into HTTP 200 and emits UNSOUND_CONDITION', async () => {
    const infoSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: 'cadence-adversarial-pre-pr-review-gate',
              name: 'CADENCE Adversarial Pre-PR Review Gate',
              summary: 'Three-lens pre-PR review.',
              tags: ['code-review'],
              url: 'https://agensi.io/skills/cadence-adversarial-pre-pr-review-gate',
              creatorHandle: 'AKLAPPER',
              isPublished: true,
              sortOrder: 1,
            },
            {
              slug: 'foreign-marketplace-skill',
              name: 'Foreign Skill',
              summary: 'Owned by another creator.',
              tags: ['other'],
              url: 'https://agensi.io/skills/foreign-marketplace-skill',
              creatorHandle: 'other-creator',
              isPublished: true,
              sortOrder: 2,
            },
            {
              slug: 'draft-aklapper-skill',
              name: 'Draft Skill',
              summary: 'Unpublished draft.',
              tags: ['draft'],
              url: 'https://agensi.io/skills/draft-aklapper-skill',
              creatorHandle: 'aklapper',
              isPublished: false,
              sortOrder: 3,
            },
          ],
        }),
      );
    });
    servers.push(srv.close);

    const result = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/api/skills',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.notModified) throw new Error('Expected items result');
    expect(result.items.map(item => item.slug)).toEqual(['cadence-adversarial-pre-pr-review-gate']);
    expect(result.rejectedForeignCount).toBe(1);
    expect(result.rejectedUnpublishedCount).toBe(1);
    const logs = infoSpy.mock.calls.map(call => String(call[0]));
    expect(
      logs.some(
        msg =>
          msg.includes('UNSOUND_CONDITION') &&
          msg.includes('agensi.catalog.foreign_creator_rejected'),
      ),
    ).toBe(true);
    expect(
      logs.some(
        msg =>
          msg.includes('UNSOUND_CONDITION') &&
          msg.includes('agensi.catalog.unpublished_item_rejected'),
      ),
    ).toBe(true);
  });

  it('rejects javascript: URLs, clamps oversized timeouts to 2000ms, and never leaks AGENSI_API_KEY', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secret = 'secret-agensi-token-value';
    const srv = await startLoopbackServer((req, res) => {
      const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (parsed.pathname === '/slow') {
        setTimeout(() => {
          if (!res.writableEnded) {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ items: [] }));
          }
        }, 2_600);
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: 'xss-skill',
              name: 'Bad URL Skill',
              summary: 'Contains unsafe URL scheme.',
              tags: ['bad'],
              url: 'javascript:alert(1)',
              creatorHandle: 'aklapper',
              isPublished: true,
            },
          ],
        }),
      );
    });
    servers.push(srv.close);

    const cfg = resolveAgensiCatalogConfig({
      AGENSI_API_BASE_URL: srv.baseUrl,
      AGENSI_API_KEY: secret,
      AGENSI_FETCH_TIMEOUT_MS: '9000',
    });
    expect(cfg.timeoutMs).toBe(MAX_AGENSI_FETCH_TIMEOUT_MS);
    expect(cfg.ttlSeconds).toBe(DEFAULT_AGENSI_CACHE_TTL_SECONDS);

    const invalidRes = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/poison',
      creatorHandle: 'aklapper',
      apiKey: secret,
      timeoutMs: 9_000,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io'],
    });
    expect(invalidRes.ok).toBe(true);
    if (!invalidRes.ok || invalidRes.notModified) throw new Error('Expected filtered empty list');
    expect(invalidRes.items).toEqual([]);
    expect(invalidRes.rejectedInvalidCount).toBe(1);
    const warnLogs = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnLogs).toContain('BOUNDARY_FAULT');
    expect(warnLogs).toContain('agensi.catalog.payload_validation_failed');
    expect(warnLogs).not.toContain(secret);

    const started = Date.now();
    const timeoutRes = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/slow',
      creatorHandle: 'aklapper',
      apiKey: secret,
      timeoutMs: 9_000,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io'],
    });
    const elapsedMs = Date.now() - started;
    expect(elapsedMs).toBeLessThan(2_450);
    expect(timeoutRes.ok).toBe(false);
    if (timeoutRes.ok) throw new Error('Expected timeout failure');
    expect(timeoutRes.errorCode).toBe('AGENSI_TIMEOUT');
    expect(timeoutRes.message).not.toContain(secret);
  });

  it('defaults omitted Agensi env vars to public storefront and supports dual opt-out and untrusted URL fail-closed', async () => {
    const defaultCfg = resolveAgensiCatalogConfig({});
    expect(defaultCfg.baseUrl).toBe('https://www.agensi.io');
    expect(defaultCfg.apiPath).toBe('/creators/aklapper');
    expect(defaultCfg.creatorHandle).toBe('aklapper');
    expect(defaultCfg.timeoutMs).toBe(DEFAULT_AGENSI_FETCH_TIMEOUT_MS);

    expect(resolveAgensiCatalogConfig({ AGENSI_SYNC_DISABLED: 'true' }).baseUrl).toBeNull();
    expect(resolveAgensiCatalogConfig({ AGENSI_SYNC_DISABLED: '1' }).baseUrl).toBeNull();
    expect(
      resolveAgensiCatalogConfig({
        AGENSI_API_BASE_URL: 'https://www.agensi.io',
        AGENSI_SYNC_DISABLED: 'true',
      }).baseUrl,
    ).toBeNull();

    for (const disabledOrInvalid of [
      '',
      'off',
      'disabled',
      'none',
      'https://user:pass@agensi.io',
      'http://evil.example.com',
      'ftp://agensi.io',
    ]) {
      expect(
        resolveAgensiCatalogConfig({ AGENSI_API_BASE_URL: disabledOrInvalid }).baseUrl,
      ).toBeNull();
    }

    const unsetRes = await fetchAgensiCreatorCatalog({
      baseUrl: '',
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io'],
    });
    expect(unsetRes.ok).toBe(false);
    if (unsetRes.ok) {
      throw new Error('Expected ok=false when AGENSI_API_BASE_URL is unset');
    }
    expect(unsetRes.errorCode).toBe('AGENSI_NOT_CONFIGURED');

    let requestCount = 0;
    const srv = await startLoopbackServer((_req, res) => {
      requestCount += 1;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: `page-skill-${requestCount}`,
              name: `Skill ${requestCount}`,
              summary: 'Paginated entry.',
              tags: ['agents'],
              url: `https://agensi.io/skills/page-skill-${requestCount}`,
              creatorHandle: 'aklapper',
              isPublished: true,
              sortOrder: requestCount,
            },
          ],
          nextCursor: `cursor-${requestCount + 1}`,
        }),
      );
    });
    servers.push(srv.close);

    const cappedRes = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/api/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 25,
      allowedOrigins: ['https://agensi.io'],
    });
    expect(requestCount).toBe(MAX_AGENSI_PAGES);
    expect(cappedRes.ok).toBe(true);
    if (!cappedRes.ok || cappedRes.notModified) {
      throw new Error('Expected paginated catalog items');
    }
    expect(cappedRes.items).toHaveLength(MAX_AGENSI_PAGES);
  });

  it('handles HTTP 304 Not Modified with If-None-Match cleanly without treating 304 as error', async () => {
    let receivedIfNoneMatch: string | undefined;
    const srv = await startLoopbackServer((req, res) => {
      receivedIfNoneMatch =
        typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : undefined;
      res.statusCode = 304;
      res.setHeader('etag', '"v2"');
      res.end();
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog(
      {
        baseUrl: srv.baseUrl,
        apiPath: '/api/creators/aklapper',
        creatorHandle: 'aklapper',
        timeoutMs: 1_800,
        maxPages: 10,
        allowedOrigins: ['https://agensi.io'],
      },
      { etag: '"v1"' },
    );

    expect(receivedIfNoneMatch).toBe('"v1"');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected ok=true on 304');
    expect(res.notModified).toBe(true);
    expect(res.etag).toBe('"v2"');
  });

  it('parses live Agensi TSR HTML stream with UUID creator_id, status live, and omitted URLs', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const tsrHtml = `<!doctype html><html><head><title>@aklapper | Agensi</title></head><body>
      <script data-tsr-stream-part="">$R[0]=["creator-profile","aklapper"];$R[1]={id:"00000000-0000-4000-8000-000000000001",slug:"skill-one",name:"Skill One",summary:"First live skill.",tags:["agents","sdlc"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[2]={id:"00000000-0000-4000-8000-000000000002",slug:"skill-two",name:"Skill Two",summary:"Second live skill.",tags:["tdd"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[3]={id:"00000000-0000-4000-8000-000000000003",slug:"skill-three",name:"Skill Three",summary:"Third live skill.",tags:["review"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};</script>
      <script data-tsr-stream-part="">$R[4]={id:"00000000-0000-4000-8000-000000000004",slug:"skill-four",name:"Skill Four",summary:"Fourth live skill.",tags:["mcp"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[5]={id:"00000000-0000-4000-8000-000000000005",slug:"skill-five",name:"Skill Five",summary:"Fifth live skill.",tags:["go"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[6]={id:"00000000-0000-4000-8000-000000000006",slug:"skill-six",name:"Skill Six",summary:"Sixth live skill.",tags:["cloud"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"};$R[7]={queryKey:$R[0],state:{data:{slug:"aklapper",skills:[$R[1],$R[2],$R[3],$R[4],$R[5],$R[6]]}}};</script>
    </body></html>`;

    let receivedAccept: string | undefined;
    const srv = await startLoopbackServer((req, res) => {
      receivedAccept =
        typeof req.headers['accept'] === 'string' ? req.headers['accept'] : undefined;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(tsrHtml);
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog(
      {
        baseUrl: srv.baseUrl,
        apiPath: '/creators/aklapper',
        creatorHandle: 'aklapper',
        timeoutMs: 1_800,
        maxPages: 10,
        allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
      },
      { correlationId: 'corr-tsr-1' },
    );

    expect(receivedAccept).toContain('text/html');
    expect(res.ok).toBe(true);
    if (!res.ok || res.notModified) throw new Error('Expected live TSR items result');
    expect(res.items).toHaveLength(6);
    expect(res.rejectedForeignCount).toBe(0);
    expect(res.rejectedUnpublishedCount).toBe(0);
    expect(res.items.map(i => i.slug)).toEqual([
      'skill-one',
      'skill-two',
      'skill-three',
      'skill-four',
      'skill-five',
      'skill-six',
    ]);
    expect(
      res.items.every(
        item =>
          item.creatorHandle === 'aklapper' &&
          item.isPublished === true &&
          item.url === `https://agensi.io/skills/${item.slug}`,
      ),
    ).toBe(true);
    expect(res.items[0]?.tags).toEqual(['agents', 'sdlc']);
    const infoLogs = infoSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(infoLogs).toContain('RULE_DIVERGENCE');
    expect(infoLogs).toContain('agensi.catalog.parse_mode_total');
    expect(infoLogs).toContain('tsr_stream');
  });

  it('validates redirects pre-hop, strips x-api-key cross-origin, and rejects untrusted origins and redirect loops', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let targetApiKeyHeader: string | undefined;
    const targetSrv = await startLoopbackServer((req, res) => {
      targetApiKeyHeader =
        typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          slug: 'aklapper',
          skills: [
            {
              slug: 'redirected-skill',
              name: 'Redirected Skill',
              summary: 'Served after allowed redirect.',
              tags: ['redirect'],
              url: 'https://agensi.io/skills/redirected-skill',
              status: 'live',
            },
          ],
        }),
      );
    });
    servers.push(targetSrv.close);

    let hostileHitCount = 0;
    const hostileSrv = await startLoopbackServer((_req, res) => {
      hostileHitCount += 1;
      res.statusCode = 200;
      res.end('should never be reached');
    });
    servers.push(hostileSrv.close);

    const redirectorSrv = await startLoopbackServer((req, res) => {
      const path = req.url ?? '/';
      if (path === '/allowed-redirect') {
        res.statusCode = 301;
        res.setHeader('location', `${targetSrv.baseUrl}/creators/aklapper`);
        res.end();
        return;
      }
      if (path === '/hostile-redirect') {
        res.statusCode = 301;
        res.setHeader('location', `${hostileSrv.baseUrl}/steal`);
        res.end();
        return;
      }
      res.statusCode = 302;
      res.setHeader('location', '/loop');
      res.end();
    });
    servers.push(redirectorSrv.close);

    const allowedRes = await fetchAgensiCreatorCatalog({
      baseUrl: redirectorSrv.baseUrl,
      apiPath: '/allowed-redirect',
      creatorHandle: 'aklapper',
      apiKey: 'top-secret-key',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io', targetSrv.baseUrl],
    });
    expect(allowedRes.ok).toBe(true);
    if (!allowedRes.ok || allowedRes.notModified) throw new Error('Expected redirect success');
    expect(allowedRes.items.map(i => i.slug)).toEqual(['redirected-skill']);
    expect(targetApiKeyHeader).toBeUndefined();

    const hostileRes = await fetchAgensiCreatorCatalog({
      baseUrl: redirectorSrv.baseUrl,
      apiPath: '/hostile-redirect',
      creatorHandle: 'aklapper',
      apiKey: 'top-secret-key',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(hostileRes.ok).toBe(false);
    if (hostileRes.ok) throw new Error('Expected untrusted redirect failure');
    expect(hostileRes.errorCode).toBe('AGENSI_UNTRUSTED_ORIGIN');
    expect(hostileHitCount).toBe(0);

    const loopRes = await fetchAgensiCreatorCatalog({
      baseUrl: redirectorSrv.baseUrl,
      apiPath: '/loop',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(loopRes.ok).toBe(false);
    if (loopRes.ok) throw new Error('Expected redirect loop failure');
    expect(loopRes.errorCode).toBe('AGENSI_UNTRUSTED_ORIGIN');

    const warnLogs = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnLogs).toContain('BOUNDARY_FAULT');
    expect(warnLogs).toContain('agensi.catalog.untrusted_redirect');
    expect(warnLogs).not.toContain('top-secret-key');
  });

  it('rejects foreign explicit creator handles and draft/paused statuses in TSR payloads', async () => {
    const tsrHtml = `<html><body><script data-tsr-stream-part="">$R[0]={queryKey:["creator-profile","aklapper"],state:{data:{slug:"aklapper",skills:[{slug:"live-owner",name:"Live Owner",summary:"Valid live skill.",tags:["ok"],creator_id:"11111111-1111-4111-8111-111111111111",status:"live"},{slug:"foreign-item",name:"Foreign",summary:"Wrong creator.",tags:[],creatorHandle:"other-dev",status:"live"},{slug:"draft-item",name:"Draft",summary:"Not published.",tags:[],creator_id:"11111111-1111-4111-8111-111111111111",status:"draft"},{slug:"paused-item",name:"Paused",summary:"Paused skill.",tags:[],creator_id:"11111111-1111-4111-8111-111111111111",status:"paused"}]}}};</script></body></html>`;
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(tsrHtml);
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(true);
    if (!res.ok || res.notModified) throw new Error('Expected filtered items');
    expect(res.items.map(i => i.slug)).toEqual(['live-owner']);
    expect(res.rejectedForeignCount).toBe(1);
    expect(res.rejectedUnpublishedCount).toBe(2);
  });

  it('aborts responses exceeding 512 KiB streaming cap with AGENSI_PAYLOAD_TOO_LARGE', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oversizedChunk = 'x'.repeat(64 * 1024);
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      for (let i = 0; i < 10; i += 1) {
        res.write(oversizedChunk);
      }
      res.end();
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected payload too large error');
    expect(res.errorCode).toBe('AGENSI_PAYLOAD_TOO_LARGE');
    const warnLogs = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnLogs).toContain('BOUNDARY_FAULT');
    expect(warnLogs).toContain('agensi.catalog.payload_too_large');
  });

  it('falls back to bounded semantic HTML cards when TSR stream is absent and decodes entities safely', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const semanticHtml = `<!doctype html><html><body>
      <nav><a href="/skills/">Browse Skills</a></nav>
      <main>
        <a href="/skills/alpha-ops-tool" class="card">
          <h3><span>Alpha</span> &amp; Ops &quot;Tool&quot;</h3>
          <p>Runs <strong>safe</strong> &lt;checks&gt; on &#39;clusters&#39; &#x2192; fast.</p>
        </a>
        <a href="/skills/beta-sync" class="card">
          <h3>Beta Sync</h3>
          <p>Syncs catalog items reliably.</p>
        </a>
      </main>
    </body></html>`;
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(semanticHtml);
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(true);
    if (!res.ok || res.notModified) throw new Error('Expected semantic HTML fallback items');
    expect(res.items.map(i => i.slug)).toEqual(['alpha-ops-tool', 'beta-sync']);
    expect(res.items[0]?.name).toBe('Alpha & Ops "Tool"');
    expect(res.items[0]?.summary).toBe("Runs safe <checks> on 'clusters' → fast.");
    expect(res.items[0]?.url).toBe('https://agensi.io/skills/alpha-ops-tool');
    const infoLogs = infoSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(infoLogs).toContain('RULE_DIVERGENCE');
    expect(infoLogs).toContain('html_fallback');
  });

  it('fails closed on unparseable HTML without leaking AGENSI_API_KEY', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secret = 'agensi-html-secret-123';
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end('<html><body><div>No skills here</div></body></html>');
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      apiKey: secret,
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected invalid payload failure');
    expect(res.errorCode).toBe('AGENSI_INVALID_PAYLOAD');
    expect(res.message).not.toContain(secret);
    const warnLogs = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnLogs).toContain('BOUNDARY_FAULT');
    expect(warnLogs).not.toContain(secret);
  });

  it('joins live two-query TSR creator-profile and creator-skills payloads and rejects mismatched creator_id items', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const twoQueryHtml = `<!doctype html><html><body>
      <script data-tsr-stream-part="">$R[0]={queryKey:["creator-profile","aklapper"],state:{data:{user_id:"66ef91f8-1111-4111-8111-111111111111",slug:"aklapper",total_skills:2}}};</script>
      <script data-tsr-stream-part="">$R[1]={queryKey:["creator-skills","66ef91f8-1111-4111-8111-111111111111"],state:{data:[{slug:"joined-skill-one",name:"Joined Skill One",summary:"Live joined skill.",tags:["tsr","live"],creator_id:"66ef91f8-1111-4111-8111-111111111111",status:"live"},{slug:"foreign-uuid-skill",name:"Foreign UUID Skill",summary:"Must not attach to aklapper.",tags:["bad"],creator_id:"99999999-9999-4999-8999-999999999999",status:"live"}]}};</script>
    </body></html>`;
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(twoQueryHtml);
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(true);
    if (!res.ok || res.notModified) throw new Error('Expected two-query TSR items');
    expect(res.items.map(i => i.slug)).toEqual(['joined-skill-one']);
    expect(res.items[0]?.url).toBe('https://agensi.io/skills/joined-skill-one');
    expect(res.items[0]?.tags).toEqual(['tsr', 'live']);
    expect(infoSpy.mock.calls.map(c => String(c[0])).join('\n')).toContain('tsr_stream');
  });

  it('extracts article stretched-link semantic cards skipping author bylines and decodes entities in a single pass without RangeError', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const articleHtml = `<!doctype html><html><body>
      <main>
        <article class="skill-card">
          <a href="/skills/stretched-card-skill" aria-label="Stretched Card"></a>
          <div>
            <h3>Stretched &amp;#9999999; Card &#9999999;&#x110000;</h3>
            <p>by Andrew Klapper</p>
            <p>Real summary with &amp; &lt;safe&gt; &quot;quotes&quot; &#39;ok&#39;.</p>
          </div>
        </article>
      </main>
    </body></html>`;
    const srv = await startLoopbackServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(articleHtml);
    });
    servers.push(srv.close);

    const res = await fetchAgensiCreatorCatalog({
      baseUrl: srv.baseUrl,
      apiPath: '/creators/aklapper',
      creatorHandle: 'aklapper',
      timeoutMs: 1_800,
      maxPages: 10,
      allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
    });
    expect(res.ok).toBe(true);
    if (!res.ok || res.notModified) throw new Error('Expected article fallback items');
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.slug).toBe('stretched-card-skill');
    expect(res.items[0]?.name).toBe('Stretched &#9999999; Card');
    expect(res.items[0]?.summary).toBe(`Real summary with & <safe> "quotes" 'ok'.`);
    expect(infoSpy.mock.calls.map(c => String(c[0])).join('\n')).toContain('html_fallback');
  });

  it('parses 480 KiB of pathological unclosed script and anchor tags in linear time (<50ms)', async () => {
    const { parseAgensiCreatorHtml } = await import('../src/agensi.ts');
    const evilScripts = '<script data-tsr-stream-part="x" '.repeat(7_500);
    const evilAnchors = '<a href="/skills/x" '.repeat(12_000);
    const payload = `${evilScripts}${evilAnchors}`;
    expect(payload.length).toBeGreaterThan(450_000);

    const started = performance.now();
    const res = parseAgensiCreatorHtml(payload, {
      creatorHandle: 'aklapper',
      finalUrl: 'https://www.agensi.io/creators/aklapper',
    });
    const elapsedMs = performance.now() - started;

    expect(res.ok).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });

  it('rejects untrusted initial AGENSI_API_BASE_URL on hop 0 without calling fetchImpl or leaking x-api-key', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn<typeof fetch>();

    const res = await fetchAgensiCreatorCatalog(
      {
        baseUrl: 'https://evil.example.com',
        apiPath: '/creators/aklapper',
        creatorHandle: 'aklapper',
        apiKey: 'never-send-this-key',
        timeoutMs: 1_800,
        maxPages: 10,
        allowedOrigins: ['https://agensi.io', 'https://www.agensi.io'],
      },
      { fetchImpl: fetchSpy },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected untrusted initial origin failure');
    expect(res.errorCode).toBe('AGENSI_UNTRUSTED_ORIGIN');
    const warnLogs = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnLogs).toContain('agensi.catalog.untrusted_redirect');
    expect(warnLogs).not.toContain('never-send-this-key');
  });
});
