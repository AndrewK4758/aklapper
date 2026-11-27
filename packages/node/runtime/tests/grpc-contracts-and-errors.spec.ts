import {
  AskResponseSchema,
  AskStreamEventSchema,
  CadenceRunResultSchema,
  CadenceStreamCompleteEventSchema,
  CadenceStreamErrorEventSchema,
  CadenceStreamLogEventSchema,
  CadenceStreamPhaseEventSchema,
  PublicAppErrorSchema,
  QuotaStatusSchema,
} from '@aklapper/core';
import { StreamDeadlineError } from '@aklapper/core/server-errors';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, type Transport } from '@connectrpc/connect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearGcpIdentityTokenCacheForTest, GcpOidcTokenError } from '../src/gcp-oidc.ts';
import {
  callAsk,
  classifyGrpcError,
  getAskStatus,
  GrpcPayloadContractError,
  IDEMPOTENT_OIDC_RETRY_PROCEDURES,
  isFallbackTransportError,
  isGfeIamAuthRejection,
  mapProtoAskChunkToSse,
  mapProtoAskResponseToDomain,
  mapProtoCadenceChunkToSse,
  mapProtoCadenceRunToDomain,
  triggerReindex,
} from '../src/grpc.ts';
import {
  AskResponseSchema as ProtoAskResponseSchema,
  AskStreamChunkSchema,
  GetAskStatusResponseSchema,
} from '../src/grpc/gen/ai_ask/v1/ask_pb.ts';
import {
  CadenceRunResultSchema as ProtoCadenceRunResultSchema,
  CadenceStringListSchema,
  CadenceTurnPayloadValueSchema,
  CadenceTurnSchema as ProtoCadenceTurnSchema,
  Osc7501StatusSchema as ProtoOsc7501StatusSchema,
  StreamRunResponseSchema,
} from '../src/grpc/gen/cadence/v1/cadence_pb.ts';
import {
  ErrorDetailEnvelopeSchema,
  PublicAppErrorSchema as ProtoPublicAppErrorSchema,
  QuotaStatusSchema as ProtoQuotaStatusSchema,
} from '../src/grpc/gen/common/v1/error_pb.ts';

afterEach(() => {
  clearGcpIdentityTokenCacheForTest();
  vi.restoreAllMocks();
});

function createFakeTransport(
  unaryHandler: (
    procedure: string,
    headers: Headers,
  ) => Promise<{ readonly message: unknown; readonly header?: Headers }>,
): Transport {
  return {
    async unary(method, _signal, _timeoutMs, header, _input) {
      const procedure = `/${method.parent.typeName}/${method.name}`;
      const reqHeaders = new Headers(header);
      const out = await unaryHandler(procedure, reqHeaders);
      return {
        stream: false,
        service: method.parent,
        method,
        header: out.header ?? new Headers(),
        trailer: new Headers(),
        message: out.message as never,
      };
    },
    async stream() {
      throw new Error('stream not implemented in fake unary transport');
    },
  };
}

