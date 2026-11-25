import type { PortalCadenceLoaderData } from '@aklapper/core';
import { type FetcherWithComponents, useFetcher } from 'react-router';

import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';

import { useCadenceRunController } from '../cadence-stream';
import { type PaneAdapterProps, PaneStreamGate } from '../PaneStreamGate';

function PortalCadencePaneBody({
  data,
  submitFetcher,
  onClose,
}: {
  readonly data: PortalCadenceLoaderData;
  readonly submitFetcher: FetcherWithComponents<PortalCadenceActionResult>;
  readonly onClose: () => void;
}) {
  const controller = useCadenceRunController({
    recentRuns: data.recentRuns,
    fetcher: submitFetcher,
  });

  return (
    <PortalCadencePage
      content={data.content}
      presets={data.presets}
      quota={data.quota}
      goldenRuns={data.goldenRuns}
      recentRuns={data.recentRuns}
      actionResult={controller.actionResult}
      isSubmitting={controller.isSubmitting}
      isStreaming={controller.isStreaming}
      streamLogs={controller.streamLogs}
      onRunBuild={controller.onRunBuild}
      onApproveSpec={controller.onApproveSpec}
      onGateVerdict={controller.onGateVerdict}
      onClose={onClose}
    />
  );
}

export function CadencePaneAdapter({ ctx }: PaneAdapterProps) {
  const submitFetcher = useFetcher<PortalCadenceActionResult>();
  return (
    <PaneStreamGate<PortalCadenceLoaderData>
      routePath='/cadence'
      paneId={ctx.paneId}
      title='CADENCE Builder'
      loadingLabel='Loading sandbox builder...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalCadencePaneBody data={data} submitFetcher={submitFetcher} onClose={ctx.exitTui} />
      )}
    </PaneStreamGate>
  );
}
