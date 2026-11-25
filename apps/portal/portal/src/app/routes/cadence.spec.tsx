import {
  buildTailoredCadenceArtifactHtml,
  type CadenceExecutionMode,
  type CadencePreset,
  type CadenceRunLifecycleStatus,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceTurn,
  type CadenceTurnPhase,
  type CadenceTurnStatus,
  PortalCadenceContentSchema,
  type PortalCadenceLoaderData,
  type QuotaStatus,
} from '@aklapper/core';
import { GUEST_SESSION_COOKIE_NAME } from '@aklapper/node-runtime/auth';
import { INTERNAL_AUTH_HEADER } from '@aklapper/node-runtime/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredRun {
  runId: string;
  sessionId: string;
  presetSlug: string;
  runStatus: CadenceRunLifecycleStatus;
  mode: CadenceRunMode;
  gateVerdict: 'pending' | 'approved' | 'rejected';
  turns: CadenceTurn[];
  artifactHtml: string;
  prompt: string;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
}

const TEST_PRESETS: readonly CadencePreset[] = [
  {
    slug: 'solar-forge-starter',
    title: 'Solar Forge Sandbox Starter',
    starterPrompt:
      'Build a responsive Solar Forge diagnostic card with live status telemetry and keyboard shortcuts.',
    expectedKind: 'diagnostic-card',
    starterArtifactHtml: '<!doctype html><html><body>Starter</body></html>',
    sortOrder: 1,
  },
  {
    slug: 'chord-pipeline-monitor',
    title: 'CHORD Pipeline Latency Monitor',
    starterPrompt:
      'Build an interactive CHORD pipeline monitor tracking triage, spec, build, and gate stage latencies.',
    expectedKind: 'pipeline-monitor',
    starterArtifactHtml: '<!doctype html><html><body>Monitor</body></html>',
    sortOrder: 2,
  },
];

