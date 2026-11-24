import type { PortalMenuLoaderData } from '@aklapper/core';
import { loadPortalMenuDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { href, useNavigate } from 'react-router';

import { PortalMenuPage } from '#pages/menu';

import { reportPortalPublicError } from '../client-telemetry';
import { useClusterTelemetry } from '../cluster-stream';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/menu';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  return {
    correlationId,
    payload: deferStreamResult(loadPortalMenuDataWithPrerender(), {
      request,
      context,
      source: 'portal.menu.loader',
    }),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Launch Menu // andrew-k.us',
    description:
      'Select a Solar Forge module to explore CADENCE, RAG Q&A, Agensi skills, and contact workflows.',
  });
}

export default function PortalMenuRoute({ loaderData }: Route.ComponentProps) {
  const cluster = useClusterTelemetry();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalMenuLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading launch menu...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content, items }) => (
        <PortalMenuPage
          content={content}
          items={items}
          deployments={cluster.deployments}
          onNavigate={to => {
            if (paneNav?.docked) {
              if (to === '/') {
                paneNav.exitTui();
              } else {
                paneNav.push(to);
              }
            } else {
              void navigate(to);
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
