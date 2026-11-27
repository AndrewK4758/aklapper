import {
  DEFAULT_PORTAL_HOME_PORTRAIT,
  DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
  isPublicAppError,
  SITE_CONTENT_KEYS,
} from '@aklapper/core';
import { PORTAL_ABOUT_SEED } from '@aklapper/core/prerender';
import { PrivacySanitizationError } from '@aklapper/node-runtime/go-privacy-check';
import {
  Code,
  ConnectError,
  ErrorDetailEnvelopeSchema,
  PublicAppErrorSchema,
  type GrpcCallMetadata,
  type ReindexResult as GrpcReindexResult,
} from '@aklapper/node-runtime/grpc';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { create, toBinary } from '@bufbuild/protobuf';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AsyncUnknownFn = (...args: unknown[]) => Promise<unknown>;
type LogFn = (obj: Record<string, unknown>, msg?: string) => void;

const mocks = vi.hoisted(() => ({
  resolveAdminSessionViaGrpc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  syncAdminAgensiCatalogViaGrpc: vi.fn<AsyncUnknownFn>(),
  upsertAdminSiteContentViaGrpc: vi.fn<AsyncUnknownFn>(),
  upsertAdminCareerDossierViaGrpc: vi.fn<AsyncUnknownFn>(),
  deleteAdminMenuItemViaGrpc: vi.fn<AsyncUnknownFn>(),
  deleteAdminContactSubmissionViaGrpc: vi.fn<AsyncUnknownFn>(),
  deleteAdminContactSubmissionsViaGrpc: vi.fn<AsyncUnknownFn>(),
  updateAdminQuotaPolicyViaGrpc: vi.fn<AsyncUnknownFn>(),
  resetAdminRateLimitBucketViaGrpc: vi.fn<AsyncUnknownFn>(),
  overrideAdminSandboxGateVerdictViaGrpc: vi.fn<AsyncUnknownFn>(),
  ingestAdminAnalyticsViaGrpc: vi.fn<AsyncUnknownFn>(),
  triggerReindex: vi.fn<(meta: GrpcCallMetadata) => Promise<GrpcReindexResult>>(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    resolveAdminSessionViaGrpc: (...args: unknown[]) => mocks.resolveAdminSessionViaGrpc(...args),
    syncAdminAgensiCatalogViaGrpc: (...args: unknown[]) =>
      mocks.syncAdminAgensiCatalogViaGrpc(...args),
    upsertAdminSiteContentViaGrpc: (...args: unknown[]) =>
      mocks.upsertAdminSiteContentViaGrpc(...args),
    upsertAdminCareerDossierViaGrpc: (...args: unknown[]) =>
      mocks.upsertAdminCareerDossierViaGrpc(...args),
    deleteAdminMenuItemViaGrpc: (...args: unknown[]) => mocks.deleteAdminMenuItemViaGrpc(...args),
    deleteAdminContactSubmissionViaGrpc: (...args: unknown[]) =>
      mocks.deleteAdminContactSubmissionViaGrpc(...args),
    deleteAdminContactSubmissionsViaGrpc: (...args: unknown[]) =>
      mocks.deleteAdminContactSubmissionsViaGrpc(...args),
    updateAdminQuotaPolicyViaGrpc: (...args: unknown[]) =>
      mocks.updateAdminQuotaPolicyViaGrpc(...args),
    resetAdminRateLimitBucketViaGrpc: (...args: unknown[]) =>
      mocks.resetAdminRateLimitBucketViaGrpc(...args),
    overrideAdminSandboxGateVerdictViaGrpc: (...args: unknown[]) =>
      mocks.overrideAdminSandboxGateVerdictViaGrpc(...args),
    ingestAdminAnalyticsViaGrpc: (...args: unknown[]) => mocks.ingestAdminAnalyticsViaGrpc(...args),
    triggerReindex: mocks.triggerReindex,
  };
});

import { ADMIN_CMS_FIXTURE, AUTH_STATUS, UNAUTH_STATUS } from './admin-test-fixtures';
import { action as analyticsIngestAction } from './api.analytics.ingest';
import { action as cmsAction } from './cms';
import { action as inboxAction } from './inbox';
import { action as opsAction } from './ops';
import { action as quotasAction } from './quotas';

interface DataWithStatus<T = Record<string, unknown>> {
  readonly type: 'DataWithResponseInit';
  readonly data: T;
  readonly init: { readonly status?: number; readonly headers?: Record<string, string> } | null;
}

function makeActionArgs(
  urlStr: string,
  pattern: string,
  fields: Record<string, string> | readonly (readonly [string, string])[],
  correlationId: string,
) {
  const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
  const context = new RouterContextProvider();
  context.set(requestContextKey, {
    correlationId,
    logger,
    serviceName: 'admin-ssr',
    signal: new AbortController().signal,
  });
  const body = Array.isArray(fields)
    ? new URLSearchParams(fields.map(([k, v]) => [k, v]))
    : new URLSearchParams(fields as Record<string, string>);
  const request = new Request(urlStr, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return {
    logger,
    args: {
      request,
      url: new URL(urlStr),
      pattern,
      unstable_pattern: pattern,
      params: {},
      context,
    },
  };
}

function expectUpstream503(
  res: DataWithStatus,
  logger: { error: ReturnType<typeof vi.fn<LogFn>> },
  cid: string,
) {
  expect(res.init?.status).toBe(503);
  expect(res.data).toMatchObject({
    ok: false,
    code: 'ERR_UPSTREAM_UNAVAILABLE',
    correlationId: cid,
    message: 'Upstream service unreachable.',
  });
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ errorCode: 'ERR_UPSTREAM_UNAVAILABLE', correlationId: cid }),
    expect.any(String),
  );
}

