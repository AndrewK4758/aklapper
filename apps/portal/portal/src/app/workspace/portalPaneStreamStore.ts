import type { StreamResult } from '@aklapper/core';

import {
  createTransportPublicError,
  generateClientCorrelationId,
  getActivePaneTransport,
  type PaneLoadedEnvelope,
  type PaneStreamTransport,
  resetGuestSessionBarrierForTest,
  setActivePaneTransportForTest,
  settleEnvelopeStreams,
} from './portalPaneTransport';
import type { PortalPaneRoute, PortalPaneViewRef } from './portalWorkspaceSnapshot';

export const MAX_CACHED_PANE_ENVELOPES = 32;

const PANE_TELEMETRY_DEDUP_MS = 5_000;
const MAX_PANE_TELEMETRY_ENTRIES = 128;
const recentPaneTelemetry = new Map<string, number>();

export function emitPaneTelemetryOnce(key: string, emit: () => void): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const prev = recentPaneTelemetry.get(key);
  if (prev !== undefined && now - prev < PANE_TELEMETRY_DEDUP_MS) {
    return;
  }
  if (recentPaneTelemetry.size >= MAX_PANE_TELEMETRY_ENTRIES) {
    for (const [entryKey, ts] of recentPaneTelemetry) {
      if (now - ts >= PANE_TELEMETRY_DEDUP_MS) {
        recentPaneTelemetry.delete(entryKey);
      }
    }
    if (recentPaneTelemetry.size >= MAX_PANE_TELEMETRY_ENTRIES) {
      const oldestKey = recentPaneTelemetry.keys().next().value;
      if (oldestKey !== undefined) recentPaneTelemetry.delete(oldestKey);
    }
  }
  recentPaneTelemetry.set(key, now);
  emit();
}

export function resetPaneTelemetryDedupForTest(): void {
  recentPaneTelemetry.clear();
}

export interface PaneStreamEntry<T = unknown> {
  readonly key: string;
  readonly paneId: string;
  readonly routePath: PortalPaneRoute;
  readonly retryNonce: number;
  readonly status: 'loading' | 'ready';
  readonly correlationId: string;
  readonly envelope: PaneLoadedEnvelope<T> | null;
  readonly payload: Promise<StreamResult<T>>;
}

export interface CreatePortalPaneStreamStoreOptions {
  readonly getTransport?: () => PaneStreamTransport;
  readonly maxEntries?: number;
}

export interface PortalPaneStreamStore {
  readonly getServerSnapshot: <T = unknown>(
    paneId: string,
    routePath: PortalPaneRoute,
  ) => PaneStreamEntry<T>;
  readonly prewarm: <T = unknown>(paneId: string, routePath: PortalPaneRoute) => PaneStreamEntry<T>;
  readonly getOrStart: <T = unknown>(
    paneId: string,
    routePath: PortalPaneRoute,
  ) => PaneStreamEntry<T>;
  readonly retry: <T = unknown>(paneId: string, routePath: PortalPaneRoute) => PaneStreamEntry<T>;
  readonly subscribe: (
    paneId: string,
    routePath: PortalPaneRoute,
    listener: () => void,
  ) => () => void;
  readonly evictPane: (paneId: string) => void;
  readonly evictPaneViews: (views: readonly PortalPaneViewRef[]) => void;
  readonly setTransportForTest: (transport: PaneStreamTransport | null) => void;
  readonly resetForTest: () => void;
}

interface PaneStreamRecord {
  readonly controller: AbortController;
  renderAccessed: boolean;
  entry: PaneStreamEntry<unknown>;
}

const NEVER_SETTLED_PAYLOAD: Promise<StreamResult<never>> = new Promise(() => undefined);
const SERVER_PLACEHOLDER_CACHE = new Map<string, PaneStreamEntry<unknown>>();

function buildKey(paneId: string, routePath: PortalPaneRoute): string {
  return `${paneId}:${routePath}`;
}

