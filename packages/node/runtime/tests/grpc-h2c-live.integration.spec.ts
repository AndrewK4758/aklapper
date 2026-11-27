import http from 'node:http';
import http2 from 'node:http2';
import type { AddressInfo } from 'node:net';

import { create, toBinary } from '@bufbuild/protobuf';
import { Code, ConnectError, createConnectRouter } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bridgeGrpcStreamToSse,
  clearGoGrpcTransportCacheForTest,
  getAskStatus,
  getOrCreateGoGrpcTransport,
  mapProtoAskChunkToSse,
  mapProtoCadenceChunkToSse,
  streamAsk,
  streamCadenceRun,
} from '../src/grpc.ts';
import {
  AskService,
  type AskStreamChunk,
  AskStreamChunkSchema,
  GetAskStatusResponseSchema,
} from '../src/grpc/gen/ai_ask/v1/ask_pb.ts';
import {
  CadenceRunResultSchema,
  CadenceService,
  CadenceTurnSchema,
  StreamRunResponseSchema,
} from '../src/grpc/gen/cadence/v1/cadence_pb.ts';
import {
  ErrorDetailEnvelopeSchema,
  PublicAppErrorSchema,
  QuotaStatusSchema,
} from '../src/grpc/gen/common/v1/error_pb.ts';
import {
  Health,
  HealthCheckResponse_ServingStatus,
  HealthCheckResponseSchema,
} from '../src/grpc/gen/grpc/health/v1/health_pb.ts';
import type { SsrStructuredLogger } from '../src/request-context.ts';
import { clearRuntimeHealthCacheForTest, probeRuntimeServices } from '../src/runtime-health.ts';

const serversToClose: Array<() => Promise<void>> = [];

afterEach(async () => {
  clearGoGrpcTransportCacheForTest();
  clearRuntimeHealthCacheForTest();
  while (serversToClose.length > 0) {
    const closeFn = serversToClose.pop();
    if (closeFn) {
      await closeFn();
    }
  }
});

