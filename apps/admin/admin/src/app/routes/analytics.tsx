import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsFilter,
  type AdminAnalyticsSummaryData,
  parseAdminAnalyticsFilter,
  type StreamResult,
} from '@aklapper/core';
import {
  getAdminAnalyticsBreakdownsViaGrpc,
  getAdminAnalyticsSummaryViaGrpc,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { href } from 'react-router';

import { AdminAnalyticsBreakdowns, AdminAnalyticsPage } from '#pages/analytics';

import { runAdminStreamRpc } from '../admin-grpc.server';
import { requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/analytics';

export interface AdminAnalyticsStreamData {
  readonly correlationId: string;
  readonly filter?: AdminAnalyticsFilter;
  readonly summaryPayload: Promise<StreamResult<AdminAnalyticsSummaryData>>;
  readonly breakdownsPayload: Promise<StreamResult<AdminAnalyticsBreakdownsData>>;
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<AdminAnalyticsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const { session } = await requireAdminSession(request, {
    context,
    source: 'admin.analytics.loader',
  });

  const url = new URL(request.url);
  const { filter, clampedFields } = parseAdminAnalyticsFilter(url.searchParams);
  if (clampedFields.length > 0) {
    const logger = reqCtx?.logger ?? createFallbackLogger('admin-analytics');
    logger.warn(
      {
        seam_type: 'UNSOUND_CONDITION',
        event: 'admin.analytics.invalid_filter_clamped',
        clampedFields,
        correlationId,
      },
      'Clamped invalid admin analytics filter query parameters',
    );
  }

  const rpcCtx = {
    correlationId,
    ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
    signal: reqCtx?.signal ?? request.signal,
  };

  return {
    correlationId,
    filter,
    summaryPayload: deferStreamResult(
      runAdminStreamRpc(() => getAdminAnalyticsSummaryViaGrpc(session.sessionId, filter, rpcCtx), {
        correlationId,
        source: 'admin.analytics.summary',
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
      }),
      {
        request,
        context,
        source: 'admin.analytics.summary',
      },
    ),
    breakdownsPayload: deferStreamResult(
      runAdminStreamRpc(
        () => getAdminAnalyticsBreakdownsViaGrpc(session.sessionId, filter, rpcCtx),
        {
          correlationId,
          source: 'admin.analytics.breakdowns',
          ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        },
      ),
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
      {breakdowns => <AdminAnalyticsBreakdowns data={breakdowns} filter={loaderData.filter} />}
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