function getImmutableServerEntry<T>(
  paneId: string,
  routePath: PortalPaneRoute,
): PaneStreamEntry<T> {
  const key = buildKey(paneId, routePath);
  const cached = SERVER_PLACEHOLDER_CACHE.get(key);
  if (cached) {
    return cached as PaneStreamEntry<T>;
  }
  const entry: PaneStreamEntry<unknown> = Object.freeze({
    key,
    paneId,
    routePath,
    retryNonce: 0,
    status: 'loading',
    correlationId: 'ssr-pane-pending',
    envelope: null,
    payload: NEVER_SETTLED_PAYLOAD,
  });
  if (SERVER_PLACEHOLDER_CACHE.size < MAX_CACHED_PANE_ENVELOPES) {
    SERVER_PLACEHOLDER_CACHE.set(key, entry);
  }
  return entry as PaneStreamEntry<T>;
}

export function createPortalPaneStreamStore(
  options: CreatePortalPaneStreamStoreOptions = {},
): PortalPaneStreamStore {
  const maxEntries = options.maxEntries ?? MAX_CACHED_PANE_ENVELOPES;
  const resolveTransport = (): PaneStreamTransport =>
    options.getTransport ? options.getTransport() : getActivePaneTransport();

  const records = new Map<string, PaneStreamRecord>();
  const listenersByKey = new Map<string, Set<() => void>>();

  const notifyKey = (key: string): void => {
    const set = listenersByKey.get(key);
    if (!set || set.size === 0) return;
    for (const listener of Array.from(set)) {
      listener();
    }
  };

  const emitSsrMutationBlocked = (method: string): void => {
    console.warn(
      JSON.stringify({
        event: 'portal.workspace.ssr_mutation_blocked',
        seamType: 'UNSOUND_CONDITION',
        store: 'portalPaneStreamStore',
        method,
      }),
    );
  };

  const enforceLruCap = (protectedKey?: string): void => {
    if (records.size <= maxEntries) return;
    for (const candidateKey of Array.from(records.keys())) {
      if (records.size <= maxEntries) break;
      if (candidateKey === protectedKey) continue;
      if ((listenersByKey.get(candidateKey)?.size ?? 0) > 0) continue;
      const oldest = records.get(candidateKey);
      if (!oldest || oldest.renderAccessed) continue;
      oldest.controller.abort();
      records.delete(candidateKey);
    }
  };

  const touchRecord = (key: string, record: PaneStreamRecord): void => {
    records.delete(key);
    records.set(key, record);
  };

  const startRecord = <T>(
    paneId: string,
    routePath: PortalPaneRoute,
    retryNonce: number,
    shouldNotify: boolean,
    renderAccessed: boolean,
  ): PaneStreamEntry<T> => {
    const key = buildKey(paneId, routePath);
    const existing = records.get(key);
    if (existing) {
      existing.controller.abort();
      records.delete(key);
    }

    const controller = new AbortController();
    const initialCorrelationId = generateClientCorrelationId();
    let loadPromise: Promise<PaneLoadedEnvelope<T>>;
    try {
      loadPromise = Promise.resolve(resolveTransport().load<T>(routePath, controller.signal));
    } catch (syncError) {
      loadPromise = Promise.reject(syncError);
    }

    const record: PaneStreamRecord = {
      controller,
      renderAccessed,
      entry: {
        key,
        paneId,
        routePath,
        retryNonce,
        status: 'loading',
        correlationId: initialCorrelationId,
        envelope: null,
        payload: NEVER_SETTLED_PAYLOAD,
      },
    };

    const payloadPromise: Promise<StreamResult<T>> = loadPromise.then(
      rawEnvelope => {
        const settledEnvelope = settleEnvelopeStreams(rawEnvelope);
        if (records.get(key) === record) {
          record.entry = {
            ...record.entry,
            status: 'ready',
            correlationId: settledEnvelope.correlationId,
            envelope: settledEnvelope,
          };
          notifyKey(key);
        }
        return settledEnvelope.payload as Promise<StreamResult<T>>;
      },
      (error: unknown) => {
        const publicError = createTransportPublicError({
          error,
          correlationId: initialCorrelationId,
        });
        const fallbackEnvelope: PaneLoadedEnvelope<T> = {
          correlationId: publicError.correlationId,
          payload: Promise.resolve<StreamResult<T>>({ ok: false, error: publicError }),
        };
        if (records.get(key) === record) {
          record.entry = {
            ...record.entry,
            status: 'ready',
            correlationId: publicError.correlationId,
            envelope: fallbackEnvelope,
          };
          notifyKey(key);
        }
        return { ok: false as const, error: publicError };
      },
    );
    void payloadPromise.catch(() => undefined);

    record.entry = {
      ...record.entry,
      payload: payloadPromise,
    };

    records.set(key, record);
    enforceLruCap(key);

    if (shouldNotify) {
      notifyKey(key);
    }
    return record.entry as PaneStreamEntry<T>;
  };

  const getOrStart = <T = unknown>(
    paneId: string,
    routePath: PortalPaneRoute,
  ): PaneStreamEntry<T> => {
    if (typeof window === 'undefined') {
      return getImmutableServerEntry<T>(paneId, routePath);
    }
    const key = buildKey(paneId, routePath);
    const existing = records.get(key);
    if (existing) {
      existing.renderAccessed = true;
      touchRecord(key, existing);
      return existing.entry as PaneStreamEntry<T>;
    }
    return startRecord<T>(paneId, routePath, 0, false, true);
  };

  const prewarm = <T = unknown>(paneId: string, routePath: PortalPaneRoute): PaneStreamEntry<T> => {
    if (typeof window === 'undefined') {
      emitSsrMutationBlocked('prewarm');
      return getImmutableServerEntry<T>(paneId, routePath);
    }
    const key = buildKey(paneId, routePath);
    const existing = records.get(key);
    if (existing) {
      touchRecord(key, existing);
      return existing.entry as PaneStreamEntry<T>;
    }
    return startRecord<T>(paneId, routePath, 0, false, false);
  };

  const retry = <T = unknown>(paneId: string, routePath: PortalPaneRoute): PaneStreamEntry<T> => {
    if (typeof window === 'undefined') {
      emitSsrMutationBlocked('retry');
      return getImmutableServerEntry<T>(paneId, routePath);
    }
    const key = buildKey(paneId, routePath);
    const existing = records.get(key);
    const prevNonce = existing?.entry.retryNonce ?? 0;
    return startRecord<T>(
      paneId,
      routePath,
      prevNonce + 1,
      true,
      existing?.renderAccessed ?? false,
    );
  };

  const subscribe = (
    paneId: string,
    routePath: PortalPaneRoute,
    listener: () => void,
  ): (() => void) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    const key = buildKey(paneId, routePath);
    let set = listenersByKey.get(key);
    if (!set) {
      set = new Set();
      listenersByKey.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        listenersByKey.delete(key);
        const record = records.get(key);
        if (record) {
          record.renderAccessed = false;
        }
        enforceLruCap();
      }
    };
  };

  const evictKey = (key: string): void => {
    const existing = records.get(key);
    if (!existing) return;
    existing.controller.abort();
    records.delete(key);
    // Do not notify subscribers on eviction: removed panes/views are unmounting,
    // and notifying while still mounted would re-trigger getOrStart() via useSyncExternalStore.
    listenersByKey.delete(key);
  };

  const evictPane = (paneId: string): void => {
    if (typeof window === 'undefined') {
      emitSsrMutationBlocked('evictPane');
      return;
    }
    const prefix = `${paneId}:`;
    for (const key of Array.from(records.keys())) {
      if (key.startsWith(prefix)) {
        evictKey(key);
      }
    }
  };

  const evictPaneViews = (views: readonly PortalPaneViewRef[]): void => {
    if (typeof window === 'undefined') {
      emitSsrMutationBlocked('evictPaneViews');
      return;
    }
    for (const view of views) {
      evictKey(buildKey(view.paneId, view.routePath));
    }
  };

  const setTransportForTest = (transport: PaneStreamTransport | null): void => {
    setActivePaneTransportForTest(transport);
  };

  const resetForTest = (): void => {
    for (const record of records.values()) {
      record.controller.abort();
    }
    records.clear();
    listenersByKey.clear();
    resetPaneTelemetryDedupForTest();
    resetGuestSessionBarrierForTest();
    setActivePaneTransportForTest(null);
  };

  return {
    getServerSnapshot: getImmutableServerEntry,
    prewarm,
    getOrStart,
    retry,
    subscribe,
    evictPane,
    evictPaneViews,
    setTransportForTest,
    resetForTest,
  };
}

export const portalPaneStreamStore: PortalPaneStreamStore = createPortalPaneStreamStore();
