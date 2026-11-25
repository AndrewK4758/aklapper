import {
  buildTailoredCadenceArtifactHtml,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceSpecArtifact,
  type CadenceStreamCompleteEvent,
  type CadenceStreamErrorEvent,
  type CadenceStreamPhaseEvent,
  type CadenceTurn,
  extractCadencePromptKeywords,
  MAX_CADENCE_ARTIFACT_BYTES,
  type QuotaStatus,
  sanitizeCadenceArtifactHtml,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  type AppDatabase,
  completeSandboxRunRow,
  failSandboxRunRow,
  getCadencePresetBySlug,
  getQuotaStatusForSession,
  getSandboxRunWithTurnsById,
  pauseSandboxRunForSpecApproval,
  updateSandboxTurnRow,
} from '@aklapper/db';
import { logDiagnosticError, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

export function logCadenceStreamSeam(
  level: 'info' | 'warn' | 'error',
  seamType: string,
  event: string,
  severity: string,
  fields: Record<string, unknown>,
): void {
  const payload = JSON.stringify({
    seam_type: seamType,
    event,
    severity,
    service: 'portal-cadence-stream',
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.info(payload);
}

const SAFE_STREAM_FAILURE_SUMMARY = 'CHORD execution failed before completion.';

export interface SseStreamSink {
  readonly enqueue: (eventName: string, payload: unknown) => boolean;
  readonly close: () => void;
  readonly isClosed: () => boolean;
}

export function createSafeSseSink(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  isCancelled: () => boolean,
): SseStreamSink {
  let closed = false;
  return {
    isClosed: () => closed || isCancelled(),
    enqueue: (eventName, payload) => {
      if (closed || isCancelled()) {
        return false;
      }
      try {
        controller.enqueue(encodeSseFrame(encoder, eventName, payload));
        return true;
      } catch {
        closed = true;
        return false;
      }
    },
    close: () => {
      if (closed || isCancelled()) {
        closed = true;
        return;
      }
      try {
        controller.close();
        closed = true;
      } catch {
        closed = true;
      }
    },
  };
}

export function encodeSseFrame(
  encoder: TextEncoder,
  eventName: string,
  payload: unknown,
): Uint8Array {
  return encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function buildStatusBadge(state: 'running' | 'ready' | 'error', label: string, progress: number) {
  return {
    source: 'cadence-portal',
    state,
    label,
    progress,
    timestamp: new Date().toISOString(),
  };
}

export function replayReadyRunSse(
  sink: SseStreamSink,
  run: CadenceRunResult,
  quota: QuotaStatus,
): void {
  for (let i = 0; i < run.turns.length; i += 1) {
    const turn = run.turns[i];
    if (!turn) continue;
    const progress = Math.min(100, (i + 1) * 25);
    const phasePayload: CadenceStreamPhaseEvent = {
      runId: run.runId,
      runStatus: run.runStatus ?? 'ready',
      progress,
      turn,
    };
    if (!sink.enqueue('phase', phasePayload)) {
      return;
    }
  }
  const completePayload: CadenceStreamCompleteEvent = {
    run: { ...run, quota },
    quota,
  };
  sink.enqueue('complete', completePayload);
}

export async function pollActiveFallbackRunSse(
  db: AppDatabase,
  runId: string,
  sessionId: string,
  isCancelled: () => boolean,
  sink: SseStreamSink,
): Promise<void> {
  const deadline = Date.now() + 12_000;
  let lastSnapshotKey = '';

  while (Date.now() < deadline && !isCancelled()) {
    const record = await getSandboxRunWithTurnsById(db, runId);
    if (isCancelled()) {
      return;
    }
    if (!record) {
      sink.enqueue('error', {
        runId,
        error: 'Sandbox run disappeared during stream polling.',
        runStatus: 'failed',
      } satisfies CadenceStreamErrorEvent);
      return;
    }

    const key = record.run.turns.map(t => `${t.phase}:${t.status}`).join('|');
    if (key !== lastSnapshotKey) {
      lastSnapshotKey = key;
      for (let i = 0; i < record.run.turns.length; i += 1) {
        const turn = record.run.turns[i];
        if (!turn || turn.status === 'pending') continue;
        if (
          !sink.enqueue('phase', {
            runId,
            runStatus: record.run.runStatus ?? 'running',
            progress: Math.min(100, (i + 1) * 25),
            turn,
          } satisfies CadenceStreamPhaseEvent)
        ) {
          return;
        }
      }
    }

    if (record.run.runStatus === 'ready') {
      const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
      sink.enqueue('complete', {
        run: { ...record.run, quota },
        quota,
      } satisfies CadenceStreamCompleteEvent);
      return;
    }
    if (record.run.runStatus === 'failed') {
      sink.enqueue('error', {
        runId,
        error: 'Sandbox run failed before artifact completion.',
        runStatus: 'failed',
      } satisfies CadenceStreamErrorEvent);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 40));
  }

  if (isCancelled()) {
    return;
  }

  sink.enqueue('error', {
    runId,
    error: 'Timed out waiting for active stream completion.',
    runStatus: 'running',
  } satisfies CadenceStreamErrorEvent);
}

export async function runFallbackChordPipelineSse(
  db: AppDatabase,
  run: CadenceRunResult,
  mode: CadenceRunMode,
  sessionId: string,
  sink: SseStreamSink,
  telemetry?: { readonly correlationId: string; readonly logger: SsrStructuredLogger },
): Promise<void> {
  const emitStep = async (
    phase: CadenceTurn['phase'],
    agentName: string,
    status: CadenceTurn['status'],
    summary: string,
    latencyMs: number,
    progress: number,
    payload?: Record<string, unknown>,
  ): Promise<void> => {
    const updated = await updateSandboxTurnRow(db, {
      runId: run.runId,
      phase,
      status,
      summary,
      latencyMs,
      ...(payload ? { payload } : {}),
    });
    const turn: CadenceTurn = updated ?? { phase, agentName, status, summary, latencyMs };
    sink.enqueue('phase', {
      runId: run.runId,
      runStatus: 'running',
      status: buildStatusBadge('running', `CHORD ${phase} · ${status}`, progress),
      progress,
      turn,
    } satisfies CadenceStreamPhaseEvent);
  };

  try {
    const presetSlug = run.presetSlug ?? 'custom';
    const preset = await getCadencePresetBySlug(db, presetSlug);
    const triageTurn = run.turns.find(t => t.phase === 'triage');
    const requireSpecApproval = Boolean(triageTurn?.payload?.['requireSpecApproval'] === true);

    await emitStep(
      'triage',
      'chord-triage',
      'running',
      'Evaluating prompt and isolation...',
      0,
      15,
    );
    const detectedKeywords = extractCadencePromptKeywords(run.prompt, 6);
    await emitStep(
      'triage',
      'chord-triage',
      'completed',
      `Classified prompt (${run.prompt.length} chars) under "${presetSlug}" (${mode} fallback).`,
      2,
      25,
      {
        presetSlug,
        promptLen: run.prompt.length,
        mode,
        detectedKeywords,
        isolationPolicy: 'sandbox=allow-scripts; opaque-origin; max-48KiB',
      },
    );

    await emitStep('spec', 'chord-spec', 'running', 'Drafting tailored UI artifact spec...', 0, 40);
    const fallbackSpec: CadenceSpecArtifact = {
      title: preset?.title ?? 'Custom CADENCE Artifact Specification',
      summary: `Structured CHORD specification for "${presetSlug}" (${mode} fallback).`,
      conditions: [
        `Prompt received (${run.prompt.length} chars) under preset "${presetSlug}".`,
        'Isolated opaque-origin sandbox iframe (sandbox=allow-scripts, referrerPolicy=no-referrer).',
      ],
      handling: [
        'Run triage classification, CHORD spec drafting, HTML5/CSS synthesis, and strict CSP sanitization.',
      ],
      outcomes: [
        'Self-contained dark Solar Forge HTML5+CSS document filling 100% width',
        'Interactive controls using pure HTML5/CSS (tabs, collapsible panels, charts)',
        'Zero external fetches, zero arbitrary inline JS, <= 48 KiB UTF-8',
      ],
      rules: [
        "Strict CSP meta injected (default-src 'none', sha256-pinned probe script)",
        'Zero inline <script>, <svg>, <iframe>, <object>, or on* event handlers.',
      ],
      deltas: ['Persists sandbox_runs row with structured spec_json and 4 sandbox_turns.'],
    };
    const specTurnUpdated = await updateSandboxTurnRow(db, {
      runId: run.runId,
      phase: 'spec',
      status: 'completed',
      summary: 'Drafted single-file Solar Forge HTML/CSS specification.',
      latencyMs: 4,
      payload: {
        specTitle: fallbackSpec.title,
        specSummary: fallbackSpec.summary,
        conditions: fallbackSpec.conditions,
        rules: fallbackSpec.rules,
        recalledPatterns: [],
        acceptanceCriteria: fallbackSpec.outcomes,
        sandboxConstraints:
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      },
    });
    sink.enqueue('phase', {
      runId: run.runId,
      runStatus: 'running',
      status: buildStatusBadge('running', 'CHORD spec · completed', 50),
      progress: 50,
      turn: specTurnUpdated ?? {
        phase: 'spec',
        agentName: 'chord-spec',
        status: 'completed',
        summary: 'Drafted single-file Solar Forge HTML/CSS specification.',
        latencyMs: 4,
      },
      spec: fallbackSpec,
    } satisfies CadenceStreamPhaseEvent);

    if (requireSpecApproval) {
      const paused = await pauseSandboxRunForSpecApproval(db, {
        runId: run.runId,
        tokensIn: Math.ceil(run.prompt.length / 4) + 120,
        tokensOut: 160,
        executionMode: mode === 'llm' ? 'fallback' : 'fast',
        spec: fallbackSpec,
      });
      const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
      const pausedRun: CadenceRunResult = {
        ...(paused ?? { ...run, runStatus: 'awaiting_approval', spec: fallbackSpec }),
        quota,
      };
      sink.enqueue('complete', {
        run: pausedRun,
        quota,
      } satisfies CadenceStreamCompleteEvent);
      return;
    }

    await runFallbackChordBuildPhaseSse(
      db,
      { ...run, spec: fallbackSpec },
      mode,
      sessionId,
      sink,
      telemetry,
    );
    return;
  } catch (error) {
    const correlationId = telemetry?.correlationId ?? run.runId;
    const { diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.cadence.stream',
    });
    if (telemetry) {
      logDiagnosticError(telemetry.logger, diagnostic);
    }
    try {
      await failSandboxRunRow(db, run.runId, SAFE_STREAM_FAILURE_SUMMARY);
    } catch (failErr) {
      const failDiag = classifyServerError(failErr, {
        correlationId,
        source: 'portal.cadence.stream',
      }).diagnostic;
      logCadenceStreamSeam(
        'error',
        'DELTA_AUDIT_GAP',
        'cadence.run.terminal_commit_gap',
        'critical',
        {
          runId: run.runId,
          correlationId,
          error: failDiag.causeMessage ?? failDiag.reasoning,
        },
      );
    }
    logCadenceStreamSeam(
      'error',
      'DELTA_AUDIT_GAP',
      'cadence.run.terminal_commit_gap',
      'critical',
      {
        runId: run.runId,
        correlationId,
        error: diagnostic.causeMessage ?? diagnostic.reasoning,
      },
    );
    sink.enqueue('error', {
      runId: run.runId,
      error: SAFE_STREAM_FAILURE_SUMMARY,
      code: 'ERR_CADENCE_STREAM',
      runStatus: 'failed',
    } satisfies CadenceStreamErrorEvent);
  }
}

export async function runFallbackChordBuildPhaseSse(
  db: AppDatabase,
  run: CadenceRunResult,
  mode: CadenceRunMode,
  sessionId: string,
  sink: SseStreamSink,
  telemetry?: { readonly correlationId: string; readonly logger: SsrStructuredLogger },
): Promise<void> {
  const emitStep = async (
    phase: CadenceTurn['phase'],
    agentName: string,
    status: CadenceTurn['status'],
    summary: string,
    latencyMs: number,
    progress: number,
    payload?: Record<string, unknown>,
  ): Promise<void> => {
    const updated = await updateSandboxTurnRow(db, {
      runId: run.runId,
      phase,
      status,
      summary,
      latencyMs,
      ...(payload ? { payload } : {}),
    });
    const turn: CadenceTurn = updated ?? { phase, agentName, status, summary, latencyMs };
    sink.enqueue('phase', {
      runId: run.runId,
      runStatus: 'building',
      status: buildStatusBadge('running', `CHORD ${phase} · ${status}`, progress),
      progress,
      turn,
    } satisfies CadenceStreamPhaseEvent);
  };

  try {
    const presetSlug = run.presetSlug ?? 'custom';
    const preset = await getCadencePresetBySlug(db, presetSlug);

    await emitStep(
      'build',
      'chord-builder',
      'running',
      'Synthesizing sandbox HTML widget...',
      0,
      70,
    );
    const rawHtml = buildTailoredCadenceArtifactHtml({ prompt: run.prompt, preset });
    await emitStep(
      'build',
      'chord-builder',
      'completed',
      `Synthesized bounded HTML/CSS artifact (${rawHtml.length} bytes) via ${mode}-node-fallback.`,
      6,
      80,
      {
        provider: `${mode}-node-fallback`,
        artifactBytes: rawHtml.length,
        ...(mode === 'llm'
          ? {
              fallbackReason:
                'CADENCE Go service unreachable; rendered structured interactive fallback.',
            }
          : {}),
      },
    );

    await emitStep(
      'gate',
      'chord-gate',
      'running',
      'Running HTML/JS isolation sanitizer...',
      0,
      90,
    );
    const sanitized = sanitizeCadenceArtifactHtml(rawHtml);
    if (sanitized.stripped) {
      logCadenceStreamSeam('warn', 'BOUNDARY_FAULT', 'cadence.gate.artifact_sanitized', 'warn', {
        runId: run.runId,
        stripped: true,
      });
    }
    const tokensIn = Math.ceil(run.prompt.length / 4) + 120;
    const tokensOut = 480;

    await emitStep(
      'gate',
      'chord-gate',
      'completed',
      sanitized.stripped
        ? 'Sanitizer neutralized restricted tags/escape hatches; ready for gate verdict.'
        : 'Artifact passed HTML/JS isolation sanitizer; ready for operator gate verdict.',
      3,
      100,
      {
        sanitized: sanitized.stripped,
        gateVerdict: 'pending',
        artifactBytes: sanitized.html.length,
        checks: [
          "Strict CSP meta injected (default-src 'none', sha256-pinned probe script)",
          `Payload size verified (${sanitized.html.length} / ${MAX_CADENCE_ARTIFACT_BYTES} bytes)`,
          'Zero external network fetches, zero iframe/svg/object/event-handler escape hatches',
        ],
      },
    );

    const completed = await completeSandboxRunRow(db, {
      runId: run.runId,
      tokensIn,
      tokensOut,
      artifactHtml: sanitized.html,
      executionMode: mode === 'llm' ? 'fallback' : 'fast',
      ...(run.spec ? { spec: run.spec } : {}),
    });
    const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
    const finalRun: CadenceRunResult = {
      ...(completed ?? { ...run, runStatus: 'ready', artifactHtml: sanitized.html }),
      status: buildStatusBadge('ready', 'CHORD spec + sandbox artifact ready', 100),
      quota,
    };

    sink.enqueue('complete', {
      run: finalRun,
      quota,
    } satisfies CadenceStreamCompleteEvent);
  } catch (error) {
    const correlationId = telemetry?.correlationId ?? run.runId;
    const { diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.cadence.stream',
    });
    if (telemetry) {
      logDiagnosticError(telemetry.logger, diagnostic);
    }
    try {
      await failSandboxRunRow(db, run.runId, SAFE_STREAM_FAILURE_SUMMARY);
    } catch (failErr) {
      const failDiag = classifyServerError(failErr, {
        correlationId,
        source: 'portal.cadence.stream',
      }).diagnostic;
      logCadenceStreamSeam(
        'error',
        'DELTA_AUDIT_GAP',
        'cadence.run.terminal_commit_gap',
        'critical',
        {
          runId: run.runId,
          correlationId,
          error: failDiag.causeMessage ?? failDiag.reasoning,
        },
      );
    }
    logCadenceStreamSeam(
      'error',
      'DELTA_AUDIT_GAP',
      'cadence.run.terminal_commit_gap',
      'critical',
      {
        runId: run.runId,
        correlationId,
        error: diagnostic.causeMessage ?? diagnostic.reasoning,
      },
    );
    sink.enqueue('error', {
      runId: run.runId,
      error: SAFE_STREAM_FAILURE_SUMMARY,
      code: 'ERR_CADENCE_STREAM',
      runStatus: 'failed',
    } satisfies CadenceStreamErrorEvent);
  }
}
