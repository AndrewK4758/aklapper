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
  return Boolean(run && (run.runStatus === 'pending' || run.runStatus === 'running'));
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
  readonly onGateVerdict: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
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
  const [streamEntry, setStreamEntry] = useState<{
    readonly runId: string;
    readonly store: CadenceRunStreamStore;
  } | null>(() =>
    initialRecoverable
      ? {
          runId: initialRecoverable.runId,
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
          runId: lateRecoverable.runId,
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
    if (fetcherData.ok && fetcherData.intent === 'run-init' && isStreamableRun(fetcherData.run)) {
      setTargetRun(fetcherData.run);
      if (streamEntry?.runId !== fetcherData.run.runId) {
        setStreamEntry({
          runId: fetcherData.run.runId,
          store: createCadenceRunStreamStore({
            runId: fetcherData.run.runId,
            initialRun: fetcherData.run,
            ...(eventSourceFactory ? { eventSourceFactory } : {}),
          }),
        });
      }
    } else if (fetcherData.ok && (fetcherData.intent === 'run' || fetcherData.intent === 'gate')) {
      setTargetRun(undefined);
      if (streamEntry !== null) {
        setStreamEntry(null);
      }
    }
  } else if (targetRun && streamEntry?.runId !== targetRun.runId) {
    setStreamEntry({
      runId: targetRun.runId,
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

  let actionResult: PortalCadenceActionResult | undefined = fetcherData;
  if (streamSnapshot && !(fetcherData && !fetcherData.ok)) {
    if (streamSnapshot.error) {
      actionResult = {
        ok: false,
        intent: 'run',
        error: streamSnapshot.error,
        run: streamSnapshot.run,
        ...(streamSnapshot.quota ? { quota: streamSnapshot.quota } : {}),
      };
    } else if (fetcherData?.ok && fetcherData.intent === 'gate') {
      actionResult = fetcherData;
    } else {
      actionResult = {
        ok: true,
        intent:
          streamSnapshot.run.runStatus === 'pending' || streamSnapshot.run.runStatus === 'running'
            ? 'run-init'
            : 'run',
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
        { intent: 'run', prompt, presetSlug, mode },
        { method: 'post', action: href('/cadence') },
      );
    },
    onGateVerdict: ({ runId, verdict }) => {
      void fetcher.submit(
        { intent: 'gate', runId, verdict },
        { method: 'post', action: href('/cadence') },
      );
    },
  };
}
