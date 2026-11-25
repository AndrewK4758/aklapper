import { isPublicAppError } from '@aklapper/core';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AsyncUnknownFn = (...args: unknown[]) => Promise<unknown>;
type LogFn = (obj: Record<string, unknown>, msg?: string) => void;

const mocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
  getSharedDb: vi.fn<() => unknown>(),
  setMaintenanceModeDefault: vi.fn<AsyncUnknownFn>(),
  syncAgensiCatalog: vi.fn<AsyncUnknownFn>(),
  upsertSiteContent: vi.fn<AsyncUnknownFn>(),
  deleteMenuItem: vi.fn<AsyncUnknownFn>(),
  deleteContactSubmission: vi.fn<AsyncUnknownFn>(),
  deleteContactSubmissions: vi.fn<AsyncUnknownFn>(),
  updateQuotaPolicy: vi.fn<AsyncUnknownFn>(),
  resetRateLimitBucket: vi.fn<AsyncUnknownFn>(),
  overrideSandboxGateVerdict: vi.fn<AsyncUnknownFn>(),
  handleAnalyticsIngestRequest: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock('@aklapper/db/auth', () => ({
  resolveAdminSessionFromRequest: mocks.resolveAdminSessionFromRequest,
}));

vi.mock('@aklapper/db/analytics', () => ({
  handleAnalyticsIngestRequest: mocks.handleAnalyticsIngestRequest,
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: mocks.getSharedDb,
    setMaintenanceModeDefault: mocks.setMaintenanceModeDefault,
    syncAgensiCatalog: mocks.syncAgensiCatalog,
    upsertSiteContent: mocks.upsertSiteContent,
    deleteMenuItem: mocks.deleteMenuItem,
    deleteContactSubmission: mocks.deleteContactSubmission,
    deleteContactSubmissions: mocks.deleteContactSubmissions,
    updateQuotaPolicy: mocks.updateQuotaPolicy,
    resetRateLimitBucket: mocks.resetRateLimitBucket,
    overrideSandboxGateVerdict: mocks.overrideSandboxGateVerdict,
  };
});

import { ADMIN_CMS_FIXTURE, AUTH_STATUS } from './admin-test-fixtures';
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

