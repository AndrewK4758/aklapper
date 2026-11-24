import {
  type ActionErrorMetadata,
  type AskMode,
  type AskResponse,
  type AskTurnState,
  AskTurnStateSchema,
  PublicAppErrorSchema,
  type QuotaStatus,
} from '@aklapper/core';

export const ASK_TURN_STORAGE_KEY = 'aklapper.portal.ask.activeTurn';

export type PortalAskActionResult =
  | {
      readonly ok: true;
      readonly pending?: false;
      readonly mode: AskMode;
      readonly submittedText: string;
      readonly attemptId?: string;
      readonly response: AskResponse;
    }
  | {
      readonly ok: true;
      readonly pending: true;
      readonly mode: AskMode;
      readonly submittedText: string;
      readonly attemptId: string;
      readonly turnState: AskTurnState;
    }
  | ({
      readonly ok: false;
      readonly mode: AskMode;
      readonly error: string;
      readonly quota?: QuotaStatus;
    } & ActionErrorMetadata);

export interface QaTranscriptEntry {
  readonly id: string;
  readonly question: string;
  readonly response: AskResponse;
}

export type RecoveredErrorState = {
  readonly ok: false;
  readonly mode: AskMode;
  readonly error: string;
} & ActionErrorMetadata;

export function isPendingAskResult(
  result: PortalAskActionResult | undefined,
): result is Extract<PortalAskActionResult, { readonly pending: true }> {
  return Boolean(result && result.ok && 'pending' in result && result.pending === true);
}

export function prependQaTranscriptEntry(
  prev: readonly QaTranscriptEntry[],
  id: string,
  question: string,
  response: AskResponse,
): readonly QaTranscriptEntry[] {
  return prev.some(item => item.id === id) ? prev : [{ id, question, response }, ...prev];
}

export interface PersistedAskTurn {
  readonly attemptId: string;
  readonly mode: AskMode;
  readonly question: string;
}

export type PollTurnOutcome =
  | { readonly kind: 'pending'; readonly state: AskTurnState }
  | { readonly kind: 'settled'; readonly state: AskTurnState }
  | ({ readonly kind: 'error'; readonly message: string } & ActionErrorMetadata);

export function generateAskAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '11111111-1111-4111-8111-111111111111';
}

export function buildRecoveringTurnState(attemptId: string, mode: AskMode): AskTurnState {
  const nowIso = new Date().toISOString();
  return {
    attemptId,
    status: 'running',
    mode,
    correlationId: 'recovering',
    leaseExpiresAt: nowIso,
    expiresAt: nowIso,
  };
}

const storageListeners = new Set<() => void>();
let cachedRawSnapshot: string | null | undefined;
let cachedParsedSnapshot: PersistedAskTurn | null = null;

function notifyPersistedAskListeners(): void {
  cachedRawSnapshot = undefined;
  for (const listener of storageListeners) {
    listener();
  }
}

export function subscribePersistedAskTurn(listener: () => void): () => void {
  storageListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      storageListeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === ASK_TURN_STORAGE_KEY || event.key === null) {
      cachedRawSnapshot = undefined;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    storageListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function readPersistedAskTurn(): PersistedAskTurn | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ASK_TURN_STORAGE_KEY);
    if (raw === cachedRawSnapshot) {
      return cachedParsedSnapshot;
    }
    cachedRawSnapshot = raw;
    if (!raw) {
      cachedParsedSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedAskTurn>;
    if (
      typeof parsed.attemptId === 'string' &&
      parsed.attemptId.length > 0 &&
      (parsed.mode === 'qa' || parsed.mode === 'jd_match') &&
      typeof parsed.question === 'string' &&
      parsed.question.length > 0
    ) {
      cachedParsedSnapshot = {
        attemptId: parsed.attemptId,
        mode: parsed.mode,
        question: parsed.question,
      };
      return cachedParsedSnapshot;
    }
    cachedParsedSnapshot = null;
    return null;
  } catch {
    cachedRawSnapshot = null;
    cachedParsedSnapshot = null;
    return null;
  }
}

export function writePersistedAskTurn(turn: PersistedAskTurn): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ASK_TURN_STORAGE_KEY, JSON.stringify(turn));
  } catch {
    return;
  }
  notifyPersistedAskListeners();
}

export function clearPersistedAskTurn(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ASK_TURN_STORAGE_KEY);
  } catch {
    return;
  }
  notifyPersistedAskListeners();
}

export async function pollAskTurnState(
  attemptId: string,
  signal: AbortSignal,
): Promise<PollTurnOutcome> {
  const response = await fetch(`/api/ask/turns/${encodeURIComponent(attemptId)}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });

  const rawBody = await response.json().catch(() => null);
  const parsedTurn = AskTurnStateSchema.safeParse(rawBody);
  if (parsedTurn.success) {
    if (parsedTurn.data.status === 'pending' || parsedTurn.data.status === 'running') {
      return { kind: 'pending', state: parsedTurn.data };
    }
    if (
      (parsedTurn.data.status === 'completed' || parsedTurn.data.status === 'abstained') &&
      parsedTurn.data.response
    ) {
      return { kind: 'settled', state: parsedTurn.data };
    }
    const turnErr = parsedTurn.data.error;
    return {
      kind: 'error',
      message: turnErr?.message ?? 'Ask request failed before completion.',
      code: turnErr?.code ?? 'ERR_UPSTREAM_UNAVAILABLE',
      action: turnErr?.action ?? 'Retry your question.',
      correlationId: turnErr?.correlationId ?? parsedTurn.data.correlationId,
    };
  }

  const parsedErr = PublicAppErrorSchema.safeParse(rawBody);
  if (parsedErr.success) {
    return {
      kind: 'error',
      message: parsedErr.data.message,
      code: parsedErr.data.code,
      action: parsedErr.data.action,
      correlationId: parsedErr.data.correlationId,
    };
  }

  return {
    kind: 'error',
    message: `Unable to recover active ask attempt (HTTP ${response.status}).`,
    code: response.status === 404 ? 'ERR_NOT_FOUND' : 'ERR_UPSTREAM_UNAVAILABLE',
    action: 'Submit your question again.',
  };
}

export interface StartAskTurnPollingOptions {
  readonly attemptId: string;
  readonly pollImmediately: boolean;
  readonly intervalMs?: number;
  readonly onPending: (state: AskTurnState) => void;
  readonly onSettled: (state: AskTurnState) => void;
  readonly onError: (outcome: Extract<PollTurnOutcome, { readonly kind: 'error' }>) => void;
}

export function startAskTurnPolling(options: StartAskTurnPollingOptions): () => void {
  const { attemptId, pollImmediately, intervalMs = 700, onPending, onSettled, onError } = options;
  const controller = new AbortController();
  let timerId: number | undefined;
  let cancelled = false;

  const scheduleNext = () => {
    timerId = window.setTimeout(() => {
      void pollOnce();
    }, intervalMs);
  };

  const pollOnce = async () => {
    try {
      const outcome = await pollAskTurnState(attemptId, controller.signal);
      if (cancelled) return;
      if (outcome.kind === 'pending') {
        onPending(outcome.state);
        scheduleNext();
        return;
      }
      clearPersistedAskTurn();
      if (outcome.kind === 'settled') {
        onSettled(outcome.state);
        return;
      }
      onError(outcome);
    } catch (err) {
      if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
      scheduleNext();
    }
  };

  if (pollImmediately) {
    void pollOnce();
  } else {
    scheduleNext();
  }

  return () => {
    cancelled = true;
    controller.abort();
    if (timerId !== undefined) window.clearTimeout(timerId);
  };
}