const stateStore = vi.hoisted(() => {
  const runs = new Map<string, StoredRun>();
  const quotas = new Map<string, QuotaStatus>();
  let seq = 0;

  const getQuota = (sessionId: string): QuotaStatus => {
    const existing = quotas.get(sessionId);
    if (existing) return existing;
    const fresh: QuotaStatus = {
      role: 'guest',
      turnsUsed: 0,
      maxTurns: 5,
      tokensUsed: 0,
      maxTokens: 20_000,
    };
    quotas.set(sessionId, fresh);
    return fresh;
  };

  const toRunResult = (row: StoredRun, quota?: QuotaStatus): CadenceRunResult => ({
    runId: row.runId,
    prompt: row.prompt,
    presetSlug: row.presetSlug,
    runStatus: row.runStatus,
    mode: row.mode,
    gateVerdict: row.gateVerdict,
    turns: row.turns.map(t => ({ ...t })),
    artifactHtml: row.artifactHtml,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    ...(quota ? { quota } : {}),
    createdAt: row.createdAt,
  });

  const makeUuid = (): string => {
    seq += 1;
    const hex = seq.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };

  return {
    runs,
    quotas,
    reset: () => {
      runs.clear();
      quotas.clear();
      seq = 0;
      stateStore.failNextClaim = false;
      stateStore.failNextTurnUpdate = false;
      stateStore.failNextFailCommit = false;
    },
    getQuota,
    toRunResult,
    makeUuid,
    failNextClaim: false,
    failNextTurnUpdate: false,
    failNextFailCommit: false,
  };
});

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: () => ({}) as ReturnType<typeof actual.getSharedDb>,
    loadPortalCadenceDataWithPrerender: vi.fn<
      (sessionId?: string) => Promise<PortalCadenceLoaderData>
    >(async (sessionId?: string): Promise<PortalCadenceLoaderData> => {
      const recentRuns = sessionId
        ? Array.from(stateStore.runs.values())
            .filter(r => r.sessionId === sessionId)
            .map(r => stateStore.toRunResult(r))
        : [];
      return {
        content: PortalCadenceContentSchema.parse({
          windowTitle: 'CADENCE Builder // portfolio-public',
          statusBadge: { source: 'svc-cadence-demo', state: 'idle', label: '0/1 replicas' },
          description: 'Build interactive sandbox artifacts.',
          iframeTitle: 'CADENCE Sandbox Artifact Preview',
        }),
        presets: TEST_PRESETS,
        quota: stateStore.getQuota(sessionId ?? 'anonymous'),
        goldenRuns: [],
        recentRuns,
      };
    }),
    findCachedSandboxRun: vi.fn<
      () => Promise<{
        promptHash: string;
        scope: 'miss';
        sourceRun: null;
        sourceTurns: readonly never[];
      }>
    >(async () => ({
      promptHash: 'test-hash',
      scope: 'miss',
      sourceRun: null,
      sourceTurns: [],
    })),
    getCadencePresetBySlug: vi.fn<(_db: unknown, slug: string) => Promise<CadencePreset | null>>(
      async (_db: unknown, slug: string) => {
        return TEST_PRESETS.find(p => p.slug === slug) ?? null;
      },
    ),
    getQuotaStatusForSession: vi.fn<
      (_db: unknown, _role: string, sessionId?: string) => Promise<QuotaStatus>
    >(async (_db: unknown, _role: string, sessionId?: string) => {
      return stateStore.getQuota(sessionId ?? 'anonymous');
    }),
    createPendingSandboxRunWithQuota: vi.fn<
      (
        _db: unknown,
        input: {
          sessionId: string;
          presetSlug?: string;
          prompt: string;
          mode: CadenceRunMode;
          promptHash?: string | null;
          estimatedTokens?: number;
        },
      ) => Promise<
        | { allowed: false; quota: QuotaStatus; run: null }
        | { allowed: true; quota: QuotaStatus; run: CadenceRunResult }
      >
    >(
      async (
        _db: unknown,
        input: {
          sessionId: string;
          presetSlug?: string;
          prompt: string;
          mode: CadenceRunMode;
          promptHash?: string | null;
          estimatedTokens?: number;
        },
      ) => {
        const q = stateStore.getQuota(input.sessionId);
        if (q.turnsUsed + 1 > q.maxTurns) {
          return { allowed: false as const, quota: q, run: null };
        }
        const updatedQuota: QuotaStatus = {
          ...q,
          turnsUsed: q.turnsUsed + 1,
          tokensUsed: q.tokensUsed + (input.estimatedTokens ?? 800),
        };
        stateStore.quotas.set(input.sessionId, updatedQuota);

        const runId = stateStore.makeUuid();
        const stored: StoredRun = {
          runId,
          sessionId: input.sessionId,
          presetSlug: input.presetSlug?.trim() || 'custom',
          runStatus: 'pending',
          mode: input.mode,
          gateVerdict: 'pending',
          prompt: input.prompt,
          artifactHtml: '',
          tokensIn: 0,
          tokensOut: 0,
          createdAt: '2026-11-24T22:00:00.000Z',
          turns: [
            {
              phase: 'triage',
              agentName: 'chord-triage',
              status: 'pending',
              summary: 'Queued',
              latencyMs: 0,
            },
            {
              phase: 'spec',
              agentName: 'chord-spec',
              status: 'pending',
              summary: 'Queued',
              latencyMs: 0,
            },
            {
              phase: 'build',
              agentName: 'chord-builder',
              status: 'pending',
              summary: 'Queued',
              latencyMs: 0,
            },
            {
              phase: 'gate',
              agentName: 'chord-gate',
              status: 'pending',
              summary: 'Queued',
              latencyMs: 0,
            },
          ],
        };
        stateStore.runs.set(runId, stored);
        return {
          allowed: true as const,
          quota: updatedQuota,
          run: stateStore.toRunResult(stored, updatedQuota),
        };
      },
    ),
    getSandboxRunWithTurnsById: vi.fn<
      (_db: unknown, runId: string) => Promise<{ sessionId: string; run: CadenceRunResult } | null>
    >(async (_db: unknown, runId: string) => {
      const row = stateStore.runs.get(runId);
      if (!row) return null;
      return { sessionId: row.sessionId, run: stateStore.toRunResult(row) };
    }),
    claimPendingSandboxRun: vi.fn<
      (
        _db: unknown,
        runId: string,
        sessionId: string,
      ) => Promise<{ run: CadenceRunResult; mode: CadenceRunMode } | null>
    >(async (_db: unknown, runId: string, sessionId: string) => {
      if (stateStore.failNextClaim) {
        stateStore.failNextClaim = false;
        throw Object.assign(new Error('Failed query: UPDATE sandbox_runs SET status = running'), {
          name: 'DrizzleQueryError',
          cause: Object.assign(new Error('terminating connection due to administrator command'), {
            code: '57P01',
          }),
        });
      }
      const row = stateStore.runs.get(runId);
      if (!row || row.sessionId !== sessionId || row.runStatus !== 'pending') {
        return null;
      }
      row.runStatus = 'running';
      return { run: stateStore.toRunResult(row), mode: row.mode };
    }),
    updateSandboxTurnRow: vi.fn<
      (
        _db: unknown,
        input: {
          runId: string;
          phase: CadenceTurnPhase;
          status: CadenceTurnStatus;
          summary: string;
          latencyMs: number;
        },
      ) => Promise<CadenceTurn | null>
    >(
      async (
        _db: unknown,
        input: {
          runId: string;
          phase: CadenceTurnPhase;
          status: CadenceTurnStatus;
          summary: string;
          latencyMs: number;
        },
      ) => {
        if (stateStore.failNextTurnUpdate && input.phase === 'build') {
          stateStore.failNextTurnUpdate = false;
          throw new Error('Injected phase fault');
        }
        const row = stateStore.runs.get(input.runId);
        if (!row) return null;
        const turn = row.turns.find(t => t.phase === input.phase);
        if (!turn) return null;
        turn.status = input.status;
        turn.summary = input.summary;
        turn.latencyMs = input.latencyMs;
        return { ...turn };
      },
    ),
    completeSandboxRunRow: vi.fn<
      (
        _db: unknown,
        input: {
          runId: string;
          tokensIn: number;
          tokensOut: number;
          artifactHtml: string;
          executionMode?: CadenceExecutionMode;
        },
      ) => Promise<CadenceRunResult | null>
    >(
      async (
        _db: unknown,
        input: {
          runId: string;
          tokensIn: number;
          tokensOut: number;
          artifactHtml: string;
          executionMode?: CadenceExecutionMode;
        },
      ) => {
        const row = stateStore.runs.get(input.runId);
        if (!row) return null;
        row.runStatus = 'ready';
        row.tokensIn = input.tokensIn;
        row.tokensOut = input.tokensOut;
        row.artifactHtml = input.artifactHtml;
        return stateStore.toRunResult(row);
      },
    ),
    failSandboxRunRow: vi.fn<(_db: unknown, runId: string, reason: string) => Promise<void>>(
      async (_db: unknown, runId: string, reason: string) => {
        if (stateStore.failNextFailCommit) {
          stateStore.failNextFailCommit = false;
          throw new Error('DB fail write rejected');
        }
        const row = stateStore.runs.get(runId);
        if (row) {
          row.runStatus = 'failed';
          for (const t of row.turns) {
            if (t.status === 'running') {
              t.status = 'failed';
              t.summary = reason;
            }
          }
        }
      },
    ),
    updateSandboxRunGateVerdictForSession: vi.fn<
      (
        _db: unknown,
        runId: string,
        verdict: 'approved' | 'rejected',
        sessionId: string,
      ) => Promise<
        | { outcome: 'not-found' }
        | { outcome: 'forbidden' }
        | { outcome: 'conflict'; status: CadenceRunLifecycleStatus }
        | { outcome: 'ok'; run: CadenceRunResult }
      >
    >(async (_db: unknown, runId: string, verdict: 'approved' | 'rejected', sessionId: string) => {
      const row = stateStore.runs.get(runId);
      if (!row) return { outcome: 'not-found' as const };
      if (row.sessionId !== sessionId) return { outcome: 'forbidden' as const };
      if (row.runStatus !== 'ready') return { outcome: 'conflict' as const, status: row.runStatus };
      row.gateVerdict = verdict;
      return { outcome: 'ok' as const, run: stateStore.toRunResult(row) };
    }),
  };
});

