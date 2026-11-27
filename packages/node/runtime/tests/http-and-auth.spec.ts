import { PassThrough } from 'node:stream';

import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_SESSION_COOKIE_NAME,
  ARGON2ID_DEFAULTS,
  Argon2ConcurrencyError,
  AUTH_LOG_REDACT_PATHS,
  buildDailyAnalyticsSalt,
  buildPreviousUtcDayAnalyticsSalt,
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
  hashPasswordArgon2id,
  hashVisitorIdentity,
  hashVisitorIp,
  isSafeRedirectTarget,
  isSecureRequest,
  isWithinUtcMidnightGraceWindow,
  parseArgon2idPhc,
  parseCookieHeader,
  sanitizeRedirectTarget,
  serializeSessionCookie,
  verifyBackupCode,
  verifyPasswordArgon2id,
  verifyTotpCode,
} from '../src/auth.ts';
import {
  INTERNAL_AUTH_HEADER,
  joinUpstreamUrl,
  proxyJson,
  proxySse,
  resolveAnalyticsClientIp,
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
    expect(isSecureRequest('http://localhost:4301/login', 'http, https')).toBe(true);
    expect(isSecureRequest('https://admin.andrew-k.us/login', 'https, http')).toBe(false);

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

  it('hashes and verifies passwords with bounded OWASP Argon2id PHC parameters', async () => {
    expect(ARGON2ID_DEFAULTS).toEqual({
      memory: 19456,
      passes: 2,
      parallelism: 1,
      saltLength: 16,
      tagLength: 32,
    });

    const hash = await hashPasswordArgon2id('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);

    const parsed = parseArgon2idPhc(hash);
    expect(parsed).not.toBeNull();
    expect(parsed?.memory).toBe(19456);
    expect(parsed?.passes).toBe(2);
    expect(parsed?.parallelism).toBe(1);
    expect(parsed?.salt.length).toBe(16);
    expect(parsed?.hash.length).toBe(32);

    expect(await verifyPasswordArgon2id('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPasswordArgon2id('wrong-password', hash)).toBe(false);
  });

  it('rejects empty passwords and malformed, padded, or out-of-bounds Argon2id PHC hashes', async () => {
    await expect(hashPasswordArgon2id('')).rejects.toThrow(/password/i);
    await expect(hashPasswordArgon2id('a'.repeat(1025))).rejects.toThrow(/password/i);
    await expect(hashPasswordArgon2id('valid-pw', { memory: 131072 })).rejects.toThrow(/memory/i);

    const validSalt = Buffer.alloc(16, 0xff).toString('base64').replace(/=+$/, '');
    const validTag = Buffer.alloc(32, 0xfe).toString('base64').replace(/=+$/, '');
    const paddedSalt = `${validSalt}==`;
    const urlSafeSalt = validSalt.replace(/\+/g, '-').replace(/\//g, '_');

    const invalidHashes = [
      '',
      'not-a-phc',
      `$argon2i$v=19$m=19456,t=2,p=1$${validSalt}$${validTag}`,
      `$argon2id$v=18$m=19456,t=2,p=1$${validSalt}$${validTag}`,
      `$argon2id$v=19$m=2048,t=2,p=1$${validSalt}$${validTag}`,
      `$argon2id$v=19$m=131072,t=2,p=1$${validSalt}$${validTag}`,
      `$argon2id$v=19$m=19456,t=0,p=1$${validSalt}$${validTag}`,
      `$argon2id$v=19$m=19456,t=2,p=8$${validSalt}$${validTag}`,
      `$argon2id$v=19$m=19456,t=2,p=1$${paddedSalt}$${validTag}`,
      `$argon2id$v=19$m=19456,t=2,p=1$${urlSafeSalt}$${validTag}`,
      `$argon2id$v=19$m=19456,t=2,p=1$short$short`,
    ];

    for (const bad of invalidHashes) {
      expect(parseArgon2idPhc(bad)).toBeNull();
      expect(await verifyPasswordArgon2id('any-password', bad)).toBe(false);
    }

    expect(await verifyPasswordArgon2id('any-password', null)).toBe(false);
    expect(await verifyPasswordArgon2id('any-password', undefined)).toBe(false);
  });

  it('caps concurrent Argon2id derivations at 2 and recovers after slots clear', async () => {
    const hash = await hashPasswordArgon2id('concurrency-test-secret');

    const p1 = verifyPasswordArgon2id('concurrency-test-secret', hash);
    const p2 = verifyPasswordArgon2id('concurrency-test-secret', hash);
    const p3 = verifyPasswordArgon2id('concurrency-test-secret', hash);

    const settled = await Promise.allSettled([p1, p2, p3]);
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    expect(rejected[0]?.reason).toBeInstanceOf(Argon2ConcurrencyError);

    expect(await verifyPasswordArgon2id('concurrency-test-secret', hash)).toBe(true);
  });

  it('redacts sensitive auth headers, cookies, and credential fields in Pino logs', async () => {
    const chunks: string[] = [];
    const stream = new PassThrough();
    stream.on('data', chunk => {
      chunks.push(Buffer.from(chunk).toString('utf8'));
    });

    const app = Fastify({
      logger: {
        stream,
        redact: {
          paths: [...AUTH_LOG_REDACT_PATHS],
          censor: '[REDACTED]',
        },
      },
    });

    app.post('/probe', async (request, reply) => {
      request.log.info(
        {
          payload: {
            password: 'super-secret-password',
            passwordHashArgon2: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
            secret: 'base32-totp-secret',
            totpKey: 'aes-key-material',
          },
        },
        'auth probe',
      );
      reply.header('set-cookie', 'ak_admin_session=secret-session-cookie; HttpOnly');
      return { ok: true };
    });

    try {
      await app.inject({
        method: 'POST',
        url: '/probe',
        headers: {
          cookie: 'ak_admin_session=incoming-cookie',
          authorization: 'Bearer secret-bearer',
          'x-internal-auth': 'v1.internal.hmac',
          'x-bootstrap-token': 'legacy-boot-secret',
        },
      });
    } finally {
      await app.close();
    }

    const joined = chunks.join('');
    expect(joined).not.toContain('super-secret-password');
    expect(joined).not.toContain('$argon2id$v=19$m=19456');
    expect(joined).not.toContain('base32-totp-secret');
    expect(joined).not.toContain('aes-key-material');
    expect(joined).not.toContain('incoming-cookie');
    expect(joined).not.toContain('secret-bearer');
    expect(joined).not.toContain('v1.internal.hmac');
    expect(joined).not.toContain('legacy-boot-secret');
    expect(joined).not.toContain('secret-session-cookie');
    expect(joined).toContain('[REDACTED]');
  });

  it('resolves analytics client IP canonically across X-Forwarded-For, X-Real-IP, and loopback fallback', () => {
    const reqXff = new Request('https://andrew-k.us/', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.42',
        'x-real-ip': '198.51.100.99',
      },
    });
    expect(resolveAnalyticsClientIp(reqXff)).toBe('198.51.100.42');

    const reqRealIp = new Request('https://andrew-k.us/', {
      headers: { 'x-real-ip': '198.51.100.99' },
    });
    expect(resolveAnalyticsClientIp(reqRealIp)).toBe('198.51.100.99');

    const reqNone = new Request('https://andrew-k.us/');
    expect(resolveAnalyticsClientIp(reqNone)).toBe('127.0.0.1');
  });

  it('computes prior-day UTC salt and 30-minute UTC-midnight grace window for daily visitor hashing', () => {
    const justAfterMidnight = new Date('2026-11-28T00:05:00.000Z');
    const midday = new Date('2026-11-28T12:00:00.000Z');

    expect(isWithinUtcMidnightGraceWindow(justAfterMidnight)).toBe(true);
    expect(isWithinUtcMidnightGraceWindow(midday)).toBe(false);
    expect(buildDailyAnalyticsSalt('base-salt', justAfterMidnight)).toBe('base-salt:2026-11-28');
    expect(buildPreviousUtcDayAnalyticsSalt('base-salt', justAfterMidnight)).toBe(
      'base-salt:2026-11-27',
    );

    const priorHash = hashVisitorIdentity(
      '198.51.100.42',
      'Mozilla/5.0 Safari/605',
      buildPreviousUtcDayAnalyticsSalt('base-salt', justAfterMidnight),
    );
    const yesterdayHash = hashVisitorIdentity(
      '198.51.100.42',
      'Mozilla/5.0 Safari/605',
      buildDailyAnalyticsSalt('base-salt', new Date('2026-11-27T23:55:00.000Z')),
    );
    expect(priorHash).toBe(yesterdayHash);
  });
});
