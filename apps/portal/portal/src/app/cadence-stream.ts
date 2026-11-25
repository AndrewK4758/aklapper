import {
  type CadenceGateVerdict,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceRunStreamSnapshot,
  createCadenceRunStreamStore,
} from '@aklapper/core';
import { useId, useState, useSyncExternalStore } from 'react';
import { type FetcherWithComponents, href } from 'react-router';

import type { PortalCadenceActionResult } from '#pages/cadence';

const NOOP_SUBSCRIBE = (): (() => void) => () => undefined;
const NULL_SNAPSHOT = (): CadenceRunStreamSnapshot | null => null;

// Client-only single-owner SSE auto-attach claim registry keyed by runId -> instanceId.
const activeAutoAttachedRunIds = new Map<string, string>();

export function resetCadenceAutoAttachRegistryForTest(): void {
  activeAutoAttachedRunIds.clear();
}

function canClaimAutoAttachRun(runId: string, instanceId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const existingOwner = activeAutoAttachedRunIds.get(runId);
  return existingOwner === undefined || existingOwner === instanceId;
}

function tryClaimAutoAttachRun(runId: string, instanceId: string): boolean {
  if (!canClaimAutoAttachRun(runId, instanceId)) {
    return false;
  }
  activeAutoAttachedRunIds.set(runId, instanceId);
  return true;
}

function releaseAutoAttachRunClaim(runId: string, instanceId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (activeAutoAttachedRunIds.get(runId) === instanceId) {
    activeAutoAttachedRunIds.delete(runId);
  }
}

interface ClaimedCadenceStreamStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => CadenceRunStreamSnapshot | null;
  readonly getServerSnapshot: () => CadenceRunStreamSnapshot | null;
  readonly close: () => void;
}

function createClaimedCadenceStreamStore(options: {
  readonly runId: string;
  readonly initialRun: CadenceRunResult;
  readonly instanceId: string;
  readonly eventSourceFactory?: (url: string) => EventSource;
}): ClaimedCadenceStreamStore {
  const inner = createCadenceRunStreamStore({
    runId: options.runId,
    initialRun: options.initialRun,
    ...(options.eventSourceFactory ? { eventSourceFactory: options.eventSourceFactory } : {}),
  });
  let claimDenied = false;
  const release = () => {
    releaseAutoAttachRunClaim(options.runId, options.instanceId);
  };
  return {
    subscribe: listener => {
      if (!tryClaimAutoAttachRun(options.runId, options.instanceId)) {
        claimDenied = true;
        listener();
        return () => undefined;
      }
      claimDenied = false;
      const unsubscribe = inner.subscribe(() => {
        const snap = inner.getSnapshot();
        if (snap.connectionState === 'completed' || snap.connectionState === 'error') {
          release();
        }
        listener();
      });
      return () => {
        unsubscribe();
        release();
      };
    },
    getSnapshot: () => (claimDenied ? null : inner.getSnapshot()),
    getServerSnapshot: inner.getServerSnapshot,
    close: () => {
      inner.close();
      release();
    },
  };
}

function isStreamableRun(run: CadenceRunResult | undefined): run is CadenceRunResult {
  return Boolean(
    run &&
    (run.runStatus === 'pending' ||
      run.runStatus === 'running' ||
      run.runStatus === 'build_queued' ||
      run.runStatus === 'building'),
  );
}

function resolveStreamKey(run: CadenceRunResult): string {
  const stage = run.runStatus === 'build_queued' || run.runStatus === 'building' ? 'build' : 'spec';
  return `${run.runId}:${stage}`;
}

export interface CadencePaneActionAdapter {
  readonly data: PortalCadenceActionResult | undefined;
  readonly isSubmitting: boolean;
  readonly submit: (fields: Readonly<Record<string, string>>) => void;
}

export interface UseCadenceRunControllerOptions {
  readonly instanceId?: string;
  readonly recentRuns?: readonly CadenceRunResult[];
  readonly fetcher?: FetcherWithComponents<PortalCadenceActionResult>;
  readonly paneAction?: CadencePaneActionAdapter;
  readonly eventSourceFactory?: (url: string) => EventSource;
}

export interface CadenceRunController {
  readonly actionResult: PortalCadenceActionResult | undefined;
  readonly isSubmitting: boolean;
  readonly isStreaming: boolean;
  readonly streamLogs: readonly string[];
  readonly onRunBuild: (payload: {
    prompt: string;
    presetSlug: string;
    mode: CadenceRunMode;
  }) => void;
  readonly onApproveSpec: (runId: string) => void;
  readonly onGateVerdict: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
  readonly onReset: () => void;
}

