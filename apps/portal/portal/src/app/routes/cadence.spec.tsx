import { GUEST_SESSION_COOKIE_NAME, signGuestSessionCookie } from '@aklapper/node-runtime/auth';
import {
  type ApproveSpecGateResult,
  type ClearCadenceSessionRunsResult,
  Code,
  ConnectError,
  type CreateCadenceRunInput,
  type CreateCadenceRunResult,
  type GrpcCallMetadata,
  type SubmitGateVerdictResult,
} from '@aklapper/node-runtime/grpc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const grpcMocks = vi.hoisted(() => ({
  realCreateCadenceRun: null as
    | ((meta: GrpcCallMetadata, req: CreateCadenceRunInput) => Promise<CreateCadenceRunResult>)
    | null,
  realSubmitCadenceGateVerdict: null as
    | ((
        meta: GrpcCallMetadata,
        runId: string,
        verdict: 'approved' | 'rejected',
      ) => Promise<SubmitGateVerdictResult>)
    | null,
  realApproveCadenceSpecGate: null as
    | ((meta: GrpcCallMetadata, runId: string) => Promise<ApproveSpecGateResult>)
    | null,
  realClearCadenceSessionRuns: null as
    | ((meta: GrpcCallMetadata) => Promise<ClearCadenceSessionRunsResult>)
    | null,
  realStreamCadenceRun: null as
    | ((
        meta: GrpcCallMetadata,
        runId: string,
        callbacks?: { readonly onHeader?: (headers: Headers) => void },
      ) => AsyncIterable<unknown>)
    | null,
  createCadenceRun:
    vi.fn<
      (meta: GrpcCallMetadata, req: CreateCadenceRunInput) => Promise<CreateCadenceRunResult>
    >(),
  submitCadenceGateVerdict:
    vi.fn<
      (
        meta: GrpcCallMetadata,
        runId: string,
        verdict: 'approved' | 'rejected',
      ) => Promise<SubmitGateVerdictResult>
    >(),
  approveCadenceSpecGate:
    vi.fn<(meta: GrpcCallMetadata, runId: string) => Promise<ApproveSpecGateResult>>(),
  clearCadenceSessionRuns:
    vi.fn<(meta: GrpcCallMetadata) => Promise<ClearCadenceSessionRunsResult>>(),
  streamCadenceRun:
    vi.fn<
      (
        meta: GrpcCallMetadata,
        runId: string,
        callbacks?: { readonly onHeader?: (headers: Headers) => void },
      ) => AsyncIterable<unknown>
    >(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  grpcMocks.realCreateCadenceRun = actual.createCadenceRun;
  grpcMocks.realSubmitCadenceGateVerdict = actual.submitCadenceGateVerdict;
  grpcMocks.realApproveCadenceSpecGate = actual.approveCadenceSpecGate;
  grpcMocks.realClearCadenceSessionRuns = actual.clearCadenceSessionRuns;
  grpcMocks.realStreamCadenceRun = actual.streamCadenceRun;
  grpcMocks.createCadenceRun.mockImplementation((meta, req) => actual.createCadenceRun(meta, req));
  grpcMocks.submitCadenceGateVerdict.mockImplementation((meta, runId, verdict) =>
    actual.submitCadenceGateVerdict(meta, runId, verdict),
  );
  grpcMocks.approveCadenceSpecGate.mockImplementation((meta, runId) =>
    actual.approveCadenceSpecGate(meta, runId),
  );
  grpcMocks.clearCadenceSessionRuns.mockImplementation(meta =>
    actual.clearCadenceSessionRuns(meta),
  );
  grpcMocks.streamCadenceRun.mockImplementation((meta, runId, callbacks) =>
    actual.streamCadenceRun(meta, runId, callbacks),
  );
  return {
    ...actual,
    createCadenceRun: grpcMocks.createCadenceRun,
    submitCadenceGateVerdict: grpcMocks.submitCadenceGateVerdict,
    approveCadenceSpecGate: grpcMocks.approveCadenceSpecGate,
    clearCadenceSessionRuns: grpcMocks.clearCadenceSessionRuns,
    streamCadenceRun: grpcMocks.streamCadenceRun,
  };
});

