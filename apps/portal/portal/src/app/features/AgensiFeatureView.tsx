import type { PortalAgensiLoaderData } from '@aklapper/core';
import type { TerminalPaneViewContext } from '@aklapper/ui';

import { PortalAgensiPage } from '#pages/agensi';

import type { StreamLoaderEnvelope } from '../pane-loader';
import {
  FeatureStreamBoundary,
  usePortalPaneStream,
  usePrimaryRouteClose,
} from './FeatureStreamBoundary';

export interface AgensiFeatureViewProps {
  readonly mode: 'route' | 'pane';
  readonly loaderData: StreamLoaderEnvelope<PortalAgensiLoaderData>;
  readonly paneId?: string;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly onClose: () => void;
}

export function AgensiFeatureView({
  mode,
  loaderData,
  paneId,
  retryNonce,
  isRetrying,
  onRetry,
  onClose,
}: AgensiFeatureViewProps) {
  return (
    <FeatureStreamBoundary<PortalAgensiLoaderData>
      mode={mode}
      routePath='/agensi'
      paneId={paneId}
      title='Agensi Storefront'
      loadingLabel='Loading Agensi storefront...'
      correlationId={loaderData.correlationId}
      resolve={loaderData.payload}
      retryNonce={retryNonce}
      isRetrying={isRetrying}
      onRetry={onRetry}
      onExit={onClose}
    >
      {({ content, skills, catalogMeta }) => (
        <PortalAgensiPage
          content={content}
          skills={skills}
          catalogMeta={catalogMeta}
          onClose={onClose}
        />
      )}
    </FeatureStreamBoundary>
  );
}

export function AgensiRouteView({
  loaderData,
}: {
  readonly loaderData: StreamLoaderEnvelope<PortalAgensiLoaderData>;
}) {
  const onClose = usePrimaryRouteClose();
  return <AgensiFeatureView mode='route' loaderData={loaderData} onClose={onClose} />;
}

export function AgensiPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  const { entry, retry } = usePortalPaneStream<PortalAgensiLoaderData>(ctx.paneId, '/agensi');
  return (
    <AgensiFeatureView
      mode='pane'
      paneId={ctx.paneId}
      loaderData={{ correlationId: entry.correlationId, payload: entry.payload }}
      retryNonce={entry.retryNonce}
      isRetrying={entry.status === 'loading' && entry.retryNonce > 0}
      onRetry={retry}
      onClose={ctx.exitTui}
    />
  );
}
