import type { K8sPodEvent, PortalHomeContent } from '@aklapper/core';
import {
  Button,
  LazyChunkBoundary,
  LoadingElement,
  type TerminalPaneViewContext,
  TuiWindow,
} from '@aklapper/ui';
import { lazy, type ReactNode } from 'react';

import { PortalLauncherTui } from '#pages/home';

import { reportPortalClientError } from './client-telemetry';
import {
  emitPaneTelemetryOnce,
  isPortalPaneRoute,
  PORTAL_PANE_ROUTES,
  type PortalPaneRoute,
  type PortalPaneViewId,
} from './PaneStreamGate';

export { isPortalPaneRoute, PORTAL_PANE_ROUTES, type PortalPaneRoute, type PortalPaneViewId };

const LazyMenuPaneAdapter = lazy(() =>
  import('./pane-views/MenuPaneAdapter').then(mod => ({ default: mod.MenuPaneAdapter })),
);
const LazyAgensiPaneAdapter = lazy(() =>
  import('./pane-views/AgensiPaneAdapter').then(mod => ({ default: mod.AgensiPaneAdapter })),
);
const LazyAskPaneAdapter = lazy(() =>
  import('./pane-views/AskPaneAdapter').then(mod => ({ default: mod.AskPaneAdapter })),
);
const LazyCadencePaneAdapter = lazy(() =>
  import('./pane-views/CadencePaneAdapter').then(mod => ({ default: mod.CadencePaneAdapter })),
);
const LazyContactPaneAdapter = lazy(() =>
  import('./pane-views/ContactPaneAdapter').then(mod => ({ default: mod.ContactPaneAdapter })),
);

function reportLazyPaneChunkError(routePath: string, error: unknown): void {
  console.error(
    JSON.stringify({
      event: 'ui.lazy_chunk.load_failed',
      routePath,
    }),
  );
  reportPortalClientError(error, {
    phase: 'boundary',
    pathname: routePath,
    errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
  });
}

function LazyPaneSlot({
  routePath,
  title,
  loadingLabel,
  onExit,
  children,
}: {
  readonly routePath: PortalPaneRoute;
  readonly title: string;
  readonly loadingLabel: string;
  readonly onExit: () => void;
  readonly children: ReactNode;
}) {
  return (
    <LazyChunkBoundary
      loadingLabel={loadingLabel}
      errorTitle={`Unable to load ${title}`}
      fallback={
        <TuiWindow title={title} onClose={onExit}>
          <LoadingElement label={loadingLabel} />
        </TuiWindow>
      }
      onChunkError={error => reportLazyPaneChunkError(routePath, error)}
    >
      {children}
    </LazyChunkBoundary>
  );
}

function UnknownPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  emitPaneTelemetryOnce(`unknown:${ctx.paneId}:${ctx.viewId}`, () => {
    console.warn(
      JSON.stringify({
        event: 'portal.pane_nav.unknown_view_id',
        viewId: ctx.viewId,
        paneId: ctx.paneId,
      }),
    );
  });

  return (
    <TuiWindow title={ctx.viewId} onClose={ctx.exitTui}>
      <div role='alert'>
        <p>Unregistered view: {ctx.viewId}</p>
        <Button type='button' variant='default' onClick={ctx.exitTui}>
          Return to Terminal
        </Button>
      </div>
    </TuiWindow>
  );
}

export interface RenderPortalPaneViewOptions {
  readonly ctx: TerminalPaneViewContext;
  readonly homeContent?: PortalHomeContent;
  readonly deployments?: Readonly<Record<string, K8sPodEvent>>;
}

export function renderPortalPaneView({
  ctx,
  homeContent,
  deployments,
}: RenderPortalPaneViewOptions): ReactNode {
  switch (ctx.viewId) {
    case 'tui':
      return homeContent ? (
        <PortalLauncherTui
          content={homeContent}
          ttyNumber={ctx.ttyNumber}
          isSinglePane={ctx.isSinglePane}
          onClose={ctx.exitTui}
        />
      ) : (
        <UnknownPaneView ctx={ctx} />
      );
    case '/menu':
      return (
        <LazyPaneSlot
          key={`${ctx.paneId}:/menu`}
          routePath='/menu'
          title='Launch Menu'
          loadingLabel='Loading launch menu...'
          onExit={ctx.exitTui}
        >
          <LazyMenuPaneAdapter ctx={ctx} deployments={deployments} />
        </LazyPaneSlot>
      );
    case '/agensi':
      return (
        <LazyPaneSlot
          key={`${ctx.paneId}:/agensi`}
          routePath='/agensi'
          title='Agensi Storefront'
          loadingLabel='Loading Agensi storefront...'
          onExit={ctx.exitTui}
        >
          <LazyAgensiPaneAdapter ctx={ctx} />
        </LazyPaneSlot>
      );
    case '/ask':
      return (
        <LazyPaneSlot
          key={`${ctx.paneId}:/ask`}
          routePath='/ask'
          title='Ask Portfolio'
          loadingLabel='Loading portfolio Q&A...'
          onExit={ctx.exitTui}
        >
          <LazyAskPaneAdapter ctx={ctx} />
        </LazyPaneSlot>
      );
    case '/cadence':
      return (
        <LazyPaneSlot
          key={`${ctx.paneId}:/cadence`}
          routePath='/cadence'
          title='CADENCE Builder'
          loadingLabel='Loading sandbox builder...'
          onExit={ctx.exitTui}
        >
          <LazyCadencePaneAdapter ctx={ctx} />
        </LazyPaneSlot>
      );
    case '/contact':
      return (
        <LazyPaneSlot
          key={`${ctx.paneId}:/contact`}
          routePath='/contact'
          title='Contact'
          loadingLabel='Loading contact channel...'
          onExit={ctx.exitTui}
        >
          <LazyContactPaneAdapter ctx={ctx} />
        </LazyPaneSlot>
      );
    default:
      return <UnknownPaneView ctx={ctx} />;
  }
}
