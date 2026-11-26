import {
  type AskServiceStatus,
  CONTACT_FORM_DEFINITION,
  createPublicAppError,
  type PortalAgensiLoaderData,
  PortalAskContentSchema,
  type PortalAskLoaderData,
  type PortalCadenceLoaderData,
  type PortalHomeLoaderData,
  type PublicAppError,
  type QuotaStatus,
  type StreamResult,
} from '@aklapper/core';
import { GUEST_SESSION_COOKIE_NAME } from '@aklapper/node-runtime/auth';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  getSharedDbMock,
  loadPortalHomeMock,
  loadPortalAskMock,
  loadPortalCadenceMock,
  consumeQuotaMock,
  findCachedSandboxRunMock,
  createPendingRunMock,
  updateGateForSessionMock,
} = vi.hoisted(() => ({
  getSharedDbMock: vi.fn<() => Record<string, never>>(() => ({})),
  loadPortalHomeMock: vi.fn<() => Promise<PortalHomeLoaderData>>(),
  loadPortalAskMock: vi.fn<(sid?: string) => Promise<PortalAskLoaderData>>(),
  loadPortalCadenceMock: vi.fn<(sid?: string) => Promise<PortalCadenceLoaderData>>(),
  consumeQuotaMock: vi.fn<() => Promise<{ allowed: boolean; quota: QuotaStatus }>>(),
  findCachedSandboxRunMock: vi.fn<
    () => Promise<{
      promptHash: string;
      scope: 'miss';
      sourceRun: null;
      sourceTurns: readonly never[];
    }>
  >(async () => ({
    promptHash: 'mock-hash',
    scope: 'miss',
    sourceRun: null,
    sourceTurns: [],
  })),
  createPendingRunMock: vi.fn<() => Promise<never>>(),
  updateGateForSessionMock: vi.fn<() => Promise<never>>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: getSharedDbMock,
    loadPortalHomeDataWithPrerender: loadPortalHomeMock,
    loadPortalAskDataWithPrerender: loadPortalAskMock,
    loadPortalCadenceDataWithPrerender: loadPortalCadenceMock,
    consumeQuotaForSession: consumeQuotaMock,
    findCachedSandboxRun: findCachedSandboxRunMock,
    createPendingSandboxRunWithQuota: createPendingRunMock,
    updateSandboxRunGateVerdictForSession: updateGateForSessionMock,
  };
});

import PortalAgensiRoute, { ErrorBoundary as AgensiErrorBoundary } from './agensi';
import { loader as askTurnPollLoader } from './api.ask.turns.$attemptId';
import * as apiNotFoundModule from './api.not-found';
import { action as cadenceAction, loader as cadenceLoader } from './cadence';
import PortalChatRoute, { action as chatAction, loader as chatLoader } from './chat';
import PortalHomeRoute, {
  ErrorBoundary as HomeErrorBoundary,
  loader as homeLoader,
  meta as homeMeta,
} from './home';
import PortalNotFoundRoute, {
  action as notFoundAction,
  ErrorBoundary as NotFoundErrorBoundary,
  loader as notFoundLoader,
  meta as notFoundMeta,
} from './not-found';

const HOME_FIXTURE: PortalHomeLoaderData = {
  content: {
    tuiTitle: 'tui :: solar-forge launcher',
    tuiBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods' },
    heading: 'Solar Forge Agentic Terminal — tty1',
    description: 'Interactive Solar Forge terminal workspace.',
    actions: [{ label: 'Open Menu', to: '/menu', variant: 'primary' }],
  },
  terminal: {
    slug: 'portal-home',
    bannerTitle: 'Solar Forge Terminal',
    bannerMeta: 'tty1',
    osLabel: '⚡',
    directory: '~/andrew-k.us',
    vcsBranch: 'main',
    vcsState: 'clean',
    contextLabel: 'visitor@andrew-k.us',
    placeholder: 'type a command',
    quickCommands: ['help'],
    initialEntries: [],
    commands: [],
  },
  contactForm: CONTACT_FORM_DEFINITION,
};

