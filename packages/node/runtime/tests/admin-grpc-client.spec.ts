import { createServer } from 'node:http2';
import type { AddressInfo } from 'node:net';

import { extractPrivacySanitizationFindings } from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrivacySanitizationError } from '../src/cli/go-privacy-check.ts';
import {
  classifyAdminGrpcError,
  clearGoGrpcTransportCacheForTest,
  handleAdminAuthGrpcBffRequest,
  IDEMPOTENT_OIDC_RETRY_PROCEDURES,
  openAdminContactAttachmentStreamViaGrpc,
  resolveAdminSessionViaGrpc,
  upsertAdminSiteContentViaGrpc,
} from '../src/grpc.ts';
import { AdminAuthService } from '../src/grpc/gen/admin/v1/auth_pb.ts';
import { AdminCmsService } from '../src/grpc/gen/admin/v1/cms_pb.ts';
import {
  AdminInboxService,
  ContactAttachmentMetadataSchema,
  StreamContactAttachmentResponseSchema,
} from '../src/grpc/gen/admin/v1/inbox_pb.ts';
import {
  ErrorDetailEnvelopeSchema,
  PrivacySanitizationFindingSchema,
  PublicAppErrorSchema,
} from '../src/grpc/gen/common/v1/error_pb.ts';
import { DEV_FALLBACK_ADMIN_INTERNAL_AUTH_SECRET, verifyInternalAuthToken } from '../src/http.ts';

function makeDetailedError(
  code: Code,
  status: number,
  appCode: string,
  message: string,
  extra?: {
    readonly retryAfterSeconds?: number;
    readonly findings?: ReadonlyArray<{
      readonly ruleId: string;
      readonly category: string;
      readonly field: string;
      readonly location: string;
    }>;
  },
): ConnectError {
  const envelope = create(ErrorDetailEnvelopeSchema, {
    error: create(PublicAppErrorSchema, {
      code: appCode,
      status,
      message,
      action: 'Retry.',
      correlationId: '11111111-1111-4111-8111-111111111111',
    }),
    ...(extra?.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: extra.retryAfterSeconds }
      : {}),
    sanitizationFindings: (extra?.findings ?? []).map(f =>
      create(PrivacySanitizationFindingSchema, f),
    ),
  });
  return new ConnectError(message, code, undefined, [
    { desc: ErrorDetailEnvelopeSchema, value: envelope },
  ]);
}

