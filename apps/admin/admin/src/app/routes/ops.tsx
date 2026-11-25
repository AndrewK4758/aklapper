import {
  AdminGateOverrideSchema,
  AdminWakeDeploymentSchema,
  type CadenceAdminStatus,
  type QdrantHealthStatus,
  type StreamResult,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { getSharedDb, listAdminSandboxRuns, overrideSandboxGateVerdict } from '@aklapper/db';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { data, href } from 'react-router';

import {
  type AdminOpsActionData,
  AdminOpsPage,
  type AdminOpsPrimaryData,
  CadenceRuntimeStatusBody,
  QdrantRuntimeStatusBody,
} from '#pages/ops';

import {
  fetchCadenceAdminStatus,
  fetchQdrantStatus,
  forwardCadenceGateOverride,
  requireAdminSession,
  triggerClusterWake,
  triggerQdrantReindex,
} from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/ops';

export interface AdminOpsStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminOpsPrimaryData>>;
  readonly cadenceStatusPayload: Promise<StreamResult<CadenceAdminStatus>>;
  readonly qdrantStatusPayload: Promise<StreamResult<QdrantHealthStatus>>;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminOpsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  await requireAdminSession(request, { context, source: 'admin.ops.loader' });

  return {
    correlationId,
    payload: deferStreamResult(
      (async (): Promise<AdminOpsPrimaryData> => {
        const db = getSharedDb();
        const sandboxRuns = await listAdminSandboxRuns(db, 25);
        return {
          sandboxRuns,
          k8sWatchConfigured: Boolean(process.env['K8S_WATCH_URL']?.trim()),
        };
      })(),
      { request, context, source: 'admin.ops.loader' },
    ),
    cadenceStatusPayload: deferStreamResult(fetchCadenceAdminStatus(), {
      request,
      context,
      source: 'admin.ops.cadence',
    }),
    qdrantStatusPayload: deferStreamResult(fetchQdrantStatus(), {
      request,
      context,
      source: 'admin.ops.qdrant',
    }),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdminSession(request, { context, source: 'admin.ops.action' });
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-ops');
  const headers = { 'X-Correlation-Id': correlationId };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<AdminOpsActionData>(
      {
        ok: false,
        message: 'Malformed ops request payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your ops action parameters and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'wake-deployment') {
      const { deployment } = AdminWakeDeploymentSchema.parse({
        deployment: formData.get('deployment'),
      });
      const result = await triggerClusterWake(deployment);
      if (result.ok) {
        return data<AdminOpsActionData>(
          { ok: true, message: result.message },
          { status: 200, headers },
        );
      }
      const upstreamError = Object.assign(new Error(result.message), {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
      });
      const { publicError, diagnostic } = classifyServerError(upstreamError, {
        correlationId,
        source: 'admin.ops.action.wake_deployment',
      });
      logDiagnosticError(logger, diagnostic);
      return data<AdminOpsActionData>(
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

    if (intent === 'override-gate') {
      const parsed = AdminGateOverrideSchema.parse({
        runId: formData.get('runId'),
        gateVerdict: formData.get('gateVerdict'),
      });
      const updated = await overrideSandboxGateVerdict(
        getSharedDb(),
        parsed.runId,
        parsed.gateVerdict,
      );
      if (!updated) {
        return data<AdminOpsActionData>(
          {
            ok: false,
            message: `Sandbox run ${parsed.runId} not found.`,
            code: 'ERR_NOT_FOUND',
            action: 'Refresh sandbox runs and retry.',
            correlationId,
          },
          { status: 404, headers },
        );
      }
      await forwardCadenceGateOverride(parsed.runId, parsed.gateVerdict);
      return data<AdminOpsActionData>(
        {
          ok: true,
          message: `Updated gate verdict for run ${parsed.runId} to "${updated.gateVerdict}".`,
        },
        { status: 200, headers },
      );
    }

    if (intent === 'reindex-qdrant') {
      const result = await triggerQdrantReindex();
      if (result.ok) {
        return data<AdminOpsActionData>(
          { ok: true, message: result.message },
          { status: 200, headers },
        );
      }
      const upstreamError = Object.assign(new Error(result.message), {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
      });
      const { publicError, diagnostic } = classifyServerError(upstreamError, {
        correlationId,
        source: 'admin.ops.action.reindex_qdrant',
      });
      logDiagnosticError(logger, diagnostic);
      return data<AdminOpsActionData>(
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

    return data<AdminOpsActionData>(
      {
        ok: false,
        message: 'Unsupported ops action.',
        code: 'ERR_VALIDATION',
        action: 'Select a valid ops control and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'admin.ops.action',
    });
    logDiagnosticError(logger, diagnostic);
    return data<AdminOpsActionData>(
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
    title: 'Cluster & CADENCE Ops // admin.andrew-k.us',
    description:
      'Dual-namespace GKE pod watcher, cadence-admin runtime controls, Qdrant index management, and gate audit.',
  });
}

export default function AdminOpsRoute({ loaderData, actionData }: Route.ComponentProps) {
  const cadenceStatusSlot = (
    <SuspenseElement<CadenceAdminStatus>
      resolve={loaderData.cadenceStatusPayload}
      correlationId={loaderData.correlationId}
      homeHref=''
      loadingLabel='Probing cadence-admin runtime...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
        console.error(
          JSON.stringify({
            event: 'admin.secondary_stream.degraded',
            slot: 'ops.cadence',
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
    >
      {status => <CadenceRuntimeStatusBody status={status} />}
    </SuspenseElement>
  );

  const qdrantStatusSlot = (
    <SuspenseElement<QdrantHealthStatus>
      resolve={loaderData.qdrantStatusPayload}
      correlationId={loaderData.correlationId}
      homeHref=''
      loadingLabel='Probing Qdrant vector index...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
        console.error(
          JSON.stringify({
            event: 'admin.secondary_stream.degraded',
            slot: 'ops.qdrant',
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
    >
      {status => <QdrantRuntimeStatusBody status={status} />}
    </SuspenseElement>
  );

  return (
    <SuspenseElement<AdminOpsPrimaryData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading cluster & ops status...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {resolved => (
        <AdminOpsPage
          data={resolved}
          cadenceStatusSlot={cadenceStatusSlot}
          qdrantStatusSlot={qdrantStatusSlot}
          actionData={actionData ?? null}
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