import { loader as streamLoader } from './api.cadence.runs.$runId.stream';
import { action } from './cadence';

function makeActionArgs(
  formFields: Record<string, string>,
  cookie?: string,
): Parameters<typeof action>[0] {
  const fd = new FormData();
  for (const [k, v] of Object.entries(formFields)) {
    fd.set(k, v);
  }
  const headers = new Headers();
  if (cookie) {
    headers.set('cookie', cookie);
  }
  const request = new Request('http://localhost/cadence', {
    method: 'POST',
    headers,
    body: fd,
  });
  return {
    request,
    params: {},
    context: {} as Parameters<typeof action>[0]['context'],
    unstable_pattern: '/cadence',
    url: new URL('http://localhost/cadence'),
    pattern: '/cadence',
  } as Parameters<typeof action>[0];
}

function makeStreamArgs(runId: string, cookie?: string): Parameters<typeof streamLoader>[0] {
  const headers = new Headers();
  if (cookie) {
    headers.set('cookie', cookie);
  }
  const request = new Request(`http://localhost/api/cadence/runs/${runId}/stream`, {
    method: 'GET',
    headers,
  });
  return {
    request,
    params: { runId },
    context: {} as Parameters<typeof streamLoader>[0]['context'],
    unstable_pattern: '/api/cadence/runs/:runId/stream',
    url: new URL(`http://localhost/api/cadence/runs/${runId}/stream`),
    pattern: '/api/cadence/runs/:runId/stream',
  } as Parameters<typeof streamLoader>[0];
}

function unwrapDataResult(result: Awaited<ReturnType<typeof action>>) {
  if (result instanceof Response) {
    throw new Error('Expected DataWithResponseInit');
  }
  return result;
}

