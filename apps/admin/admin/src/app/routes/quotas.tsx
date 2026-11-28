import {
  type AdminQuotasLoaderData,
  BucketPurgeSchema,
  BucketResetSchema,
  QuotaPolicyUpdateSchema,
  type StreamResult,
} from '@aklapper/core';
import {
  classifyGrpcError,
  listAdminQuotasAndBucketsViaGrpc,
  purgeAdminStaleRateLimitBucketsViaGrpc,
  resetAdminRateLimitBucketViaGrpc,
  updateAdminQuotaPolicyViaGrpc,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { data, href } from 'react-router';

import { type AdminQuotasActionData, AdminQuotasPage } from '#pages/quotas';

import { runAdminStreamRpc } from '../admin-grpc.server';
import { requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/quotas';

export interface AdminQuotasStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminQuotasLoaderData>>;
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<AdminQuotasStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const { session } = await requireAdminSession(request, {
    context,
    source: 'admin.quotas.loader',
  });

  return {
    correlationId,
    payload: deferStreamResult(
      runAdminStreamRpc(
        () =>
          listAdminQuotasAndBucketsViaGrpc(session.sessionId, {
            correlationId,
            ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
            signal: reqCtx?.signal ?? request.signal,
          }),
        {
          correlationId,
          source: 'admin.quotas.loader',
          ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        },
      ),
      {
        request,
        context,
        source: 'admin.quotas.loader',
      },
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session } = await requireAdminSession(request, {
    context,
    source: 'admin.quotas.action',
  });
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-quotas');
  const headers = { 'X-Correlation-Id': correlationId };
  const rpcCtx = { correlationId, logger };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<AdminQuotasActionData>(
      {
        ok: false,
        message: 'Malformed quota request payload.',
        code: 'ERR_VALIDATION',
        action: 'Review quota inputs and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'update-policy') {
      const parsed = QuotaPolicyUpdateSchema.parse({
        role: formData.get('role'),
        maxTurnsPerSession: formData.get('maxTurnsPerSession'),
        maxTokensPerRun: formData.get('maxTokensPerRun'),
        maxDailyGlobalTokens: formData.get('maxDailyGlobalTokens'),
      });
      const updated = await updateAdminQuotaPolicyViaGrpc(session.sessionId, parsed, rpcCtx);
      return data<AdminQuotasActionData>(
        {
          ok: true,
          message: `Updated ${updated.role} quota policy (${updated.maxTurnsPerSession} turns, ${updated.maxTokensPerRun} tokens/run).`,
        },
        { status: 200, headers },
      );
    }

    if (intent === 'reset-bucket') {
      const { scopeKey } = BucketResetSchema.parse({
        scopeKey: formData.get('scopeKey'),
      });
      const deleted = await resetAdminRateLimitBucketViaGrpc(session.sessionId, scopeKey, rpcCtx);
      return deleted
        ? data<AdminQuotasActionData>(
            { ok: true, message: `Reset rate-limit bucket ${scopeKey}.` },
            { status: 200, headers },
          )
        : data<AdminQuotasActionData>(
            {
              ok: false,
              message: `Bucket ${scopeKey} was not found.`,
              code: 'ERR_NOT_FOUND',
              action: 'Refresh the quota view and verify the bucket key.',
              correlationId,
            },
            { status: 404, headers },
          );
    }

    if (intent === 'purge-stale') {
      const { olderThanHours } = BucketPurgeSchema.parse({
        olderThanHours: formData.get('olderThanHours'),
      });
      const count = await purgeAdminStaleRateLimitBucketsViaGrpc(
        session.sessionId,
        olderThanHours,
        rpcCtx,
      );
      return data<AdminQuotasActionData>(
        {
          ok: true,
          message: `Purged ${count} stale bucket${count === 1 ? '' : 's'} older than ${olderThanHours}h.`,
        },
        { status: 200, headers },
      );
    }

    return data<AdminQuotasActionData>(
      {
        ok: false,
        message: 'Unsupported quota intent.',
        code: 'ERR_VALIDATION',
        action: 'Select a valid quota control and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  } catch (error) {
    const { publicError } = classifyGrpcError(error, {
      correlationId,
      source: 'admin.quotas.action',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return data<AdminQuotasActionData>(
      {
        ok: false,
        message: publicError.message,
        code: publicError.code,
        action: publicError.action,
        correlationId: publicError.correlationId,
      },
      { status: publicError.status, headers },
    );
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Quotas & Rate Limits // admin.andrew-k.us',
    description: 'Configure guest and admin AI quota policies and reset active rate-limit buckets.',
  });
}

export default function AdminQuotasRoute({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <SuspenseElement<AdminQuotasLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading quota policies...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {resolved => <AdminQuotasPage data={resolved} actionData={actionData ?? null} />}
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
