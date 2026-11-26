import { createPublicAppError } from '@aklapper/core';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { data, href, useRouteLoaderData } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import type { loader as rootLoader } from '../root';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/not-found';

export function loader({ request, context }: Route.LoaderArgs): null {
  const correlationId = getOrCreateCorrelationId(request, context);
  const publicError = createPublicAppError({
    code: 'ERR_NOT_FOUND',
    status: 404,
    message: 'Resource could not be found.',
    action: 'Verify the URL or return home.',
    correlationId,
  });

  throw data(publicError, {
    status: 404,
    headers: { 'X-Correlation-Id': correlationId },
  });
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Not Found // andrew-k.us',
    description: 'The requested page could not be found on andrew-k.us.',
    robots: 'noindex, nofollow',
  });
}

export default function PortalNotFoundRoute() {
  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');

  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={rootData?.correlationId}
      homeHref={href('/')}
      onError={publicError => {
        if (publicError.status !== 404) {
          reportPortalPublicError(publicError, { phase: 'boundary' });
        }
      }}
    />
  );
}