async function startH2cConnectServer(
  configure: (router: ReturnType<typeof createConnectRouter>) => void,
): Promise<{
  readonly baseUrl: string;
  readonly server: http2.Http2Server;
  readonly sessions: Set<http2.ServerHttp2Session>;
}> {
  const router = createConnectRouter();
  configure(router);
  const handler = connectNodeAdapter({ routes: r => configure(r) });
  const sessions = new Set<http2.ServerHttp2Session>();
  const server = http2.createServer(handler);
  server.on('session', session => {
    sessions.add(session);
    session.on('close', () => sessions.delete(session));
  });
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address() as AddressInfo;
  serversToClose.push(async () => {
    for (const s of sessions) {
      s.destroy();
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  return { baseUrl: `http://127.0.0.1:${addr.port}`, server, sessions };
}

describe('Live Node 26 HTTP/2 h2c gRPC transport & SSE bridge integration', () => {
  it('clears header-only timer on immediate EmitStatus before slow cold-load tokens and emits keepalives', async () => {
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async *streamAsk() {
          yield create(AskStreamChunkSchema, {
            payload: {
              case: 'status',
              value: { stage: 'retrieving', label: 'Searching portfolio records...' },
            },
          });
          // Simulate slow local model cold-load exceeding headerTimeoutMs (300ms).
          await new Promise(resolve => setTimeout(resolve, 650));
          yield create(AskStreamChunkSchema, {
            payload: { case: 'delta', value: { text: 'Cold-load grounded answer.' } },
          });
          yield create(AskStreamChunkSchema, {
            payload: {
              case: 'done',
              value: {
                attemptId: '11111111-1111-4111-8111-111111111111',
                grounded: true,
                abstained: false,
                answer: 'Cold-load grounded answer.',
                provider: 'local',
                tokensUsed: 12,
                usageEstimated: false,
                correlationId: 'corr-cold-1',
              },
            },
          });
        },
      });
    });

    const response = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 300,
      heartbeatIntervalMs: 120,
      correlationId: 'corr-cold-1',
      source: 'test.cold_load',
      extraResponseHeaders: { 'set-cookie': 'ak_guest_session=signed-val; Path=/' },
      startStream: ({ signal, onHeader }) =>
        streamAsk(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-cold', secret: 'test-secret' },
            correlationId: 'corr-cold-1',
            signal,
          },
          { question: 'Test cold-load streaming' },
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('x-correlation-id')).toBe('corr-cold-1');
    expect(response.headers.get('set-cookie')).toContain('ak_guest_session=signed-val');

    const body = await response.text();
    expect(body).toContain('event: status\n');
    expect(body).toContain(': keepalive\n\n');
    expect(body).toContain('Cold-load grounded answer.');
    expect(body).toContain('event: done\n');
  });

  it('keeps Cadence StreamRun alive past headerTimeoutMs during pollActiveRun wait via immediate initial log frame', async () => {
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(CadenceService, {
        async *streamRun(req) {
          yield create(StreamRunResponseSchema, {
            payload: {
              case: 'log',
              value: {
                runId: req.runId,
                line: '[stream] Reattached to active CHORD run...',
                timestamp: new Date().toISOString(),
              },
            },
          });
          await new Promise(resolve => setTimeout(resolve, 600));
          yield create(StreamRunResponseSchema, {
            payload: {
              case: 'phase',
              value: {
                runId: req.runId,
                runStatus: 'ready',
                progress: 100,
                turn: create(CadenceTurnSchema, {
                  phase: 'gate',
                  agentName: 'cadence-gate',
                  status: 'completed',
                  summary: 'Gate passed',
                  latencyMs: 4,
                }),
              },
            },
          });
          yield create(StreamRunResponseSchema, {
            payload: {
              case: 'complete',
              value: {
                run: create(CadenceRunResultSchema, {
                  runId: req.runId,
                  prompt: 'Reloaded run',
                  runStatus: 'ready',
                  gateVerdict: 'pending',
                  turns: [],
                  artifactHtml: '<main>ready</main>',
                }),
              },
            },
          });
        },
      });
    });

    const response = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 250,
      heartbeatIntervalMs: 120,
      correlationId: 'corr-reload-1',
      source: 'test.cadence_reload',
      startStream: ({ signal, onHeader }) =>
        streamCadenceRun(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-reload', secret: 'test-secret' },
            correlationId: 'corr-reload-1',
            signal,
          },
          '22222222-2222-4222-8222-222222222222',
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoCadenceChunkToSse(chunk),
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('[stream] Reattached to active CHORD run...');
    expect(body).toContain(': keepalive\n\n');
    expect(body).toContain('event: phase\n');
    expect(body).toContain('event: complete\n');
  });

  it('aborts with HTTP 504 ERR_STREAM_TIMEOUT when server stalls before sending initial headers', async () => {
    let serverObservedAbort = false;
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async *streamAsk(_req, ctx) {
          await new Promise<void>(resolve => {
            ctx.signal.addEventListener('abort', () => {
              serverObservedAbort = true;
              resolve();
            });
            setTimeout(resolve, 2000);
          });
          yield create(AskStreamChunkSchema, {});
        },
      });
    });

    const stallErrorLogs: Array<Record<string, unknown>> = [];
    const stallLogger: SsrStructuredLogger = {
      info: () => undefined,
      warn: () => undefined,
      error: obj => {
        stallErrorLogs.push(obj);
      },
    };

    const response = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 180,
      correlationId: 'corr-stall-1',
      source: 'test.header_stall',
      logger: stallLogger,
      startStream: ({ signal, onHeader }) =>
        streamAsk(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-stall', secret: 'test-secret' },
            correlationId: 'corr-stall-1',
            signal,
          },
          { question: 'Will stall before headers' },
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk, stallLogger),
    });

    expect(response.status).toBe(504);
    const json = (await response.json()) as { code: string; correlationId: string };
    expect(json.code).toBe('ERR_STREAM_TIMEOUT');
    expect(json.correlationId).toBe('corr-stall-1');
    expect(stallErrorLogs).toContainEqual(
      expect.objectContaining({
        seam_type: 'BOUNDARY_FAULT',
        event: 'bff.grpc.stream_header_timeout',
        headerTimeoutMs: 180,
        source: 'test.header_stall',
        correlationId: 'corr-stall-1',
      }),
    );

    // Allow RST_STREAM to propagate to server handler.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(serverObservedAbort).toBe(true);
  });

  it('returns pre-stream HTTP 429 JSON with QuotaStatus on trailers-only ResourceExhausted and catalog-safe SSE error on mid-stream fault', async () => {
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async *streamAsk(req) {
          if (req.question.includes('quota')) {
            throw new ConnectError(
              'quota exceeded SELECT * FROM rate_limit_buckets',
              Code.ResourceExhausted,
              undefined,
              [
                {
                  desc: ErrorDetailEnvelopeSchema,
                  value: create(ErrorDetailEnvelopeSchema, {
                    error: create(PublicAppErrorSchema, {
                      code: 'ERR_RATE_LIMITED',
                      status: 429,
                      message: 'Too many requests received.',
                      action: 'Wait a moment and submit again.',
                      correlationId: 'corr-pre-429',
                    }),
                    quota: create(QuotaStatusSchema, {
                      role: 'guest',
                      turnsUsed: 10,
                      maxTurns: 10,
                      tokensUsed: 5000,
                      maxTokens: 12000,
                    }),
                  }),
                },
              ],
            );
          }
          yield create(AskStreamChunkSchema, {
            payload: { case: 'status', value: { stage: 'retrieving', label: 'Starting' } },
          });
          throw new ConnectError(
            'postgresql://admin:supersecret@db:5432/aklapper crash at main.go:99',
            Code.Internal,
          );
        },
      });
    });

    // 1. Pre-stream 429 with QuotaStatus + Set-Cookie preserved
    const res429 = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 2000,
      correlationId: 'corr-pre-429',
      source: 'test.pre429',
      extraResponseHeaders: { 'set-cookie': 'ak_guest_session=abc; Path=/' },
      startStream: ({ signal, onHeader }) =>
        streamAsk(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-q', secret: 'test-secret' },
            correlationId: 'corr-pre-429',
            signal,
          },
          { question: 'Trigger quota 429' },
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk),
    });
    expect(res429.status).toBe(429);
    expect(res429.headers.get('set-cookie')).toContain('ak_guest_session=abc');
    const body429 = (await res429.json()) as { code: string; quota?: { turnsUsed: number } };
    expect(body429.code).toBe('ERR_RATE_LIMITED');
    expect(body429.quota?.turnsUsed).toBe(10);
    expect(JSON.stringify(body429)).not.toContain('SELECT');

    // 2. Post-header mid-stream error -> single catalog-safe SSE event: error with zero secret leakage
    const resMid = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 2000,
      correlationId: 'corr-mid-500',
      source: 'test.mid500',
      startStream: ({ signal, onHeader }) =>
        streamAsk(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-mid', secret: 'test-secret' },
            correlationId: 'corr-mid-500',
            signal,
          },
          { question: 'Trigger mid-stream error' },
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk),
    });
    expect(resMid.status).toBe(200);
    const sseText = await resMid.text();
    expect(sseText).toContain('event: status\n');
    expect(sseText).toContain('event: error\n');
    expect(sseText).toContain('ERR_INTERNAL');
    expect(sseText).not.toContain('supersecret');
    expect(sseText).not.toContain('postgresql://');
  });

  it('recovers transparently after synthetic HTTP/2 GOAWAY closes an idle session', async () => {
    let calls = 0;
    const { baseUrl, sessions } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async getAskStatus() {
          calls += 1;
          return create(GetAskStatusResponseSchema, {
            status: 'ready',
            provider: `call-${calls}`,
            pgConnected: true,
          });
        },
      });
    });

    const transport = getOrCreateGoGrpcTransport(baseUrl);
    const first = await getAskStatus({
      baseUrl,
      internalAuth: { role: 'service', subject: 'goaway-test', secret: 'test-secret' },
      correlationId: 'corr-goaway-1',
      transport,
    });
    expect(first.provider).toBe('call-1');
    expect(sessions.size).toBeGreaterThanOrEqual(1);

    // Send HTTP/2 GOAWAY on every active session and close gracefully.
    for (const session of sessions) {
      session.goaway(0);
      session.close();
    }
    await new Promise(resolve => setTimeout(resolve, 60));

    // Subsequent call on the exact same cached transport transparently reconnects.
    const second = await getAskStatus({
      baseUrl,
      internalAuth: { role: 'service', subject: 'goaway-test', secret: 'test-secret' },
      correlationId: 'corr-goaway-2',
      transport,
    });
    expect(second.provider).toBe('call-2');
  });

  it('discriminates HTTP GET /health for portal and gRPC Health/Check for Go services in probeRuntimeServices', async () => {
    // 1. HTTP-only server for portal
    const httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'portal' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const httpPort = (httpServer.address() as AddressInfo).port;
    serversToClose.push(() => new Promise<void>(resolve => httpServer.close(() => resolve())));

    // 2. h2c gRPC Health server for Go service
    const { baseUrl: grpcBaseUrl } = await startH2cConnectServer(router => {
      router.service(Health, {
        async check(req) {
          const serving =
            req.service === '' || req.service === 'ai_ask.v1.AskService'
              ? HealthCheckResponse_ServingStatus.SERVING
              : HealthCheckResponse_ServingStatus.SERVICE_UNKNOWN;
          return create(HealthCheckResponseSchema, { status: serving });
        },
      });
    });

    const snapshot = await probeRuntimeServices({
      services: [
        {
          service: 'portal',
          url: `http://127.0.0.1:${httpPort}`,
          transport: 'http',
          oidcAuth: false,
        },
        { service: 'ai-ask', url: grpcBaseUrl, transport: 'grpc' },
      ],
      timeoutMs: 2000,
      ttlMs: 0,
      correlationId: 'corr-health-mixed',
    });

    expect(snapshot.services).toHaveLength(2);
    expect(snapshot.services[0]?.service).toBe('portal');
    expect(snapshot.services[0]?.status).toBe('healthy');
    expect(snapshot.services[0]?.detail).toBe('HTTP 200 /health');
    expect(snapshot.services[1]?.service).toBe('ai-ask');
    expect(snapshot.services[1]?.status).toBe('healthy');
    expect(snapshot.services[1]?.detail).toBe('gRPC SERVING');
    // Touch toBinary import usage verification (ensures protobuf serialization stays bundled cleanly)
    expect(
      toBinary(HealthCheckResponseSchema, create(HealthCheckResponseSchema, { status: 1 }))
        .byteLength,
    ).toBeGreaterThan(0);
  });

  it('propagates SSE ReadableStream.cancel() as HTTP/2 RST_STREAM cancelling the upstream server stream', async () => {
    let serverCancelled = false;
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async *streamAsk(_req, ctx) {
          yield create(AskStreamChunkSchema, {
            payload: { case: 'status', value: { stage: 'retrieving', label: 'Streaming...' } },
          });
          await new Promise<void>(resolve => {
            ctx.signal.addEventListener('abort', () => {
              serverCancelled = true;
              resolve();
            });
            setTimeout(resolve, 2500);
          });
        },
      });
    });

    const response = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 2000,
      correlationId: 'corr-cancel-1',
      source: 'test.cancel',
      startStream: ({ signal, onHeader }) =>
        streamAsk(
          {
            baseUrl,
            internalAuth: { role: 'guest', subject: 'guest-cancel', secret: 'test-secret' },
            correlationId: 'corr-cancel-1',
            signal,
          },
          { question: 'Cancel mid stream' },
          { onHeader },
        ),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk),
    });

    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const firstChunk = await reader!.read();
    expect(firstChunk.done).toBe(false);
    await reader!.cancel('browser disconnected');

    await new Promise(resolve => setTimeout(resolve, 120));
    expect(serverCancelled).toBe(true);
  });

  it('catches post-header GrpcPayloadContractError, emits BOUNDARY_FAULT + catalog-safe SSE error, aborts upstream, and clears keepalive interval', async () => {
    let serverObservedAbort = false;
    const { baseUrl } = await startH2cConnectServer(router => {
      router.service(AskService, {
        async *streamAsk(_req, ctx) {
          yield create(AskStreamChunkSchema, {
            payload: { case: 'status', value: { stage: 'retrieving', label: 'Starting' } },
          });
          // Malformed AskSource violates AskSourceSchema (empty title + out-of-range score).
          yield create(AskStreamChunkSchema, {
            payload: {
              case: 'sources',
              value: {
                sources: [{ title: '', snippet: 'malformed source', score: 5.5 }],
              },
            },
          });
          await new Promise<void>(resolve => {
            if (ctx.signal.aborted) {
              serverObservedAbort = true;
              resolve();
              return;
            }
            ctx.signal.addEventListener(
              'abort',
              () => {
                serverObservedAbort = true;
                resolve();
              },
              { once: true },
            );
            setTimeout(resolve, 2000);
          });
        },
      });
    });

    const errorLogs: Array<Record<string, unknown>> = [];
    const logger: SsrStructuredLogger = {
      info: () => undefined,
      warn: () => undefined,
      error: obj => {
        errorLogs.push(obj);
      },
    };

    const realSetInterval = globalThis.setInterval;
    const realClearInterval = globalThis.clearInterval;
    let activeIntervalHandle: ReturnType<typeof setInterval> | undefined;
    let streamFinished = false;
    let leakedTicksAfterClose = 0;

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((
      cb: (...args: unknown[]) => void,
      ms?: number,
      ...args: unknown[]
    ) => {
      const handle = realSetInterval(() => {
        if (streamFinished) {
          leakedTicksAfterClose += 1;
        }
        cb(...args);
      }, ms);
      activeIntervalHandle = handle;
      return handle;
    }) as typeof setInterval);
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    try {
      const response = await bridgeGrpcStreamToSse({
        headerTimeoutMs: 2000,
        heartbeatIntervalMs: 30,
        correlationId: 'corr-post-schema-1',
        source: 'test.post_schema_fault',
        logger,
        startStream: ({ signal, onHeader }) =>
          streamAsk(
            {
              baseUrl,
              internalAuth: { role: 'guest', subject: 'guest-schema', secret: 'test-secret' },
              correlationId: 'corr-post-schema-1',
              signal,
            },
            { question: 'Trigger malformed post-header sources chunk' },
            { onHeader },
          ),
        mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk, logger),
      });

      expect(response.status).toBe(200);
      const sseText = await response.text();
      streamFinished = true;

      expect(sseText).toContain('event: status\n');
      expect(sseText).toContain('event: error\n');
      expect(sseText).toContain('ERR_UPSTREAM_UNAVAILABLE');
      expect(sseText).not.toContain('AskSourceSchema');
      expect(errorLogs).toContainEqual(
        expect.objectContaining({
          seam_type: 'BOUNDARY_FAULT',
          event: 'bff.grpc.payload_contract_violation',
          schema: 'AskSourceSchema',
        }),
      );
      expect(errorLogs).toContainEqual(
        expect.objectContaining({
          seam_type: 'BOUNDARY_FAULT',
          event: 'bff.grpc.upstream_error_classified',
          errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
          grpcCode: 'PAYLOAD_CONTRACT_VIOLATION',
          correlationId: 'corr-post-schema-1',
        }),
      );

      await new Promise(resolve => setTimeout(resolve, 120));
      expect(serverObservedAbort).toBe(true);
      expect(activeIntervalHandle).toBeDefined();
      expect(clearIntervalSpy).toHaveBeenCalledWith(activeIntervalHandle);
      expect(leakedTicksAfterClose).toBe(0);
    } finally {
      if (activeIntervalHandle !== undefined) {
        realClearInterval(activeIntervalHandle);
      }
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('returns 504 ERR_STREAM_TIMEOUT and invokes onPreStreamFailure when header deadline expires concurrently with first-frame arrival', async () => {
    const errorLogs: Array<Record<string, unknown>> = [];
    const logger: SsrStructuredLogger = {
      info: () => undefined,
      warn: () => undefined,
      error: obj => {
        errorLogs.push(obj);
      },
    };

    let iteratorReturnCalled = false;
    let preStreamFailureCode: string | undefined;
    let preStreamFailureStatus: number | undefined;

    const response = await bridgeGrpcStreamToSse({
      headerTimeoutMs: 40,
      correlationId: 'corr-header-race-504',
      source: 'test.header_race',
      logger,
      startStream: ({ signal }): AsyncIterable<AskStreamChunk> => ({
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<AskStreamChunk>> {
              return new Promise<IteratorResult<AskStreamChunk>>(resolve => {
                const firstChunk = create(AskStreamChunkSchema, {
                  payload: {
                    case: 'status',
                    value: { stage: 'retrieving', label: 'Late frame 1' },
                  },
                });
                signal.addEventListener(
                  'abort',
                  () => {
                    resolve({ value: firstChunk, done: false });
                  },
                  { once: true },
                );
              });
            },
            async return(): Promise<IteratorResult<AskStreamChunk>> {
              iteratorReturnCalled = true;
              return { value: undefined, done: true };
            },
          };
        },
      }),
      mapChunkToSse: chunk => mapProtoAskChunkToSse(chunk, logger),
      onPreStreamFailure: failure => {
        preStreamFailureCode = failure.publicError.code;
        preStreamFailureStatus = failure.publicError.status;
        return null;
      },
    });

    expect(response.status).toBe(504);
    const body = (await response.json()) as { code: string; correlationId: string };
    expect(body.code).toBe('ERR_STREAM_TIMEOUT');
    expect(body.correlationId).toBe('corr-header-race-504');
    expect(preStreamFailureCode).toBe('ERR_STREAM_TIMEOUT');
    expect(preStreamFailureStatus).toBe(504);
    expect(iteratorReturnCalled).toBe(true);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({
        seam_type: 'BOUNDARY_FAULT',
        event: 'bff.grpc.stream_header_timeout',
        headerTimeoutMs: 40,
        source: 'test.header_race',
        correlationId: 'corr-header-race-504',
      }),
    );
  });
});
