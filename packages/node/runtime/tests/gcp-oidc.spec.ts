import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearGcpIdentityTokenCacheForTest,
  INTERNAL_AUTH_HEADER,
  proxyJson,
  proxySse,
  resolveGcpIdentityToken,
  resolveTrustedClientIp,
  shouldAttachGcpOidcToken,
  verifyInternalAuthToken,
} from '../src/http.ts';

function buildMockJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'sa@test', exp: expSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

describe('@aklapper/node-runtime gcp-oidc and trusted proxy helpers', () => {
  afterEach(() => {
    clearGcpIdentityTokenCacheForTest();
  });

  it('scopes OIDC identity token attachment strictly to Cloud Run / configured GCP hosts', () => {
    expect(shouldAttachGcpOidcToken('https://node-api-auth-xyz.a.run.app')).toBe(true);
    expect(
      shouldAttachGcpOidcToken('https://auth.bgdkapis.us', {
        GCP_OIDC_AUDIENCE_HOSTS: 'auth.bgdkapis.us,analytics.bgdkapis.us',
      }),
    ).toBe(true);
    expect(shouldAttachGcpOidcToken('http://127.0.0.1:4101')).toBe(false);
    expect(shouldAttachGcpOidcToken('http://localhost:4301')).toBe(false);
    expect(shouldAttachGcpOidcToken('https://cluster.us-east4.gcp.cloud.qdrant.io')).toBe(false);
  });

  it('attaches cached Metadata OIDC Bearer token on Cloud Run calls and refreshes at exp - 60s or 401 retry', async () => {
    const infoLogs: string[] = [];
    const warnLogs: string[] = [];
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      infoLogs.push(String(msg));
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const jwt1 = buildMockJwt(nowSec + 600);
      const jwt2 = buildMockJwt(nowSec + 1200);
      let metadataFetches = 0;
      const seenMetadataFlavors: Array<string | null> = [];
      const seenBearerHeaders: Array<string | null> = [];
      const seenInternalHeaders: Array<string | null> = [];
      let upstreamStatus = 200;

      const mockFetch: typeof fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const headers = new Headers(init?.headers);
        if (url.startsWith('http://metadata.google.internal')) {
          metadataFetches += 1;
          seenMetadataFlavors.push(headers.get('Metadata-Flavor'));
          return new Response(metadataFetches === 1 ? jwt1 : jwt2, { status: 200 });
        }
        seenBearerHeaders.push(headers.get('authorization'));
        seenInternalHeaders.push(headers.get(INTERNAL_AUTH_HEADER));
        if (upstreamStatus === 401) {
          upstreamStatus = 200;
          return new Response('unauthorized', { status: 401 });
        }
        return Response.json({ ok: true });
      };

      const res1 = await proxyJson<{ ok: boolean }>({
        baseUrl: 'https://node-api-auth-abc.a.run.app',
        path: '/v1/auth/session',
        internalAuth: { role: 'service', subject: 'portal', secret: 'test-hmac-secret' },
        fetchImpl: mockFetch,
      });
      const res2 = await proxyJson<{ ok: boolean }>({
        baseUrl: 'https://node-api-auth-abc.a.run.app',
        path: '/v1/auth/session',
        fetchImpl: mockFetch,
      });

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      expect(metadataFetches).toBe(1);
      expect(seenMetadataFlavors).toEqual(['Google']);
      expect(seenBearerHeaders).toEqual([`Bearer ${jwt1}`, `Bearer ${jwt1}`]);
      expect(verifyInternalAuthToken(seenInternalHeaders[0], 'test-hmac-secret')?.sub).toBe(
        'portal',
      );

      // Upstream 401 on GET evicts cache and retries metadata fetch once
      upstreamStatus = 401;
      const retried = await proxyJson<{ ok: boolean }>({
        baseUrl: 'https://node-api-auth-abc.a.run.app',
        path: '/v1/auth/session',
        fetchImpl: mockFetch,
      });
      expect(retried.ok).toBe(true);
      expect(metadataFetches).toBe(2);
      expect(seenBearerHeaders[2]).toBe(`Bearer ${jwt1}`);
      expect(seenBearerHeaders[3]).toBe(`Bearer ${jwt2}`);

      expect(infoLogs.some(line => line.includes('"branch":"metadata_refreshed"'))).toBe(true);
      expect(infoLogs.some(line => line.includes('"branch":"cache_hit"'))).toBe(true);
      expect(warnLogs.some(line => line.includes('"branch":"retry_401_refreshed"'))).toBe(true);
      expect(infoLogs.every(line => line.includes('runtime.oidc_token.resolution'))).toBe(true);

      // Near-expiry (< 60s before exp) refreshes proactively without using stale entry
      const nearExpiry = buildMockJwt(Math.floor(Date.now() / 1000) + 30);
      const refreshed = buildMockJwt(Math.floor(Date.now() / 1000) + 900);
      clearGcpIdentityTokenCacheForTest();
      let expCalls = 0;
      const expFetch: typeof fetch = async () => {
        expCalls += 1;
        return new Response(expCalls === 1 ? nearExpiry : refreshed, { status: 200 });
      };
      expect(
        await resolveGcpIdentityToken('https://node-api-analytics-abc.a.run.app', {
          fetchImpl: expFetch,
        }),
      ).toBe(nearExpiry);
      expect(
        await resolveGcpIdentityToken('https://node-api-analytics-abc.a.run.app', {
          fetchImpl: expFetch,
        }),
      ).toBe(refreshed);
      expect(expCalls).toBe(2);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('fails explicitly with GCP_OIDC_TOKEN_UNAVAILABLE on metadata outage and skips non-GCP URLs', async () => {
    const infoLogs: string[] = [];
    const warnLogs: string[] = [];
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      infoLogs.push(String(msg));
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });
    try {
      const failingMetadataFetch: typeof fetch = async () => new Response('down', { status: 503 });

      await expect(
        resolveGcpIdentityToken('https://node-api-auth-abc.a.run.app', {
          fetchImpl: failingMetadataFetch,
        }),
      ).rejects.toThrow(/GCP_OIDC_TOKEN_UNAVAILABLE/);

      const failedProxy = await proxyJson({
        baseUrl: 'https://node-api-auth-abc.a.run.app',
        path: '/v1/auth/session',
        fetchImpl: failingMetadataFetch,
      });
      expect(failedProxy.ok).toBe(false);
      expect(failedProxy.status).toBe(503);
      expect(failedProxy.error).toBe('GCP_OIDC_TOKEN_UNAVAILABLE');

      let qdrantAuthHeader: string | null = 'unexpected';
      const qdrantRes = await proxyJson({
        baseUrl: 'https://cluster.example.qdrant.io',
        path: '/collections/portfolio_docs',
        headers: { 'api-key': 'qdrant-secret' },
        oidcAuth: false,
        fetchImpl: async (_url, init) => {
          qdrantAuthHeader = new Headers(init?.headers).get('authorization');
          return Response.json({ result: { status: 'green' } });
        },
      });
      expect(qdrantRes.ok).toBe(true);
      expect(qdrantAuthHeader).toBeNull();

      const thirdPartyAutoRes = await proxyJson({
        baseUrl: 'https://thirdparty.example.com',
        path: '/ping',
        fetchImpl: async () => Response.json({ ok: true }),
      });
      expect(thirdPartyAutoRes.ok).toBe(true);

      expect(warnLogs.some(line => line.includes('"branch":"metadata_unavailable"'))).toBe(true);
      expect(
        infoLogs.some(
          line =>
            line.includes('runtime.oidc_token.resolution') &&
            line.includes('"branch":"skipped_non_gcp_target"') &&
            line.includes('thirdparty.example.com'),
        ),
      ).toBe(true);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('attaches OIDC token in proxySse when targeting Cloud Run URL and rejects forged x-internal-client-ip', async () => {
    const jwt = buildMockJwt(Math.floor(Date.now() / 1000) + 600);
    let capturedAuth: string | null = null;
    const sseRes = await proxySse({
      baseUrl: 'https://k8s-watch-abc.a.run.app',
      path: '/v1/cluster/stream',
      fetchImpl: async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('http://metadata.google.internal')) {
          return new Response(jwt, { status: 200 });
        }
        capturedAuth = new Headers(init?.headers).get('authorization');
        return new Response('event: pod\ndata: {}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      },
    });
    expect(sseRes.status).toBe(200);
    expect(capturedAuth).toBe(`Bearer ${jwt}`);

    const forged = resolveTrustedClientIp(
      {
        headers: { 'x-internal-client-ip': 'v1.forged.token' },
        ip: '198.51.100.10',
      },
      { NODE_ENV: 'production', INTERNAL_AUTH_SECRET: 'real-secret' },
    );
    expect(forged).toBe('198.51.100.10');
  });
});