describe('Proto3-to-Zod zero-value & optional presence mappers', () => {
  it('preserves matchScore=0 and latencyMs=0 while omitting empty optional strings and unset turnIndex', () => {
    const proto = create(ProtoAskResponseSchema, {
      attemptId: '',
      grounded: false,
      abstained: true,
      mode: 'jd_match',
      answer: 'Abstaining due to insufficient evidence.',
      sources: [],
      matchScore: 0,
      provider: 'local',
      model: '',
      tokensUsed: 0,
      latencyMs: 0,
      correlationId: '',
      conversationId: '',
      groundingTier: '',
    });

    const mapped = mapProtoAskResponseToDomain(proto);
    expect(AskResponseSchema.safeParse(mapped).success).toBe(true);
    expect(mapped.matchScore).toBe(0);
    expect(mapped.latencyMs).toBe(0);
    expect(mapped.attemptId).toBeUndefined();
    expect(mapped.conversationId).toBeUndefined();
    expect(mapped.turnIndex).toBeUndefined();
    expect(mapped.model).toBeUndefined();
    expect(mapped.groundingTier).toBeUndefined();
  });

  it('preserves CadenceRunResult progress=0, tokensIn/Out=0, unset turn.id, and heterogeneous payload values', () => {
    const turn = create(ProtoCadenceTurnSchema, {
      phase: 'triage',
      agentName: 'cadence-triage-agent',
      status: 'completed',
      summary: 'Triaged custom widget prompt',
      latencyMs: 12,
      payload: {
        mode: create(CadenceTurnPayloadValueSchema, {
          kind: { case: 'stringValue', value: 'fast' },
        }),
        tokens: create(CadenceTurnPayloadValueSchema, {
          kind: { case: 'numberValue', value: 0 },
        }),
        gated: create(CadenceTurnPayloadValueSchema, {
          kind: { case: 'boolValue', value: true },
        }),
        notes: create(CadenceTurnPayloadValueSchema, {
          kind: { case: 'nullValue', value: true },
        }),
        keywords: create(CadenceTurnPayloadValueSchema, {
          kind: {
            case: 'stringListValue',
            value: create(CadenceStringListSchema, { values: ['gke', 'grpc'] }),
          },
        }),
      },
      createdAt: '',
    });

    const protoRun = create(ProtoCadenceRunResultSchema, {
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Build telemetry dashboard',
      presetSlug: '',
      runStatus: 'pending',
      mode: 'fast',
      executionMode: '',
      isGolden: false,
      status: create(ProtoOsc7501StatusSchema, {
        source: 'cadence-demo',
        state: 'running',
        label: 'Queued',
        progress: 0,
        timestamp: '2026-11-27T17:00:00.000Z',
      }),
      osc7501: '',
      gateVerdict: 'pending',
      turns: [turn],
      artifactHtml: '',
      tokensIn: 0,
      tokensOut: 0,
      createdAt: '',
    });

    const mapped = mapProtoCadenceRunToDomain(protoRun);
    expect(CadenceRunResultSchema.safeParse(mapped).success).toBe(true);
    expect(mapped.status?.progress).toBe(0);
    expect(mapped.tokensIn).toBe(0);
    expect(mapped.tokensOut).toBe(0);
    expect(mapped.presetSlug).toBeUndefined();
    expect(mapped.turns[0]?.id).toBeUndefined();
    expect(mapped.turns[0]?.payload).toEqual({
      mode: 'fast',
      tokens: 0,
      gated: true,
      notes: null,
      keywords: ['gke', 'grpc'],
    });
  });

  it('maps all Ask and Cadence stream chunk variants to Zod-valid SSE frames', () => {
    const statusFrame = mapProtoAskChunkToSse(
      create(AskStreamChunkSchema, {
        payload: { case: 'status', value: { stage: 'retrieving', label: 'Searching...' } },
      }),
    );
    expect(statusFrame?.event).toBe('status');
    expect(
      AskStreamEventSchema.safeParse({ type: 'status', ...(statusFrame?.data as object) }).success,
    ).toBe(true);

    const preambleErrFrame = mapProtoAskChunkToSse(
      create(AskStreamChunkSchema, {
        payload: {
          case: 'preambleError',
          value: {
            code: 'ERR_UPSTREAM_UNAVAILABLE',
            message: 'Preamble skipped.',
            action: '',
            correlationId: 'corr-1',
          },
        },
      }),
    );
    expect(preambleErrFrame?.event).toBe('preamble_error');
    expect(
      AskStreamEventSchema.safeParse({
        type: 'preamble_error',
        ...(preambleErrFrame?.data as object),
      }).success,
    ).toBe(true);

    const logFrame = mapProtoCadenceChunkToSse(
      create(StreamRunResponseSchema, {
        payload: {
          case: 'log',
          value: { runId: 'run-1', line: '[stream] Connected', timestamp: '' },
        },
      }),
    );
    expect(logFrame?.event).toBe('log');
    expect(CadenceStreamLogEventSchema.safeParse(logFrame?.data).success).toBe(true);

    const phaseFrame = mapProtoCadenceChunkToSse(
      create(StreamRunResponseSchema, {
        payload: {
          case: 'phase',
          value: {
            runId: 'run-1',
            runStatus: 'running',
            progress: 0,
            turn: create(ProtoCadenceTurnSchema, {
              phase: 'triage',
              agentName: 'triage',
              status: 'completed',
              summary: 'Done',
              latencyMs: 5,
            }),
          },
        },
      }),
    );
    expect(phaseFrame?.event).toBe('phase');
    expect(CadenceStreamPhaseEventSchema.safeParse(phaseFrame?.data).success).toBe(true);

    const errFrame = mapProtoCadenceChunkToSse(
      create(StreamRunResponseSchema, {
        payload: {
          case: 'error',
          value: { runId: 'run-1', error: 'Run failed', code: 'ERR_INTERNAL', runStatus: 'failed' },
        },
      }),
    );
    expect(errFrame?.event).toBe('error');
    expect(CadenceStreamErrorEventSchema.safeParse(errFrame?.data).success).toBe(true);

    const completeFrame = mapProtoCadenceChunkToSse(
      create(StreamRunResponseSchema, {
        payload: {
          case: 'complete',
          value: {
            run: create(ProtoCadenceRunResultSchema, {
              runId: 'run-1',
              prompt: 'Build card',
              runStatus: 'ready',
              gateVerdict: 'pending',
              turns: [],
              artifactHtml: '<main>ok</main>',
            }),
          },
        },
      }),
    );
    expect(completeFrame?.event).toBe('complete');
    expect(CadenceStreamCompleteEventSchema.safeParse(completeFrame?.data).success).toBe(true);
  });
});

