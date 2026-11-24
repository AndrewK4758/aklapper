import type { AdminCmsLoaderData, QdrantHealthStatus, StreamResult } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { getSharedDb, loadAdminCmsData } from '@aklapper/db';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { data, href } from 'react-router';

import { type AdminCmsActionData, AdminCmsPage } from '#pages/cms';

import { fetchQdrantStatus, requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { dispatchAdminCmsIntent } from '../cms-actions.server';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/cms';

export interface CmsRouteLoaderData {
  readonly cms: AdminCmsLoaderData;
  readonly qdrant: QdrantHealthStatus;
}

export interface AdminCmsStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<CmsRouteLoaderData>>;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminCmsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  await requireAdminSession(request, { context, source: 'admin.cms.loader' });

  return {
    correlationId,
    payload: deferStreamResult(
      (async (): Promise<CmsRouteLoaderData> => {
        const db = getSharedDb();
        const [cms, qdrant] = await Promise.all([loadAdminCmsData(db), fetchQdrantStatus()]);
        return { cms, qdrant };
      })(),
      { request, context, source: 'admin.cms.loader' },
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdminSession(request, { context, source: 'admin.cms.action' });
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
    const outcome = await dispatchAdminCmsIntent(intent, formData, correlationId, logger);
    return data<AdminCmsActionData>(outcome.payload, { status: outcome.status, headers });
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'admin.cms.action',
    });
    logDiagnosticError(logger, diagnostic);
    return data<AdminCmsActionData>(
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
    title: 'Postgres 19 CMS // admin.andrew-k.us',
    description:
      'Manage site_content, live maintenance mode, menu registry, terminal commands, roadmap, Agensi skills, and CADENCE presets.',
  });
}

export default function AdminCmsRoute({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <SuspenseElement<CmsRouteLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading CMS registry...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {({ cms, qdrant }) => (
        <AdminCmsPage data={cms} qdrant={qdrant} actionData={actionData ?? null} />
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