export function useCadenceRunController({
  instanceId,
  recentRuns,
  fetcher,
  paneAction,
  eventSourceFactory,
}: UseCadenceRunControllerOptions): CadenceRunController {
  const generatedId = useId();
  const effectiveInstanceId = instanceId ?? generatedId;

  const tryCreateAutoAttachEntry = (
    run: CadenceRunResult | undefined,
  ): { readonly streamKey: string; readonly store: ClaimedCadenceStreamStore } | null => {
    if (!run || !canClaimAutoAttachRun(run.runId, effectiveInstanceId)) {
      return null;
    }
    return {
      streamKey: resolveStreamKey(run),
      store: createClaimedCadenceStreamStore({
        runId: run.runId,
        initialRun: run,
        instanceId: effectiveInstanceId,
        eventSourceFactory,
      }),
    };
  };

  const initialRecoverable = recentRuns?.find(isStreamableRun);
  const [syncedInitialRecentRuns, setSyncedInitialRecentRuns] = useState(
    () => recentRuns !== undefined,
  );
  const [initialClaimedEntry] = useState(() => tryCreateAutoAttachEntry(initialRecoverable));
  const [targetRun, setTargetRun] = useState<CadenceRunResult | undefined>(() =>
    initialClaimedEntry ? initialRecoverable : undefined,
  );
  const [lastActionData, setLastActionData] = useState<PortalCadenceActionResult | undefined>(
    undefined,
  );
  const [suppressedActionData, setSuppressedActionData] = useState<
    PortalCadenceActionResult | undefined
  >(undefined);
  const [streamEntry, setStreamEntry] = useState<{
    readonly streamKey: string;
    readonly store: ClaimedCadenceStreamStore;
  } | null>(() => initialClaimedEntry);

  const actionData = paneAction ? paneAction.data : fetcher?.data;
  const isSubmitting = paneAction ? paneAction.isSubmitting : fetcher?.state !== 'idle';

  const submitFields = (fields: Record<string, string>) => {
    if (paneAction) {
      paneAction.submit(fields);
      return;
    }
    void fetcher?.submit(fields, { method: 'post', action: href('/cadence') });
  };

  // React render-time sync with zero useEffect.
  if (!syncedInitialRecentRuns && recentRuns !== undefined) {
    setSyncedInitialRecentRuns(true);
    if (!actionData && !targetRun && streamEntry === null) {
      const lateRecoverable = recentRuns.find(isStreamableRun);
      const claimed = tryCreateAutoAttachEntry(lateRecoverable);
      if (lateRecoverable && claimed) {
        setTargetRun(lateRecoverable);
        setStreamEntry(claimed);
      }
    }
  } else if (actionData && actionData !== lastActionData) {
    setLastActionData(actionData);
    if (
      actionData.ok &&
      (actionData.intent === 'run-init' || actionData.intent === 'spec-approve') &&
      isStreamableRun(actionData.run)
    ) {
      const nextKey = resolveStreamKey(actionData.run);
      setTargetRun(actionData.run);
      if (streamEntry?.streamKey !== nextKey) {
        streamEntry?.store.close();
        setStreamEntry({
          streamKey: nextKey,
          store: createClaimedCadenceStreamStore({
            runId: actionData.run.runId,
            initialRun: actionData.run,
            instanceId: effectiveInstanceId,
            eventSourceFactory,
          }),
        });
      }
    } else if (
      actionData.ok &&
      (actionData.intent === 'run' || actionData.intent === 'gate' || actionData.intent === 'reset')
    ) {
      setTargetRun(undefined);
      if (streamEntry !== null) {
        streamEntry.store.close();
        setStreamEntry(null);
      }
    }
  } else if (targetRun && streamEntry?.streamKey !== resolveStreamKey(targetRun)) {
    streamEntry?.store.close();
    setStreamEntry({
      streamKey: resolveStreamKey(targetRun),
      store: createClaimedCadenceStreamStore({
        runId: targetRun.runId,
        initialRun: targetRun,
        instanceId: effectiveInstanceId,
        eventSourceFactory,
      }),
    });
  }

  const streamSnapshot = useSyncExternalStore<CadenceRunStreamSnapshot | null>(
    streamEntry ? streamEntry.store.subscribe : NOOP_SUBSCRIBE,
    streamEntry ? streamEntry.store.getSnapshot : NULL_SNAPSHOT,
    streamEntry ? streamEntry.store.getServerSnapshot : NULL_SNAPSHOT,
  );

  const isStreaming =
    streamSnapshot !== null &&
    (streamSnapshot.connectionState === 'connecting' ||
      streamSnapshot.connectionState === 'streaming');

  const visibleActionData = actionData === suppressedActionData ? undefined : actionData;
  let actionResult: PortalCadenceActionResult | undefined = visibleActionData;
  if (streamSnapshot && !(visibleActionData && !visibleActionData.ok)) {
    if (streamSnapshot.error) {
      actionResult = {
        ok: false,
        intent: 'run',
        error: streamSnapshot.error,
        run: streamSnapshot.run,
        ...(streamSnapshot.quota ? { quota: streamSnapshot.quota } : {}),
      };
    } else if (visibleActionData?.ok && visibleActionData.intent === 'gate') {
      actionResult = visibleActionData;
    } else {
      const activeStreamPhase =
        streamSnapshot.run.runStatus === 'pending' ||
        streamSnapshot.run.runStatus === 'running' ||
        streamSnapshot.run.runStatus === 'build_queued' ||
        streamSnapshot.run.runStatus === 'building';
      actionResult = {
        ok: true,
        intent: activeStreamPhase ? 'run-init' : 'run',
        run: streamSnapshot.run,
        ...(streamSnapshot.quota ? { quota: streamSnapshot.quota } : {}),
      };
    }
  }

  return {
    actionResult,
    isSubmitting,
    isStreaming,
    streamLogs: streamSnapshot?.logs ?? [],
    onRunBuild: ({ prompt, presetSlug, mode }) => {
      submitFields({ intent: 'run', prompt, presetSlug, mode, requireSpecApproval: 'true' });
    },
    onApproveSpec: runId => {
      submitFields({ intent: 'spec-approve', runId });
    },
    onGateVerdict: ({ runId, verdict }) => {
      submitFields({ intent: 'gate', runId, verdict });
    },
    onReset: () => {
      streamEntry?.store.close();
      setStreamEntry(null);
      setTargetRun(undefined);
      setSuppressedActionData(actionData);
      submitFields({ intent: 'reset' });
    },
  };
}