describe('classifyGrpcError fail-closed redaction and fallback boundary', () => {
  it('marks transport Unavailable/DeadlineExceeded without app detail as fallback-eligible and rejects fallback on OIDC/HMAC/app errors', () => {
    const rawUnavailable = new ConnectError(
      'connect ECONNREFUSED 127.0.0.1:8082 SELECT * FROM sandbox_runs WHERE secret=topsecret',
      Code.Unavailable,
    );
    const transportFail = classifyGrpcError(rawUnavailable, {
      correlationId: 'corr-net-1',
      source: 'test.cadence',
    });
    expect(isFallbackTransportError(transportFail)).toBe(true);
    expect(transportFail.publicError.status).toBe(502);
    expect(PublicAppErrorSchema.safeParse(transportFail.publicError).success).toBe(true);
    expect(JSON.stringify(transportFail.publicError)).not.toContain('SELECT');
    expect(JSON.stringify(transportFail.publicError)).not.toContain('ECONNREFUSED');

    const normalized503 = classifyGrpcError(rawUnavailable, {
      correlationId: 'corr-net-2',
      source: 'test.ask',
      normalizeUnavailableStatus: 503,
    });
    expect(normalized503.publicError.status).toBe(503);
    expect(isFallbackTransportError(normalized503)).toBe(true);

    const deadlineFail = classifyGrpcError(new StreamDeadlineError(15000, 'test.stream'), {
      correlationId: 'corr-net-3',
      source: 'test.stream',
    });
    expect(deadlineFail.publicError.status).toBe(504);
    expect(isFallbackTransportError(deadlineFail)).toBe(true);

    const oidcFail = classifyGrpcError(new GcpOidcTokenError('metadata offline'), {
      correlationId: 'corr-oidc-1',
      source: 'test.cadence',
    });
    expect(oidcFail.publicError.status).toBe(503);
    expect(isFallbackTransportError(oidcFail)).toBe(false);

    const hmacFail = classifyGrpcError(
      new Error('INTERNAL_AUTH_SECRET is required in production'),
      { correlationId: 'corr-hmac-1', source: 'test.cadence' },
    );
    expect(hmacFail.publicError.status).toBe(500);
    expect(isFallbackTransportError(hmacFail)).toBe(false);

    const schemaFail = classifyGrpcError(
      new GrpcPayloadContractError('CadenceRunResultSchema', 'invalid runId'),
      { correlationId: 'corr-schema-1', source: 'test.cadence' },
    );
    expect(schemaFail.publicError.status).toBe(502);
    expect(schemaFail.publicError.code).toBe('ERR_UPSTREAM_UNAVAILABLE');
    expect(isFallbackTransportError(schemaFail)).toBe(false);

    // App-level ERR_DB_UNAVAILABLE carries ErrorDetailEnvelope -> never falls back to PG19.
    const appDbDown = new ConnectError('db unavailable', Code.Unavailable, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(ProtoPublicAppErrorSchema, {
            code: 'ERR_DB_UNAVAILABLE',
            status: 503,
            message: 'Database temporarily unavailable.',
            action: 'Retry shortly or share ID.',
            correlationId: 'corr-db-1',
          }),
        }),
      },
    ]);
    const appDbFail = classifyGrpcError(appDbDown, {
      correlationId: 'corr-db-1',
      source: 'test.cadence',
    });
    expect(appDbFail.publicError.code).toBe('ERR_DB_UNAVAILABLE');
    expect(appDbFail.publicError.status).toBe(503);
    expect(isFallbackTransportError(appDbFail)).toBe(false);
  });

  it('decodes 429 QuotaStatus, 409 lock conflict, and 422 confidentiality policy errors cleanly', () => {
    const rateLimited = new ConnectError('quota exhausted', Code.ResourceExhausted, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(ProtoPublicAppErrorSchema, {
            code: 'ERR_RATE_LIMITED',
            status: 429,
            message: 'Too many requests',
            action: 'Wait',
            correlationId: 'corr-429',
          }),
          quota: create(ProtoQuotaStatusSchema, {
            role: 'guest',
            turnsUsed: 10,
            maxTurns: 10,
            tokensUsed: 4000,
            maxTokens: 12000,
          }),
        }),
      },
    ]);
    const res429 = classifyGrpcError(rateLimited, { correlationId: 'corr-429', source: 'test' });
    expect(res429.publicError.status).toBe(429);
    expect(res429.publicError.code).toBe('ERR_RATE_LIMITED');
    expect(QuotaStatusSchema.safeParse(res429.quota).success).toBe(true);
    expect(res429.quota?.turnsUsed).toBe(10);
    expect(isFallbackTransportError(res429)).toBe(false);

    const conflict409 = new ConnectError('locked', Code.FailedPrecondition, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(ProtoPublicAppErrorSchema, {
            code: 'ERR_CONSTRAINT',
            status: 409,
            message: 'locked',
            action: 'retry',
            correlationId: 'corr-409',
          }),
        }),
      },
    ]);
    const res409 = classifyGrpcError(conflict409, { correlationId: 'corr-409', source: 'test' });
    expect(res409.publicError.status).toBe(409);
    expect(res409.publicError.code).toBe('ERR_CONSTRAINT');

    const policy422 = new ConnectError('confidential', Code.FailedPrecondition, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(ProtoPublicAppErrorSchema, {
            code: 'ERR_CONSTRAINT',
            status: 422,
            message: 'confidential',
            action: 'remove',
            correlationId: 'corr-422',
          }),
        }),
      },
    ]);
    const res422 = classifyGrpcError(policy422, { correlationId: 'corr-422', source: 'test' });
    expect(res422.publicError.status).toBe(422);
    expect(res422.publicError.code).toBe('ERR_CONSTRAINT');
  });
});