describe('Admin gRPC client contracts & auth BFF', () => {
  const validSessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const unavailableSessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let serverUrl = '';
  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    clearGoGrpcTransportCacheForTest();
    const adapter = connectNodeAdapter({
      routes(router) {
        router.service(AdminAuthService, {
          getAdminSession(req, ctx) {
            const claims = verifyInternalAuthToken(
              ctx.requestHeader.get('x-internal-auth'),
              DEV_FALLBACK_ADMIN_INTERNAL_AUTH_SECRET,
            );
            if (!claims) {
              throw new ConnectError('missing auth', Code.Unauthenticated);
            }
            if (req.sessionId === unavailableSessionId) {
              throw makeDetailedError(
                Code.Unavailable,
                503,
                'ERR_DB_UNAVAILABLE',
                'Database temporarily unavailable.',
              );
            }
            if (req.sessionId === validSessionId) {
              return {
                authenticated: true,
                session: {
                  sessionId: validSessionId,
                  role: 'admin',
                  handle: 'admin',
                  expiresAt: '2026-12-31T00:00:00.000Z',
                },
                totpEnabled: true,
                passkeyCount: 2,
              };
            }
            return { authenticated: false, totpEnabled: false, passkeyCount: 0 };
          },
          passwordLogin(req) {
            if (req.handle === 'ratelimited') {
              throw makeDetailedError(
                Code.ResourceExhausted,
                429,
                'RATE_LIMITED',
                'Too many login attempts.',
                { retryAfterSeconds: 42 },
              );
            }
            if (req.handle === 'busy') {
              throw makeDetailedError(
                Code.Unavailable,
                503,
                'SERVICE_BUSY',
                'Authentication service is temporarily busy.',
                { retryAfterSeconds: 2 },
              );
            }
            return {
              verified: true,
              requiresTotp: false,
              pendingToken: '',
              passkeyCount: 1,
              session: {
                sessionId: validSessionId,
                role: 'admin',
                handle: req.handle,
                expiresAt: '2026-12-31T00:00:00.000Z',
              },
            };
          },
          logoutAdminSession() {
            return { loggedOut: true };
          },
        });

        router.service(AdminCmsService, {
          upsertSiteContent(req) {
            if (req.key === 'portal-maintenance') {
              throw makeDetailedError(
                Code.FailedPrecondition,
                410,
                'RETIRED_CMS_KEY',
                'Maintenance mode is retired.',
              );
            }
            throw makeDetailedError(
              Code.FailedPrecondition,
              422,
              'ERR_CONSTRAINT',
              'Content failed privacy policy.',
              {
                findings: [
                  {
                    ruleId: 'denylist.term_1',
                    category: 'denylist',
                    field: 'markdownBody',
                    location: 'line 1',
                  },
                ],
              },
            );
          },
        });

        router.service(AdminInboxService, {
          async *streamContactAttachment(req) {
            if (req.submissionId === 'missing') {
              throw makeDetailedError(Code.NotFound, 404, 'ERR_NOT_FOUND', 'Attachment not found.');
            }
            yield create(StreamContactAttachmentResponseSchema, {
              chunk: {
                case: 'metadata',
                value: create(ContactAttachmentMetadataSchema, {
                  id: req.submissionId,
                  filename: 'report.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 10n,
                  sha256: 'a'.repeat(64),
                }),
              },
            });
            yield create(StreamContactAttachmentResponseSchema, {
              chunk: { case: 'data', value: new Uint8Array([1, 2, 3, 4, 5]) },
            });
            if (req.submissionId === 'with-empty-frame') {
              yield create(StreamContactAttachmentResponseSchema, {
                chunk: { case: 'data', value: new Uint8Array(0) },
              });
            }
            yield create(StreamContactAttachmentResponseSchema, {
              chunk: { case: 'data', value: new Uint8Array([6, 7, 8, 9, 10]) },
            });
          },
        });
      },
    });

    const server = createServer(adapter);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${addr.port}`;
    closeServer = () => new Promise<void>(resolve => server.close(() => resolve()));
  });

  afterAll(async () => {
    clearGoGrpcTransportCacheForTest();
    if (closeServer) {
      await closeServer();
    }
  });

  it('enforces OIDC retry safety: read-only admin RPCs allowed, mutating RPCs excluded', () => {
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/admin.v1.AdminAuthService/GetAdminSession')).toBe(
      true,
    );
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/admin.v1.AdminCmsService/GetAdminChrome')).toBe(
      true,
    );
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/admin.v1.AdminAuthService/PasswordLogin')).toBe(
      false,
    );
    expect(
      IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/admin.v1.AdminCmsService/UpsertSiteContent'),
    ).toBe(false);
    expect(
      IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/admin.v1.AdminOpsService/OverrideSandboxGateVerdict'),
    ).toBe(false);
  });

  it('resolves admin session via gRPC, skips on missing cookie, and emits session_gate_fault on 503', async () => {
    const emptyRes = await resolveAdminSessionViaGrpc(new Request('http://localhost:4201/cms'), {
      baseUrl: serverUrl,
    });
    expect(emptyRes.authenticated).toBe(false);

    const validRes = await resolveAdminSessionViaGrpc(
      new Request('http://localhost:4201/cms', {
        headers: { cookie: `ak_admin_session=${validSessionId}` },
      }),
      { baseUrl: serverUrl },
    );
    expect(validRes).toMatchObject({
      authenticated: true,
      totpEnabled: true,
      passkeyCount: 2,
      session: { sessionId: validSessionId, role: 'admin', handle: 'admin' },
    });

    const errorSpy = vi.fn<(...args: unknown[]) => void>();
    await expect(
      resolveAdminSessionViaGrpc(
        new Request('http://localhost:4201/cms', {
          headers: { cookie: `ak_admin_session=${unavailableSessionId}` },
        }),
        {
          baseUrl: serverUrl,
          logger: {
            info: vi.fn<(...args: unknown[]) => void>(),
            warn: vi.fn<(...args: unknown[]) => void>(),
            error: errorSpy,
          },
        },
      ),
    ).rejects.toBeInstanceOf(ConnectError);
    expect(
      errorSpy.mock.calls.some(
        call =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          (call[0] as Record<string, unknown>)['event'] === 'admin.auth.session_gate_fault',
      ),
    ).toBe(true);
  });

  it('handles /api/auth/* BFF: retires guest with 404, sets Secure cookie on HTTPS login, preserves 429/503 Retry-After', async () => {
    const guestRes = await handleAdminAuthGrpcBffRequest(
      new Request('http://localhost:4201/api/auth/guest', { method: 'POST' }),
      'guest',
      { baseUrl: serverUrl },
    );
    expect(guestRes.status).toBe(404);

    const loginRes = await handleAdminAuthGrpcBffRequest(
      new Request('http://localhost:4201/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
        body: JSON.stringify({ handle: 'admin', password: 'secret' }),
      }),
      'password/login',
      { baseUrl: serverUrl },
    );
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`ak_admin_session=${validSessionId}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');

    const rlRes = await handleAdminAuthGrpcBffRequest(
      new Request('http://localhost:4201/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: 'ratelimited', password: 'secret' }),
      }),
      'password/login',
      { baseUrl: serverUrl },
    );
    expect(rlRes.status).toBe(429);
    expect(rlRes.headers.get('retry-after')).toBe('42');

    const busyRes = await handleAdminAuthGrpcBffRequest(
      new Request('http://localhost:4201/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: 'busy', password: 'secret' }),
      }),
      'password/login',
      { baseUrl: serverUrl },
    );
    expect(busyRes.status).toBe(503);
    expect(busyRes.headers.get('retry-after')).toBe('2');
  });

  it('decodes privacy 422 sanitization_findings into PrivacySanitizationError and preserves 410 retired status', async () => {
    const errSpy = vi.fn<(...args: unknown[]) => void>();
    let caught: unknown;
    try {
      await upsertAdminSiteContentViaGrpc(
        validSessionId,
        { key: 'portal-about', markdownBody: 'Secret', metadataJson: {} },
        {
          baseUrl: serverUrl,
          logger: {
            info: vi.fn<(...args: unknown[]) => void>(),
            warn: vi.fn<(...args: unknown[]) => void>(),
            error: errSpy,
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PrivacySanitizationError);
    const findings = extractPrivacySanitizationFindings(caught);
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.ruleId).toBe('denylist.term_1');
    expect(
      errSpy.mock.calls.some(
        call =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          (call[0] as Record<string, unknown>)['event'] === 'bff.grpc.admin_error_classified',
      ),
    ).toBe(true);

    const retiredFailure = classifyAdminGrpcError(
      makeDetailedError(Code.FailedPrecondition, 410, 'RETIRED_CMS_KEY', 'Retired'),
      { correlationId: 'corr-410', source: 'admin.cms.site_content' },
    );
    expect(retiredFailure.publicError.status).toBe(410);
  });

  it('streams multi-chunk contact attachment without buffering and emits seam on stream fault', async () => {
    const streamed = await openAdminContactAttachmentStreamViaGrpc(validSessionId, 'sub-1', {
      baseUrl: serverUrl,
    });
    expect(streamed.metadata.filename).toBe('report.pdf');
    expect(streamed.metadata.sizeBytes).toBe(10);

    const reader = streamed.body.getReader();
    const bytes: number[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes.push(...next.value);
    }
    expect(bytes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const withEmpty = await openAdminContactAttachmentStreamViaGrpc(
      validSessionId,
      'with-empty-frame',
      { baseUrl: serverUrl },
    );
    const emptyReader = withEmpty.body.getReader();
    const emptyBytes: number[] = [];
    for (;;) {
      const next = await emptyReader.read();
      if (next.done) break;
      emptyBytes.push(...next.value);
    }
    expect(emptyBytes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const warnSpy = vi.fn<(...args: unknown[]) => void>();
    await expect(
      openAdminContactAttachmentStreamViaGrpc(validSessionId, 'missing', {
        baseUrl: serverUrl,
        logger: {
          info: vi.fn<(...args: unknown[]) => void>(),
          warn: warnSpy,
          error: vi.fn<(...args: unknown[]) => void>(),
        },
      }),
    ).rejects.toBeInstanceOf(ConnectError);
    expect(
      warnSpy.mock.calls.some(
        call =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          (call[0] as Record<string, unknown>)['event'] === 'admin.inbox.attachment_stream_failed',
      ),
    ).toBe(true);
  });
});
