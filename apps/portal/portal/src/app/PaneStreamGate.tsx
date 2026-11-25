import type { K8sPodEvent } from '@aklapper/core';
import {
  Button,
  ErrorElement,
  LoadingElement,
  SuspenseElement,
  type TerminalPaneViewContext,
  TuiWindow,
} from '@aklapper/ui';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import { reportPortalClientError, reportPortalPublicError } from './client-telemetry';
import {
  isPaneLoaderErrorEnvelope,
  isStreamLoaderEnvelope,
  type PaneLoaderErrorEnvelope,
  type StreamLoaderEnvelope,
  unwrapPaneLoaderData,
} from './pane-loader';

export const PORTAL_PANE_ROUTES = ['/menu', '/agensi', '/ask', '/cadence', '/contact'] as const;
export type PortalPaneRoute = (typeof PORTAL_PANE_ROUTES)[number];
export type PortalPaneViewId = 'tui' | PortalPaneRoute;

export function isPortalPaneRoute(pathname: string): pathname is PortalPaneRoute {
  return (PORTAL_PANE_ROUTES as readonly string[]).includes(pathname);
}

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

export interface PaneAdapterProps {
  readonly ctx: TerminalPaneViewContext;
  readonly deployments?: Readonly<Record<string, K8sPodEvent>>;
}

interface PaneStatusFallbackProps {
  readonly title: string;
  readonly loadingLabel: string;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onExit: () => void;
}

function PaneStatusFallback({
  title,
  loadingLabel,
  isLoading,
  onRetry,
  onExit,
}: PaneStatusFallbackProps) {
  return (
    <TuiWindow title={title} onClose={onExit}>
      {isLoading ? (
        <LoadingElement label={loadingLabel} />
      ) : (
        <div role='alert'>
          <p>Unable to load {title}. Check your connection and try again.</p>
          <Button type='button' variant='primary' onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </TuiWindow>
  );
}

export interface PaneStreamGateProps<T> {
  readonly routePath: PortalPaneRoute;
  readonly paneId: string;
  readonly title: string;
  readonly loadingLabel: string;
  readonly onExit: () => void;
  readonly children: (data: T, rawEnvelope?: unknown) => ReactNode;
}

export function PaneStreamGate<T>({
  routePath,
  paneId,
  title,
  loadingLabel,
  onExit,
  children,
}: PaneStreamGateProps<T>) {
  const fetcher = useFetcher<StreamLoaderEnvelope<T> | T | PaneLoaderErrorEnvelope>();
  const [settledAttempt, setSettledAttempt] = useState(0);
  const initiatedRef = useRef(false);

  const triggerLoad = useCallback(() => {
    void Promise.resolve(fetcher.load(`${routePath}?pane=1`))
      .catch(() => undefined)
      .finally(() => {
        setSettledAttempt(c => c + 1);
      });
  }, [fetcher, routePath]);

  const rawData = fetcher.data as StreamLoaderEnvelope<T> | T | PaneLoaderErrorEnvelope | undefined;

  useEffect(() => {
    if (!initiatedRef.current && fetcher.state === 'idle' && rawData === undefined) {
      initiatedRef.current = true;
      triggerLoad();
    }
  }, [fetcher.state, rawData, triggerLoad]);

  if (isStreamLoaderEnvelope<T>(rawData)) {
    return (
      <SuspenseElement<T>
        resolve={rawData.payload}
        correlationId={rawData.correlationId}
        homeHref=''
        loading={
          <TuiWindow title={title} onClose={onExit}>
            <LoadingElement label={loadingLabel} />
          </TuiWindow>
        }
        onStreamError={error => {
          reportPortalPublicError(error, { phase: 'stream', pathname: routePath });
          console.error(
            JSON.stringify({
              event: 'portal.pane_nav.fetcher_load_failed',
              routePath,
              paneId,
              code: error.code,
              correlationId: error.correlationId,
            }),
          );
        }}
        errorElement={error => (
          <TuiWindow title={title} onClose={onExit}>
            <ErrorElement
              error={error}
              onRetry={triggerLoad}
              isRetrying={fetcher.state !== 'idle'}
              homeHref=''
            />
          </TuiWindow>
        )}
      >
        {data => children(data, rawData)}
      </SuspenseElement>
    );
  }

  const resolvedDirect = unwrapPaneLoaderData(rawData);
  if (resolvedDirect !== undefined) {
    return <>{children(resolvedDirect, rawData)}</>;
  }

  const returnedErrorEnvelope = isPaneLoaderErrorEnvelope(rawData);
  const hasError =
    fetcher.state === 'idle' &&
    (returnedErrorEnvelope || (settledAttempt > 0 && rawData === undefined));

  if (hasError) {
    const fallbackReason = returnedErrorEnvelope ? 'loader_error_envelope' : 'transport_failure';
    emitPaneTelemetryOnce(
      `fallback:${paneId}:${routePath}:${fallbackReason}:${settledAttempt}`,
      () => {
        console.error(
          JSON.stringify({
            event: 'portal.pane_nav.fetcher_load_failed',
            routePath,
            paneId,
            reason: fallbackReason,
          }),
        );
        reportPortalClientError(
          new Error(
            returnedErrorEnvelope
              ? 'Pane loader returned an error envelope.'
              : 'Pane fetcher transport failure.',
          ),
          {
            phase: 'boundary',
            pathname: routePath,
            errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
          },
        );
      },
    );
  }

  return (
    <PaneStatusFallback
      title={title}
      loadingLabel={loadingLabel}
      isLoading={!hasError}
      onRetry={triggerLoad}
      onExit={onExit}
    />
  );
}
