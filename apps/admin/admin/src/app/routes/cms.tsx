import {
  type AdminCmsLoaderData,
  extractPrivacySanitizationFindings,
  type QdrantHealthStatus,
  type StreamResult,
} from '@aklapper/core';
import { classifyGrpcError, getAdminCmsDataViaGrpc } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { OscStatusBadge, RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { useState } from 'react';
import { data, href } from 'react-router';

import { type AdminCmsActionData, AdminCmsPage } from '#pages/cms';

import { runAdminStreamRpc } from '../admin-grpc.server';
import { fetchQdrantStatus, requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { dispatchAdminCmsIntent } from '../cms-actions.server';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/cms';

export interface AdminCmsStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminCmsLoaderData>>;
  readonly qdrantPayload: Promise<StreamResult<QdrantHealthStatus>>;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminCmsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const { session } = await requireAdminSession(request, { context, source: 'admin.cms.loader' });

  return {
    correlationId,
    payload: deferStreamResult(
      runAdminStreamRpc(
        () =>
          getAdminCmsDataViaGrpc(session.sessionId, undefined, {
            correlationId,
            ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
            signal: reqCtx?.signal ?? request.signal,
          }),
        {
          correlationId,
          source: 'admin.cms.loader',
          ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        },
      ),
      { request, context, source: 'admin.cms.loader' },
    ),
    qdrantPayload: deferStreamResult(
      runAdminStreamRpc(() => fetchQdrantStatus(session.sessionId, correlationId, reqCtx?.logger), {
        correlationId,
        source: 'admin.cms.qdrant',
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
      }),
      {
        request,
        context,
        source: 'admin.cms.qdrant',
      },
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session } = await requireAdminSession(request, { context, source: 'admin.cms.action' });
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-cms');
  const headers = { 'X-Correlation-Id': correlationId };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<AdminCmsActionData>(
      {
        ok: false,
        message: 'Malformed CMS submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your form inputs and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const intent = String(formData.get('intent') ?? '');

  try {
    const outcome = await dispatchAdminCmsIntent(
      intent,
      formData,
      correlationId,
      logger,
      session.sessionId,
      session.handle,
    );
    return data<AdminCmsActionData>(outcome.payload, { status: outcome.status, headers });
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'admin.cms.action',
      normalizeUnavailableStatus: 503,
      logger,
    });
    const sanitizationFindings =
      failure.sanitizationFindings ?? extractPrivacySanitizationFindings(error);
    return data<AdminCmsActionData>(
      {
        ok: false,
        message: failure.publicError.message,
        code: failure.publicError.code,
        action: failure.publicError.action,
        correlationId: failure.publicError.correlationId,
        ...(sanitizationFindings ? { sanitizationFindings } : {}),
      },
      { status: failure.publicError.status, headers },
    );
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Postgres 19 CMS // admin.andrew-k.us',
    description:
      'Manage site_content, menu registry, terminal commands, Agensi skills, and CADENCE presets.',
  });
}

export default function AdminCmsRoute({ loaderData, actionData }: Route.ComponentProps) {
  const [activeTab, setActiveTab] = useState<string>('site');
  const qdrantStatusSlot = (
    <SuspenseElement<QdrantHealthStatus>
      resolve={loaderData.qdrantPayload}
      correlationId={loaderData.correlationId}
      homeHref=''
      loading={<OscStatusBadge source='qdrant' state='scaling' label='Checking Qdrant...' />}
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
        console.error(
          JSON.stringify({
            event: 'admin.secondary_stream.degraded',
            slot: 'cms.qdrant',
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
      errorElement={() => (
        <OscStatusBadge source='qdrant' state='error' label='Qdrant status unavailable' />
      )}
    >
      {qdrant => (
        <OscStatusBadge
          source='qdrant'
          state={qdrant.online ? 'ready' : 'idle'}
          label={
            qdrant.online ? `${qdrant.collection}: ${qdrant.pointsCount} pts` : 'Qdrant offline'
          }
        />
      )}
    </SuspenseElement>
  );

  return (
    <SuspenseElement<AdminCmsLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading CMS registry...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {cms => (
        <AdminCmsPage
          data={cms}
          qdrantStatusSlot={qdrantStatusSlot}
          actionData={actionData ?? null}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
        />
      )}
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
