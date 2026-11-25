import type { PortalCadenceLoaderData } from '@aklapper/core';
import type { TerminalPaneViewContext } from '@aklapper/ui';
import { useMemo } from 'react';
import { type FetcherWithComponents, useFetcher } from 'react-router';

import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';

import { type CadencePaneActionAdapter, useCadenceRunController } from '../cadence-stream';
import type { StreamLoaderEnvelope } from '../pane-loader';
import {
  FeatureStreamBoundary,
  usePaneActionSubmit,
  usePortalPaneStream,
  usePrimaryRouteClose,
} from './FeatureStreamBoundary';

interface CadenceLoadedBodyProps {
  readonly instanceId: string;
  readonly loadedData: PortalCadenceLoaderData;
  readonly fetcher?: FetcherWithComponents<PortalCadenceActionResult>;
  readonly paneAction?: CadencePaneActionAdapter;
  readonly onClose: () => void;
}

function CadenceLoadedBody({
  instanceId,
  loadedData,
  fetcher,
  paneAction,
  onClose,
}: CadenceLoadedBodyProps) {
  const controller = useCadenceRunController({
    instanceId,
    recentRuns: loadedData.recentRuns,
    fetcher,
    paneAction,
  });

  return (
    <PortalCadencePage
      content={loadedData.content}
      presets={loadedData.presets}
      quota={loadedData.quota}
      goldenRuns={loadedData.goldenRuns}
      recentRuns={loadedData.recentRuns}
      actionResult={controller.actionResult}
      isSubmitting={controller.isSubmitting}
      isStreaming={controller.isStreaming}
      streamLogs={controller.streamLogs}
      onRunBuild={controller.onRunBuild}
      onApproveSpec={controller.onApproveSpec}
      onGateVerdict={controller.onGateVerdict}
      onReset={controller.onReset}
      onClose={onClose}
    />
  );
}

export interface CadenceFeatureViewProps {
  readonly mode: 'route' | 'pane';
  readonly instanceId: string;
  readonly paneId?: string;
  readonly loaderData: StreamLoaderEnvelope<PortalCadenceLoaderData>;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly fetcher?: FetcherWithComponents<PortalCadenceActionResult>;
  readonly paneAction?: CadencePaneActionAdapter;
  readonly onClose: () => void;
}

export function CadenceFeatureView({
  mode,
  instanceId,
  paneId,
  loaderData,
  retryNonce,
  isRetrying,
  onRetry,
  fetcher,
  paneAction,
  onClose,
}: CadenceFeatureViewProps) {
  return (
    <FeatureStreamBoundary<PortalCadenceLoaderData>
      mode={mode}
      routePath='/cadence'
      paneId={paneId}
      title='CADENCE Builder'
      loadingLabel='Loading sandbox builder...'
      correlationId={loaderData.correlationId}
      resolve={loaderData.payload}
      retryNonce={retryNonce}
      isRetrying={isRetrying}
      onRetry={onRetry}
      onExit={onClose}
    >
      {loadedData => (
        <CadenceLoadedBody
          instanceId={instanceId}
          loadedData={loadedData}
          fetcher={fetcher}
          paneAction={paneAction}
          onClose={onClose}
        />
      )}
    </FeatureStreamBoundary>
  );
}

export function CadenceRouteView({
  loaderData,
}: {
  readonly loaderData: StreamLoaderEnvelope<PortalCadenceLoaderData>;
}) {
  const fetcher = useFetcher<PortalCadenceActionResult>();
  const onClose = usePrimaryRouteClose();

  return (
    <CadenceFeatureView
      mode='route'
      instanceId='primary:/cadence'
      loaderData={loaderData}
      fetcher={fetcher}
      onClose={onClose}
    />
  );
}

export function CadencePaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  const { entry, retry } = usePortalPaneStream<PortalCadenceLoaderData>(ctx.paneId, '/cadence');
  const paneSubmit = usePaneActionSubmit<PortalCadenceActionResult>('/cadence');

  const {
    actionData: paneActionData,
    isSubmitting: paneIsSubmitting,
    submit: submitPaneAction,
  } = paneSubmit;

  const paneAction = useMemo<CadencePaneActionAdapter>(
    () => ({
      data: paneActionData,
      isSubmitting: paneIsSubmitting,
      submit: fields => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) {
          formData.set(key, value);
        }
        submitPaneAction(formData);
      },
    }),
    [paneActionData, paneIsSubmitting, submitPaneAction],
  );

  return (
    <CadenceFeatureView
      mode='pane'
      instanceId={`pane:${ctx.paneId}`}
      paneId={ctx.paneId}
      loaderData={{ correlationId: entry.correlationId, payload: entry.payload }}
      retryNonce={entry.retryNonce}
      isRetrying={entry.status === 'loading' && entry.retryNonce > 0}
      onRetry={retry}
      paneAction={paneAction}
      onClose={ctx.exitTui}
    />
  );
}
