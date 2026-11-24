import type { PortalMaintenanceLoaderData } from '@aklapper/core';
import { loadPortalMaintenanceDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { href } from 'react-router';

import { PortalChangesInProgressPage } from '#pages/changes-in-progress';

import { reportPortalPublicError } from '../client-telemetry';
import { buildPortalPageMeta, DEFAULT_PORTAL_MAINTENANCE_DESCRIPTION } from '../seo';
import type { Route } from './+types/changes-in-progress';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  return {
    correlationId,
    payload: deferStreamResult(loadPortalMaintenanceDataWithPrerender(), {
      request,
      context,
      source: 'portal.changes-in-progress.loader',
    }),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Changes in Progress // andrew-k.us',
    description: DEFAULT_PORTAL_MAINTENANCE_DESCRIPTION,
    robots: 'noindex, nofollow',
  });
}

export default function ChangesInProgressRoute({ loaderData }: Route.ComponentProps) {
  return (
    <SuspenseElement<PortalMaintenanceLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading maintenance status...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {data => <PortalChangesInProgressPage data={data} />}
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
