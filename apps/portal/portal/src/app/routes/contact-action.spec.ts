import { type AnalyticsBatch, type ContactSubmissionSummary } from '@aklapper/core';
import { bootstrapDocumentAnalytics, resetAnalyticsBootstrap } from '@aklapper/core/analytics';
import { GUEST_SESSION_COOKIE_NAME, signGuestSessionCookie } from '@aklapper/node-runtime/auth';
import {
  Code,
  ConnectError,
  ErrorDetailEnvelopeSchema,
  FieldErrorListSchema,
  PublicAppErrorSchema,
  type GrpcCallMetadata,
  type IngestPortalAnalyticsResult,
  type PortalClientRequestContextInput,
  type SubmitPortalContactInput,
} from '@aklapper/node-runtime/grpc';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { create } from '@bufbuild/protobuf';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { submitPortalContactMock, ingestPortalAnalyticsMock } = vi.hoisted(() => ({
  submitPortalContactMock:
    vi.fn<
      (meta: GrpcCallMetadata, input: SubmitPortalContactInput) => Promise<ContactSubmissionSummary>
    >(),
  ingestPortalAnalyticsMock:
    vi.fn<
      (
        meta: GrpcCallMetadata,
        batch: AnalyticsBatch,
        clientContext: PortalClientRequestContextInput,
      ) => Promise<IngestPortalAnalyticsResult>
    >(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    submitPortalContact: submitPortalContactMock,
    ingestPortalAnalytics: ingestPortalAnalyticsMock,
  };
});

import {
  processContactSubmission,
  resetContactRateLimiterForTest,
  resolveClientKey,
} from '../contact-submission.server';
import { submitPortalContactForm } from '../terminalForms';
import { action as analyticsIngestAction } from './api.analytics.ingest';
import { action as apiContactAction } from './api.contact';
import { action as contactRouteAction } from './contact';

function makeRequest(
  formDataImpl: () => Promise<FormData>,
  headers: Record<string, string> = {},
): Request {
  return {
    url: 'https://andrew-k.us/contact',
    headers: new Headers(headers),
    formData: formDataImpl,
  } as unknown as Request;
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

function makeValidAnalyticsBatchJson(): string {
  return JSON.stringify({
    sessionId: 'sess_client_1',
    events: [
      {
        type: 'page_view',
        name: 'portal_page_view',
        path: '/about',
        metadata: { app: 'portal', navigation: 'initial' },
        timestamp: '2026-11-27T00:00:00.000Z',
      },
    ],
  });
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

describe('processContactSubmission & resource action routes (Go gRPC)', () => {
  const origPortalApiUrl = process.env['PORTAL_API_URL'];

  beforeEach(() => {
    process.env['PORTAL_API_URL'] = 'http://127.0.0.1:8084';
  });

  afterEach(() => {
    resetContactRateLimiterForTest();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (origPortalApiUrl === undefined) delete process.env['PORTAL_API_URL'];
    else process.env['PORTAL_API_URL'] = origPortalApiUrl;
  });

  it('rejects malformed payloads, honeypot triggers, and disallowed attachments locally with 400 ERR_VALIDATION before calling gRPC', async () => {
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
    expect(submitPortalContactMock).not.toHaveBeenCalled();
  });

  it('decodes 429 ERR_RATE_LIMITED with Retry-After and 422 ERR_CONSTRAINT fieldErrors from portal-api ConnectErrors', async () => {
    submitPortalContactMock.mockRejectedValueOnce(
      new ConnectError('rate limited', Code.ResourceExhausted, undefined, [
        {
          desc: ErrorDetailEnvelopeSchema,
          value: create(ErrorDetailEnvelopeSchema, {
            error: create(PublicAppErrorSchema, {
              code: 'ERR_RATE_LIMITED',
              status: 429,
              message: 'Too many requests received.',
              action: 'Wait a moment and submit again.',
              correlationId: 'corr-429',
            }),
            retryAfterSeconds: 42,
          }),
        },
      ]),
    );

    const limited = await processContactSubmission(
      makeRequest(async () => makeValidFormData(), {
        'x-forwarded-for': '198.51.100.1, 203.0.113.10',
      }),
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

    submitPortalContactMock.mockRejectedValueOnce(
      new ConnectError('constraint failed', Code.FailedPrecondition, undefined, [
        {
          desc: ErrorDetailEnvelopeSchema,
          value: create(ErrorDetailEnvelopeSchema, {
            error: create(PublicAppErrorSchema, {
              code: 'ERR_CONSTRAINT',
              status: 422,
              message: 'Database constraint rejected Email format.',
              action: 'Check highlighted fields and retry.',
              correlationId: 'corr-422',
              fieldErrors: {
                email: create(FieldErrorListSchema, {
                  messages: ['Database constraint rejected Email format.'],
                }),
              },
            }),
          }),
        },
      ]),
    );

    const constraintRes = await processContactSubmission(
      makeRequest(async () => makeValidFormData()),
      { correlationId: 'corr-422' },
    );
    expect(constraintRes.status).toBe(422);
    expect(constraintRes.payload).toMatchObject({
      ok: false,
      source: 'database',
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-422',
      fieldErrors: { email: ['Database constraint rejected Email format.'] },
    });
  });

  it('forwards raw attachment bytes, signed client IP, and candidate analyticsSessionId over gRPC and returns 201', async () => {
    const payloadText = 'FLOW-MATIC specification';
    const summary: ContactSubmissionSummary = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '+1 (555) 867-5309',
      attachmentName: 'spec.txt',
      attachmentSizeBytes: Buffer.byteLength(payloadText),
      attachmentSha256: 'a'.repeat(64),
      createdAt: '2026-11-24T12:34:56.000Z',
    };
    submitPortalContactMock.mockResolvedValueOnce(summary);

    const fd = new FormData();
    fd.set('name', '  Grace Hopper ');
    fd.set('email', 'GRACE@EXAMPLE.COM');
    fd.set('phone', '+1 (555) 867-5309');
    fd.set('message', 'Testing valid multipart submission with attachment.');
    fd.set('file', makeFileWithBuffer(payloadText, '../spec.txt', 'text/plain'));
    fd.set('analyticsSessionId', 'sess_verified_99');

    const res = await processContactSubmission(
      makeRequest(async () => fd, { 'x-forwarded-for': '203.0.113.55' }),
      { correlationId: 'corr-201' },
    );
    expect(res.status).toBe(201);
    expect(res.payload).toEqual({ ok: true, submission: summary });
    expect(submitPortalContactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://127.0.0.1:8084',
        correlationId: 'corr-201',
        signedClientIp: expect.any(String),
      }),
      expect.objectContaining({
        name: '  Grace Hopper ',
        email: 'GRACE@EXAMPLE.COM',
        candidateAnalyticsSessionId: 'sess_verified_99',
        attachment: expect.objectContaining({
          filename: 'spec.txt',
          mimeType: 'text/plain',
          content: expect.any(Uint8Array),
        }),
      }),
    );
  });

  it('propagates 503 ERR_UPSTREAM_UNAVAILABLE and RouterContextProvider correlationId across /contact, /api/contact, and /api/analytics/ingest', async () => {
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

    submitPortalContactMock.mockRejectedValueOnce(
      new ConnectError('upstream unavailable', Code.Unavailable),
    );
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
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      correlationId: 'corr-route-503',
    });

    submitPortalContactMock.mockRejectedValueOnce(
      new ConnectError('upstream unavailable', Code.Unavailable),
    );
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
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      correlationId: 'corr-api-503',
    });

    ingestPortalAnalyticsMock.mockRejectedValueOnce(
      new ConnectError('upstream unavailable', Code.Unavailable),
    );
    const analyticsRes = await analyticsIngestAction({
      request: new Request('http://localhost/api/analytics/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: makeValidAnalyticsBatchJson(),
      }),
      params: {},
      context: makeCtx('corr-analytics-503'),
      url: new URL('http://localhost/api/analytics/ingest'),
      pattern: '/api/analytics/ingest',
    });
    expect(analyticsRes.status).toBe(503);
    expect(analyticsRes.headers.get('X-Correlation-Id')).toBe('corr-analytics-503');
    expect(await analyticsRes.json()).toMatchObject({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      correlationId: 'corr-analytics-503',
    });
    expect(errorCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects oversized analytics metadata locally with 400 and forwards valid batches with passive guestSessionId and Retry-After on 429', async () => {
    const oversizedKeys: Record<string, string> = {};
    for (let i = 0; i < 17; i++) oversizedKeys[`k${i}`] = 'v';
    const badAnalytics = await analyticsIngestAction({
      request: new Request('https://andrew-k.us/api/analytics/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess_bad_meta',
          events: [
            {
              type: 'interaction',
              name: 'click',
              path: '/about',
              metadata: oversizedKeys,
              timestamp: '2026-11-27T00:00:00.000Z',
            },
          ],
        }),
      }),
      params: {},
      context: new RouterContextProvider(),
      url: new URL('https://andrew-k.us/api/analytics/ingest'),
      pattern: '/api/analytics/ingest',
    });
    expect(badAnalytics.status).toBe(400);
    expect(ingestPortalAnalyticsMock).not.toHaveBeenCalled();

    const origSecret = process.env['INTERNAL_AUTH_SECRET'];
    try {
      process.env['INTERNAL_AUTH_SECRET'] = 'test-analytics-secret-0123456789abcdef';
      const signedGuest = signGuestSessionCookie('guest_passive_123');
      ingestPortalAnalyticsMock.mockResolvedValueOnce({
        accepted: 1,
        sessionId: 'sess_p1',
        ipHash: 'h12345678901234567890123',
      });

      const res = await analyticsIngestAction({
        request: new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${GUEST_SESSION_COOKIE_NAME}=${signedGuest}`,
          },
          body: makeValidAnalyticsBatchJson(),
        }),
        params: {},
        context: new RouterContextProvider(),
        url: new URL('https://andrew-k.us/api/analytics/ingest'),
        pattern: '/api/analytics/ingest',
      });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({
        accepted: 1,
        sessionId: 'sess_p1',
        ipHash: 'h12345678901234567890123',
      });
      expect(ingestPortalAnalyticsMock).toHaveBeenCalledWith(
        expect.objectContaining({ signedClientIp: expect.any(String) }),
        expect.objectContaining({ sessionId: 'sess_client_1' }),
        expect.objectContaining({ guestSessionId: 'guest_passive_123' }),
      );

      ingestPortalAnalyticsMock.mockRejectedValueOnce(
        new ConnectError('too many analytics', Code.ResourceExhausted, undefined, [
          {
            desc: ErrorDetailEnvelopeSchema,
            value: create(ErrorDetailEnvelopeSchema, {
              error: create(PublicAppErrorSchema, {
                code: 'ERR_RATE_LIMITED',
                status: 429,
                message: 'Too many requests received.',
                action: 'Wait a moment and submit again.',
                correlationId: 'corr-ing-429',
              }),
              retryAfterSeconds: 33,
            }),
          },
        ]),
      );
      const res429 = await analyticsIngestAction({
        request: new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: makeValidAnalyticsBatchJson(),
        }),
        params: {},
        context: new RouterContextProvider(),
        url: new URL('https://andrew-k.us/api/analytics/ingest'),
        pattern: '/api/analytics/ingest',
      });
      expect(res429.status).toBe(429);
      expect(res429.headers.get('Retry-After')).toBe('33');
    } finally {
      if (origSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = origSecret;
    }
  });

  it('catches browser network failures and attaches active analyticsSessionId in submitPortalContactForm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );
    const failed = await submitPortalContactForm(makeValidFormData());
    expect(failed).toMatchObject({
      ok: false,
      source: 'client',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      fieldErrors: {},
    });

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
});
