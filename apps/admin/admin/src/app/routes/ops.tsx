import {
  AdminGateOverrideSchema,
  createPublicAppError,
  type QdrantHealthStatus,
  type StreamResult,
} from '@aklapper/core';
import {
  classifyGrpcError,
  listAdminSandboxRunsViaGrpc,
  overrideAdminSandboxGateVerdictViaGrpc,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { data, href } from 'react-router';

import {
  type AdminOpsActionData,
  AdminOpsPage,
  type AdminOpsPrimaryData,
  QdrantRuntimeStatusBody,
} from '#pages/ops';

import { runAdminStreamRpc } from '../admin-grpc.server';
import { fetchQdrantStatus, requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { handleReindexQdrantIntent } from '../cms-reindex-privacy.server';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/ops';

export interface AdminOpsStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminOpsPrimaryData>>;
  readonly qdrantStatusPayload: Promise<StreamResult<QdrantHealthStatus>>;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminOpsStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const { session } = await requireAdminSession(request, { context, source: 'admin.ops.loader' });

  return {
    correlationId,
    payload: deferStreamResult(
      runAdminStreamRpc(
        async (): Promise<AdminOpsPrimaryData> => {
          const sandboxRuns = await listAdminSandboxRunsViaGrpc(session.sessionId, 25, {
            correlationId,
            ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
            signal: reqCtx?.signal ?? request.signal,
          });
          return { sandboxRuns };
        },
        {
          correlationId,
          source: 'admin.ops.loader',
          ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        },
      ),
      { request, context, source: 'admin.ops.loader' },
    ),
    qdrantStatusPayload: deferStreamResult(
      runAdminStreamRpc(() => fetchQdrantStatus(session.sessionId, correlationId, reqCtx?.logger), {
        correlationId,
        source: 'admin.ops.qdrant',
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
      }),
      {
        request,
        context,
        source: 'admin.ops.qdrant',
      },
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session } = await requireAdminSession(request, { context, source: 'admin.ops.action' });
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
  let targetRunId = '';

  try {
    if (intent === 'override-gate') {
      const parsed = AdminGateOverrideSchema.parse({
        runId: formData.get('runId'),
        gateVerdict: formData.get('gateVerdict'),
      });
      targetRunId = parsed.runId;
      const updated = await overrideAdminSandboxGateVerdictViaGrpc(
        session.sessionId,
        parsed.runId,
        parsed.gateVerdict,
        { correlationId, logger },
      );
      return data<AdminOpsActionData>(
        {
          ok: true,
          message: `Updated gate verdict for run ${parsed.runId} to "${updated.gateVerdict}".`,
        },
        { status: 200, headers },
      );
    }

    if (intent === 'reindex-qdrant') {
      const outcome = await handleReindexQdrantIntent(
        correlationId,
        logger,
        'admin.ops.action.reindex_qdrant',
      );
      return data<AdminOpsActionData>(outcome.payload, { status: outcome.status, headers });
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
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'admin.ops.action',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (
      intent === 'override-gate' &&
      failure.publicError.status === 409 &&
      failure.publicError.code === 'ERR_CONSTRAINT'
    ) {
      logger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'cadence.gate.golden_mutation_blocked',
          runId: targetRunId,
          correlationId,
        },
        'Blocked admin gate override against read-only Golden showcase run',
      );
      const conflictError = createPublicAppError({
        code: 'ERR_CONSTRAINT',
        status: 409,
        message: 'Golden showcase runs are read-only and cannot be mutated.',
        action: 'Select a visitor sandbox run to override its gate verdict.',
        correlationId,
      });
      return data<AdminOpsActionData>(
        {
          ok: false,
          message: conflictError.message,
          code: conflictError.code,
          action: conflictError.action,
          correlationId: conflictError.correlationId,
        },
        { status: 409, headers },
      );
    }
    if (intent === 'override-gate' && failure.publicError.status === 404) {
      return data<AdminOpsActionData>(
        {
          ok: false,
          message: `Sandbox run ${targetRunId} not found.`,
          code: 'ERR_NOT_FOUND',
          action: 'Refresh sandbox runs and retry.',
          correlationId,
        },
        { status: 404, headers },
      );
    }
    return data<AdminOpsActionData>(
      {
        ok: false,
        message: failure.publicError.message,
        code: failure.publicError.code,
        action: failure.publicError.action,
        correlationId: failure.publicError.correlationId,
      },
      { status: failure.publicError.status, headers },
    );
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Runtime Health & CADENCE Ops // admin.andrew-k.us',
    description:
      'Cloud Run / Docker runtime health, Qdrant index management, and PostgreSQL sandbox gate audit.',
  });
}

export default function AdminOpsRoute({ loaderData, actionData }: Route.ComponentProps) {
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
