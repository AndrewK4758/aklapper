import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { href } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import { AboutRouteView } from '../features/AboutFeatureView';
import { loadPortalAboutDataWithPrerender } from '../portal-api.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/about';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  return {
    correlationId,
    payload: deferStreamResult(
      loadPortalAboutDataWithPrerender({
        correlationId,
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        signal: reqCtx?.signal ?? request.signal,
      }),
      {
        request,
        context,
        source: 'portal.about.loader',
      },
    ),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'About Andrew Klapper // andrew-k.us',
    description:
      'Sanitized engineering resume, technical skills, independent R&D projects, and interactive platform services guide for Andrew Klapper.',
  });
}

export default function PortalAboutRoute({ loaderData }: Route.ComponentProps) {
  return <AboutRouteView loaderData={loaderData} />;
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
