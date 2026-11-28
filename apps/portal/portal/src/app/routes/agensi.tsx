import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { href } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import { AgensiRouteView } from '../features/AgensiFeatureView';
import { loadPortalAgensiDataWithPrerender } from '../portal-api.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/agensi';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  return {
    correlationId,
    payload: deferStreamResult(
      loadPortalAgensiDataWithPrerender({
        correlationId,
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        signal: reqCtx?.signal ?? request.signal,
      }),
      {
        request,
        context,
        source: 'portal.agensi.loader',
      },
    ),
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