import { completeSandboxRunRow, createPendingSandboxRunWithQuota } from '@aklapper/db';

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

describe('/cadence action & /api/cadence/runs/:runId/stream SSE handler', () => {
  const originalDemoUrl = process.env['CADENCE_DEMO_URL'];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    stateStore.reset();
    delete process.env['CADENCE_DEMO_URL'];
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    if (originalDemoUrl === undefined) {
      delete process.env['CADENCE_DEMO_URL'];
    } else {
      process.env['CADENCE_DEMO_URL'] = originalDemoUrl;
    }
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('initializes durable 202 pending runs, streams live phases via SSE, replays cleanly, and enforces gate ownership', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_alpha123`;
    const initRes = unwrapDataResult(
      await action(
        makeActionArgs(
          {
            intent: 'run',
            prompt: 'Measure <script>alert(1)</script> CHORD stage latency',
            presetSlug: 'chord-pipeline-monitor',
            mode: 'fast',
          },
          cookie,
        ),
      ),
    );

    expect(initRes.init?.status).toBe(202);
    expect(initRes.data).toMatchObject({
      ok: true,
      intent: 'run-init',
      run: {
        runStatus: 'pending',
        mode: 'fast',
        presetSlug: 'chord-pipeline-monitor',
      },
      quota: { turnsUsed: 1 },
    });

    const runId = (initRes.data as { run: CadenceRunResult }).run.runId;

    // Premature gate while pending returns 409 Conflict.
    const prematureGate = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(prematureGate.init?.status).toBe(409);

    // Stream missing cookie -> 401 before opening SSE and zero Set-Cookie header.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unauthStream = await streamLoader(makeStreamArgs(runId));
    expect(unauthStream.status).toBe(401);
    expect(unauthStream.headers.get('set-cookie')).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('UNSOUND_CONDITION'));

    // Cross-session cookie -> 403.
    const crossSession = await streamLoader(
      makeStreamArgs(runId, `${GUEST_SESSION_COOKIE_NAME}=guest_session_beta9999`),
    );
    expect(crossSession.status).toBe(403);

    // Invalid UUID -> 400.
    const badIdStream = await streamLoader(makeStreamArgs('not-a-uuid', cookie));
    expect(badIdStream.status).toBe(400);

    // Owner stream executes all 4 phases and streams SSE frames.
    const sseRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');
    const sseText = await sseRes.text();
    expect(sseText).toContain('event: phase');
    expect(sseText).toContain('event: complete');
    const completeLine = sseText.split('\n\n').find(chunk => chunk.startsWith('event: complete\n'));
    const completeJson = JSON.parse(completeLine?.split('\ndata: ')[1] ?? '{}') as {
      run?: CadenceRunResult;
    };
    expect(completeJson.run?.artifactHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(completeJson.run?.artifactHtml).not.toContain('<script>alert(1)</script>');

    // Replaying stream on ready run returns complete without double-charging quota.
    const replayRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(replayRes.status).toBe(200);
    const replayText = await replayRes.text();
    expect(replayText).toContain('event: complete');
    expect(stateStore.getQuota('guest_session_alpha123').turnsUsed).toBe(1);

    // Wrong session gate -> 403, owner gate -> 200 approved.
    const wrongGate = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'gate', runId, verdict: 'approved' },
          `${GUEST_SESSION_COOKIE_NAME}=guest_session_beta9999`,
        ),
      ),
    );
    expect(wrongGate.init?.status).toBe(403);

    const okGate = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(okGate.init?.status).toBe(200);
    expect(okGate.data).toMatchObject({
      ok: true,
      intent: 'gate',
      run: { gateVerdict: 'approved', runStatus: 'ready' },
    });
  });

  it('honors legacy synchronous 201 upstream responses, fails closed on 502 schema errors, propagates 4xx, and falls back only on 502/504', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_upstream1`;
    process.env['CADENCE_DEMO_URL'] = 'http://cadence-demo.internal';

    // 1. Legacy synchronous 201 (omitted runStatus) preserves immediate ready intent.
    const syncRun: CadenceRunResult = {
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Legacy synchronous CADENCE prompt',
      presetSlug: 'solar-forge-starter',
      gateVerdict: 'pending',
      turns: [],
      artifactHtml: buildTailoredCadenceArtifactHtml({
        prompt: 'Legacy synchronous CADENCE prompt',
      }),
    };
    globalThis.fetch = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(syncRun), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    const legacyRes = unwrapDataResult(
      await action(
        makeActionArgs({ intent: 'run', prompt: 'Legacy synchronous CADENCE prompt' }, cookie),
      ),
    );
    expect(legacyRes.init?.status).toBe(201);
    expect(legacyRes.data).toMatchObject({
      ok: true,
      intent: 'run',
      run: { runId: syncRun.runId },
    });
    expect(stateStore.runs.size).toBe(0);

    // 2. Malformed 200 payload fails closed with 502 without falling back to PG19.
    globalThis.fetch = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ runId: 123, bogus: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    const badSchemaRes = unwrapDataResult(
      await action(
        makeActionArgs({ intent: 'run', prompt: 'Schema validation test prompt' }, cookie),
      ),
    );
    expect(badSchemaRes.init?.status).toBe(502);
    expect(stateStore.runs.size).toBe(0);

    // 3. Upstream 400 propagates directly without falling back to PG19.
    globalThis.fetch = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ error: 'Upstream rejected request' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    const upstream400 = unwrapDataResult(
      await action(
        makeActionArgs({ intent: 'run', prompt: 'Propagated 400 prompt check' }, cookie),
      ),
    );
    expect(upstream400.init?.status).toBe(400);
    expect(stateStore.runs.size).toBe(0);

    // 4. Upstream 504 timeout falls back cleanly to Node PG19 pending init.
    globalThis.fetch = vi.fn<() => Promise<Response>>(async () => {
      const err = new Error('Timed out');
      err.name = 'TimeoutError';
      throw err;
    }) as unknown as typeof fetch;
    const fallbackInit = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Cold wake fallback test prompt', mode: 'fast' },
          cookie,
        ),
      ),
    );
    expect(fallbackInit.init?.status).toBe(202);
    expect(stateStore.runs.size).toBe(1);
  });

  it('enforces atomic 429 quota caps with zero orphan rows and handles concurrent CAS + mid-stream failure', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_quota123`;
    for (let i = 0; i < 5; i++) {
      const ok = unwrapDataResult(
        await action(
          makeActionArgs(
            { intent: 'run', prompt: `Turn ${i + 1} quota build prompt`, mode: 'fast' },
            cookie,
          ),
        ),
      );
      expect(ok.init?.status).toBe(202);
    }

    const denied = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Sixth turn must reject cleanly', mode: 'fast' },
          cookie,
        ),
      ),
    );
    expect(denied.init?.status).toBe(429);
    expect(denied.data).toMatchObject({ ok: false, quota: { turnsUsed: 5 } });
    expect(stateStore.runs.size).toBe(5);

    // Mid-stream failure transitions runStatus -> failed, emits static safe SSE/DB summary, and logs raw detail server-side only.
    const abortCookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_abort999`;
    const initAbort = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Injected stream failure run', mode: 'fast' },
          abortCookie,
        ),
      ),
    );
    const abortRunId = (initAbort.data as { run: CadenceRunResult }).run.runId;
    stateStore.failNextTurnUpdate = true;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const abortRes = await streamLoader(makeStreamArgs(abortRunId, abortCookie));
    const abortText = await abortRes.text();
    expect(abortText).toContain('event: error');
    expect(abortText).not.toContain('Injected phase fault');
    const failedRow = stateStore.runs.get(abortRunId);
    expect(failedRow?.runStatus).toBe('failed');
    expect(failedRow?.turns.find(t => t.phase === 'build')?.summary).not.toContain(
      'Injected phase fault',
    );
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Injected phase fault'));

    // Concurrent single-claim test: second stream emits invalid_claim_state and waits for completion.
    const casCookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_cas99999`;
    const initCas = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Concurrent claim race protection', mode: 'fast' },
          casCookie,
        ),
      ),
    );
    const casRunId = (initCas.data as { run: CadenceRunResult }).run.runId;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [resA, resB] = await Promise.all([
      streamLoader(makeStreamArgs(casRunId, casCookie)),
      streamLoader(makeStreamArgs(casRunId, casCookie)),
    ]);
    const [textA, textB] = await Promise.all([resA.text(), resB.text()]);
    expect(textA).toContain('event: complete');
    expect(textB).toContain('event: complete');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('UNSOUND_CONDITION'));

    // Client disconnect / ReadableStream cancel mid-stream must NOT corrupt healthy run to failed.
    const cancelCookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_cancel77`;
    const initCancel = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Stream cancel persistence resilience', mode: 'fast' },
          cancelCookie,
        ),
      ),
    );
    const cancelRunId = (initCancel.data as { run: CadenceRunResult }).run.runId;
    const cancelRes = await streamLoader(makeStreamArgs(cancelRunId, cancelCookie));
    const reader = cancelRes.body?.getReader();
    await reader?.cancel();
    await vi.waitFor(() => {
      expect(stateStore.runs.get(cancelRunId)?.runStatus).toBe('ready');
    });
  });

  it('attaches X-Internal-Auth on upstream proxy calls and preserves 503 GCP_OIDC_TOKEN_UNAVAILABLE without falling back', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_auth001`;
    const runId = '66666666-6666-4666-8666-666666666666';
    process.env['CADENCE_DEMO_URL'] = 'http://cadence-demo.internal';

    const seenHeaders: Array<{
      url: string;
      internalAuth: string | null;
      sessionId: string | null;
    }> = [];
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input, init) => {
        const url = String(input);
        const reqHeaders = new Headers(init?.headers);
        seenHeaders.push({
          url,
          internalAuth: reqHeaders.get(INTERNAL_AUTH_HEADER),
          sessionId: reqHeaders.get('x-session-id'),
        });

        if (url.endsWith('/stream')) {
          return new Response('event: complete\ndata: {}\n\n', {
            status: 200,
            headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          });
        }
        if (url.endsWith('/gate')) {
          return new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            runId,
            prompt: 'Auth init check',
            presetSlug: 'solar-forge-starter',
            runStatus: 'pending',
            mode: 'fast',
            gateVerdict: 'pending',
            turns: [],
            artifactHtml: '',
          }),
          { status: 202, headers: { 'content-type': 'application/json' } },
        );
      },
    ) as unknown as typeof fetch;

    const initRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'run', prompt: 'Auth init check' }, cookie)),
    );
    expect(initRes.init?.status).toBe(202);
    expect(
      (initRes.init?.headers as Record<string, string> | undefined)?.['X-Correlation-Id'],
    ).toBeTruthy();

    const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(streamRes.status).toBe(200);

    const gateRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(gateRes.init?.status).toBe(200);

    expect(seenHeaders).toHaveLength(3);
    for (const call of seenHeaders) {
      expect(call.internalAuth).toBeTruthy();
      expect(call.sessionId).toBe('guest_session_auth001');
    }

    // Cloud Run OIDC failure returns 503 directly on POST /cadence (run + gate) and GET .../stream with zero PG19 fallback.
    process.env['CADENCE_DEMO_URL'] = 'https://cadence-demo-xyz.a.run.app';
    globalThis.fetch = vi.fn<() => Promise<Response>>(async () => {
      throw new Error('Metadata server unavailable');
    }) as unknown as typeof fetch;

    const oidcRunRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'run', prompt: 'OIDC failure test prompt' }, cookie)),
    );
    expect(oidcRunRes.init?.status).toBe(503);
    expect(oidcRunRes.data).toMatchObject({ ok: false, code: 'ERR_UPSTREAM_UNAVAILABLE' });
    expect(stateStore.runs.size).toBe(0);

    const oidcGateRes = unwrapDataResult(
      await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
    );
    expect(oidcGateRes.init?.status).toBe(503);

    const oidcStreamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(oidcStreamRes.status).toBe(503);
    expect(await oidcStreamRes.json()).toMatchObject({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
    });
  });

  it('fails closed with structured 500 responses when INTERNAL_AUTH_SECRET is missing in production', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_prod001`;
    const runId = '77777777-7777-4777-8777-777777777777';
    const prevNodeEnv = process.env['NODE_ENV'];
    const prevSecret = process.env['INTERNAL_AUTH_SECRET'];
    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderrChunks.push(String(chunk));
      return true;
    });

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
      expect(stateStore.runs.size).toBe(0);

      const gateRes = unwrapDataResult(
        await action(makeActionArgs({ intent: 'gate', runId, verdict: 'approved' }, cookie)),
      );
      expect(gateRes.init?.status).toBe(500);
      expect(gateRes.data).toMatchObject({ ok: false, intent: 'gate', code: 'ERR_INTERNAL' });
      expect(JSON.stringify(gateRes.data)).not.toContain('INTERNAL_AUTH_SECRET');

      const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
      expect(streamRes.status).toBe(500);
      expect(streamRes.headers.get('X-Correlation-Id')).toBeTruthy();
      const body = (await streamRes.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ code: 'ERR_INTERNAL', status: 500 });
      expect(JSON.stringify(body)).not.toContain('INTERNAL_AUTH_SECRET');
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrChunks.join('')).toContain('"errorCode":"ERR_INTERNAL"');
    } finally {
      if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = prevNodeEnv;
      if (prevSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = prevSecret;
    }
  });

  it('logs diagnostics and emits a safe SSE error event when DB fails inside ReadableStream.start', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_dbfail1`;
    const initRes = unwrapDataResult(
      await action(
        makeActionArgs(
          { intent: 'run', prompt: 'Stream DB claim failure test', mode: 'fast' },
          cookie,
        ),
      ),
    );
    expect(initRes.init?.status).toBe(202);
    const runId = (initRes.data as { run: CadenceRunResult }).run.runId;

    stateStore.failNextClaim = true;
    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderrChunks.push(String(chunk));
      return true;
    });
    const streamRes = await streamLoader(makeStreamArgs(runId, cookie));
    expect(streamRes.status).toBe(200);
    const text = await streamRes.text();
    expect(text).toContain('event: error');
    expect(text).toContain('ERR_DB_UNAVAILABLE');
    expect(text).not.toContain('Failed query:');
    expect(text).not.toContain('sandbox_runs');
    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrChunks.join('')).toContain('"errorCode":"ERR_DB_UNAVAILABLE"');
  });

  it('persists promptHash on fallback init and records executionMode as fallback for llm or fast for fast streams', async () => {
    const cookie = `${GUEST_SESSION_COOKIE_NAME}=guest_session_meta123`;
    const createMock = vi.mocked(createPendingSandboxRunWithQuota);
    const completeMock = vi.mocked(completeSandboxRunRow);
    createMock.mockClear();
    completeMock.mockClear();

    const llmInit = unwrapDataResult(
      await action(
        makeActionArgs(
          {
            intent: 'run',
            prompt: 'Fallback metadata verification in llm mode',
            presetSlug: 'solar-forge-starter',
            mode: 'llm',
          },
          cookie,
        ),
      ),
    );
    expect(llmInit.init?.status).toBe(202);
    expect(createMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: 'llm',
        promptHash: 'test-hash',
      }),
    );

    const llmRunId = (llmInit.data as { run: CadenceRunResult }).run.runId;
    const llmStream = await streamLoader(makeStreamArgs(llmRunId, cookie));
    expect(llmStream.status).toBe(200);
    await llmStream.text();
    expect(completeMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: llmRunId,
        executionMode: 'fallback',
      }),
    );

    const fastInit = unwrapDataResult(
      await action(
        makeActionArgs(
          {
            intent: 'run',
            prompt: 'Fallback metadata verification in fast mode',
            presetSlug: 'solar-forge-starter',
            mode: 'fast',
          },
          cookie,
        ),
      ),
    );
    expect(fastInit.init?.status).toBe(202);
    expect(createMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: 'fast',
        promptHash: 'test-hash',
      }),
    );

    const fastRunId = (fastInit.data as { run: CadenceRunResult }).run.runId;
    const fastStream = await streamLoader(makeStreamArgs(fastRunId, cookie));
    expect(fastStream.status).toBe(200);
    await fastStream.text();
    expect(completeMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: fastRunId,
        executionMode: 'fast',
      }),
    );
  });
});
