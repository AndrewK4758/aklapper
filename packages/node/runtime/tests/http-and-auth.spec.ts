import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_SESSION_COOKIE_NAME,
  buildDailyAnalyticsSalt,
  buildTotpOtpAuthUrl,
  clearSessionCookie,
  computeTotpCode,
  decryptTotpSecret,
  encodeBase32,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  GUEST_SESSION_COOKIE_NAME,
  hashBackupCode,
  hashVisitorIp,
  isSafeRedirectTarget,
  isSecureRequest,
  parseCookieHeader,
  sanitizeRedirectTarget,
  serializeSessionCookie,
  verifyBackupCode,
  verifyTotpCode,
} from '../src/auth.ts';
import {
  INTERNAL_AUTH_HEADER,
  joinUpstreamUrl,
  proxyJson,
  proxySse,
  signInternalAuthToken,
  verifyInternalAuthToken,
} from '../src/http.ts';

describe('@aklapper/node-runtime/http & auth', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalInternalSecret = process.env['INTERNAL_AUTH_SECRET'];
  const originalTotpKey = process.env['TOTP_ENCRYPTION_KEY'];

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;

    if (originalInternalSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
    else process.env['INTERNAL_AUTH_SECRET'] = originalInternalSecret;

    if (originalTotpKey === undefined) delete process.env['TOTP_ENCRYPTION_KEY'];
    else process.env['TOTP_ENCRYPTION_KEY'] = originalTotpKey;

    vi.restoreAllMocks();
  });

  it('joins upstream base URLs and paths without duplicate slashes', () => {
    expect(joinUpstreamUrl('http://127.0.0.1:8081/', '/v1/pods')).toBe(
      'http://127.0.0.1:8081/v1/pods',
    );
    expect(joinUpstreamUrl('http://127.0.0.1:8081', 'v1/pods')).toBe(
      'http://127.0.0.1:8081/v1/pods',
    );
  });

  it('signs and verifies HMAC-SHA256 internal auth tokens matching the cross-language vector', () => {
    const token = signInternalAuthToken({
      role: 'admin',
      subject: 'user-1',
      secret: 'cross-lang-test-secret',
      nowSeconds: 1_700_000_000,
      ttlSeconds: 300,
    });
    expect(token).toBe(
      'v1.eyJyb2xlIjoiYWRtaW4iLCJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDMwMH0.RlpNGuDUf8pZ9CB1C_3_4rtJfy7xmFw8ptVCmk4_FQs',
    );

    const claims = verifyInternalAuthToken(token, 'cross-lang-test-secret', 1_700_000_100);
    expect(claims).toEqual({
      role: 'admin',
      sub: 'user-1',
      iat: 1_700_000_000,
      exp: 1_700_000_300,
    });

    // Expired token rejected
    expect(verifyInternalAuthToken(token, 'cross-lang-test-secret', 1_700_000_300)).toBeNull();
    // Tampered token rejected
    expect(
      verifyInternalAuthToken(`${token.slice(0, -2)}AA`, 'cross-lang-test-secret', 1_700_000_100),
    ).toBeNull();
    // Wrong secret rejected
    expect(verifyInternalAuthToken(token, 'wrong-secret', 1_700_000_100)).toBeNull();
  });

  it('fails closed in production when INTERNAL_AUTH_SECRET is unset', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['INTERNAL_AUTH_SECRET'];

    expect(() => signInternalAuthToken({ role: 'admin', subject: 'user-1' })).toThrow(
      /INTERNAL_AUTH_SECRET/,
    );
    expect(verifyInternalAuthToken('v1.abc.def')).toBeNull();
  });

  it('proxies JSON and SSE requests with internal auth injection and clean error mapping', async () => {
    let capturedAuthHeader: string | null = null;
    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedAuthHeader = headers.get(INTERNAL_AUTH_HEADER);
      return Response.json({ ok: true, echoed: init?.body ? JSON.parse(String(init.body)) : null });
    };

    const result = await proxyJson<{ ok: boolean; echoed: { ping: string } }>({
      baseUrl: 'http://127.0.0.1:8085',
      path: '/v1/admin/status',
      method: 'POST',
      body: { ping: 'pong' },
      internalAuth: {
        role: 'admin',
        subject: 'admin-1',
        secret: 'proxy-secret',
      },
      fetchImpl: mockFetch,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true, echoed: { ping: 'pong' } });
    expect(capturedAuthHeader).not.toBeNull();
    expect(verifyInternalAuthToken(capturedAuthHeader, 'proxy-secret')?.role).toBe('admin');

    const failResult = await proxyJson({
      baseUrl: 'http://127.0.0.1:8085',
      path: '/v1/down',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(failResult.ok).toBe(false);
    expect(failResult.status).toBe(502);
    expect(failResult.error).toBe('UPSTREAM_UNAVAILABLE');

    const sseRes = await proxySse({
      baseUrl: 'http://127.0.0.1:8081',
      path: '/v1/cluster/stream',
      fetchImpl: async () =>
        new Response('event: pod\ndata: {"ok":true}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');
    expect(sseRes.headers.get('x-accel-buffering')).toBe('no');
    expect(await sseRes.text()).toContain('{"ok":true}');
  });

  it('parses, serializes, and clears session cookies and validates safe redirect targets', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(
      parseCookieHeader(
        `${ADMIN_SESSION_COOKIE_NAME}=tok%201; ${GUEST_SESSION_COOKIE_NAME}=guest-2; bad=%E0%A4%A; empty`,
      ),
    ).toEqual({
      [ADMIN_SESSION_COOKIE_NAME]: 'tok 1',
      [GUEST_SESSION_COOKIE_NAME]: 'guest-2',
      bad: '%E0%A4%A',
    });

    const cookie = serializeSessionCookie(ADMIN_SESSION_COOKIE_NAME, 'sess-123', {
      maxAgeSeconds: 3600,
      secure: true,
    });
    expect(cookie).toContain('ak_admin_session=sess-123');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=3600');

    const cleared = clearSessionCookie(ADMIN_SESSION_COOKIE_NAME);
    expect(cleared).toContain('ak_admin_session=');
    expect(cleared).toContain('Max-Age=0');

    expect(isSecureRequest('https://admin.andrew-k.us/login')).toBe(true);
    expect(isSecureRequest('http://localhost:4301/login')).toBe(false);
    expect(isSecureRequest('http://localhost:4301/login', 'https')).toBe(true);

    expect(isSafeRedirectTarget('/analytics?window=7d')).toBe(true);
    expect(isSafeRedirectTarget('//evil.example/phish')).toBe(false);
    expect(isSafeRedirectTarget('https://evil.example')).toBe(false);
    expect(isSafeRedirectTarget('/foo\r\nSet-Cookie: bad=1')).toBe(false);
    expect(sanitizeRedirectTarget('//evil.example', '/')).toBe('/');
    expect(sanitizeRedirectTarget('/analytics', '/')).toBe('/analytics');
  });

  it('implements RFC 6238 TOTP, AES-256-GCM encryption, backup codes, and daily IP hashing', () => {
    // RFC 6238 SHA-1 test vector: ASCII '12345678901234567890' at T=59s -> 287082
    const rfcSecret = encodeBase32(Buffer.from('12345678901234567890', 'ascii'));
    expect(computeTotpCode(rfcSecret, 59_000, 30, 6)).toBe('287082');
    expect(verifyTotpCode(rfcSecret, '287082', { timestampMs: 59_000 })).toBe(true);
    expect(verifyTotpCode(rfcSecret, '287082', { timestampMs: 89_000, window: 1 })).toBe(true);
    expect(verifyTotpCode(rfcSecret, '000000', { timestampMs: 59_000 })).toBe(false);

    const generated = generateTotpSecret();
    const url = buildTotpOtpAuthUrl({ secret: generated, accountName: 'admin' });
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(`secret=${generated}`);

    const encrypted = encryptTotpSecret(generated, 'unit-test-key');
    expect(encrypted).not.toContain(generated);
    expect(decryptTotpSecret(encrypted, 'unit-test-key')).toBe(generated);
    expect(() => decryptTotpSecret(encrypted, 'wrong-key')).toThrow(
      /Unsupported state|unable to authenticate/i,
    );

    process.env['NODE_ENV'] = 'production';
    delete process.env['TOTP_ENCRYPTION_KEY'];
    expect(() => encryptTotpSecret(generated)).toThrow(/TOTP_ENCRYPTION_KEY/);

    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    const hashes = codes.map(hashBackupCode);
    const check = verifyBackupCode(codes[2]!.toLowerCase().replace('-', ''), hashes);
    expect(check.matched).toBe(true);
    expect(check.remainingHashes).toHaveLength(7);
    expect(verifyBackupCode(codes[2]!, check.remainingHashes).matched).toBe(false);

    const salt = buildDailyAnalyticsSalt('test-salt', new Date('2026-11-24T12:00:00Z'));
    expect(salt).toBe('test-salt:2026-11-24');
    expect(hashVisitorIp('127.0.0.1', salt)).toMatch(/^[a-f0-9]{24}$/);
  });
});
