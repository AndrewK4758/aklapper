import { createHash } from 'node:crypto';

import {
  CONTACT_FORM_DEFINITION,
  type ContactFormSubmission,
  type ContactSubmissionSummary,
  type PortalContactLoaderData,
} from '@aklapper/core';
import { ContactDbConstraintError } from '@aklapper/db';
import { INTERNAL_AUTH_HEADER, verifyInternalAuthToken } from '@aklapper/node-runtime/http';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  getSharedDbMock,
  loadPortalContactDataMock,
  insertContactSubmissionMock,
  handleAnalyticsIngestRequestMock,
} = vi.hoisted(() => ({
  getSharedDbMock: vi.fn<() => Record<string, never>>(() => ({})),
  loadPortalContactDataMock: vi.fn<() => Promise<PortalContactLoaderData>>(),
  insertContactSubmissionMock:
    vi.fn<(db: unknown, submission: ContactFormSubmission) => Promise<ContactSubmissionSummary>>(),
  handleAnalyticsIngestRequestMock: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: getSharedDbMock,
    loadPortalContactData: loadPortalContactDataMock,
    insertContactSubmission: insertContactSubmissionMock,
  };
});

vi.mock('@aklapper/db/analytics', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db/analytics')>();
  return {
    ...actual,
    handleAnalyticsIngestRequest: handleAnalyticsIngestRequestMock,
  };
});

import {
  processContactSubmission,
  resetContactRateLimiterForTest,
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

  it('returns 429 ERR_RATE_LIMITED after 20 requests from the same client IP', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    const badFd = new FormData();
    for (let i = 0; i < 20; i += 1) {
      await processContactSubmission(
        makeRequest(async () => badFd, { 'x-forwarded-for': '203.0.113.10' }),
        { correlationId: `corr-burst-${i}` },
      );
    }

    const limited = await processContactSubmission(
      makeRequest(async () => badFd, { 'x-forwarded-for': '203.0.113.10' }),
      { correlationId: 'corr-429' },
    );
    expect(limited.status).toBe(429);
    expect(limited.payload).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_RATE_LIMITED',
      correlationId: 'corr-429',
    });
    expect(insertContactSubmissionMock).not.toHaveBeenCalled();
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

  it('attaches signed X-Internal-Auth service tokens on contact notify and public cluster SSE proxies', async () => {
    const origContactUrl = process.env['CONTACT_API_URL'];
    const origWatchUrl = process.env['K8S_WATCH_URL'];
    const origSecret = process.env['INTERNAL_AUTH_SECRET'];
    const capturedCalls: Array<{ url: string; token: string | null }> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      capturedCalls.push({ url, token: new Headers(init?.headers).get(INTERNAL_AUTH_HEADER) });
      if (url.endsWith('/v1/cluster/stream')) {
        return new Response('event: pod\ndata: {"deployment":"cadence-demo"}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      return Response.json({
        accepted: true,
        submissionId: '55555555-5555-4555-8555-555555555555',
      });
    });

    try {
      process.env['CONTACT_API_URL'] = 'http://127.0.0.1:8084';
      process.env['K8S_WATCH_URL'] = 'http://127.0.0.1:8081';
      process.env['INTERNAL_AUTH_SECRET'] = 'portal-bff-test-secret';

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
      validFd.set('message', 'Verifying signed contact notify webhook forwarding.');
      await processContactSubmission(
        makeRequest(async () => validFd),
        {
          correlationId: 'corr-signed-notify',
        },
      );
      await new Promise(resolve => setTimeout(resolve, 0));

      const { loader: clusterStreamLoader } = await import('./api.cluster.stream');
      const sseRes = await clusterStreamLoader({
        request: new Request('http://localhost/api/cluster/stream'),
        params: {},
        context: new RouterContextProvider(),
        url: new URL('http://localhost/api/cluster/stream'),
        pattern: '/api/cluster/stream',
      } as never);
      expect(sseRes.status).toBe(200);

      const notifyCall = capturedCalls.find(c => c.url.endsWith('/v1/contact/notify'));
      const streamCall = capturedCalls.find(c => c.url.endsWith('/v1/cluster/stream'));
      expect(notifyCall?.token).toBeTruthy();
      expect(streamCall?.token).toBeTruthy();

      const notifyClaims = verifyInternalAuthToken(notifyCall?.token, 'portal-bff-test-secret');
      const streamClaims = verifyInternalAuthToken(streamCall?.token, 'portal-bff-test-secret');
      expect(notifyClaims?.role).toBe('service');
      expect(notifyClaims?.sub).toBe('portal-contact');
      expect(streamClaims?.role).toBe('service');
      expect(streamClaims?.sub).toBe('portal-cluster-stream');
    } finally {
      fetchSpy.mockRestore();
      if (origContactUrl === undefined) delete process.env['CONTACT_API_URL'];
      else process.env['CONTACT_API_URL'] = origContactUrl;
      if (origWatchUrl === undefined) delete process.env['K8S_WATCH_URL'];
      else process.env['K8S_WATCH_URL'] = origWatchUrl;
      if (origSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = origSecret;
    }
  });
});
