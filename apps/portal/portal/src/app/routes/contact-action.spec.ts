import { createHash } from 'node:crypto';

import {
  CONTACT_FORM_DEFINITION,
  type ContactFormSubmission,
  type ContactSubmissionSummary,
  type PortalContactLoaderData,
} from '@aklapper/core';
import { ContactDbConstraintError } from '@aklapper/db';
import { INTERNAL_AUTH_HEADER } from '@aklapper/node-runtime/http';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  getSharedDbMock,
  consumeRateLimitMock,
  loadPortalContactDataMock,
  insertContactSubmissionMock,
  handleAnalyticsIngestRequestMock,
  resolveOrCreateContactAnalyticsSessionMock,
  recordContactSubmittedAnalyticsEventMock,
} = vi.hoisted(() => ({
  getSharedDbMock: vi.fn<() => Record<string, never>>(() => ({})),
  consumeRateLimitMock: vi.fn<
    (
      db: unknown,
      scopeKey: string,
      options: { maxAttempts: number; windowMs: number },
    ) => Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>
  >(async () => ({ allowed: true, remaining: 19, retryAfterSeconds: 60 })),
  loadPortalContactDataMock: vi.fn<() => Promise<PortalContactLoaderData>>(),
  insertContactSubmissionMock:
    vi.fn<
      (
        db: unknown,
        submission: ContactFormSubmission,
        link?: { analyticsSessionId?: string | null; guestSessionId?: string | null },
      ) => Promise<ContactSubmissionSummary>
    >(),
  handleAnalyticsIngestRequestMock:
    vi.fn<(request: Request, options?: Record<string, unknown>) => Promise<Response>>(),
  resolveOrCreateContactAnalyticsSessionMock: vi.fn<
    (
      db: unknown,
      request: Request,
      options?: Record<string, unknown>,
    ) => Promise<{
      analyticsSessionId: string | null;
      guestSessionId: string | null;
      linkMethod: string;
      spoofRejected: boolean;
    }>
  >(async () => ({
    analyticsSessionId: 'sess_default_linked',
    guestSessionId: null,
    linkMethod: 'verified_client_session',
    spoofRejected: false,
  })),
  recordContactSubmittedAnalyticsEventMock: vi.fn<
    (db: unknown, sessionId: string | null | undefined) => Promise<void>
  >(async () => undefined),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: getSharedDbMock,
    consumeRateLimit: consumeRateLimitMock,
    loadPortalContactData: loadPortalContactDataMock,
    insertContactSubmission: insertContactSubmissionMock,
    resolveOrCreateContactAnalyticsSession: resolveOrCreateContactAnalyticsSessionMock,
    recordContactSubmittedAnalyticsEvent: recordContactSubmittedAnalyticsEventMock,
  };
});

vi.mock('@aklapper/db/analytics', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db/analytics')>();
  return {
    ...actual,
    handleAnalyticsIngestRequest: handleAnalyticsIngestRequestMock,
  };
});

import { bootstrapDocumentAnalytics, resetAnalyticsBootstrap } from '@aklapper/core/analytics';
import { GUEST_SESSION_COOKIE_NAME, signGuestSessionCookie } from '@aklapper/node-runtime/auth';

import {
  processContactSubmission,
  resetContactRateLimiterForTest,
  resolveClientKey,
} from '../contact-submission.server';
import { submitPortalContactForm } from '../terminalForms';
import { action as analyticsIngestAction } from './api.analytics.ingest';
import { action as apiContactAction } from './api.contact';
import { action as contactRouteAction } from './contact';

const CONTACT_LOADER_FIXTURE: PortalContactLoaderData = {
  content: {
    windowTitle: 'tui :: andrew-k.us // contact',
    statusBadge: { source: 'contact-form', state: 'ready', label: 'zod + pg19' },
    description: 'Send a validated message directly into Postgres 19.',
    form: CONTACT_FORM_DEFINITION,
  },
};

