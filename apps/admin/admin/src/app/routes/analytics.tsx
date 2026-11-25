import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsSummaryData,
  AdminAnalyticsWindowSchema,
  type StreamResult,
} from '@aklapper/core';
import {
  loadAdminAnalyticsBreakdownsWithPrerender,
  loadAdminAnalyticsSummaryWithPrerender,
} from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { href } from 'react-router';

import { AdminAnalyticsBreakdowns, AdminAnalyticsPage } from '#pages/analytics';

import { requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/analytics';

export interface AdminAnalyticsStreamData {
  readonly correlationId: string;
  readonly summaryPayload: Promise<StreamResult<AdminAnalyticsSummaryData>>;
  readonly breakdownsPayload: Promise<StreamResult<AdminAnalyticsBreakdownsData>>;
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
    summaryPayload: deferStreamResult(
      (async () => loadAdminAnalyticsSummaryWithPrerender(window))(),
      {
        request,
        context,
        source: 'admin.analytics.summary',
      },
    ),
    breakdownsPayload: deferStreamResult(
      (async () => loadAdminAnalyticsBreakdownsWithPrerender(window))(),
      {
        request,
        context,
        source: 'admin.analytics.breakdowns',
      },
    ),
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
  const breakdownsSlot = (
    <SuspenseElement<AdminAnalyticsBreakdownsData>
      resolve={loaderData.breakdownsPayload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading analytics breakdowns...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
        console.error(
          JSON.stringify({
            event: 'admin.secondary_stream.degraded',
            slot: 'analytics.breakdowns',
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
    >
      {breakdowns => <AdminAnalyticsBreakdowns data={breakdowns} />}
    </SuspenseElement>
  );

  return (
    <SuspenseElement<AdminAnalyticsSummaryData>
      resolve={loaderData.summaryPayload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading analytics telemetry...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {summary => <AdminAnalyticsPage data={summary} breakdownsSlot={breakdownsSlot} />}
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
