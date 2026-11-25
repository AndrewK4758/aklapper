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
  readonly ownerInstanceId?: string;
}

export function matchesPersistedAskTurnOwner(
  turn: PersistedAskTurn | null,
  instanceId?: string,
): turn is PersistedAskTurn {
  if (!turn) return false;
  if (!turn.ownerInstanceId || !instanceId) return true;
  return turn.ownerInstanceId === instanceId;
}

export interface PendingAskTurnSummary {
  readonly hasPendingTurn: boolean;
  readonly attemptId: string | undefined;
  readonly mode: AskMode | undefined;
  readonly submittedText: string | undefined;
  readonly pollImmediately: boolean;
}

export function resolvePendingAskTurn(input: {
  readonly pendingActionResult:
    | Extract<PortalAskActionResult, { readonly pending: true }>
    | undefined;
  readonly persistedTurn: PersistedAskTurn | null;
  readonly instanceId?: string;
  readonly dispatchedAttemptId: string | null;
  readonly settledPendingAttemptIds: ReadonlySet<string>;
  readonly isSubmitting: boolean;
  readonly hasActiveStream: boolean;
  readonly actionSettled: boolean;
}): PendingAskTurnSummary {
  const { pendingActionResult, persistedTurn, instanceId } = input;
  const isRecovered =
    matchesPersistedAskTurnOwner(persistedTurn, instanceId) &&
    persistedTurn.attemptId !== input.dispatchedAttemptId &&
    !input.settledPendingAttemptIds.has(persistedTurn.attemptId) &&
    !input.isSubmitting &&
    !input.hasActiveStream &&
    !input.actionSettled;
  if (pendingActionResult) {
    return {
      hasPendingTurn: true,
      attemptId: pendingActionResult.attemptId,
      mode: pendingActionResult.mode,
      submittedText: pendingActionResult.submittedText,
      pollImmediately: false,
    };
  }
  if (isRecovered && persistedTurn) {
    return {
      hasPendingTurn: true,
      attemptId: persistedTurn.attemptId,
      mode: persistedTurn.mode,
      submittedText: persistedTurn.question,
      pollImmediately: true,
    };
  }
  return {
    hasPendingTurn: false,
    attemptId: undefined,
    mode: undefined,
    submittedText: undefined,
    pollImmediately: false,
  };
}

export type PollTurnOutcome =
  | { readonly kind: 'pending'; readonly state: AskTurnState }
  | { readonly kind: 'settled'; readonly state: AskTurnState }
  | ({
      readonly kind: 'error';
      readonly message: string;
      readonly quota?: QuotaStatus;
    } & ActionErrorMetadata);

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

export function resolveAskTurnStorageKey(ownerInstanceId?: string): string {
  return ownerInstanceId ? `${ASK_TURN_STORAGE_KEY}:${ownerInstanceId}` : ASK_TURN_STORAGE_KEY;
}

const storageListeners = new Set<() => void>();
const cachedSnapshots = new Map<
  string,
  { readonly rawKey: string; readonly parsed: PersistedAskTurn | null }
>();
const MAX_CACHED_TURN_STORES = 64;
const turnStores = new Map<
  string,
  {
    readonly subscribe: (listener: () => void) => () => void;
    readonly getSnapshot: () => PersistedAskTurn | null;
    readonly getServerSnapshot: () => null;
  }
>();
const NULL_ASK_TURN = (): null => null;

function notifyPersistedAskListeners(): void {
  cachedSnapshots.clear();
  for (const listener of storageListeners) listener();
}

function parsePersistedAskTurnRaw(raw: string | null): PersistedAskTurn | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAskTurn>;
    if (
      typeof parsed.attemptId !== 'string' ||
      parsed.attemptId.length === 0 ||
      (parsed.mode !== 'qa' && parsed.mode !== 'jd_match') ||
      typeof parsed.question !== 'string' ||
      parsed.question.length === 0
    ) {
      return null;
    }
    const ownerInstanceId =
      typeof parsed.ownerInstanceId === 'string' && parsed.ownerInstanceId.length > 0
        ? parsed.ownerInstanceId
        : undefined;
    return {
      attemptId: parsed.attemptId,
      mode: parsed.mode,
      question: parsed.question,
      ...(ownerInstanceId ? { ownerInstanceId } : {}),
    };
  } catch {
    return null;
  }
}