function makeRequest(
  formDataImpl: () => Promise<FormData>,
  headers: Record<string, string> = {},
): Request {
  return { headers: new Headers(headers), formData: formDataImpl } as unknown as Request;
}

function makeFileWithBuffer(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  if (typeof file.arrayBuffer !== 'function') {
    const encoded = new TextEncoder().encode(content);
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () =>
        encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength),
    });
  }
  return file;
}

function makeValidFormData(): FormData {
  const fd = new FormData();
  fd.set('name', 'Ada Lovelace');
  fd.set('email', 'ada@example.com');
  fd.set('message', 'Validating structured contact write-gate behavior.');
  return fd;
}

function makeMockLogger() {
  const errorCalls: Array<Record<string, unknown>> = [];
  const logger: SsrStructuredLogger = {
    info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(obj => {
      errorCalls.push(obj);
    }),
  };
  return { logger, errorCalls };
}

describe('processContactSubmission & resource action routes', () => {
  afterEach(() => {
    resetContactRateLimiterForTest();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects malformed payloads, honeypot triggers, and disallowed attachments with 400 ERR_VALIDATION', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);

    const malformed = await processContactSubmission(
      makeRequest(async () => {
        throw new TypeError('Invalid multipart body');
      }),
      { correlationId: 'corr-400-malformed' },
    );
    expect(malformed.status).toBe(400);
    expect(malformed.payload).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_VALIDATION',
      correlationId: 'corr-400-malformed',
    });

    const honeypotFd = makeValidFormData();
    honeypotFd.set('website', 'https://spam.example.invalid');
    const honeypot = await processContactSubmission(
      makeRequest(async () => honeypotFd),
      { correlationId: 'corr-400-honeypot' },
    );
    expect(honeypot.status).toBe(400);
    expect(honeypot.payload).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_VALIDATION',
      correlationId: 'corr-400-honeypot',
    });

    const badFileFd = makeValidFormData();
    badFileFd.set('file', makeFileWithBuffer('#!/bin/sh', 'exploit.sh', 'text/plain'));
    const badFile = await processContactSubmission(
      makeRequest(async () => badFileFd),
      { correlationId: 'corr-400-file' },
    );
    expect(badFile.status).toBe(400);
    expect(badFile.payload).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_VALIDATION',
      correlationId: 'corr-400-file',
      fieldErrors: { file: expect.any(Array) },
    });
    expect(insertContactSubmissionMock).not.toHaveBeenCalled();
  });

  it('returns 429 ERR_RATE_LIMITED with Retry-After and hashes rightmost X-Forwarded-For IP', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    consumeRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });
    const badFd = new FormData();
    const limited = await processContactSubmission(
      makeRequest(async () => badFd, { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' }),
      { correlationId: 'corr-429' },
    );
    expect(limited.status).toBe(429);
    expect(limited.retryAfterSeconds).toBe(42);
    expect(limited.payload).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_RATE_LIMITED',
      correlationId: 'corr-429',
    });
    const expectedDigest = createHash('sha256').update('203.0.113.10').digest('hex').slice(0, 32);
    expect(consumeRateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      `contact:ip:${expectedDigest}`,
      { maxAttempts: 20, windowMs: 60_000 },
    );
    expect(insertContactSubmissionMock).not.toHaveBeenCalled();

    consumeRateLimitMock.mockRejectedValueOnce(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5439'), { code: 'ECONNREFUSED' }),
    );
    const failedClosed = await processContactSubmission(
      makeRequest(async () => badFd, { 'x-forwarded-for': '203.0.113.10' }),
      { correlationId: 'corr-503-rl' },
    );
    expect(failedClosed.status).toBe(503);
    expect(failedClosed.payload).toMatchObject({
      ok: false,
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-503-rl',
    });
  });

  it('commits valid multipart submissions with SHA-256 digest and returns 201', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    const payloadText = 'FLOW-MATIC specification';
    const expectedSha = createHash('sha256').update(Buffer.from(payloadText)).digest('hex');
    const summary: ContactSubmissionSummary = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '+1 (555) 867-5309',
      attachmentName: 'spec.txt',
      attachmentSizeBytes: Buffer.byteLength(payloadText),
      attachmentSha256: expectedSha,
      createdAt: '2026-11-24T12:34:56.000Z',
    };
    insertContactSubmissionMock.mockResolvedValueOnce(summary);

    const fd = new FormData();
    fd.set('name', '  Grace Hopper ');
    fd.set('email', 'GRACE@EXAMPLE.COM');
    fd.set('phone', '+1 (555) 867-5309');
    fd.set('message', 'Testing valid multipart submission with attachment.');
    fd.set('file', makeFileWithBuffer(payloadText, '../spec.txt', 'text/plain'));

    const res = await processContactSubmission(
      makeRequest(async () => fd),
      {
        correlationId: 'corr-201',
      },
    );
    expect(res.status).toBe(201);
    expect(res.payload).toEqual({ ok: true, submission: summary });
    expect(insertContactSubmissionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Grace Hopper',
        email: 'grace@example.com',
        attachment: expect.objectContaining({ filename: 'spec.txt', sha256: expectedSha }),
      }),
      { analyticsSessionId: 'sess_default_linked', guestSessionId: null },
    );
  });

  it('maps ContactDbConstraintError to 422 with ERR_CONSTRAINT and correlationId', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    insertContactSubmissionMock.mockRejectedValueOnce(
      new ContactDbConstraintError(
        'contact_email_format_check',
        { email: ['Database constraint rejected Email format.'] },
        'Database constraint rejected Email format.',
      ),
    );

    const res = await processContactSubmission(
      makeRequest(async () => makeValidFormData()),
      {
        correlationId: 'corr-422',
      },
    );
    expect(res.status).toBe(422);
    expect(res.payload).toMatchObject({
      ok: false,
      source: 'database',
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-422',
      fieldErrors: { email: ['Database constraint rejected Email format.'] },
    });
  });

  it('classifies DB outages during load and insert to HTTP 503 with correlated diagnostic logs', async () => {
    const { logger, errorCalls } = makeMockLogger();

    loadPortalContactDataMock.mockRejectedValueOnce(
      new Error('connection terminated unexpectedly'),
    );
    const loadFail = await processContactSubmission(
      makeRequest(async () => makeValidFormData()),
      { correlationId: 'corr-503-load', logger },
    );
    expect(loadFail.status).toBe(503);
    expect(loadFail.payload).toMatchObject({
      ok: false,
      source: 'database',
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-503-load',
      action: expect.any(String),
    });
    expect(JSON.stringify(loadFail.payload)).not.toContain('connection terminated');

    loadPortalContactDataMock.mockResolvedValueOnce(CONTACT_LOADER_FIXTURE);
    insertContactSubmissionMock.mockRejectedValueOnce(new Error('connection terminated'));
    const insertFail = await processContactSubmission(
      makeRequest(async () => makeValidFormData()),
      { correlationId: 'corr-503-insert', logger },
    );
    expect(insertFail.status).toBe(503);
    expect(insertFail.payload).toMatchObject({
      ok: false,
      source: 'database',
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-503-insert',
      action: expect.any(String),
    });
    expect(JSON.stringify(insertFail.payload)).not.toContain('connection terminated');
    expect(errorCalls).toHaveLength(2);
  });

  it('catches browser network failures in submitPortalContactForm without unhandled rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );

    const result = await submitPortalContactForm(makeValidFormData());
    expect(result).toMatchObject({
      ok: false,
      source: 'client',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      action: expect.any(String),
      fieldErrors: {},
    });
    expect(JSON.stringify(result)).not.toContain('TypeError');
  });

  it('propagates RouterContextProvider correlationId across /contact, /api/contact, and /api/analytics/ingest', async () => {
    const { logger, errorCalls } = makeMockLogger();
    const makeCtx = (correlationId: string) => {
      const ctx = new RouterContextProvider();
      ctx.set(requestContextKey, {
        correlationId,
        logger,
        serviceName: 'portal-ssr',
        signal: new AbortController().signal,
      });
      return ctx;
    };

    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    insertContactSubmissionMock.mockRejectedValueOnce(new Error('connection terminated'));
    const routeRes = await contactRouteAction({
      request: makeRequest(async () => makeValidFormData()),
      params: {},
      context: makeCtx('corr-route-503'),
      url: new URL('http://localhost/contact'),
      pattern: '/contact',
    });
    expect(routeRes.init?.status).toBe(503);
    expect(new Headers(routeRes.init?.headers).get('X-Correlation-Id')).toBe('corr-route-503');
    expect(routeRes.data).toMatchObject({
      ok: false,
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-route-503',
    });

    insertContactSubmissionMock.mockRejectedValueOnce(new Error('connection terminated'));
    const apiRes = await apiContactAction({
      request: makeRequest(async () => makeValidFormData()),
      params: {},
      context: makeCtx('corr-api-503'),
      url: new URL('http://localhost/api/contact'),
      pattern: '/api/contact',
    });
    expect(apiRes.status).toBe(503);
    expect(apiRes.headers.get('X-Correlation-Id')).toBe('corr-api-503');
    expect(await apiRes.json()).toMatchObject({
      ok: false,
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-api-503',
    });

    handleAnalyticsIngestRequestMock.mockRejectedValueOnce(new Error('connection terminated'));
    const analyticsRes = await analyticsIngestAction({
      request: new Request('http://localhost/api/analytics/ingest', { method: 'POST' }),
      params: {},
      context: makeCtx('corr-analytics-503'),
      url: new URL('http://localhost/api/analytics/ingest'),
      pattern: '/api/analytics/ingest',
    });
    expect(analyticsRes.status).toBe(503);
    expect(analyticsRes.headers.get('X-Correlation-Id')).toBe('corr-analytics-503');
    expect(await analyticsRes.json()).toMatchObject({
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-analytics-503',
    });
    expect(errorCalls).toHaveLength(3);
  });

  it('persists contact directly to PG19 without outbound CONTACT_API_URL calls', async () => {
    const origContactUrl = process.env['CONTACT_API_URL'];
    const capturedCalls: Array<{ url: string; token: string | null }> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      capturedCalls.push({ url, token: new Headers(init?.headers).get(INTERNAL_AUTH_HEADER) });
      throw new Error(`Unexpected outbound fetch to ${url}`);
    });

    try {
      process.env['CONTACT_API_URL'] = 'http://127.0.0.1:1';

      loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
      insertContactSubmissionMock.mockResolvedValueOnce({
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-24T15:00:00.000Z',
      });
      const validFd = new FormData();
      validFd.set('name', 'Grace Hopper');
      validFd.set('email', 'grace@example.com');
      validFd.set('message', 'Verifying direct PG19 contact persistence without outbound notify.');
      const res = await processContactSubmission(
        makeRequest(async () => validFd),
        {
          correlationId: 'corr-direct-pg19',
        },
      );
      expect(res.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(capturedCalls.some(c => c.url.includes('/v1/contact/notify'))).toBe(false);
    } finally {
      fetchSpy.mockRestore();
      if (origContactUrl === undefined) delete process.env['CONTACT_API_URL'];
      else process.env['CONTACT_API_URL'] = origContactUrl;
    }
  });

  it('emits outcome audit gap and returns classified 500 when insertContactSubmission lacks id', async () => {
    const { logger, errorCalls } = makeMockLogger();
    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderrChunks.push(String(chunk));
      return true;
    });
    try {
      loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
      insertContactSubmissionMock.mockResolvedValueOnce({
        id: '',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-24T15:00:00.000Z',
      });

      const res = await processContactSubmission(
        makeRequest(async () => makeValidFormData()),
        { correlationId: 'corr-audit-gap', logger },
      );
      expect(res.status).toBe(500);
      expect(res.payload).toMatchObject({
        ok: false,
        correlationId: 'corr-audit-gap',
      });
      expect(errorCalls).toHaveLength(1);
      expect(
        stderrChunks.some(
          line => line.includes('DELTA_AUDIT_GAP') && line.includes('corr-audit-gap'),
        ),
      ).toBe(true);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('unifies client IP resolution via resolveAnalyticsClientIp across XFF, X-Real-IP, and default fallback', () => {
    expect(
      resolveClientKey(
        makeRequest(async () => new FormData(), {
          'x-forwarded-for': '198.51.100.1, 203.0.113.42',
        }),
      ),
    ).toBe('203.0.113.42');
    expect(
      resolveClientKey(makeRequest(async () => new FormData(), { 'x-real-ip': '198.51.100.9' })),
    ).toBe('198.51.100.9');
    expect(resolveClientKey(makeRequest(async () => new FormData()))).toBe('127.0.0.1');
  });

  it('passes server-authoritative portal app and fail-open passive guestSessionId in /api/analytics/ingest', async () => {
    const origSecret = process.env['INTERNAL_AUTH_SECRET'];
    try {
      process.env['INTERNAL_AUTH_SECRET'] = 'test-analytics-secret-0123456789abcdef';
      const signedGuest = signGuestSessionCookie('guest_passive_123');
      handleAnalyticsIngestRequestMock.mockResolvedValueOnce(
        Response.json({ accepted: 1, sessionId: 'sess_p1', ipHash: 'h1' }, { status: 202 }),
      );

      const res = await analyticsIngestAction({
        request: new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: { cookie: `${GUEST_SESSION_COOKIE_NAME}=${signedGuest}` },
        }),
        params: {},
        context: new RouterContextProvider(),
        url: new URL('https://andrew-k.us/api/analytics/ingest'),
        pattern: '/api/analytics/ingest',
      });
      expect(res.status).toBe(202);
      expect(handleAnalyticsIngestRequestMock).toHaveBeenCalledWith(
        expect.any(Request),
        expect.objectContaining({
          app: 'portal',
          guestSessionId: 'guest_passive_123',
        }),
      );

      // Missing INTERNAL_AUTH_SECRET degrades passive guestSessionId to null without throwing
      delete process.env['INTERNAL_AUTH_SECRET'];
      handleAnalyticsIngestRequestMock.mockResolvedValueOnce(
        Response.json({ accepted: 1, sessionId: 'sess_p2', ipHash: 'h2' }, { status: 202 }),
      );
      const resNoSecret = await analyticsIngestAction({
        request: new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: { cookie: `${GUEST_SESSION_COOKIE_NAME}=${signedGuest}` },
        }),
        params: {},
        context: new RouterContextProvider(),
        url: new URL('https://andrew-k.us/api/analytics/ingest'),
        pattern: '/api/analytics/ingest',
      });
      expect(resNoSecret.status).toBe(202);
      expect(handleAnalyticsIngestRequestMock).toHaveBeenLastCalledWith(
        expect.any(Request),
        expect.objectContaining({
          app: 'portal',
          guestSessionId: null,
        }),
      );
    } finally {
      if (origSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = origSecret;
    }
  });

  it('links verified analytics session, emits commit audit without PII, and stays HTTP 201 when analytics linking throws', async () => {
    const infoCalls: Array<Record<string, unknown>> = [];
    const logger: SsrStructuredLogger = {
      info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(obj => {
        infoCalls.push(obj);
      }),
      warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
      error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    };
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    resolveOrCreateContactAnalyticsSessionMock.mockResolvedValueOnce({
      analyticsSessionId: 'sess_verified_99',
      guestSessionId: 'guest_chat_99',
      linkMethod: 'verified_client_session',
      spoofRejected: false,
    });
    insertContactSubmissionMock.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      attachmentName: null,
      attachmentSizeBytes: null,
      attachmentSha256: null,
      createdAt: '2026-11-27T01:00:00.000Z',
    });

    const fd = makeValidFormData();
    fd.set('analyticsSessionId', 'sess_verified_99');
    const okRes = await processContactSubmission(
      makeRequest(async () => fd, { 'x-forwarded-for': '203.0.113.55' }),
      { correlationId: 'corr-link-ok', logger },
    );
    expect(okRes.status).toBe(201);
    expect(resolveOrCreateContactAnalyticsSessionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        candidateSessionId: 'sess_verified_99',
        correlationId: 'corr-link-ok',
      }),
    );
    expect(insertContactSubmissionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Ada Lovelace', email: 'ada@example.com' }),
      { analyticsSessionId: 'sess_verified_99', guestSessionId: 'guest_chat_99' },
    );
    expect(recordContactSubmittedAnalyticsEventMock).toHaveBeenCalledWith(
      expect.anything(),
      'sess_verified_99',
    );
    const auditRecord = infoCalls.find(
      c => c['event'] === 'portal.contact.analytics_link_committed',
    );
    expect(auditRecord).toMatchObject({
      seam_type: 'DELTA_AUDIT_GAP',
      event: 'portal.contact.analytics_link_committed',
      submissionId: '33333333-3333-4333-8333-333333333333',
      linkMethod: 'verified_client_session',
      linkedSessionPresent: true,
      guestSessionLinked: true,
      correlationId: 'corr-link-ok',
    });
    expect(JSON.stringify(auditRecord)).not.toContain('ada@example.com');
    expect(JSON.stringify(auditRecord)).not.toContain('203.0.113.55');

    // Fail-open: analytics resolver throwing must NEVER block HTTP 201 commit
    resolveOrCreateContactAnalyticsSessionMock.mockRejectedValueOnce(
      new Error('analytics db timeout'),
    );
    insertContactSubmissionMock.mockResolvedValueOnce({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      attachmentName: null,
      attachmentSizeBytes: null,
      attachmentSha256: null,
      createdAt: '2026-11-27T01:05:00.000Z',
    });
    const failOpenRes = await processContactSubmission(
      makeRequest(async () => makeValidFormData()),
      { correlationId: 'corr-link-fail-open', logger },
    );
    expect(failOpenRes.status).toBe(201);
    expect(insertContactSubmissionMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'ada@example.com' }),
      { analyticsSessionId: null, guestSessionId: null },
    );
  });

  it('attaches active in-memory analyticsSessionId in submitPortalContactForm without mutating caller FormData unexpectedly', async () => {
    const metaEndpoint = document.createElement('meta');
    metaEndpoint.name = 'aklapper-analytics-endpoint';
    metaEndpoint.content = '/api/analytics/ingest';
    const metaApp = document.createElement('meta');
    metaApp.name = 'aklapper-analytics-app';
    metaApp.content = 'portal';
    document.head.append(metaEndpoint, metaApp);

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json(
        {
          ok: true,
          submission: {
            id: '66666666-6666-4666-8666-666666666666',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            phone: null,
            attachmentName: null,
            attachmentSizeBytes: null,
            attachmentSha256: null,
            createdAt: '2026-11-27T01:10:00.000Z',
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const client = bootstrapDocumentAnalytics(document);
      expect(client).not.toBeNull();
      const fd = makeValidFormData();
      const res = await submitPortalContactForm(fd);
      expect(res.ok).toBe(true);
      const sentBody = fetchMock.mock.calls[0]?.[1]?.body as FormData;
      expect(sentBody.get('analyticsSessionId')).toBe(client?.sessionId);
    } finally {
      resetAnalyticsBootstrap();
      document.head.innerHTML = '';
    }
  });
});
