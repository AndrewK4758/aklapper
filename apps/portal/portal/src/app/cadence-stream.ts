import {
  type CadenceGateVerdict,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceRunStreamSnapshot,
  type CadenceRunStreamStore,
  createCadenceRunStreamStore,
} from '@aklapper/core';
import { useState, useSyncExternalStore } from 'react';
import { type FetcherWithComponents, href } from 'react-router';

import type { PortalCadenceActionResult } from '#pages/cadence';

const NOOP_SUBSCRIBE = (): (() => void) => () => undefined;
const NULL_SNAPSHOT = (): CadenceRunStreamSnapshot | null => null;

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

export interface UseCadenceRunControllerOptions {
  readonly recentRuns?: readonly CadenceRunResult[];
  readonly fetcher: FetcherWithComponents<PortalCadenceActionResult>;
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
  recentRuns,
  fetcher,
  eventSourceFactory,
}: UseCadenceRunControllerOptions): CadenceRunController {
  const initialRecoverable = recentRuns?.find(isStreamableRun);
  const [syncedInitialRecentRuns, setSyncedInitialRecentRuns] = useState(
    () => recentRuns !== undefined,
  );
  const [targetRun, setTargetRun] = useState<CadenceRunResult | undefined>(initialRecoverable);
  const [lastFetcherData, setLastFetcherData] = useState<PortalCadenceActionResult | undefined>(
    undefined,
  );
  const [suppressedFetcherData, setSuppressedFetcherData] = useState<
    PortalCadenceActionResult | undefined
  >(undefined);
  const [streamEntry, setStreamEntry] = useState<{
    readonly streamKey: string;
    readonly store: CadenceRunStreamStore;
  } | null>(() =>
    initialRecoverable
      ? {
          streamKey: resolveStreamKey(initialRecoverable),
          store: createCadenceRunStreamStore({
            runId: initialRecoverable.runId,
            initialRun: initialRecoverable,
            ...(eventSourceFactory ? { eventSourceFactory } : {}),
          }),
        }
      : null,
  );

  // React render-time sync with zero useEffect.
  const fetcherData = fetcher.data;
  if (!syncedInitialRecentRuns && recentRuns !== undefined) {
    setSyncedInitialRecentRuns(true);
    if (!fetcherData && !targetRun && streamEntry === null) {
      const lateRecoverable = recentRuns.find(isStreamableRun);
      if (lateRecoverable) {
        setTargetRun(lateRecoverable);
        setStreamEntry({
          streamKey: resolveStreamKey(lateRecoverable),
          store: createCadenceRunStreamStore({
            runId: lateRecoverable.runId,
            initialRun: lateRecoverable,
            ...(eventSourceFactory ? { eventSourceFactory } : {}),
          }),
        });
      }
    }
  } else if (fetcherData && fetcherData !== lastFetcherData) {
    setLastFetcherData(fetcherData);
    if (
      fetcherData.ok &&
      (fetcherData.intent === 'run-init' || fetcherData.intent === 'spec-approve') &&
      isStreamableRun(fetcherData.run)
    ) {
      const nextKey = resolveStreamKey(fetcherData.run);
      setTargetRun(fetcherData.run);
      if (streamEntry?.streamKey !== nextKey) {
        setStreamEntry({
          streamKey: nextKey,
          store: createCadenceRunStreamStore({
            runId: fetcherData.run.runId,
            initialRun: fetcherData.run,
            ...(eventSourceFactory ? { eventSourceFactory } : {}),
          }),
        });
      }
    } else if (
      fetcherData.ok &&
      (fetcherData.intent === 'run' ||
        fetcherData.intent === 'gate' ||
        fetcherData.intent === 'reset')
    ) {
      setTargetRun(undefined);
      if (streamEntry !== null) {
        streamEntry.store.close();
        setStreamEntry(null);
      }
    }
  } else if (targetRun && streamEntry?.streamKey !== resolveStreamKey(targetRun)) {
    setStreamEntry({
      streamKey: resolveStreamKey(targetRun),
      store: createCadenceRunStreamStore({
        runId: targetRun.runId,
        initialRun: targetRun,
        ...(eventSourceFactory ? { eventSourceFactory } : {}),
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

  const visibleFetcherData = fetcherData === suppressedFetcherData ? undefined : fetcherData;
  let actionResult: PortalCadenceActionResult | undefined = visibleFetcherData;
  if (streamSnapshot && !(visibleFetcherData && !visibleFetcherData.ok)) {
    if (streamSnapshot.error) {
      actionResult = {
        ok: false,
        intent: 'run',
        error: streamSnapshot.error,
        run: streamSnapshot.run,
        ...(streamSnapshot.quota ? { quota: streamSnapshot.quota } : {}),
      };
    } else if (visibleFetcherData?.ok && visibleFetcherData.intent === 'gate') {
      actionResult = visibleFetcherData;
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
    isSubmitting: fetcher.state !== 'idle',
    isStreaming,
    streamLogs: streamSnapshot?.logs ?? [],
    onRunBuild: ({ prompt, presetSlug, mode }) => {
      void fetcher.submit(
        { intent: 'run', prompt, presetSlug, mode, requireSpecApproval: 'true' },
        { method: 'post', action: href('/cadence') },
      );
    },
    onApproveSpec: runId => {
      void fetcher.submit(
        { intent: 'spec-approve', runId },
        { method: 'post', action: href('/cadence') },
      );
    },
    onGateVerdict: ({ runId, verdict }) => {
      void fetcher.submit(
        { intent: 'gate', runId, verdict },
        { method: 'post', action: href('/cadence') },
      );
    },
    onReset: () => {
      streamEntry?.store.close();
      setStreamEntry(null);
      setTargetRun(undefined);
      setSuppressedFetcherData(fetcher.data);
      void fetcher.submit({ intent: 'reset' }, { method: 'post', action: href('/cadence') });
    },
  };
}
