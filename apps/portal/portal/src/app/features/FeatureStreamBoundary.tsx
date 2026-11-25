import type { StreamResult } from '@aklapper/core';
import {
  ErrorElement,
  LoadingElement,
  SuspenseElement,
  TuiWindow,
  usePaneNavigation,
} from '@aklapper/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { href, useNavigate } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import { type PaneStreamEntry, portalPaneStreamStore } from '../workspace/portalPaneStreamStore';
import { submitPortalPaneAction } from '../workspace/portalPaneTransport';
import type { PortalPaneRoute } from '../workspace/portalWorkspaceSnapshot';
import {
  createInvocationUnloadTracker,
  type InvocationUnloadTracker,
} from '../workspace/unloadGuard';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function isFailedActionResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'ok' in result &&
    (result as { readonly ok?: unknown }).ok === false
  );
}

export interface FeatureStreamBoundaryProps<T> {
  readonly mode: 'route' | 'pane';
  readonly routePath: PortalPaneRoute;
  readonly paneId?: string;
  readonly title: string;
  readonly loadingLabel: string;
  readonly correlationId: string;
  readonly resolve: Promise<StreamResult<T>>;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly onExit: () => void;
  readonly children: (data: T) => ReactNode;
}

export function usePrimaryRouteClose(): () => void {
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();
  return useCallback(() => {
    if (paneNav?.docked) {
      paneNav.exitTui();
    } else {
      void navigate(href('/'));
    }
  }, [navigate, paneNav]);
}

export function usePortalPaneStream<T>(
  paneId: string,
  routePath: PortalPaneRoute,
): {
  readonly entry: PaneStreamEntry<T>;
  readonly retry: () => void;
} {
  const subscribe = useCallback(
    (listener: () => void) => portalPaneStreamStore.subscribe(paneId, routePath, listener),
    [paneId, routePath],
  );
  const getSnapshot = useCallback(
    () => portalPaneStreamStore.getOrStart<T>(paneId, routePath),
    [paneId, routePath],
  );
  const getServerSnapshot = useCallback(
    () => portalPaneStreamStore.getServerSnapshot<T>(paneId, routePath),
    [paneId, routePath],
  );
  const entry = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const retry = useCallback(() => {
    portalPaneStreamStore.retry<T>(paneId, routePath);
  }, [paneId, routePath]);
  return { entry, retry };
}

export function usePaneActionSubmit<T>(routePath: PortalPaneRoute): {
  readonly actionData: T | undefined;
  readonly isSubmitting: boolean;
  readonly submit: (formData: FormData) => void;
} {
  const [actionData, setActionData] = useState<T | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const unloadRef = useRef<InvocationUnloadTracker | null>(null);

  useIsomorphicLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      unloadRef.current?.dispose();
      unloadRef.current = null;
    };
  }, []);

  const submit = useCallback(
    (formData: FormData) => {
      abortRef.current?.abort();
      unloadRef.current?.dispose();
      const controller = new AbortController();
      const unloadTracker = createInvocationUnloadTracker();
      abortRef.current = controller;
      unloadRef.current = unloadTracker;
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      setIsSubmitting(true);
      void submitPortalPaneAction<T>(routePath, formData, controller.signal)
        .then(result => {
          if (!mountedRef.current || seqRef.current !== seq) {
            return;
          }
          const unloading = unloadTracker.isUnloading();
          const failed = isFailedActionResult(result);
          if (failed && (controller.signal.aborted || unloading)) {
            setIsSubmitting(false);
            return;
          }
          setActionData(result);
          setIsSubmitting(false);
        })
        .catch(() => {
          if (mountedRef.current && seqRef.current === seq) {
            setIsSubmitting(false);
          }
        })
        .finally(() => {
          unloadTracker.dispose();
          if (unloadRef.current === unloadTracker) {
            unloadRef.current = null;
          }
        });
    },
    [routePath],
  );

  return { actionData, isSubmitting, submit };
}

export function FeatureStreamBoundary<T>({
  mode,
  routePath,
  paneId,
  title,
  loadingLabel,
  correlationId,
  resolve,
  retryNonce = 0,
  isRetrying = false,
  onRetry,
  onExit,
  children,
}: FeatureStreamBoundaryProps<T>) {
  if (mode === 'route') {
    return (
      <SuspenseElement<T>
        resolve={resolve}
        correlationId={correlationId}
        homeHref={href('/')}
        loadingLabel={loadingLabel}
        onStreamError={error => {
          reportPortalPublicError(error, { phase: 'stream', pathname: routePath });
        }}
      >
        {children}
      </SuspenseElement>
    );
  }

  return (
    <SuspenseElement<T>
      key={retryNonce}
      resolve={resolve}
      correlationId={correlationId}
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
            seamType: 'BOUNDARY_FAULT',
            routePath,
            paneId,
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
      errorElement={error => (
        <TuiWindow title={title} onClose={onExit}>
          <ErrorElement error={error} onRetry={onRetry} isRetrying={isRetrying} homeHref='' />
        </TuiWindow>
      )}
    >
      {children}
    </SuspenseElement>
  );
}
