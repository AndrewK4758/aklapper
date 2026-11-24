import type {
  ContactActionResult,
  K8sPodEvent,
  PortalAgensiLoaderData,
  PortalAskLoaderData,
  PortalCadenceLoaderData,
  PortalContactLoaderData,
  PortalHomeContent,
  PortalMenuLoaderData,
} from '@aklapper/core';
import {
  Button,
  ErrorElement,
  LoadingElement,
  SuspenseElement,
  type TerminalPaneViewContext,
  TuiWindow,
} from '@aklapper/ui';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { href, useFetcher } from 'react-router';

import { PortalAgensiPage } from '#pages/agensi';
import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';
import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';
import { PortalContactPage } from '#pages/contact';
import { PortalLauncherTui } from '#pages/home';
import { PortalMenuPage } from '#pages/menu';

import { reportPortalPublicError } from './client-telemetry';
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

interface PaneStreamGateProps<T> {
  readonly routePath: PortalPaneRoute;
  readonly paneId: string;
  readonly title: string;
  readonly loadingLabel: string;
  readonly onExit: () => void;
  readonly children: (data: T) => ReactNode;
}

function PaneStreamGate<T>({
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
    void Promise.resolve(fetcher.load(`${routePath}?pane=1`)).finally(() => {
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
        {children}
      </SuspenseElement>
    );
  }

  const resolvedDirect = unwrapPaneLoaderData(rawData);
  if (resolvedDirect !== undefined) {
    return <>{children(resolvedDirect)}</>;
  }

  const returnedErrorEnvelope = isPaneLoaderErrorEnvelope(rawData);
  const hasError =
    fetcher.state === 'idle' &&
    (returnedErrorEnvelope || (settledAttempt > 0 && rawData === undefined));

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

interface PaneAdapterProps {
  readonly ctx: TerminalPaneViewContext;
  readonly deployments?: Readonly<Record<string, K8sPodEvent>>;
}

function PortalMenuPaneView({ ctx, deployments }: PaneAdapterProps) {
  return (
    <PaneStreamGate<PortalMenuLoaderData>
      routePath='/menu'
      paneId={ctx.paneId}
      title='Launch Menu'
      loadingLabel='Loading launch menu...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalMenuPage
          content={data.content}
          items={data.items}
          deployments={deployments}
          onNavigate={to => {
            if (to === '/') {
              ctx.exitTui();
            } else {
              ctx.push(to);
            }
          }}
        />
      )}
    </PaneStreamGate>
  );
}

function PortalAgensiPaneView({ ctx }: PaneAdapterProps) {
  return (
    <PaneStreamGate<PortalAgensiLoaderData>
      routePath='/agensi'
      paneId={ctx.paneId}
      title='Agensi Storefront'
      loadingLabel='Loading Agensi storefront...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalAgensiPage content={data.content} skills={data.skills} onClose={ctx.exitTui} />
      )}
    </PaneStreamGate>
  );
}

function PortalAskPaneView({ ctx }: PaneAdapterProps) {
  const submitFetcher = useFetcher<PortalAskActionResult>();
  return (
    <PaneStreamGate<PortalAskLoaderData>
      routePath='/ask'
      paneId={ctx.paneId}
      title='Ask Portfolio'
      loadingLabel='Loading portfolio Q&A...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalAskPage
          content={data.content}
          quota={data.quota}
          askStatus={data.askStatus}
          actionResult={submitFetcher.data}
          isSubmitting={submitFetcher.state !== 'idle'}
          onSubmitAsk={({ mode, text, attemptId }) => {
            void submitFetcher.submit(
              { mode, text, attemptId },
              { method: 'post', action: href('/ask') },
            );
          }}
          onClose={ctx.exitTui}
        />
      )}
    </PaneStreamGate>
  );
}

function PortalCadencePaneView({ ctx }: PaneAdapterProps) {
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
        <PortalCadencePage
          content={data.content}
          presets={data.presets}
          quota={data.quota}
          recentRuns={data.recentRuns}
          actionResult={submitFetcher.data}
          isSubmitting={submitFetcher.state !== 'idle'}
          onRunBuild={({ prompt, presetSlug }) => {
            void submitFetcher.submit(
              { intent: 'run', prompt, presetSlug },
              { method: 'post', action: href('/cadence') },
            );
          }}
          onGateVerdict={({ runId, verdict }) => {
            void submitFetcher.submit(
              { intent: 'gate', runId, verdict },
              { method: 'post', action: href('/cadence') },
            );
          }}
          onClose={ctx.exitTui}
        />
      )}
    </PaneStreamGate>
  );
}

function PortalContactPaneView({ ctx }: PaneAdapterProps) {
  const submitFetcher = useFetcher<ContactActionResult>();
  return (
    <PaneStreamGate<PortalContactLoaderData>
      routePath='/contact'
      paneId={ctx.paneId}
      title='Contact'
      loadingLabel='Loading contact channel...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalContactPage
          content={data.content}
          actionData={submitFetcher.data}
          isSubmitting={submitFetcher.state !== 'idle'}
          formAction={href('/contact')}
          onClose={ctx.exitTui}
          renderFormElement={({ action, className, onSubmit, children }) => (
            <submitFetcher.Form
              action={action}
              method='post'
              encType='multipart/form-data'
              noValidate
              className={className}
              onSubmit={onSubmit}
            >
              {children}
            </submitFetcher.Form>
          )}
        />
      )}
    </PaneStreamGate>
  );
}

function UnknownPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
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
      return <PortalMenuPaneView key={`${ctx.paneId}:/menu`} ctx={ctx} deployments={deployments} />;
    case '/agensi':
      return <PortalAgensiPaneView key={`${ctx.paneId}:/agensi`} ctx={ctx} />;
    case '/ask':
      return <PortalAskPaneView key={`${ctx.paneId}:/ask`} ctx={ctx} />;
    case '/cadence':
      return <PortalCadencePaneView key={`${ctx.paneId}:/cadence`} ctx={ctx} />;
    case '/contact':
      return <PortalContactPaneView key={`${ctx.paneId}:/contact`} ctx={ctx} />;
    default:
      return <UnknownPaneView ctx={ctx} />;
  }
}
