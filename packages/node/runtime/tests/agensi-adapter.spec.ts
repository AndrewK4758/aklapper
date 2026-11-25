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

  it('skips network I/O when base URL is unset and stops runaway pagination at 10 pages', async () => {
    const unconfiguredCfg = resolveAgensiCatalogConfig({});
    expect(unconfiguredCfg.baseUrl).toBeNull();
    const unsetRes = await fetchAgensiCreatorCatalog({
      baseUrl: '',
      apiPath: '/api/creators/aklapper',
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
});