export function subscribePersistedAskTurn(
  listener: () => void,
  ownerInstanceId?: string,
): () => void {
  storageListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      storageListeners.delete(listener);
    };
  }
  const scopedKey = resolveAskTurnStorageKey(ownerInstanceId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === scopedKey || event.key === ASK_TURN_STORAGE_KEY || event.key === null) {
      cachedSnapshots.clear();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    storageListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function readPersistedAskTurn(ownerInstanceId?: string): PersistedAskTurn | null {
  if (typeof window === 'undefined') return null;
  const scope = ownerInstanceId ?? '';
  const scopedKey = resolveAskTurnStorageKey(ownerInstanceId);
  try {
    const scopedRaw = window.sessionStorage.getItem(scopedKey);
    const legacyRaw =
      ownerInstanceId && scopedRaw === null
        ? window.sessionStorage.getItem(ASK_TURN_STORAGE_KEY)
        : null;
    const rawKey = `${scopedRaw ?? ''}\0${legacyRaw ?? ''}`;
    const cached = cachedSnapshots.get(scope);
    if (cached?.rawKey === rawKey) return cached.parsed;
    let resolved = parsePersistedAskTurnRaw(scopedRaw);
    if (!resolved && ownerInstanceId && legacyRaw !== null) {
      const parsedLegacy = parsePersistedAskTurnRaw(legacyRaw);
      resolved = matchesPersistedAskTurnOwner(parsedLegacy, ownerInstanceId) ? parsedLegacy : null;
    }
    cachedSnapshots.set(scope, { rawKey, parsed: resolved });
    return resolved;
  } catch {
    cachedSnapshots.delete(scope);
    return null;
  }
}

export function getPersistedAskTurnStore(ownerInstanceId?: string) {
  const scope = ownerInstanceId ?? '';
  const existing = turnStores.get(scope);
  if (existing) return existing;
  const store = {
    subscribe: (listener: () => void) => subscribePersistedAskTurn(listener, ownerInstanceId),
    getSnapshot: () => readPersistedAskTurn(ownerInstanceId),
    getServerSnapshot: NULL_ASK_TURN,
  };
  if (turnStores.size >= MAX_CACHED_TURN_STORES) {
    const oldest = turnStores.keys().next().value;
    if (oldest !== undefined) turnStores.delete(oldest);
  }
  turnStores.set(scope, store);
  return store;
}

export function writePersistedAskTurn(turn: PersistedAskTurn): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      resolveAskTurnStorageKey(turn.ownerInstanceId),
      JSON.stringify(turn),
    );
  } catch {
    return;
  }
  notifyPersistedAskListeners();
}

export function clearPersistedAskTurn(ownerInstanceId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(resolveAskTurnStorageKey(ownerInstanceId));
    if (ownerInstanceId) {
      const legacy = parsePersistedAskTurnRaw(window.sessionStorage.getItem(ASK_TURN_STORAGE_KEY));
      if (legacy && matchesPersistedAskTurnOwner(legacy, ownerInstanceId)) {
        window.sessionStorage.removeItem(ASK_TURN_STORAGE_KEY);
      }
    }
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
      quota: parsedTurn.data.quota,
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
  readonly ownerInstanceId?: string;
  readonly intervalMs?: number;
  readonly onPending: (state: AskTurnState) => void;
  readonly onSettled: (state: AskTurnState) => void;
  readonly onError: (outcome: Extract<PollTurnOutcome, { readonly kind: 'error' }>) => void;
}

export function startAskTurnPolling(options: StartAskTurnPollingOptions): () => void {
  const {
    attemptId,
    pollImmediately,
    ownerInstanceId,
    intervalMs = 700,
    onPending,
    onSettled,
    onError,
  } = options;
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
      clearPersistedAskTurn(ownerInstanceId);
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
