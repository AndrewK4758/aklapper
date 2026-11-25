import { loadPortalAgensiDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { href } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import { AgensiRouteView } from '../features/AgensiFeatureView';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/agensi';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  return {
    correlationId,
    payload: deferStreamResult(loadPortalAgensiDataWithPrerender({ correlationId }), {
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
  return <AgensiRouteView loaderData={loaderData} />;
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
