import type { PortalCadenceLoaderData } from '@aklapper/core';
import { loadPortalCadenceDataWithPrerender } from '@aklapper/db';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { data, type FetcherWithComponents, href, useFetcher, useNavigate } from 'react-router';

import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';

import { handleCadenceGateAction, handleCadenceRunAction } from '../cadence-action.server';
import { useCadenceRunController } from '../cadence-stream';
import { reportPortalPublicError } from '../client-telemetry';
import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/cadence';

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  return data(
    {
      correlationId,
      payload: deferStreamResult(loadPortalCadenceDataWithPrerender(sessionId), {
        request,
        context,
        source: 'portal.cadence.loader',
      }),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-cadence');
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
    ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}),
  };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'run',
        error: 'Malformed sandbox submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your prompt and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const actionCtx = {
    sessionId,
    correlationId,
    logger,
    headers,
    cadenceDemoUrl: process.env['CADENCE_DEMO_URL']?.trim(),
  };
  const intent = String(formData.get('intent') ?? 'run').trim();

  if (intent === 'gate') {
    return handleCadenceGateAction(formData, actionCtx);
  }
  return handleCadenceRunAction(formData, actionCtx);
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'CADENCE Builder // andrew-k.us',
    description:
      'Quota-gated prompt-to-artifact sandbox wired for live GKE Autopilot scale-from-zero execution.',
  });
}

function CadenceLoadedView({
  loadedData,
  fetcher,
  onClose,
}: {
  readonly loadedData: PortalCadenceLoaderData;
  readonly fetcher: FetcherWithComponents<PortalCadenceActionResult>;
  readonly onClose: () => void;
}) {
  const controller = useCadenceRunController({ recentRuns: loadedData.recentRuns, fetcher });
  return (
    <PortalCadencePage
      content={loadedData.content}
      presets={loadedData.presets}
      quota={loadedData.quota}
      recentRuns={loadedData.recentRuns}
      actionResult={controller.actionResult}
      isSubmitting={controller.isSubmitting}
      isStreaming={controller.isStreaming}
      onRunBuild={controller.onRunBuild}
      onGateVerdict={controller.onGateVerdict}
      onClose={onClose}
    />
  );
}

export default function PortalCadenceRoute({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<PortalCadenceActionResult>();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalCadenceLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading sandbox builder...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {loadedData => (
        <CadenceLoadedView
          loadedData={loadedData}
          fetcher={fetcher}
          onClose={() => {
            if (paneNav?.docked) {
              paneNav.exitTui();
            } else {
              void navigate(href('/'));
            }
          }}
        />
      )}
    </SuspenseElement>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={loaderData?.correlationId}
      homeHref={href('/')}
      onError={publicError => {
        reportPortalPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
