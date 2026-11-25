import { type QuotaStatus } from './auth.ts';
import { type CadenceStreamLogEvent, CadenceStreamLogEventSchema } from './cadence-artifacts.ts';
import {
  type CadenceRunResult,
  type CadenceStreamCompleteEvent,
  CadenceStreamCompleteEventSchema,
  type CadenceStreamErrorEvent,
  CadenceStreamErrorEventSchema,
  type CadenceStreamPhaseEvent,
  CadenceStreamPhaseEventSchema,
  type CadenceTurn,
  type CadenceTurnPhase,
} from './portal.ts';

const MAX_STREAM_LOG_LINES = 200;

export type ParsedCadenceSseEvent =
  | { readonly type: 'phase'; readonly data: CadenceStreamPhaseEvent }
  | { readonly type: 'log'; readonly data: CadenceStreamLogEvent }
  | { readonly type: 'complete'; readonly data: CadenceStreamCompleteEvent }
  | { readonly type: 'error'; readonly data: CadenceStreamErrorEvent };

export type CadenceStreamConnectionState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'completed'
  | 'error';

export interface CadenceRunStreamSnapshot {
  readonly run: CadenceRunResult;
  readonly quota: QuotaStatus | null;
  readonly logs: readonly string[];
  readonly connectionState: CadenceStreamConnectionState;
  readonly error: string | null;
}

export interface CadenceRunStreamStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CadenceRunStreamSnapshot;
  getServerSnapshot: () => CadenceRunStreamSnapshot;
  close: () => void;
}

export interface CreateCadenceRunStreamStoreOptions {
  readonly runId: string;
  readonly initialRun: CadenceRunResult;
  readonly endpoint?: string;
  readonly eventSourceFactory?: (url: string) => EventSource;
}

const PHASE_ORDER: Readonly<Record<CadenceTurnPhase, number>> = {
  triage: 0,
  spec: 1,
  build: 2,
  gate: 3,
};

export function parseCadenceSseEvent(
  eventType: string,
  rawData: string,
): ParsedCadenceSseEvent | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawData);
  } catch {
    return null;
  }

  switch (eventType) {
    case 'phase': {
      const parsed = CadenceStreamPhaseEventSchema.safeParse(decoded);
      return parsed.success ? { type: 'phase', data: parsed.data } : null;
    }
    case 'log': {
      const parsed = CadenceStreamLogEventSchema.safeParse(decoded);
      return parsed.success ? { type: 'log', data: parsed.data } : null;
    }
    case 'complete': {
      const parsed = CadenceStreamCompleteEventSchema.safeParse(decoded);
      return parsed.success ? { type: 'complete', data: parsed.data } : null;
    }
    case 'error': {
      const parsed = CadenceStreamErrorEventSchema.safeParse(decoded);
      return parsed.success ? { type: 'error', data: parsed.data } : null;
    }
    default:
      return null;
  }
}