describe('Admin mutation actions & classified HTTP status semantics', () => {
  const originalAiAskUrl = process.env['AI_ASK_URL'];
  const originalK8sWatchUrl = process.env['K8S_WATCH_URL'];

  beforeEach(() => {
    mocks.resolveAdminSessionFromRequest.mockResolvedValue(AUTH_STATUS);
    mocks.getSharedDb.mockReturnValue({});
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
    mocks.setMaintenanceModeDefault.mockResolvedValueOnce({
      maintenanceModeDefault: true,
      rebuildProgressPercent: 75,
    });
    const okCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'set-maintenance', maintenanceModeDefault: 'true', rebuildProgressPercent: '75' },
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

    mocks.deleteMenuItem.mockResolvedValueOnce(false);
    const missingCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'delete-menu-item', slug: 'missing-item' },
      'corr-cms-404',
    );
    const missingRes = (await cmsAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    const dbErr = Object.assign(
      new Error('Failed query: UPDATE portal_chrome; connection terminated'),
      { name: 'DrizzleQueryError', cause: new Error('connection terminated') },
    );
    mocks.setMaintenanceModeDefault.mockRejectedValueOnce(dbErr);
    const failCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'set-maintenance', maintenanceModeDefault: 'true' },
      'corr-cms-503',
    );
    const failRes = (await cmsAction(failCall.args as never)) as unknown as DataWithStatus;
    expect(failRes.init?.status).toBe(503);
    expect(failRes.data['ok']).toBe(false);
    expect(failRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(failRes.data['correlationId']).toBe('corr-cms-503');
    expect(String(failRes.data['message'])).not.toContain('connection terminated');
    expect(String(failRes.data['message'])).not.toContain('UPDATE');
    expect(failCall.logger.error).toHaveBeenCalledTimes(1);

    mocks.getSharedDb.mockClear();
    mocks.getSharedDb.mockImplementation(() => {
      throw new Error('DATABASE_URL is required');
    });
    const reindexCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'reindex-qdrant' },
      'corr-cms-reindex-503',
    );
    const reindexRes = (await cmsAction(reindexCall.args as never)) as unknown as DataWithStatus;
    expectUpstream503(reindexRes, reindexCall.logger, 'corr-cms-reindex-503');
    expect(mocks.getSharedDb).not.toHaveBeenCalled();
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
          maintenanceModeDefault: false,
        }),
      },
      'corr-sc-invalid',
    );
    const invalidRes = (await cmsAction(
      invalidSchemaCall.args as never,
    )) as unknown as DataWithStatus;
    expect(invalidRes.init?.status).toBe(400);
    expect(invalidRes.data['code']).toBe('ERR_VALIDATION');
    expect(mocks.upsertSiteContent).not.toHaveBeenCalled();
    expect(invalidSchemaCall.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.cms.site_content_invalid_payload',
        key: 'portal-chrome',
        correlationId: 'corr-sc-invalid',
      }),
      expect.any(String),
    );

    mocks.upsertSiteContent.mockResolvedValueOnce({
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
  });

  it('triggers syncAgensiCatalog on sync-agensi-catalog and rejects retired manual CRUD intents with HTTP 410', async () => {
    mocks.syncAgensiCatalog.mockResolvedValueOnce({
      creatorHandle: 'aklapper',
      skills: ADMIN_CMS_FIXTURE.agensiSkills,
      syncState: ADMIN_CMS_FIXTURE.agensiSyncState,
      notModified: false,
      syncedCount: 1,
      deactivatedCount: 0,
    });

    const syncCall = makeActionArgs(
      'http://localhost:4301/cms',
      '/cms',
      { intent: 'sync-agensi-catalog' },
      'corr-agensi-sync',
    );
    const syncRes = (await cmsAction(syncCall.args as never)) as unknown as DataWithStatus;
    expect(mocks.syncAgensiCatalog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ forceRefresh: true, correlationId: 'corr-agensi-sync' }),
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
    mocks.deleteContactSubmission.mockResolvedValueOnce(true);
    const okCall = makeActionArgs(
      'http://localhost:4301/inbox',
      '/inbox',
      { intent: 'delete', id: 'sub-1' },
      'corr-inbox-200',
    );
    const okRes = (await inboxAction(okCall.args as never)) as unknown as DataWithStatus;
    expect(okRes.init?.status).toBe(200);
    expect(okRes.data['ok']).toBe(true);

    mocks.deleteContactSubmission.mockResolvedValueOnce(false);
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

    mocks.deleteContactSubmission.mockRejectedValueOnce(new Error('connection terminated'));
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
    expect(String(dbRes.data['message'])).not.toContain('connection terminated');
    expect(dbCall.logger.error).toHaveBeenCalledTimes(1);
  });

  it('handles delete-many intent with deduplication and honest 200, 400, 404, and 503 statuses', async () => {
    mocks.deleteContactSubmissions.mockResolvedValueOnce(2);
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
    expect(mocks.deleteContactSubmissions).toHaveBeenCalledWith(expect.anything(), [
      'sub-1',
      'sub-2',
    ]);

    mocks.deleteContactSubmissions.mockResolvedValueOnce(1);
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

    mocks.deleteContactSubmissions.mockResolvedValueOnce(0);
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

    mocks.deleteContactSubmissions.mockRejectedValueOnce(new Error('connection terminated'));
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
    expect(dbRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-inbox-bulk-503');
    expect(String(dbRes.data['message'])).not.toContain('connection terminated');
    expect(dbCall.logger.error).toHaveBeenCalledTimes(1);
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

    mocks.resetRateLimitBucket.mockResolvedValueOnce(false);
    const missingCall = makeActionArgs(
      'http://localhost:4301/quotas',
      '/quotas',
      { intent: 'reset-bucket', scopeKey: 'session:missing' },
      'corr-quotas-404',
    );
    const missingRes = (await quotasAction(missingCall.args as never)) as unknown as DataWithStatus;
    expect(missingRes.init?.status).toBe(404);
    expect(missingRes.data['code']).toBe('ERR_NOT_FOUND');

    mocks.getSharedDb.mockImplementationOnce(() => {
      throw new Error('DATABASE_URL is required');
    });
    const dbCall = makeActionArgs(
      'http://localhost:4301/quotas',
      '/quotas',
      { intent: 'reset-bucket', scopeKey: 'session:active' },
      'corr-quotas-503',
    );
    const dbRes = (await quotasAction(dbCall.args as never)) as unknown as DataWithStatus;
    expect(dbRes.init?.status).toBe(503);
    expect(dbRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-quotas-503');
    expect(String(dbRes.data['message'])).not.toContain('DATABASE_URL');
    expect(dbCall.logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns honest 200, 400, 404, and 503 responses in ops action including upstream wake/reindex failures', async () => {
    const wakeSimCall = makeActionArgs(
      'http://localhost:4301/ops',
      '/ops',
      { intent: 'wake-deployment', deployment: 'svc-ai-ask' },
      'corr-ops-wake-200',
    );
    const wakeSimRes = (await opsAction(wakeSimCall.args as never)) as unknown as DataWithStatus;
    expect(wakeSimRes.init?.status).toBe(200);
    expect(wakeSimRes.data['ok']).toBe(true);

    process.env['K8S_WATCH_URL'] = 'http://127.0.0.1:9999';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'cluster watch down' }), { status: 502 }),
      );
    try {
      const wakeFailCall = makeActionArgs(
        'http://localhost:4301/ops',
        '/ops',
        { intent: 'wake-deployment', deployment: 'svc-ai-ask' },
        'corr-ops-wake-503',
      );
      const wakeFailRes = (await opsAction(
        wakeFailCall.args as never,
      )) as unknown as DataWithStatus;
      expectUpstream503(wakeFailRes, wakeFailCall.logger, 'corr-ops-wake-503');
    } finally {
      fetchSpy.mockRestore();
      delete process.env['K8S_WATCH_URL'];
    }

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

    mocks.overrideSandboxGateVerdict.mockResolvedValueOnce(null);
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

    mocks.overrideSandboxGateVerdict.mockRejectedValueOnce(new Error('connection terminated'));
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
    expect(dbRes.data['code']).toBe('ERR_DB_UNAVAILABLE');
    expect(dbRes.data['correlationId']).toBe('corr-ops-503');
    expect(dbCall.logger.error).toHaveBeenCalledTimes(1);
  });

  it('classifies unexpected DB faults in admin api.analytics.ingest with X-Correlation-Id', async () => {
    mocks.handleAnalyticsIngestRequest.mockRejectedValueOnce(new Error('connection terminated'));
    const { args, logger } = makeActionArgs(
      'http://localhost:4301/api/analytics/ingest',
      '/api/analytics/ingest',
      {},
      'corr-ingest-503',
    );

    const response = await analyticsIngestAction(args as never);
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Correlation-Id')).toBe('corr-ingest-503');
    const body: unknown = await response.json();
    expect(isPublicAppError(body)).toBe(true);
    expect(body).toEqual(
      expect.objectContaining({
        code: 'ERR_DB_UNAVAILABLE',
        correlationId: 'corr-ingest-503',
      }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
