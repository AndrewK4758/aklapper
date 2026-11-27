import type { ContactActionResult } from '@aklapper/core';
import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { data, href } from 'react-router';

import { reportPortalPublicError } from '../client-telemetry';
import { processContactSubmission } from '../contact-submission.server';
import { ContactRouteView } from '../features/ContactFeatureView';
import { createPrimaryRouteClientAction } from '../features/paneClientAction';
import { loadPortalContactDataWithPrerender } from '../portal-api.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/contact';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  return {
    correlationId,
    payload: deferStreamResult(
      loadPortalContactDataWithPrerender({
        correlationId,
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        signal: reqCtx?.signal ?? request.signal,
      }),
      {
        request,
        context,
        source: 'portal.contact.loader',
      },
    ),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact // andrew-k.us',
    description:
      'Direct TUI contact form backed by recursive Zod/JSON schema validation and PostgreSQL 19 CHECK constraints.',
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const { payload, status, retryAfterSeconds } = await processContactSubmission(request, {
    correlationId,
    logger: reqCtx?.logger,
  });
  return data<ContactActionResult>(payload, {
    status,
    headers: {
      'X-Correlation-Id': correlationId,
      ...(typeof retryAfterSeconds === 'number'
        ? { 'Retry-After': String(retryAfterSeconds) }
        : {}),
    },
  });
}

export const clientAction = createPrimaryRouteClientAction<ContactActionResult>('/contact');

export default function PortalContactRoute({ loaderData, actionData }: Route.ComponentProps) {
  return <ContactRouteView loaderData={loaderData} actionData={actionData} />;
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