function upsertPhaseTurn(
  turns: readonly CadenceTurn[],
  incoming: CadenceTurn,
): readonly CadenceTurn[] {
  let replaced = false;
  const next = turns.map(turn => {
    if (turn.phase === incoming.phase) {
      replaced = true;
      return incoming;
    }
    return turn;
  });

  if (replaced) {
    return next;
  }

  return [...next, incoming].toSorted((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
}

function initialConnectionStateForRun(run: CadenceRunResult): CadenceStreamConnectionState {
  if (!run.runStatus || run.runStatus === 'ready') {
    return 'completed';
  }
  if (run.runStatus === 'failed') {
    return 'error';
  }
  return 'connecting';
}

export function createCadenceRunStreamStore(
  options: CreateCadenceRunStreamStoreOptions,
): CadenceRunStreamStore {
  const initialState = initialConnectionStateForRun(options.initialRun);
  const initialSnapshot: CadenceRunStreamSnapshot = {
    run: options.initialRun,
    quota: options.initialRun.quota ?? null,
    logs: [],
    connectionState: initialState,
    error: initialState === 'error' ? 'Run failed before artifact completion.' : null,
  };

  let currentSnapshot: CadenceRunStreamSnapshot = initialSnapshot;
  let eventSource: EventSource | null = null;
  let terminalReached = initialState === 'completed' || initialState === 'error';
  const listeners = new Set<() => void>();
  const endpoint =
    options.endpoint ?? `/api/cadence/runs/${encodeURIComponent(options.runId)}/stream`;

  const notifyListeners = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const close = (): void => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const commitSnapshot = (next: CadenceRunStreamSnapshot): void => {
    currentSnapshot = next;
    notifyListeners();
  };

  const handleNamedMessage = (eventType: string, rawData: unknown): void => {
    if (typeof rawData !== 'string') {
      return;
    }
    const parsed = parseCadenceSseEvent(eventType, rawData);
    if (!parsed) {
      return;
    }

    if (parsed.type === 'phase') {
      commitSnapshot({
        ...currentSnapshot,
        run: {
          ...currentSnapshot.run,
          runStatus: parsed.data.runStatus,
          status: parsed.data.status ?? currentSnapshot.run.status,
          turns: [...upsertPhaseTurn(currentSnapshot.run.turns, parsed.data.turn)],
        },
        connectionState: 'streaming',
        error: null,
      });
      return;
    }

    if (parsed.type === 'log') {
      const nextLogs = [...currentSnapshot.logs, parsed.data.line].slice(-MAX_STREAM_LOG_LINES);
      commitSnapshot({
        ...currentSnapshot,
        logs: nextLogs,
        connectionState: 'streaming',
        error: null,
      });
      return;
    }

    if (parsed.type === 'complete') {
      terminalReached = true;
      close();
      commitSnapshot({
        run: parsed.data.run,
        quota: parsed.data.quota ?? parsed.data.run.quota ?? currentSnapshot.quota,
        logs: currentSnapshot.logs,
        connectionState: 'completed',
        error: null,
      });
      return;
    }

    terminalReached = true;
    close();
    commitSnapshot({
      ...currentSnapshot,
      run: {
        ...currentSnapshot.run,
        runStatus: parsed.data.runStatus ?? 'failed',
      },
      connectionState: 'error',
      error: parsed.data.error,
    });
  };

  const ensureConnection = (): void => {
    if (terminalReached || eventSource) {
      return;
    }

    const factory =
      options.eventSourceFactory ??
      (typeof window !== 'undefined' && typeof EventSource !== 'undefined'
        ? (url: string) => new EventSource(url)
        : null);

    if (!factory) {
      return;
    }

    try {
      const source = factory(endpoint);
      eventSource = source;

      const onEvent = (type: string) => (ev: Event) => {
        const messageEvent = ev as Event & { readonly data?: unknown };
        handleNamedMessage(type, messageEvent.data);
      };

      source.addEventListener('phase', onEvent('phase'));
      source.addEventListener('log', onEvent('log'));
      source.addEventListener('complete', onEvent('complete'));
      source.addEventListener('error', onEvent('error'));

      source.onerror = () => {
        // Close immediately on terminal HTTP status or EOF so EventSource never spins.
        if (terminalReached) {
          close();
          return;
        }
        terminalReached = true;
        close();
        commitSnapshot({
          ...currentSnapshot,
          connectionState: 'error',
          error: 'Run stream interrupted. Reload or re-run to inspect progress.',
        });
      };
    } catch {
      eventSource = null;
      terminalReached = true;
      commitSnapshot({
        ...currentSnapshot,
        connectionState: 'error',
        error: 'Unable to open live CADENCE stream connection.',
      });
    }
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      ensureConnection();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        close();
      }
    };
  };

  return {
    subscribe,
    getSnapshot: () => currentSnapshot,
    getServerSnapshot: () => initialSnapshot,
    close,
  };
}
