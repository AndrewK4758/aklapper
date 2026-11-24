import type { PortalAgensiLoaderData } from '@aklapper/core';
import { loadPortalAgensiDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { href, useNavigate } from 'react-router';

import { PortalAgensiPage } from '#pages/agensi';

import { reportPortalPublicError } from '../client-telemetry';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/agensi';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  return {
    correlationId,
    payload: deferStreamResult(loadPortalAgensiDataWithPrerender(), {
      request,
      context,
      source: 'portal.agensi.loader',
    }),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Agensi Storefront // andrew-k.us',
    description:
      'Published commercial AI agent skills and cloud-native operational blueprints on agensi.io.',
  });
}

export default function PortalAgensiRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalAgensiLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading Agensi storefront...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content, skills }) => (
        <PortalAgensiPage
          content={content}
          skills={skills}
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