function makeConnectErrorWithEnvelope(
  code: Code,
  publicCode: string,
  status: number,
  message: string,
  retryAfterSeconds?: number,
): ConnectError {
  const err = new ConnectError(message, code);
  const envelope = create(ErrorDetailEnvelopeSchema, {
    error: create(PublicAppErrorSchema, {
      code: publicCode,
      status,
      message,
      action: 'Retry shortly.',
      correlationId: 'corr-proto',
    }),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  });
  err.details.push({
    type: 'common.v1.ErrorDetailEnvelope',
    value: toBinary(ErrorDetailEnvelopeSchema, envelope),
  });
  return err;
}

describe('Admin mutation actions & classified HTTP status semantics', () => {
  const originalAiAskUrl = process.env['AI_ASK_URL'];
  const originalK8sWatchUrl = process.env['K8S_WATCH_URL'];

  beforeEach(() => {
    mocks.resolveAdminSessionViaGrpc.mockResolvedValue(AUTH_STATUS);
    delete process.env['AI_ASK_URL'];
    delete process.env['K8S_WATCH_URL'];
  });

  afterEach(() => {
    if (originalAiAskUrl === undefined) delete process.env['AI_ASK_URL'];
    else process.env['AI_ASK_URL'] = originalAiAskUrl;
    if (originalK8sWatchUrl === undefined) delete process.env['K8S_WATCH_URL'];
    else process.env['K8S_WATCH_URL'] = originalK8sWatchUrl;
    vi.resetAllMocks();
  });

  it('returns honest 200, 400, 404, and classified 503 responses in cms action without leaking raw SQL', async () => {
    mocks.deleteAdminMenuItemViaGrpc.mockResolvedValueOnce(true);
    const okCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'delete-menu-item', slug: 'legacy-item' },
      'corr-cms-200',
    );
    const okRes = (await cmsAction(okCall.args as never)) as unknown as DataWithStatus;
    expect(okRes.init?.status).toBe(200);
    expect(okRes.data['ok']).toBe(true);

    const badJsonCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'upsert-site-content', key: 'home', markdownBody: '# hi', metadataJson: '[1,2]' },
      'corr-cms-400',
    );
    const badJsonRes = (await cmsAction(badJsonCall.args as never)) as unknown as DataWithStatus;
    expect(badJsonRes.init?.status).toBe(400);
    expect(badJsonRes.data['code']).toBe('ERR_VALIDATION');
    expect(badJsonRes.data['correlationId']).toBe('corr-cms-400');

    mocks.deleteAdminMenuItemViaGrpc.mockResolvedValueOnce(false);
    const missingCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'delete-menu-item', slug: 'missing-item' },
      'corr-cms-404',
    );
    const missingRes = (await cmsAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    mocks.deleteAdminMenuItemViaGrpc.mockRejectedValueOnce(
      makeConnectErrorWithEnvelope(
        Code.Unavailable,
        'ERR_DB_UNAVAILABLE',
        503,
        'Database temporarily unavailable.',
      ),
    );
    const failCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'delete-menu-item', slug: 'broken-item' },
      'corr-cms-503',
    );
    const failRes = (await cmsAction(failCall.args as never)) as unknown as DataWithStatus;
    expect(failRes.init?.status).toBe(503);
    expect(failRes.data['ok']).toBe(false);
    expect(failRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(failRes.data['correlationId']).toBe('corr-cms-503');
    expect(String(failRes.data['message'])).not.toContain('DELETE');
    expect(failCall.logger.error).toHaveBeenCalled();

    const reindexCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'reindex-qdrant' },
      'corr-cms-reindex-503',
    );
    const reindexRes = (await cmsAction(reindexCall.args as never)) as unknown as DataWithStatus;
    expectUpstream503(reindexRes, reindexCall.logger, 'corr-cms-reindex-503');
  });

  it('rejects retired maintenance and roadmap CMS intents with HTTP 410 and UNSOUND_CONDITION log without invoking admin-api', async () => {
    for (const intent of [
      'set-maintenance',
      'upsert-roadmap-milestone',
      'delete-roadmap-milestone',
    ] as const) {
      mocks.upsertAdminSiteContentViaGrpc.mockClear();
      const cid = `corr-retired-${intent}`;
      const call = makeActionArgs(
        'http://localhost:4301/cms',
        '/cms',
        { intent, slug: 'phase-1', maintenanceModeDefault: 'true' },
        cid,
      );
      const res = (await cmsAction(call.args as never)) as unknown as DataWithStatus;
      expect(res.init?.status).toBe(410);
      expect(res.data).toMatchObject({
        ok: false,
        code: 'ERR_VALIDATION',
        correlationId: cid,
      });
      expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();
      expect(call.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          seam_type: 'UNSOUND_CONDITION',
          event: 'admin.cms.retired_maintenance_intent_blocked',
          intent,
          correlationId: cid,
        }),
        expect.any(String),
      );
    }

    // Unauthorized caller posting a retired intent fails closed before CMS dispatch
    mocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce(UNAUTH_STATUS);
    const unauthCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'set-maintenance', maintenanceModeDefault: 'true' },
      'corr-unauth-retired',
    );
    let thrown: unknown = null;
    try {
      await cmsAction(unauthCall.args as never);
    } catch (error) {
      thrown = error;
    }
    const status =
      thrown instanceof Response
        ? thrown.status
        : (thrown as { init?: { status?: number } } | null)?.init?.status;
    expect([302, 401]).toContain(status);
    expect(unauthCall.logger.warn).not.toHaveBeenCalled();
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();

    // Active CMS intents targeting retired portal-maintenance key/profile also return HTTP 410 with zero RPC calls
    const retiredTargetCases: ReadonlyArray<Record<string, string>> = [
      {
        intent: 'upsert-site-content',
        key: 'portal-maintenance',
        markdownBody: '# Dormant',
        metadataJson: '{"heading":"Legacy"}',
      },
      {
        intent: 'upsert-site-content',
        key: ' PORTAL-MAINTENANCE ',
        markdownBody: '# Dormant',
        metadataJson: '{"heading":"Legacy"}',
      },
      {
        intent: 'upsert-terminal-profile',
        slug: 'portal-maintenance',
        bannerTitle: 'Legacy',
      },
      {
        intent: 'upsert-terminal-command',
        profileSlug: 'portal-maintenance',
        name: 'roadmap',
      },
      {
        intent: 'upsert-terminal-entry',
        profileSlug: 'portal-maintenance',
        command: 'status',
      },
      {
        intent: 'upsert-terminal-directory-entry',
        profileSlug: 'portal-maintenance',
        name: 'changes-in-progress',
      },
    ];

    for (const [idx, fields] of retiredTargetCases.entries()) {
      mocks.upsertAdminSiteContentViaGrpc.mockClear();
      const cid = `corr-retired-target-${idx}`;
      const call = makeActionArgs('http://localhost:4301/cms', '/cms', fields, cid);
      const res = (await cmsAction(call.args as never)) as unknown as DataWithStatus;
      expect(res.init?.status).toBe(410);
      expect(res.data).toMatchObject({
        ok: false,
        code: 'ERR_VALIDATION',
        correlationId: cid,
      });
      expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();
      expect(call.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          seam_type: 'UNSOUND_CONDITION',
          event: 'admin.cms.retired_maintenance_intent_blocked',
          intent: fields['intent'],
          correlationId: cid,
        }),
        expect.any(String),
      );
    }
  });

  it('validates site_content payloads server-side and emits structured warning and commit audit logs', async () => {
    const invalidSchemaCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'portal-chrome',
        markdownBody: '# Chrome',
        metadataJson: JSON.stringify({
          pageTitle: 'Portal',
          brandLabel: 'andrew-k.us',
          statusBadge: { source: 'portal', state: 'ready', label: 'Online' },
          footerText: 'Solar Forge',
          footerLinkLabel: 'GitHub',
          footerLinkUrl: 'not-a-valid-url',
        }),
      },
      'corr-sc-invalid',
    );
    const invalidRes = (await cmsAction(
      invalidSchemaCall.args as never,
    )) as unknown as DataWithStatus;
    expect(invalidRes.init?.status).toBe(400);
    expect(invalidRes.data['code']).toBe('ERR_VALIDATION');
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();
    expect(invalidSchemaCall.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.site_content_invalid_payload',
        key: 'portal-chrome',
        correlationId: 'corr-sc-invalid',
      }),
      expect.any(String),
    );

    mocks.upsertAdminSiteContentViaGrpc.mockResolvedValueOnce({
      key: 'admin-analytics',
      markdownBody: '# Analytics',
      metadataJson: { windowTitle: 'Analytics', description: 'Live metrics.' },
      updatedAt: '2026-11-24T22:45:00.000Z',
    });
    const validCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'admin-analytics',
        markdownBody: '# Analytics',
        metadataJson: JSON.stringify({ windowTitle: 'Analytics', description: 'Live metrics.' }),
      },
      'corr-sc-valid',
    );
    const validRes = (await cmsAction(validCall.args as never)) as unknown as DataWithStatus;
    expect(validRes.init?.status).toBe(200);
    expect(validRes.data['ok']).toBe(true);
    expect(validCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.site_content_upsert_committed',
        key: 'admin-analytics',
        updatedAt: '2026-11-24T22:45:00.000Z',
        correlationId: 'corr-sc-valid',
      }),
      expect.any(String),
    );
    const analyticsLogPayload = validCall.logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(analyticsLogPayload['sanitizationVerified']).toBeUndefined();
  });

  it('guards portal-home upserts against invalid portrait.src, non-HTTPS githubUrl, and gRPC privacy 422 while auditing sanitized commits', async () => {
    const basePortalHome = {
      tuiTitle: 'Portfolio Launcher',
      tuiBadge: { source: 'cloud-run', state: 'idle', label: 'Idle' },
      heading: 'Andrew Klapper — Portfolio',
      description: 'Interactive terminal portfolio.',
      actions: [{ label: 'Contact', to: '/contact', variant: 'primary' }],
      portrait: { ...DEFAULT_PORTAL_HOME_PORTRAIT },
      resumeSummary: {
        ...DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
        highlights: [...DEFAULT_PORTAL_HOME_RESUME_SUMMARY.highlights],
        services: DEFAULT_PORTAL_HOME_RESUME_SUMMARY.services.map(s => ({ ...s })),
      },
    };

    const hostilePortrait = 'https://evil.example.invalid/hotlink.webp';
    const badSrcCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'portal-home',
        markdownBody: '# Home',
        metadataJson: JSON.stringify({
          ...basePortalHome,
          portrait: { ...basePortalHome.portrait, src: hostilePortrait },
        }),
      },
      'corr-home-bad-src',
    );
    const badSrcRes = (await cmsAction(badSrcCall.args as never)) as unknown as DataWithStatus;
    expect(badSrcRes.init?.status).toBe(400);
    expect(badSrcRes.data['code']).toBe('ERR_VALIDATION');
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();
    expect(badSrcCall.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'portal.home.portrait_src_invalid',
        seam_type: 'UNSOUND_CONDITION',
        key: 'portal-home',
        correlationId: 'corr-home-bad-src',
      }),
      expect.any(String),
    );
    expect(JSON.stringify(badSrcCall.logger.warn.mock.calls)).not.toContain(hostilePortrait);

    const badGithubCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'portal-home',
        markdownBody: '# Home',
        metadataJson: JSON.stringify({
          ...basePortalHome,
          resumeSummary: {
            ...basePortalHome.resumeSummary,
            githubUrl: 'javascript:alert(1)',
          },
        }),
      },
      'corr-home-bad-gh',
    );
    const badGithubRes = (await cmsAction(
      badGithubCall.args as never,
    )) as unknown as DataWithStatus;
    expect(badGithubRes.init?.status).toBe(400);
    expect(badGithubRes.data['code']).toBe('ERR_VALIDATION');
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();

    mocks.upsertAdminSiteContentViaGrpc.mockRejectedValueOnce(
      new PrivacySanitizationError([
        {
          ruleId: 'pii.us_phone',
          category: 'pii',
          field: 'resumeSummary.roleLine',
          location: 'resumeSummary.roleLine',
        },
      ]),
    );
    const piiCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'portal-home',
        markdownBody: '## References\nJane Synthetic',
        metadataJson: JSON.stringify({
          ...basePortalHome,
          resumeSummary: {
            ...basePortalHome.resumeSummary,
            roleLine: 'Senior Engineer · Marietta, GA 99999 · (555) 010-1234',
          },
        }),
      },
      'corr-home-pii',
    );
    const piiRes = (await cmsAction(piiCall.args as never)) as unknown as DataWithStatus;
    expect(piiRes.init?.status).toBe(422);
    expect(piiRes.data['code']).toBe('ERR_CONSTRAINT');
    expect(Array.isArray(piiRes.data['sanitizationFindings'])).toBe(true);

    mocks.upsertAdminSiteContentViaGrpc.mockResolvedValueOnce({
      key: 'portal-home',
      markdownBody: '# Home clean',
      metadataJson: basePortalHome,
      updatedAt: '2026-11-26T22:00:00.000Z',
    });
    const cleanHomeCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: 'portal-home',
        markdownBody: '# Home clean',
        metadataJson: JSON.stringify(basePortalHome),
      },
      'corr-home-ok',
    );
    const cleanHomeRes = (await cmsAction(
      cleanHomeCall.args as never,
    )) as unknown as DataWithStatus;
    expect(cleanHomeRes.init?.status).toBe(200);
    expect(cleanHomeRes.data['ok']).toBe(true);
    expect(mocks.upsertAdminSiteContentViaGrpc).toHaveBeenCalledTimes(2);
    expect(cleanHomeCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.site_content_upsert_committed',
        seam_type: 'DELTA_AUDIT_GAP',
        key: 'portal-home',
        adminActor: AUTH_STATUS.session.handle,
        sanitizationVerified: true,
        updatedAt: '2026-11-26T22:00:00.000Z',
        correlationId: 'corr-home-ok',
      }),
      expect.any(String),
    );
  });

  it('triggers syncAdminAgensiCatalogViaGrpc on sync-agensi-catalog and rejects retired manual CRUD intents with HTTP 410', async () => {
    mocks.syncAdminAgensiCatalogViaGrpc.mockResolvedValueOnce({
      creatorHandle: 'aklapper',
      skills: ADMIN_CMS_FIXTURE.agensiSkills,
      syncState: ADMIN_CMS_FIXTURE.agensiSyncState,
    });

    const syncCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'sync-agensi-catalog' },
      'corr-agensi-sync',
    );
    const syncRes = (await cmsAction(syncCall.args as never)) as unknown as DataWithStatus;
    expect(mocks.syncAdminAgensiCatalogViaGrpc).toHaveBeenCalledWith(
      AUTH_STATUS.session.sessionId,
      { forceRefresh: true },
      expect.objectContaining({ correlationId: 'corr-agensi-sync' }),
    );
    expect(syncRes.init?.status).toBe(200);
    expect(syncRes.init?.headers?.['X-Correlation-Id']).toBe('corr-agensi-sync');
    expect(syncRes.data).toEqual({
      ok: true,
      message: expect.stringMatching(/Synced 1 Agensi skill/i),
    });

    for (const retiredIntent of ['upsert-agensi-skill', 'delete-agensi-skill'] as const) {
      const legacyCall = makeActionArgs(
        'http://localhost:4301/cms',
        '/cms',
        { intent: retiredIntent },
        'corr-agensi-retired',
      );
      const legacyRes = (await cmsAction(legacyCall.args as never)) as unknown as DataWithStatus;
      expect(legacyRes.init?.status).toBe(410);
      expect(legacyRes.init?.headers?.['X-Correlation-Id']).toBe('corr-agensi-retired');
      expect(legacyRes.data).toEqual(
        expect.objectContaining({
          ok: false,
          code: 'ERR_VALIDATION',
          correlationId: 'corr-agensi-retired',
        }),
      );
      expect(legacyCall.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          seam_type: 'UNSOUND_CONDITION',
          event: 'agensi.cms.legacy_manual_mutation_blocked',
          intent: retiredIntent,
          correlationId: 'corr-agensi-retired',
        }),
        expect.any(String),
      );
    }
  });

  it('returns honest 200, 400, 404, and classified 503 responses in inbox action', async () => {
    mocks.deleteAdminContactSubmissionViaGrpc.mockResolvedValueOnce(true);
    const okCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      { intent: 'delete', id: 'sub-1' },
      'corr-inbox-200',
    );
    const okRes = (await inboxAction(okCall.args as never)) as unknown as DataWithStatus;
    expect(okRes.init?.status).toBe(200);
    expect(okRes.data['ok']).toBe(true);

    mocks.deleteAdminContactSubmissionViaGrpc.mockResolvedValueOnce(false);
    const missingCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      { intent: 'delete', id: 'sub-missing' },
      'corr-inbox-404',
    );
    const missingRes = (await inboxAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    const badIntentCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      { intent: 'unknown' },
      'corr-inbox-400',
    );
    const badIntentRes = (await inboxAction(
      badIntentCall.args as never,
    )) as unknown as DataWithStatus;
    expect(badIntentRes.init?.status).toBe(400);
    expect(badIntentRes.data['code']).toBe('ERR_VALIDATION');

    mocks.deleteAdminContactSubmissionViaGrpc.mockRejectedValueOnce(
      makeConnectErrorWithEnvelope(
        Code.Unavailable,
        'ERR_DB_UNAVAILABLE',
        503,
        'Database temporarily unavailable.',
      ),
    );
    const dbCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      { intent: 'delete', id: 'sub-2' },
      'corr-inbox-503',
    );
    const dbRes = (await inboxAction(dbCall.args as never)) as unknown as DataWithStatus;
    expect(dbRes.init?.status).toBe(503);
    expect(dbRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-inbox-503');
    expect(dbCall.logger.error).toHaveBeenCalled();
  });

  it('handles delete-many intent with deduplication and honest 200, 400, 404, and 503 statuses', async () => {
    mocks.deleteAdminContactSubmissionsViaGrpc.mockResolvedValueOnce(2);
    const okCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      [
        ['intent', 'delete-many'],
        ['id', ' sub-1 '],
        ['id', 'sub-2'],
        ['id', 'sub-1'],
        ['id', '   '],
      ],
      'corr-inbox-bulk-200',
    );
    const okRes = (await inboxAction(okCall.args as never)) as unknown as DataWithStatus;
    expect(okRes.init?.status).toBe(200);
    expect(okRes.data['ok']).toBe(true);
    expect(okRes.data['message']).toBe('Deleted 2 contact submissions from PostgreSQL 19.');
    expect(mocks.deleteAdminContactSubmissionsViaGrpc).toHaveBeenCalledWith(
      AUTH_STATUS.session.sessionId,
      ['sub-1', 'sub-2'],
      expect.objectContaining({ correlationId: 'corr-inbox-bulk-200' }),
    );

    mocks.deleteAdminContactSubmissionsViaGrpc.mockResolvedValueOnce(1);
    const singleOkCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      [
        ['intent', 'delete-many'],
        ['id', 'sub-only'],
      ],
      'corr-inbox-bulk-single-200',
    );
    const singleOkRes = (await inboxAction(
      singleOkCall.args as never,
    )) as unknown as DataWithStatus;
    expect(singleOkRes.init?.status).toBe(200);
    expect(singleOkRes.data['message']).toBe('Deleted 1 contact submission from PostgreSQL 19.');

    const emptyCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      [
        ['intent', 'delete-many'],
        ['id', '   '],
      ],
      'corr-inbox-bulk-400',
    );
    const emptyRes = (await inboxAction(emptyCall.args as never)) as unknown as DataWithStatus;
    expect(emptyRes.init?.status).toBe(400);
    expect(emptyRes.data['code']).toBe('ERR_VALIDATION');
    expect(emptyRes.data['message']).toBe('Select at least one submission to delete.');

    mocks.deleteAdminContactSubmissionsViaGrpc.mockResolvedValueOnce(0);
    const missingCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      [
        ['intent', 'delete-many'],
        ['id', 'sub-missing'],
      ],
      'corr-inbox-bulk-404',
    );
    const missingRes = (await inboxAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    mocks.deleteAdminContactSubmissionsViaGrpc.mockRejectedValueOnce(
      new ConnectError('admin-api unreachable', Code.Unavailable),
    );
    const dbCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      [
        ['intent', 'delete-many'],
        ['id', 'sub-err'],
      ],
      'corr-inbox-bulk-503',
    );
    const dbRes = (await inboxAction(dbCall.args as never)) as unknown as DataWithStatus;
    expect(dbRes.init?.status).toBe(503);
    expect(dbRes.data['code']).toBe('ERR_UPSTREAM_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-inbox-bulk-503');
    expect(dbCall.logger.error).toHaveBeenCalled();
  });

  it('returns honest 200, 400 ZodError, 404, and classified 503 responses in quotas action', async () => {
    const zodCall = makeActionArgs(
      'http://localhost:4301/quotas',
      '/quotas',
      {
        intent: 'update-policy',
        role: 'invalid-role',
        maxTurnsPerSession: '0',
        maxTokensPerRun: '1',
        maxDailyGlobalTokens: '1',
      },
      'corr-quotas-400',
    );
    const zodRes = (await quotasAction(zodCall.args as never)) as unknown as DataWithStatus;
    expect(zodRes.init?.status).toBe(400);
    expect(zodRes.data['code']).toBe('ERR_VALIDATION');
    expect(zodRes.data['correlationId']).toBe('corr-quotas-400');

    mocks.resetAdminRateLimitBucketViaGrpc.mockResolvedValueOnce(false);
    const missingCall = makeActionArgs(
      'http://localhost:4301/quotas',
      '/quotas',
      { intent: 'reset-bucket', scopeKey: 'session:missing' },
      'corr-quotas-404',
    );
    const missingRes = (await quotasAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    mocks.resetAdminRateLimitBucketViaGrpc.mockRejectedValueOnce(
      new ConnectError('admin-api unreachable', Code.Unavailable),
    );
    const dbCall = makeActionArgs(
      'http://localhost:4301/quotas',
      '/quotas',
      { intent: 'reset-bucket', scopeKey: 'session:active' },
      'corr-quotas-503',
    );
    const dbRes = (await quotasAction(dbCall.args as never)) as unknown as DataWithStatus;
    expect(dbRes.init?.status).toBe(503);
    expect(dbRes.data['code']).toBe('ERR_UPSTREAM_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-quotas-503');
    expect(dbCall.logger.error).toHaveBeenCalled();
  });

  it('returns honest 200, 400, 404, and 503 responses in ops action including upstream reindex failures', async () => {
    const retiredWakeCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      { intent: 'wake-deployment', deployment: 'svc-ai-ask' },
      'corr-ops-retired-wake-400',
    );
    const retiredWakeRes = (await opsAction(
      retiredWakeCall.args as never,
    )) as unknown as DataWithStatus;
    expect(retiredWakeRes.init?.status).toBe(400);
    expect(retiredWakeRes.data['ok']).toBe(false);

    const reindexFailCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      { intent: 'reindex-qdrant' },
      'corr-ops-reindex-503',
    );
    const reindexFailRes = (await opsAction(
      reindexFailCall.args as never,
    )) as unknown as DataWithStatus;
    expectUpstream503(reindexFailRes, reindexFailCall.logger, 'corr-ops-reindex-503');

    // Both /ops and /cms preserve 409 lock contention and 422 confidentiality responses and propagate X-Correlation-Id
    process.env['AI_ASK_URL'] = 'http://127.0.0.1:8083';
    mocks.triggerReindex.mockRejectedValueOnce(
      new ConnectError('reindex already in progress', Code.FailedPrecondition),
    );
    const ops409Call = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      { intent: 'reindex-qdrant' },
      'corr-ops-reindex-409',
    );
    const ops409Res = (await opsAction(ops409Call.args as never)) as unknown as DataWithStatus;
    expect(ops409Res.init?.status).toBe(409);
    expect(ops409Res.data).toMatchObject({
      ok: false,
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-ops-reindex-409',
    });
    expect(mocks.triggerReindex).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'corr-ops-reindex-409',
        internalAuth: { role: 'admin', subject: 'admin-console-reindex' },
      }),
    );

    mocks.triggerReindex.mockRejectedValueOnce(
      new ConnectError('reindex already in progress', Code.FailedPrecondition),
    );
    const cms409Call = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'reindex-qdrant' },
      'corr-cms-reindex-409',
    );
    const cms409Res = (await cmsAction(cms409Call.args as never)) as unknown as DataWithStatus;
    expect(cms409Res.init?.status).toBe(409);
    expect(cms409Res.data).toMatchObject({
      ok: false,
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-cms-reindex-409',
    });

    // Both /ops and /cms preserve 422 confidentiality policy errors (Code.FailedPrecondition + ErrorDetailEnvelope status=422)
    const errInner = Buffer.concat([
      Buffer.from([0x0a, 14]),
      Buffer.from('ERR_CONSTRAINT', 'utf8'),
      Buffer.from([0x10, 0xa6, 0x03]), // field 2 varint 422
    ]);
    const env422 = Buffer.concat([Buffer.from([0x0a, errInner.length]), errInner]);
    const make422Err = () => {
      const err = new ConnectError('origin confidentiality violation', Code.FailedPrecondition);
      err.details.push({ type: 'common.v1.ErrorDetailEnvelope', value: new Uint8Array(env422) });
      return err;
    };

    mocks.triggerReindex.mockRejectedValueOnce(make422Err());
    const ops422Call = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      { intent: 'reindex-qdrant' },
      'corr-ops-reindex-422',
    );
    const ops422Res = (await opsAction(ops422Call.args as never)) as unknown as DataWithStatus;
    expect(ops422Res.init?.status).toBe(422);
    expect(ops422Res.data).toMatchObject({
      ok: false,
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-ops-reindex-422',
    });

    mocks.triggerReindex.mockRejectedValueOnce(make422Err());
    const cms422Call = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'reindex-qdrant' },
      'corr-cms-reindex-422',
    );
    const cms422Res = (await cmsAction(cms422Call.args as never)) as unknown as DataWithStatus;
    expect(cms422Res.init?.status).toBe(422);
    expect(cms422Res.data).toMatchObject({
      ok: false,
      code: 'ERR_CONSTRAINT',
      correlationId: 'corr-cms-reindex-422',
    });
    delete process.env['AI_ASK_URL'];

    mocks.overrideAdminSandboxGateVerdictViaGrpc.mockResolvedValueOnce({
      runId: '11111111-1111-4111-8111-111111111111',
      gateVerdict: 'approved',
    });
    const prevCadenceAdminUrl = process.env['CADENCE_ADMIN_URL'];
    const gateFetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      process.env['CADENCE_ADMIN_URL'] = 'http://127.0.0.1:1';
      const overrideOkCall = makeActionArgs(
        'http://localhost:4301/ops',
        '/ops',
        {
          intent: 'override-gate',
          runId: '11111111-1111-4111-8111-111111111111',
          gateVerdict: 'approved',
        },
        'corr-ops-override-200',
      );
      const overrideOkRes = (await opsAction(
        overrideOkCall.args as never,
      )) as unknown as DataWithStatus;
      expect(overrideOkRes.init?.status).toBe(200);
      expect(overrideOkRes.data['ok']).toBe(true);
      expect(gateFetchSpy).not.toHaveBeenCalled();
    } finally {
      gateFetchSpy.mockRestore();
      if (prevCadenceAdminUrl === undefined) delete process.env['CADENCE_ADMIN_URL'];
      else process.env['CADENCE_ADMIN_URL'] = prevCadenceAdminUrl;
    }

    mocks.overrideAdminSandboxGateVerdictViaGrpc.mockRejectedValueOnce(
      makeConnectErrorWithEnvelope(
        Code.FailedPrecondition,
        'ERR_CONSTRAINT',
        409,
        'Golden showcase runs are read-only.',
      ),
    );
    const goldenCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      {
        intent: 'override-gate',
        runId: '11111111-1111-4111-8111-111111111111',
        gateVerdict: 'rejected',
      },
      'corr-ops-golden-409',
    );
    const goldenRes = (await opsAction(goldenCall.args as never)) as unknown as DataWithStatus;
    expect(goldenRes.init?.status).toBe(409);
    expect(goldenRes.data['code']).toBe('ERR_CONSTRAINT');
    expect(goldenRes.data['message']).toContain('Golden showcase runs are read-only');
    expect(goldenCall.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        seam_type: 'UNSOUND_CONDITION',
        event: 'cadence.gate.golden_mutation_blocked',
        correlationId: 'corr-ops-golden-409',
      }),
      expect.any(String),
    );

    mocks.overrideAdminSandboxGateVerdictViaGrpc.mockRejectedValueOnce(
      new ConnectError('run not found', Code.NotFound),
    );
    const missingRunCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      {
        intent: 'override-gate',
        runId: '11111111-1111-4111-8111-111111111111',
        gateVerdict: 'approved',
      },
      'corr-ops-404',
    );
    const missingRunRes = (await opsAction(
      missingRunCall.args as never,
    )) as unknown as DataWithStatus;
    expect(missingRunRes.init?.status).toBe(404);
    expect(missingRunRes.data['code']).toBe('ERR_NOT_FOUND');

    mocks.overrideAdminSandboxGateVerdictViaGrpc.mockRejectedValueOnce(
      new ConnectError('admin-api unreachable', Code.Unavailable),
    );
    const dbCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      {
        intent: 'override-gate',
        runId: '11111111-1111-4111-8111-111111111111',
        gateVerdict: 'rejected',
      },
      'corr-ops-503',
    );
    const dbRes = (await opsAction(dbCall.args as never)) as unknown as DataWithStatus;
    expect(dbRes.init?.status).toBe(503);
    expect(dbRes.data['code']).toBe('ERR_UPSTREAM_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-ops-503');
    expect(dbCall.logger.error).toHaveBeenCalled();
  });

  it('enforces requireAdminSession, rate-limit 429, and gRPC fault classification in admin api.analytics.ingest', async () => {
    const validBatch = {
      sessionId: 'sess_admin_123456',
      events: [
        {
          type: 'page_view',
          name: 'admin.view',
          path: '/analytics',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const makeJsonArgs = (body: unknown, correlationId: string) => {
      const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
      const context = new RouterContextProvider();
      context.set(requestContextKey, {
        correlationId,
        logger,
        serviceName: 'admin-ssr',
        signal: new AbortController().signal,
      });
      const request = new Request('http://localhost:4301/api/analytics/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'AdminTest/1.0' },
        body: JSON.stringify(body),
      });
      return {
        logger,
        args: {
          request,
          url: new URL('http://localhost:4301/api/analytics/ingest'),
          pattern: '/api/analytics/ingest',
          unstable_pattern: '/api/analytics/ingest',
          params: {},
          context,
        },
      };
    };

    // 1. Unauthenticated caller rejected with 401 and RULE_DIVERGENCE seam
    mocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce(UNAUTH_STATUS);
    const unauthCall = makeJsonArgs(validBatch, 'corr-ingest-401');
    const unauthRes = await analyticsIngestAction(unauthCall.args as never);
    expect(unauthRes.status).toBe(401);
    expect(mocks.ingestAdminAnalyticsViaGrpc).not.toHaveBeenCalled();
    expect(unauthCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        seam_type: 'RULE_DIVERGENCE',
        event: 'admin.analytics.ingest_auth_branch',
        branch: 'unauthenticated_rejected_401',
        correlationId: 'corr-ingest-401',
      }),
      expect.any(String),
    );

    // 2. Authenticated caller succeeds with 202 and RULE_DIVERGENCE seam
    mocks.ingestAdminAnalyticsViaGrpc.mockResolvedValueOnce({
      accepted: 1,
      sessionId: 'sess_admin_123456',
      ipHash: 'hash_1',
    });
    const okCall = makeJsonArgs(validBatch, 'corr-ingest-202');
    const okResponse = await analyticsIngestAction(okCall.args as never);
    expect(okResponse.status).toBe(202);
    expect(okResponse.headers.get('X-Correlation-Id')).toBe('corr-ingest-202');
    expect(mocks.ingestAdminAnalyticsViaGrpc).toHaveBeenCalledWith(
      AUTH_STATUS.session.sessionId,
      expect.objectContaining({ sessionId: 'sess_admin_123456' }),
      'AdminTest/1.0',
      expect.objectContaining({ correlationId: 'corr-ingest-202' }),
    );
    expect(okCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        seam_type: 'RULE_DIVERGENCE',
        event: 'admin.analytics.ingest_auth_branch',
        branch: 'authenticated_accepted',
        correlationId: 'corr-ingest-202',
      }),
      expect.any(String),
    );

    // 3. Rate limit 429 forwards Retry-After and logs rate_limited_429
    mocks.ingestAdminAnalyticsViaGrpc.mockRejectedValueOnce(
      makeConnectErrorWithEnvelope(
        Code.ResourceExhausted,
        'ERR_RATE_LIMITED',
        429,
        'Too many requests.',
        30,
      ),
    );
    const rateCall = makeJsonArgs(validBatch, 'corr-ingest-429');
    const rateRes = await analyticsIngestAction(rateCall.args as never);
    expect(rateRes.status).toBe(429);
    expect(rateRes.headers.get('Retry-After')).toBe('30');
    expect(rateCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        seam_type: 'RULE_DIVERGENCE',
        event: 'admin.analytics.ingest_auth_branch',
        branch: 'rate_limited_429',
        correlationId: 'corr-ingest-429',
      }),
      expect.any(String),
    );

    // 4. Upstream Unavailable maps cleanly to 503
    mocks.ingestAdminAnalyticsViaGrpc.mockRejectedValueOnce(
      new ConnectError('admin-api unavailable', Code.Unavailable),
    );
    const { args, logger } = makeJsonArgs(validBatch, 'corr-ingest-503');
    const response = await analyticsIngestAction(args as never);
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Correlation-Id')).toBe('corr-ingest-503');
    const body: unknown = await response.json();
    expect(isPublicAppError(body)).toBe(true);
    expect(body).toEqual(
      expect.objectContaining({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        correlationId: 'corr-ingest-503',
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('emits admin.cms.dossier_mutation_committed DELTA_AUDIT_GAP log on career dossier upsert', async () => {
    mocks.upsertAdminCareerDossierViaGrpc.mockResolvedValueOnce({
      slug: 'cloud-platform-audit',
      kind: 'architecture',
      title: 'Cloud Platform Audit',
      domainLabel: 'Cloud',
      roleTitle: 'Architect',
      timeframe: '2025',
      skills: ['Go'],
      summaryBody: 'Clean summary.',
      sections: [{ heading: 'Security', body: 'Fail-closed design.' }],
      publishStatus: 'draft',
      sanitizationVerifiedAt: '2026-11-25T00:00:00.000Z',
      denylistHash: 'hash',
      sortOrder: 1,
      updatedAt: '2026-11-25T00:00:00.000Z',
    });

    const { args, logger } = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-career-dossier',
        slug: 'cloud-platform-audit',
        kind: 'architecture',
        title: 'Cloud Platform Audit',
        domainLabel: 'Cloud',
        roleTitle: 'Architect',
        timeframe: '2025',
        skills: 'Go',
        summaryBody: 'Clean summary.',
        sectionsJson: JSON.stringify([{ heading: 'Security', body: 'Fail-closed design.' }]),
        sortOrder: '1',
      },
      'corr-dossier-audit',
    );
    const res = (await cmsAction(args as never)) as unknown as DataWithStatus;
    expect(res.data['ok']).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.dossier_mutation_committed',
        seam_type: 'DELTA_AUDIT_GAP',
        slug: 'cloud-platform-audit',
        publishStatus: 'draft',
        chunkCount: 2,
        adminActor: AUTH_STATUS.session.handle,
        correlationId: 'corr-dossier-audit',
      }),
      expect.any(String),
    );
  });

  it('enforces schema HTTP 400, fail-closed gRPC privacy HTTP 422, auth gate, and audit commit log on portal-about CMS mutations', async () => {
    mocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce(UNAUTH_STATUS);
    const unauthCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: SITE_CONTENT_KEYS.portalAbout,
        markdownBody: 'Clean note',
        metadataJson: JSON.stringify(PORTAL_ABOUT_SEED),
      },
      'corr-about-unauth',
    );
    let authRejected: unknown = null;
    try {
      const res = await cmsAction(unauthCall.args as never);
      authRejected = res;
    } catch (error) {
      authRejected = error;
    }
    expect(authRejected).toBeTruthy();
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();

    const badSchemaCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: SITE_CONTENT_KEYS.portalAbout,
        markdownBody: 'Clean',
        metadataJson: JSON.stringify({
          ...PORTAL_ABOUT_SEED,
          services: [
            {
              ...PORTAL_ABOUT_SEED.services[0],
              to: 'https://untrusted.example/phish',
            },
          ],
        }),
      },
      'corr-about-400',
    );
    const badSchemaRes = (await cmsAction(
      badSchemaCall.args as never,
    )) as unknown as DataWithStatus;
    expect(badSchemaRes.init?.status).toBe(400);
    expect(badSchemaRes.data['code']).toBe('ERR_VALIDATION');
    expect(mocks.upsertAdminSiteContentViaGrpc).not.toHaveBeenCalled();

    mocks.upsertAdminSiteContentViaGrpc.mockRejectedValueOnce(
      new PrivacySanitizationError([
        {
          ruleId: 'pii.email_address',
          category: 'pii',
          field: 'markdownBody',
          location: 'markdownBody',
        },
        {
          ruleId: 'pii.us_phone',
          category: 'pii',
          field: 'markdownBody',
          location: 'markdownBody',
        },
        {
          ruleId: 'pii.us_postal_zip',
          category: 'pii',
          field: 'markdownBody',
          location: 'markdownBody',
        },
      ]),
    );
    const piiCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: SITE_CONTENT_KEYS.portalAbout,
        markdownBody:
          'Contact reference.contact@example.com at (555) 010-1234 in Marietta, GA 30062',
        metadataJson: JSON.stringify(PORTAL_ABOUT_SEED),
      },
      'corr-about-422',
    );
    const piiRes = (await cmsAction(piiCall.args as never)) as unknown as DataWithStatus;
    expect(piiRes.init?.status).toBe(422);
    expect(piiRes.data['code']).toBe('ERR_CONSTRAINT');
    expect(piiRes.data['sanitizationFindings']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'pii.email_address' }),
        expect.objectContaining({ ruleId: 'pii.us_phone' }),
        expect.objectContaining({ ruleId: 'pii.us_postal_zip' }),
      ]),
    );

    mocks.upsertAdminSiteContentViaGrpc.mockResolvedValueOnce({
      key: SITE_CONTENT_KEYS.portalAbout,
      markdownBody: 'Updated about note for port :11434 and 40000 items.',
      metadataJson: PORTAL_ABOUT_SEED,
      updatedAt: '2026-11-26T18:00:00.000Z',
    });
    const validCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      {
        intent: 'upsert-site-content',
        key: SITE_CONTENT_KEYS.portalAbout,
        markdownBody: 'Updated about note for port :11434 and 40000 items.',
        metadataJson: JSON.stringify(PORTAL_ABOUT_SEED),
      },
      'corr-about-200',
    );
    const validRes = (await cmsAction(validCall.args as never)) as unknown as DataWithStatus;
    expect(validRes.init?.status).toBe(200);
    expect(validRes.data['ok']).toBe(true);
    expect(mocks.upsertAdminSiteContentViaGrpc).toHaveBeenLastCalledWith(
      AUTH_STATUS.session.sessionId,
      expect.objectContaining({
        key: SITE_CONTENT_KEYS.portalAbout,
        markdownBody: 'Updated about note for port :11434 and 40000 items.',
      }),
      expect.objectContaining({ correlationId: 'corr-about-200' }),
    );
    expect(validCall.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.site_content_upsert_committed',
        key: SITE_CONTENT_KEYS.portalAbout,
        updatedAt: '2026-11-26T18:00:00.000Z',
        correlationId: 'corr-about-200',
      }),
      expect.any(String),
    );
  });
});