describe('/cadence action & /api/cadence/runs/:runId/stream (Go gRPC only, fail-closed)', () => {
  const originalDemoUrl = process.env['CADENCE_DEMO_URL'];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env['CADENCE_DEMO_URL'];
    globalThis.fetch = originalFetch;
    if (grpcMocks.realCreateCadenceRun) {
      grpcMocks.createCadenceRun.mockImplementation(grpcMocks.realCreateCadenceRun);
    }
    if (grpcMocks.realSubmitCadenceGateVerdict) {
      grpcMocks.submitCadenceGateVerdict.mockImplementation(grpcMocks.realSubmitCadenceGateVerdict);
    }
    if (grpcMocks.realApproveCadenceSpecGate) {
      grpcMocks.approveCadenceSpecGate.mockImplementation(grpcMocks.realApproveCadenceSpecGate);
    }
    if (grpcMocks.realClearCadenceSessionRuns) {
      grpcMocks.clearCadenceSessionRuns.mockImplementation(grpcMocks.realClearCadenceSessionRuns);
    }
    if (grpcMocks.realStreamCadenceRun) {
      grpcMocks.streamCadenceRun.mockImplementation(grpcMocks.realStreamCadenceRun);
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalDemoUrl === undefined) delete process.env['CADENCE_DEMO_URL'];
    else process.env['CADENCE_DEMO_URL'] = originalDemoUrl;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fails closed with 503 ERR_UPSTREAM_UNAVAILABLE across run, gate, spec-approve, reset, and stream when CADENCE_DEMO_URL is unset', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=${signGuestSessionCookie('guest_no_url')}`;
    const runId = '33333333-3333-4333-8333-333333333333';

    const runRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'run', prompt: 'Valid sandbox prompt' }, cookie)),
    );
    expect(runRes.init?.status).toBe(503);
    expect(runRes.data).toMatchObject({
      ok: false,
      intent: 'run',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    const gateRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(gateRes.init?.status).toBe(503);
    expect(gateRes.data).toMatchObject({
      ok: false,
      intent: 'gate',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    const specRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'spec-approve', runId }, cookie)),
    );
    expect(specRes.init?.status).toBe(503);
    expect(specRes.data).toMatchObject({
      ok: false,
      intent: 'spec-approve',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    const resetRes = unwrapDataResult(await action(makeActionArgs({ intent: 'reset' }, cookie)));
    expect(resetRes.init?.status).toBe(503);
    expect(resetRes.data).toMatchObject({
      ok: false,
      intent: 'reset',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(streamRes.status).toBe(503);
    expect(await streamRes.json()).toMatchObject({ code: 'ERR_UPSTREAM_UNAVAILABLE', status: 503 });
  });

  it('rejects unauthenticated stream requests with 401 and invalid UUIDs with 400', async () => {
    process.env['CADENCE_DEMO_URL'] = 'http://127.0.0.1:8082';
    const badId = await streamLoader(makeStreamArgs('not-a-uuid'));
    expect(badId.status).toBe(400);

    const noCookie = await streamLoader(makeStreamArgs('33333333-3333-4333-8333-333333333333'));
    expect(noCookie.status).toBe(401);
  });

  it('routes run, stream, gate, spec-approve, and reset through CadenceService gRPC with signed guest auth and correlationId', async () => {
    process.env['CADENCE_DEMO_URL'] = 'http://cadence-demo.internal';
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=${signGuestSessionCookie('guest_session_auth001')}`;
    const runId = '66666666-6666-4666-8666-666666666666';

    const seenCalls: Array<{
      op: string;
      role?: string;
      subject?: string;
      correlationId?: string;
    }> = [];

    grpcMocks.createCadenceRun.mockImplementationOnce(async meta => {
      seenCalls.push({
        op: 'create',
        role: meta.internalAuth?.role,
        subject: meta.internalAuth?.subject,
        correlationId: meta.correlationId,
      });
      return {
        createdImmediately: false,
        run: {
          runId,
          prompt: 'Auth init check',
          presetSlug: 'solar-forge-starter',
          runStatus: 'pending',
          mode: 'fast',
          gateVerdict: 'pending',
          turns: [],
          artifactHtml: '',
        },
      };
    });
    grpcMocks.streamCadenceRun.mockImplementationOnce((meta, _id, callbacks) => {
      seenCalls.push({
        op: 'stream',
        role: meta.internalAuth?.role,
        subject: meta.internalAuth?.subject,
        correlationId: meta.correlationId,
      });
      callbacks?.onHeader?.(new Headers({ 'x-correlation-id': meta.correlationId }));
      return {
        async *[Symbol.asyncIterator]() {
          yield {
            payload: {
              case: 'log',
              value: { runId, line: 'Connected', timestamp: '2026-11-24T22:00:00Z' },
            },
          };
        },
      };
    });
    grpcMocks.approveCadenceSpecGate.mockImplementationOnce(async meta => {
      seenCalls.push({
        op: 'spec-approve',
        role: meta.internalAuth?.role,
        subject: meta.internalAuth?.subject,
        correlationId: meta.correlationId,
      });
      return {
        run: {
          runId,
          prompt: 'Auth spec approve',
          presetSlug: 'solar-forge-starter',
          runStatus: 'build_queued',
          mode: 'llm',
          gateVerdict: 'pending',
          turns: [],
          artifactHtml: '',
        },
      };
    });
    grpcMocks.submitCadenceGateVerdict.mockImplementationOnce(async meta => {
      seenCalls.push({
        op: 'gate',
        role: meta.internalAuth?.role,
        subject: meta.internalAuth?.subject,
        correlationId: meta.correlationId,
      });
      return {
        run: {
          runId,
          prompt: 'Auth gate check',
          presetSlug: 'solar-forge-starter',
          runStatus: 'ready',
          mode: 'fast',
          gateVerdict: 'approved',
          turns: [],
          artifactHtml: '<html></html>',
        },
      };
    });
    grpcMocks.clearCadenceSessionRuns.mockImplementationOnce(async meta => {
      seenCalls.push({
        op: 'reset',
        role: meta.internalAuth?.role,
        subject: meta.internalAuth?.subject,
        correlationId: meta.correlationId,
      });
      return { deletedCount: 1 };
    });

    const initRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'run', prompt: 'Auth init check' }, cookie)),
    );
    expect(initRes.init?.status).toBe(202);

    const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(streamRes.status).toBe(200);
    expect(await streamRes.text()).toContain('event: log');

    const specRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'spec-approve', runId }, cookie)),
    );
    expect(specRes.init?.status).toBe(202);

    const gateRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(gateRes.init?.status).toBe(200);

    const resetRes = unwrapDataResult(await action(makeActionArgs({ intent: 'reset' }, cookie)));
    expect(resetRes.init?.status).toBe(200);
    expect(resetRes.data).toEqual({ ok: true, intent: 'reset' });

    expect(seenCalls).toHaveLength(5);
    for (const call of seenCalls) {
      expect(call.role).toBe('guest');
      expect(call.subject).toBe('guest_session_auth001');
      expect(call.correlationId).toBeTruthy();
    }

    // Cloud Run OIDC failure fails closed with 503 across run, gate, and stream.
    process.env['CADENCE_DEMO_URL'] = 'https://cadence-demo-xyz.a.run.app';
    globalThis.fetch = vi.fn<() => Promise<Response>>(async () => {
      throw new Error('Metadata server unavailable');
    }) as unknown as typeof fetch;

    const oidcRunRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'run', prompt: 'OIDC failure test prompt' }, cookie)),
    );
    expect(oidcRunRes.init?.status).toBe(503);
    expect(oidcRunRes.data).toMatchObject({ ok: false, code: 'ERR_UPSTREAM_UNAVAILABLE' });

    const oidcGateRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(oidcGateRes.init?.status).toBe(503);

    const oidcStreamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(oidcStreamRes.status).toBe(503);
  });

  it('fails closed with structured 500 when INTERNAL_AUTH_SECRET is missing in production and maps mid-stream errors to SSE frames', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=${signGuestSessionCookie('guest_session_prod001')}`;
    const runId = '77777777-7777-4777-8777-777777777777';
    const prevNodeEnv = process.env['NODE_ENV'];
    const prevSecret = process.env['INTERNAL_AUTH_SECRET'];

    process.env['CADENCE_DEMO_URL'] = 'http://cadence-demo.internal';
    process.env['NODE_ENV'] = 'production';
    delete process.env['INTERNAL_AUTH_SECRET'];

    try {
      const runRes = unwrapDataResult(
        await action(
          makeActionArgs({ intent: 'run', prompt: 'Prod auth fail-closed test' }, cookie),
        ),
      );
      expect(runRes.init?.status).toBe(500);
      expect(runRes.data).toMatchObject({ ok: false, intent: 'run', code: 'ERR_INTERNAL' });
      expect(JSON.stringify(runRes.data)).not.toContain('INTERNAL_AUTH_SECRET');

      const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
      expect(streamRes.status).toBe(500);
      const body = (await streamRes.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ code: 'ERR_INTERNAL', status: 500 });
      expect(JSON.stringify(body)).not.toContain('INTERNAL_AUTH_SECRET');
    } finally {
      if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = prevNodeEnv;
      if (prevSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = prevSecret;
    }

    // Mid-stream ConnectError after headers emits structured SSE error event without leaking raw details.
    grpcMocks.streamCadenceRun.mockImplementationOnce((meta, _id, callbacks) => {
      callbacks?.onHeader?.(new Headers({ 'x-correlation-id': meta.correlationId }));
      return {
        async *[Symbol.asyncIterator]() {
          yield {
            payload: {
              case: 'log',
              value: { runId, line: 'Started', timestamp: '2026-11-24T22:00:00Z' },
            },
          };
          throw new ConnectError('Failed query: SELECT * FROM sandbox_runs', Code.Unavailable);
        },
      };
    });
    const midErrRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(midErrRes.status).toBe(200);
    const sseText = await midErrRes.text();
    expect(sseText).toContain('event: error');
    expect(sseText).toContain('ERR_UPSTREAM_UNAVAILABLE');
    expect(sseText).not.toContain('sandbox_runs');
  });
});
