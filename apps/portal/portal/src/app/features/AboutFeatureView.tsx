import type { PortalAboutLoaderData } from '@aklapper/core';
import type { TerminalPaneViewContext } from '@aklapper/ui';

import { PortalAboutPage } from '#pages/about';

import type { StreamLoaderEnvelope } from '../pane-loader';
import {
  FeatureStreamBoundary,
  usePortalPaneStream,
  usePrimaryRouteClose,
} from './FeatureStreamBoundary';

export interface AboutFeatureViewProps {
  readonly mode: 'route' | 'pane';
  readonly loaderData: StreamLoaderEnvelope<PortalAboutLoaderData>;
  readonly paneId?: string;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly onClose: () => void;
}

export function AboutFeatureView({
  mode,
  loaderData,
  paneId,
  retryNonce,
  isRetrying,
  onRetry,
  onClose,
}: AboutFeatureViewProps) {
  return (
    <FeatureStreamBoundary<PortalAboutLoaderData>
      mode={mode}
      routePath='/about'
      paneId={paneId}
      title='About Andrew Klapper'
      loadingLabel='Loading resume & services guide...'
      correlationId={loaderData.correlationId}
      resolve={loaderData.payload}
      retryNonce={retryNonce}
      isRetrying={isRetrying}
      onRetry={onRetry}
      onExit={onClose}
    >
      {({ content, dossiers, brandContactEmail }) => (
        <PortalAboutPage
          content={content}
          dossiers={dossiers}
          brandContactEmail={brandContactEmail}
          onClose={onClose}
        />
      )}
    </FeatureStreamBoundary>
  );
}

export function AboutRouteView({
  loaderData,
}: {
  readonly loaderData: StreamLoaderEnvelope<PortalAboutLoaderData>;
}) {
  const onClose = usePrimaryRouteClose();
  return <AboutFeatureView mode='route' loaderData={loaderData} onClose={onClose} />;
}

export function AboutPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  const { entry, retry } = usePortalPaneStream<PortalAboutLoaderData>(ctx.paneId, '/about');
  return (
    <AboutFeatureView
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