function makeContext(correlationId: string) {
  const errorCalls: Array<Record<string, unknown>> = [];
  const logger: SsrStructuredLogger = {
    info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(obj => {
      errorCalls.push(obj);
    }),
  };
  const context = new RouterContextProvider();
  context.set(requestContextKey, {
    correlationId,
    logger,
    serviceName: 'portal-ssr',
    signal: new AbortController().signal,
  });
  return { context, errorCalls };
}

function makeFormRequest(url: string, fields: Record<string, string>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return {
    url,
    headers: new Headers(),
    formData: async () => fd,
  } as unknown as Request;
}

describe('Portal streaming child routes, guest sessions, actions, and boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('streams / home payload without awaiting DB and isolates render errors in ErrorBoundary', async () => {
    const pending = Promise.withResolvers<PortalHomeLoaderData>();
    loadPortalHomeMock.mockReturnValueOnce(pending.promise);
    const { context } = makeContext('corr-home-1');

    const loaderRes = homeLoader({
      request: new Request('https://andrew-k.us/'),
      params: {},
      context,
      url: new URL('https://andrew-k.us/'),
      pattern: '/',
    });
    expect(loaderRes.correlationId).toBe('corr-home-1');
    expect(loaderRes.payload).toBeInstanceOf(Promise);

    const tags = homeMeta({
      loaderData: loaderRes,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: {
            runtimeSeo: { siteUrl: 'https://andrew-k.us' },
            correlationId: 'corr-root',
            initialViewport: 'desktop',
            isNotFound: false,
            rootPayload: Promise.withResolvers<never>().promise,
          },
        },
        { id: 'routes/home', params: {}, pathname: '/', meta: [], loaderData: loaderRes },
      ],
      location: { pathname: '/', search: '', hash: '', state: null, key: 'h1' },
      params: {},
    });
    expect(tags).toContainEqual({ title: 'Andrew Klapper Portfolio' });

    const Stub = createRoutesStub([
      {
        path: '/',
        loader: () => loaderRes,
        Component: PortalHomeRoute,
        ErrorBoundary: HomeErrorBoundary,
      },
    ]);
    render(<Stub initialEntries={['/']} />);
    expect(await screen.findByRole('status')).toBeTruthy();

    pending.resolve(HOME_FIXTURE);
    expect(await screen.findByLabelText('Interactive Terminal tty1')).toBeTruthy();

    const ErrorStub = createRoutesStub([
      {
        path: '/',
        Component: () => {
          throw new Error('Synthetic child render failure at /srv/internal/home.tsx:99');
        },
        ErrorBoundary: HomeErrorBoundary,
      },
    ]);
    render(<ErrorStub initialEntries={['/']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_INTERNAL');
    expect(alert.textContent).not.toContain('/srv/internal/home.tsx');
  });

  it('renders correlated ErrorElement on /agensi stream failure without Unexpected Server Error erasure', async () => {
    const dbError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-agensi-503',
    });

    const Stub = createRoutesStub([
      {
        path: '/agensi',
        loader: () => ({
          correlationId: 'corr-agensi-503',
          payload: Promise.resolve<StreamResult<PortalAgensiLoaderData>>({
            ok: false,
            error: dbError,
          }),
        }),
        Component: PortalAgensiRoute,
        ErrorBoundary: AgensiErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/agensi']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-agensi-503');
    expect(alert.textContent).not.toContain('Unexpected Server Error');
  });

  it('fails closed on unmatched GET/POST /api/* via resource catch-all and renders correlated 404 ErrorBoundary on HTML * routes', async () => {
    // Resource route must export ONLY loader and action (zero default / ErrorBoundary)
    expect('default' in apiNotFoundModule).toBe(false);
    expect('ErrorBoundary' in apiNotFoundModule).toBe(false);

    const apiGetCtx = makeContext('corr-api-get-404');
    const apiGetRes = apiNotFoundModule.loader({
      request: new Request('https://andrew-k.us/api/nonexistent-endpoint', { method: 'GET' }),
      params: { '*': 'nonexistent-endpoint' },
      context: apiGetCtx.context,
      url: new URL('https://andrew-k.us/api/nonexistent-endpoint'),
      pattern: '/api/*',
    });
    expect(apiGetRes.status).toBe(404);
    expect(apiGetRes.headers.get('content-type')).toContain('application/json');
    expect(apiGetRes.headers.get('X-Correlation-Id')).toBe('corr-api-get-404');
    const getBody = (await apiGetRes.json()) as PublicAppError;
    expect(getBody).toMatchObject({
      code: 'ERR_NOT_FOUND',
      status: 404,
      correlationId: 'corr-api-get-404',
    });

    const apiPostCtx = makeContext('corr-api-post-404');
    const apiPostRes = apiNotFoundModule.action({
      request: new Request('https://andrew-k.us/api/nonexistent-endpoint', { method: 'POST' }),
      params: { '*': 'nonexistent-endpoint' },
      context: apiPostCtx.context,
      url: new URL('https://andrew-k.us/api/nonexistent-endpoint'),
      pattern: '/api/*',
    });
    expect(apiPostRes.status).toBe(404);
    expect(apiPostRes.headers.get('content-type')).toContain('application/json');
    expect(apiPostRes.headers.get('X-Correlation-Id')).toBe('corr-api-post-404');
    const postBody = (await apiPostRes.json()) as PublicAppError;
    expect(postBody).toMatchObject({
      code: 'ERR_NOT_FOUND',
      status: 404,
      correlationId: 'corr-api-post-404',
    });

    // HTML catch-all not-found loader throws 404 DataWithResponseInit with PublicAppError and X-Correlation-Id
    const htmlCtx = makeContext('corr-html-404');
    let thrown: unknown = null;
    try {
      notFoundLoader({
        request: new Request('https://andrew-k.us/changes-in-progress'),
        params: { '*': 'changes-in-progress' },
        context: htmlCtx.context,
        url: new URL('https://andrew-k.us/changes-in-progress'),
        pattern: '/*',
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      type: 'DataWithResponseInit',
      data: {
        code: 'ERR_NOT_FOUND',
        status: 404,
        correlationId: 'corr-html-404',
      },
      init: {
        status: 404,
        headers: { 'X-Correlation-Id': 'corr-html-404' },
      },
    });

    // Catch-all not-found action throws 404 PublicAppError on POST/DELETE instead of 405 Method Not Allowed
    for (const reqUrl of [
      'https://andrew-k.us/changes-in-progress',
      'https://andrew-k.us/changes-in-progress.data',
    ]) {
      const actionCtx = makeContext('corr-html-action-404');
      let actionThrown: unknown = null;
      try {
        notFoundAction({
          request: new Request(reqUrl, { method: 'POST' }),
          params: { '*': 'changes-in-progress' },
          context: actionCtx.context,
          url: new URL(reqUrl),
          pattern: '/*',
        });
      } catch (error) {
        actionThrown = error;
      }
      expect(actionThrown).toMatchObject({
        type: 'DataWithResponseInit',
        data: {
          code: 'ERR_NOT_FOUND',
          status: 404,
          correlationId: 'corr-html-action-404',
        },
        init: {
          status: 404,
          headers: { 'X-Correlation-Id': 'corr-html-action-404' },
        },
      });
    }

    const tags = notFoundMeta({
      loaderData: undefined,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: {
            runtimeSeo: { siteUrl: 'https://andrew-k.us' },
            correlationId: 'corr-root-404',
            initialViewport: 'desktop',
            isNotFound: true,
            rootPayload: null,
          },
        },
        {
          id: 'routes/not-found',
          params: { '*': 'changes-in-progress' },
          pathname: '/changes-in-progress',
          meta: [],
          loaderData: null,
        },
      ],
      location: {
        pathname: '/changes-in-progress',
        search: '',
        hash: '',
        state: null,
        key: 'nf1',
      },
      params: { '*': 'changes-in-progress' },
    });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
    expect(tags).toContainEqual({ title: 'Not Found // andrew-k.us' });

    // ErrorBoundary renders RouteErrorBoundaryView with root correlationId fallback and Return Home link
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-root-fallback-404',
          initialViewport: 'desktop' as const,
          isNotFound: true,
          rootPayload: null,
        }),
        children: [
          {
            path: '*',
            loader: () => {
              throw new Response('Not Found', { status: 404 });
            },
            Component: PortalNotFoundRoute,
            ErrorBoundary: NotFoundErrorBoundary,
          },
        ],
      },
    ]);
    render(<Stub initialEntries={['/changes-in-progress']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_NOT_FOUND');
    expect(alert.textContent).toContain('HTTP 404');
    expect(alert.textContent).toContain('corr-root-fallback-404');
    expect(screen.getByRole('link', { name: 'Return Home' }).getAttribute('href')).toBe('/');
  });

  it('emits synchronous Set-Cookie on /chat and /cadence loaders and classifies DB action faults to HTTP 503', async () => {
    const askPending = Promise.withResolvers<PortalAskLoaderData>();
    loadPortalAskMock.mockReturnValueOnce(askPending.promise);
    const askCtx = makeContext('corr-ask-load');
    const askLoadRes = chatLoader({
      request: new Request('https://andrew-k.us/chat'),
      params: {},
      context: askCtx.context,
      url: new URL('https://andrew-k.us/chat'),
      pattern: '/chat',
    });
    expect(new Headers(askLoadRes.init?.headers).get('Set-Cookie')).toContain(
      `${GUEST_SESSION_COOKIE_NAME}=`,
    );
    expect(askLoadRes.data.payload).toBeInstanceOf(Promise);

    const cadPending = Promise.withResolvers<PortalCadenceLoaderData>();
    loadPortalCadenceMock.mockReturnValueOnce(cadPending.promise);
    const cadCtx = makeContext('corr-cad-load');
    const cadLoadRes = cadenceLoader({
      request: new Request('https://andrew-k.us/cadence'),
      params: {},
      context: cadCtx.context,
      url: new URL('https://andrew-k.us/cadence'),
      pattern: '/cadence',
    });
    expect(new Headers(cadLoadRes.init?.headers).get('Set-Cookie')).toContain(
      `${GUEST_SESSION_COOKIE_NAME}=`,
    );
    expect(cadLoadRes.data.payload).toBeInstanceOf(Promise);

    vi.stubEnv('AI_ASK_URL', '');
    const askErrCtx = makeContext('corr-ask-503');
    const askErrRes = await chatAction({
      request: makeFormRequest('https://andrew-k.us/chat', {
        mode: 'qa',
        text: 'How does streaming SSR work?',
      }),
      params: {},
      context: askErrCtx.context,
      url: new URL('https://andrew-k.us/chat'),
      pattern: '/chat',
    });
    expect(askErrRes.init?.status).toBe(503);
    expect(askErrRes.data).toMatchObject({
      ok: false,
      mode: 'qa',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      action: expect.any(String),
      correlationId: 'corr-ask-503',
    });
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(askErrCtx.errorCalls).toHaveLength(1);

    const oversizeJdRes = await chatAction({
      request: makeFormRequest('https://andrew-k.us/chat', {
        mode: 'jd_match',
        text: 'A'.repeat(8001),
      }),
      params: {},
      context: makeContext('corr-ask-400').context,
      url: new URL('https://andrew-k.us/chat'),
      pattern: '/chat',
    });
    expect(oversizeJdRes.init?.status).toBe(400);
    expect(oversizeJdRes.data).toMatchObject({
      ok: false,
      mode: 'jd_match',
      code: 'ERR_VALIDATION',
    });

    vi.stubEnv('AI_ASK_URL', 'http://127.0.0.1:8083');
    const pendingAttemptId = '22222222-2222-4222-8222-222222222222';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json(
        {
          attemptId: pendingAttemptId,
          status: 'running',
          mode: 'qa',
          correlationId: 'corr-ask-202',
          leaseExpiresAt: '2026-11-24T22:01:00Z',
          expiresAt: '2026-11-24T22:15:00Z',
        },
        { status: 202 },
      ),
    );
    const pendingRes = await chatAction({
      request: makeFormRequest('https://andrew-k.us/chat', {
        mode: 'qa',
        text: 'Explain detached turn execution.',
        attemptId: pendingAttemptId,
      }),
      params: {},
      context: makeContext('corr-ask-202').context,
      url: new URL('https://andrew-k.us/chat'),
      pattern: '/chat',
    });
    expect(pendingRes.init?.status).toBe(202);
    expect(pendingRes.data).toMatchObject({
      ok: true,
      pending: true,
      mode: 'qa',
      attemptId: pendingAttemptId,
    });
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    const postReqInit = fetchSpy.mock.calls[0]?.[1];
    expect(new Headers(postReqInit?.headers).get('x-internal-auth')).toBeTruthy();

    const pollMissingCookie = await askTurnPollLoader({
      request: new Request(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`),
      params: { attemptId: pendingAttemptId },
      context: makeContext('corr-poll-401-missing').context,
      url: new URL(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`),
      pattern: '/api/ask/turns/:attemptId',
    });
    expect(pollMissingCookie.status).toBe(401);
    expect(pollMissingCookie.headers.get('set-cookie')).toBeNull();

    const pollForgedCookie = await askTurnPollLoader({
      request: new Request(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`, {
        headers: { cookie: 'ak_guest_session=guest_forged_unsigned_value' },
      }),
      params: { attemptId: pendingAttemptId },
      context: makeContext('corr-poll-401-forged').context,
      url: new URL(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`),
      pattern: '/api/ask/turns/:attemptId',
    });
    expect(pollForgedCookie.status).toBe(401);
    expect(pollForgedCookie.headers.get('set-cookie')).toBeNull();

    const signedGuestCookieHeader = String(
      (pendingRes.init?.headers as Record<string, string> | undefined)?.['Set-Cookie'] ?? '',
    ).split(';')[0];
    expect(signedGuestCookieHeader).toMatch(/^ak_guest_session=guest_[a-f0-9]+\./);

    const pollBadUuid = await askTurnPollLoader({
      request: new Request('https://andrew-k.us/api/ask/turns/not-a-uuid', {
        headers: { cookie: signedGuestCookieHeader },
      }),
      params: { attemptId: 'not-a-uuid' },
      context: makeContext('corr-poll-400').context,
      url: new URL('https://andrew-k.us/api/ask/turns/not-a-uuid'),
      pattern: '/api/ask/turns/:attemptId',
    });
    expect(pollBadUuid.status).toBe(400);

    vi.stubEnv('AI_ASK_URL', '');
    const pollNoUpstream = await askTurnPollLoader({
      request: new Request(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`, {
        headers: { cookie: signedGuestCookieHeader },
      }),
      params: { attemptId: pendingAttemptId },
      context: makeContext('corr-poll-503').context,
      url: new URL(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`),
      pattern: '/api/ask/turns/:attemptId',
    });
    expect(pollNoUpstream.status).toBe(503);

    vi.stubEnv('AI_ASK_URL', 'http://127.0.0.1:8083');
    fetchSpy.mockResolvedValueOnce(
      Response.json(
        {
          attemptId: pendingAttemptId,
          status: 'running',
          mode: 'qa',
          correlationId: 'corr-poll-202',
          leaseExpiresAt: '2026-11-24T22:01:00Z',
          expiresAt: '2026-11-24T22:15:00Z',
        },
        { status: 202 },
      ),
    );
    const pollPending = await askTurnPollLoader({
      request: new Request(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`, {
        headers: { cookie: signedGuestCookieHeader },
      }),
      params: { attemptId: pendingAttemptId },
      context: makeContext('corr-poll-202').context,
      url: new URL(`https://andrew-k.us/api/ask/turns/${pendingAttemptId}`),
      pattern: '/api/ask/turns/:attemptId',
    });
    expect(pollPending.status).toBe(202);
    const pollReqInit = fetchSpy.mock.calls[1]?.[1];
    expect(new Headers(pollReqInit?.headers).get('x-internal-auth')).toBeTruthy();

    vi.stubEnv('CADENCE_DEMO_URL', '');
    const drizzleError = Object.assign(
      new Error('Failed query: SELECT * FROM quotas params: [secret]'),
      { name: 'DrizzleQueryError', cause: new Error('connection terminated') },
    );

    createPendingRunMock.mockRejectedValueOnce(drizzleError);
    const cadRunErrCtx = makeContext('corr-cad-run-503');
    const cadRunErrRes = await cadenceAction({
      request: makeFormRequest('https://andrew-k.us/cadence', {
        intent: 'run',
        prompt: 'Build a Solar Forge status widget.',
        presetSlug: 'solar-forge-starter',
      }),
      params: {},
      context: cadRunErrCtx.context,
      url: new URL('https://andrew-k.us/cadence'),
      pattern: '/cadence',
    });
    expect(cadRunErrRes.init?.status).toBe(503);
    expect(cadRunErrRes.data).toMatchObject({
      ok: false,
      intent: 'run',
      code: 'ERR_DB_UNAVAILABLE',
      action: expect.any(String),
      correlationId: 'corr-cad-run-503',
    });
    expect(JSON.stringify(cadRunErrRes.data)).not.toContain('connection terminated');
    expect(cadRunErrCtx.errorCalls).toHaveLength(1);

    updateGateForSessionMock.mockRejectedValueOnce(drizzleError);
    const cadGateErrCtx = makeContext('corr-cad-gate-503');
    const cadGateErrRes = await cadenceAction({
      request: makeFormRequest('https://andrew-k.us/cadence', {
        intent: 'gate',
        runId: '33333333-3333-4333-8333-333333333333',
        verdict: 'approved',
      }),
      params: {},
      context: cadGateErrCtx.context,
      url: new URL('https://andrew-k.us/cadence'),
      pattern: '/cadence',
    });
    expect(cadGateErrRes.init?.status).toBe(503);
    expect(cadGateErrRes.data).toMatchObject({
      ok: false,
      intent: 'gate',
      code: 'ERR_DB_UNAVAILABLE',
      correlationId: 'corr-cad-gate-503',
    });
    expect(cadGateErrCtx.errorCalls).toHaveLength(1);
  });

  it('streams /chat primary form immediately while askStatusPayload settles independently and preserves live badge precedence', async () => {
    const askStatusDeferred = Promise.withResolvers<StreamResult<AskServiceStatus | undefined>>();
    const askData: PortalAskLoaderData = {
      content: PortalAskContentSchema.parse({
        windowTitle: 'Ask Portfolio',
        statusBadge: { source: 'ai-ask', state: 'idle', label: 'idle' },
        description: 'Grounded portfolio Q&A.',
        abstentionNotice: 'Strictly grounded answers only.',
        starterQuestions: ['Explain the streaming SSR architecture'],
        jdPlaceholder: 'Paste job description...',
      }),
      quota: { role: 'guest', turnsUsed: 0, maxTurns: 10, tokensUsed: 0, maxTokens: 40_000 },
    };

    const encoder = new TextEncoder();
    const sseBody = [
      'event: meta\ndata: {"attemptId":"11111111-1111-4111-8111-111111111111","conversationId":"22222222-2222-4222-8222-222222222222","turnIndex":1,"correlationId":"corr-ask-split","mode":"qa","provider":"vertex"}\n\n',
      'event: sources\ndata: {"sources":[{"id":"doc-1","title":"SSR Architecture","snippet":"Streaming SSR","score":0.95}]}\n\n',
      'event: delta\ndata: {"text":"Streaming SSR uses deferStreamResult and SuspenseElement."}\n\n',
      'event: done\ndata: {"attemptId":"11111111-1111-4111-8111-111111111111","conversationId":"22222222-2222-4222-8222-222222222222","turnIndex":1,"grounded":true,"abstained":false,"groundingTier":"evidence","answer":"Streaming SSR uses deferStreamResult and SuspenseElement.","provider":"vertex","tokensUsed":120,"correlationId":"corr-ask-split","quota":{"role":"guest","turnsUsed":1,"maxTurns":10,"tokensUsed":120,"maxTokens":40000}}\n\n',
    ].join('');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(sseBody));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    const Stub = createRoutesStub([
      {
        path: '/chat',
        loader: () => ({
          correlationId: 'corr-ask-split',
          payload: Promise.resolve<StreamResult<PortalAskLoaderData>>({ ok: true, data: askData }),
          askStatusPayload: askStatusDeferred.promise,
        }),
        Component: PortalChatRoute,
      },
    ]);

    render(<Stub initialEntries={['/chat']} />);
    expect(await screen.findByTestId('ask-question-input')).toBeTruthy();
    expect(screen.getByText(/probing · ai-ask/i)).toBeTruthy();

    askStatusDeferred.resolve({
      ok: true,
      data: { status: 'ready', provider: 'vertex', pointsCount: 42 },
    });
    expect(await screen.findByText(/ready · 42 pts/i)).toBeTruthy();

    fireEvent.change(screen.getByTestId('ask-question-input'), {
      target: { value: 'Explain the streaming SSR architecture' },
    });
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    expect(await screen.findByText(/grounded · 1 source\(s\)/i)).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ask/stream',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
  });
});
