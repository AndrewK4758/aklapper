import {
  type AdminAnalyticsLoaderData,
  AdminAnalyticsWindowSchema,
  type StreamResult,
} from '@aklapper/core';
import { loadAdminAnalyticsDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { href } from 'react-router';

import { AdminAnalyticsPage } from '#pages/analytics';

import { requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/analytics';

export interface AdminAnalyticsStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminAnalyticsLoaderData>>;
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<AdminAnalyticsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  await requireAdminSession(request, {
    context,
    source: 'admin.analytics.loader',
  });

  const url = new URL(request.url);
  const parsedWindow = AdminAnalyticsWindowSchema.safeParse(url.searchParams.get('window'));
  const window = parsedWindow.success ? parsedWindow.data : '7d';

  return {
    correlationId,
    payload: deferStreamResult((async () => loadAdminAnalyticsDataWithPrerender(window))(), {
      request,
      context,
      source: 'admin.analytics.loader',
    }),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Analytics Telemetry // admin.andrew-k.us',
    description:
      'First-party visitor analytics, Core Web Vitals percentiles, and Agensi conversion metrics.',
  });
}

export default function AdminAnalyticsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <SuspenseElement<AdminAnalyticsLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading analytics telemetry...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {resolved => <AdminAnalyticsPage data={resolved} />}
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
        reportAdminPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
