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
import { Button, type TerminalPaneViewContext, TuiWindow } from '@aklapper/ui';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import { PortalAgensiPage } from '#pages/agensi';
import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';
import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';
import { PortalContactPage } from '#pages/contact';
import { PortalLauncherTui } from '#pages/home';
import { PortalMenuPage } from '#pages/menu';

export const PORTAL_PANE_ROUTES = ['/menu', '/agensi', '/ask', '/cadence', '/contact'] as const;
export type PortalPaneRoute = (typeof PORTAL_PANE_ROUTES)[number];
export type PortalPaneViewId = 'tui' | PortalPaneRoute;

export function isPortalPaneRoute(pathname: string): pathname is PortalPaneRoute {
  return (PORTAL_PANE_ROUTES as readonly string[]).includes(pathname);
}

interface PaneRouteLoaderState<T> {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly retry: () => void;
}

function usePaneRouteLoader<T>(routePath: PortalPaneRoute, paneId: string): PaneRouteLoaderState<T> {
  const fetcher = useFetcher<T>();
  const [settledAttempt, setSettledAttempt] = useState(0);
  const initiatedRef = useRef(false);
  const loggedErrorAttemptRef = useRef(0);

  const triggerLoad = useCallback(() => {
    void Promise.resolve(fetcher.load(routePath)).finally(() => {
      setSettledAttempt(c => c + 1);
    });
  }, [fetcher, routePath]);

  useEffect(() => {
    if (!initiatedRef.current && fetcher.state === 'idle' && fetcher.data === undefined) {
      initiatedRef.current = true;
      triggerLoad();
    }
  }, [fetcher.data, fetcher.state, triggerLoad]);

  const hasError = settledAttempt > 0 && fetcher.state === 'idle' && fetcher.data === undefined;

  useEffect(() => {
    if (hasError && loggedErrorAttemptRef.current !== settledAttempt) {
      loggedErrorAttemptRef.current = settledAttempt;
      console.error(
        JSON.stringify({
          event: 'portal.pane_nav.fetcher_load_failed',
          routePath,
          paneId,
        }),
      );
    }
  }, [hasError, paneId, routePath, settledAttempt]);

  const isLoading = !hasError && fetcher.data === undefined;

  return { data: fetcher.data, isLoading, hasError, retry: triggerLoad };
}

interface PaneStatusFallbackProps {
  readonly title: string;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onExit: () => void;
}

function PaneStatusFallback({ title, isLoading, onRetry, onExit }: PaneStatusFallbackProps) {
  return (
    <TuiWindow title={title} onClose={onExit}>
      {isLoading ? (
        <div role='status'>Loading {title} ...</div>
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

interface PaneAdapterProps {
  readonly ctx: TerminalPaneViewContext;
  readonly deployments?: Readonly<Record<string, K8sPodEvent>>;
}

function PortalMenuPaneView({ ctx, deployments }: PaneAdapterProps) {
  const { data, isLoading, retry } = usePaneRouteLoader<PortalMenuLoaderData>('/menu', ctx.paneId);
  if (!data) {
    return (
      <PaneStatusFallback
        title='Launch Menu'
        isLoading={isLoading}
        onRetry={retry}
        onExit={ctx.exitTui}
      />
    );
  }
  return (
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
  );
}

function PortalAgensiPaneView({ ctx }: PaneAdapterProps) {
  const { data, isLoading, retry } = usePaneRouteLoader<PortalAgensiLoaderData>(
    '/agensi',
    ctx.paneId,
  );
  if (!data) {
    return (
      <PaneStatusFallback
        title='Agensi Storefront'
        isLoading={isLoading}
        onRetry={retry}
        onExit={ctx.exitTui}
      />
    );
  }
  return <PortalAgensiPage content={data.content} skills={data.skills} onClose={ctx.exitTui} />;
}

function PortalAskPaneView({ ctx }: PaneAdapterProps) {
  const { data, isLoading, retry } = usePaneRouteLoader<PortalAskLoaderData>('/ask', ctx.paneId);
  const submitFetcher = useFetcher<PortalAskActionResult>();

  if (!data) {
    return (
      <PaneStatusFallback
        title='Ask Portfolio'
        isLoading={isLoading}
        onRetry={retry}
        onExit={ctx.exitTui}
      />
    );
  }
  return (
    <PortalAskPage
      content={data.content}
      quota={data.quota}
      actionResult={submitFetcher.data}
      isSubmitting={submitFetcher.state !== 'idle'}
      onSubmitAsk={({ mode, text }) => {
        void submitFetcher.submit({ mode, text }, { method: 'post', action: '/ask' });
      }}
      onClose={ctx.exitTui}
    />
  );
}

function PortalCadencePaneView({ ctx }: PaneAdapterProps) {
  const { data, isLoading, retry } = usePaneRouteLoader<PortalCadenceLoaderData>(
    '/cadence',
    ctx.paneId,
  );
  const submitFetcher = useFetcher<PortalCadenceActionResult>();

  if (!data) {
    return (
      <PaneStatusFallback
        title='CADENCE Builder'
        isLoading={isLoading}
        onRetry={retry}
        onExit={ctx.exitTui}
      />
    );
  }
  return (
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
          { method: 'post', action: '/cadence' },
        );
      }}
      onGateVerdict={({ runId, verdict }) => {
        void submitFetcher.submit(
          { intent: 'gate', runId, verdict },
          { method: 'post', action: '/cadence' },
        );
      }}
      onClose={ctx.exitTui}
    />
  );
}

function PortalContactPaneView({ ctx }: PaneAdapterProps) {
  const { data, isLoading, retry } = usePaneRouteLoader<PortalContactLoaderData>(
    '/contact',
    ctx.paneId,
  );
  const submitFetcher = useFetcher<ContactActionResult>();

  if (!data) {
    return (
      <PaneStatusFallback
        title='Contact'
        isLoading={isLoading}
        onRetry={retry}
        onExit={ctx.exitTui}
      />
    );
  }
  return (
    <PortalContactPage
      content={data.content}
      actionData={submitFetcher.data}
      isSubmitting={submitFetcher.state !== 'idle'}
      formAction='/contact'
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
  );
}

function UnknownPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  useEffect(() => {
    console.warn(
      JSON.stringify({
        event: 'portal.pane_nav.unknown_view_id',
        viewId: ctx.viewId,
        paneId: ctx.paneId,
      }),
    );
  }, [ctx.paneId, ctx.viewId]);

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