describe('OIDC + HMAC auth interceptor & IAM 401/403 disambiguation', () => {
  it('evicts OIDC token and retries ONCE strictly for idempotent read procedures, never mutating RPCs, and preserves cache on container errors', async () => {
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/ai_ask.v1.AskService/GetAskStatus')).toBe(true);
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/ai_ask.v1.AskService/Ask')).toBe(false);
    expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has('/ai_ask.v1.AskService/Reindex')).toBe(false);

    let metadataFetches = 0;
    const mockFetch: typeof fetch = vi.fn<typeof fetch>(async () => {
      metadataFetches += 1;
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
      return new Response(`eyJhbGciOiJSUzI1NiJ9.${payload}.sig-${metadataFetches}`, {
        status: 200,
      });
    });

    // 1. Idempotent GetAskStatus hit by GFE IAM 401 (no x-correlation-id, text/html) -> evict + single retry succeeds.
    let statusCalls = 0;
    const seenAuthHeaders: string[] = [];
    const statusTransport = createFakeTransport(async (_proc, headers) => {
      statusCalls += 1;
      seenAuthHeaders.push(headers.get('authorization') ?? '');
      expect(headers.get('x-internal-auth')).toBeTruthy();
      expect(headers.get('x-correlation-id')).toBe('corr-idemp-1');
      if (statusCalls === 1) {
        throw new ConnectError(
          'GFE IAM unauthorized',
          Code.Unauthenticated,
          new Headers({ 'content-type': 'text/html' }),
        );
      }
      return {
        message: create(GetAskStatusResponseSchema, {
          status: 'ready',
          provider: 'vertex',
          pgConnected: true,
        }),
      };
    });

    const status = await getAskStatus({
      baseUrl: 'https://ai-ask-test.a.run.app',
      internalAuth: { role: 'service', subject: 'portal-ask-status', secret: 'test-secret' },
      correlationId: 'corr-idemp-1',
      fetchImpl: mockFetch,
      transport: statusTransport,
    });
    expect(status.status).toBe('ready');
    expect(statusCalls).toBe(2);
    expect(metadataFetches).toBe(2);
    expect(seenAuthHeaders[0]).not.toBe(seenAuthHeaders[1]);

    // 2. Container-level CodePermissionDenied carrying echoed x-correlation-id + application/grpc does NOT evict OIDC cache.
    const containerPermErr = new ConnectError(
      'forbidden role',
      Code.PermissionDenied,
      new Headers({
        'content-type': 'application/grpc',
        'x-correlation-id': 'corr-app-403',
      }),
    );
    expect(isGfeIamAuthRejection(containerPermErr)).toBe(false);

    let reindexCalls = 0;
    const reindexTransport = createFakeTransport(async () => {
      reindexCalls += 1;
      throw containerPermErr;
    });
    await expect(
      triggerReindex({
        baseUrl: 'https://ai-ask-test.a.run.app',
        internalAuth: { role: 'guest', subject: 'guest-1', secret: 'test-secret' },
        correlationId: 'corr-app-403',
        fetchImpl: mockFetch,
        transport: reindexTransport,
      }),
    ).rejects.toThrow(ConnectError);
    expect(reindexCalls).toBe(1);
    // Token remained cached (no eviction -> next read reuses metadataFetches === 2).
    const cachedTransport = createFakeTransport(async () => ({
      message: create(GetAskStatusResponseSchema, { status: 'ready', provider: 'vertex' }),
    }));
    await getAskStatus({
      baseUrl: 'https://ai-ask-test.a.run.app',
      internalAuth: { role: 'service', subject: 'portal', secret: 'test-secret' },
      correlationId: 'corr-cache-hit',
      fetchImpl: mockFetch,
      transport: cachedTransport,
    });
    expect(metadataFetches).toBe(2);

    // 3. Mutating Ask hit by GFE IAM 401 -> evicts cache, NEVER auto-retries!
    let askCalls = 0;
    const mutatingTransport = createFakeTransport(async () => {
      askCalls += 1;
      throw new ConnectError('GFE expired JWT', Code.Unauthenticated, new Headers());
    });
    await expect(
      callAsk(
        {
          baseUrl: 'https://ai-ask-test.a.run.app',
          internalAuth: { role: 'guest', subject: 'guest-2', secret: 'test-secret' },
          correlationId: 'corr-mut-1',
          fetchImpl: mockFetch,
          transport: mutatingTransport,
        },
        { mode: 'qa', question: 'Do not double debit quota' },
      ),
    ).rejects.toThrow(ConnectError);
    expect(askCalls).toBe(1);
    // Next call fetches a fresh token (proving eviction happened without retrying mutating RPC).
    await getAskStatus({
      baseUrl: 'https://ai-ask-test.a.run.app',
      internalAuth: { role: 'service', subject: 'portal', secret: 'test-secret' },
      correlationId: 'corr-post-evict',
      fetchImpl: mockFetch,
      transport: cachedTransport,
    });
    expect(metadataFetches).toBe(3);
  });
});
