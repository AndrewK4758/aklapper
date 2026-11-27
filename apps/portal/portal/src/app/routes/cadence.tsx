import { classifyServerError } from '@aklapper/core/server-errors';
import { loadPortalCadenceDataWithPrerender } from '@aklapper/db';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { data, href } from 'react-router';

import type { PortalCadenceActionResult } from '#pages/cadence';

import {
  handleCadenceGateAction,
  handleCadenceResetAction,
  handleCadenceRunAction,
  handleCadenceSpecApproveAction,
} from '../cadence-action.server';
import { reportPortalPublicError } from '../client-telemetry';
import { triggerPortalGuestSessionBinding } from '../contact-analytics-link.server';
import { CadenceRouteView } from '../features/CadenceFeatureView';
import { createPrimaryRouteClientAction } from '../features/paneClientAction';
import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/cadence';

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  triggerPortalGuestSessionBinding(
    request,
    sessionId,
    getRequestContext(context)?.logger,
    '/cadence',
  );
  return data(
    {
      correlationId,
      payload: deferStreamResult(loadPortalCadenceDataWithPrerender(sessionId), {
        request,
        context,
        source: 'portal.cadence.loader',
      }),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-cadence');

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'run',
        error: 'Malformed sandbox submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your prompt and retry.',
        correlationId,
      },
      { status: 400, headers: { 'X-Correlation-Id': correlationId } },
    );
  }

  const rawIntent = String(formData.get('intent') ?? 'run').trim();
  const intent: PortalCadenceActionResult['intent'] =
    rawIntent === 'reset' || rawIntent === 'spec-approve' || rawIntent === 'gate'
      ? rawIntent
      : 'run';

  let sessionId: string;
  let setCookieHeader: string | undefined;
  try {
    ({ sessionId, setCookieHeader } = resolveGuestSession(request));
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.cadence.action.session',
    });
    logDiagnosticError(logger, diagnostic);
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent,
        error: publicError.message,
        code: publicError.code,
        action: publicError.action,
        correlationId: publicError.correlationId,
      },
      { status: publicError.status, headers: { 'X-Correlation-Id': correlationId } },
    );
  }
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
    ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}),
  };
  triggerPortalGuestSessionBinding(request, sessionId, logger, '/cadence');

  const actionCtx = {
    sessionId,
    correlationId,
    logger,
    headers,
    cadenceDemoUrl: process.env['CADENCE_DEMO_URL']?.trim(),
  };

  if (intent === 'reset') {
    return handleCadenceResetAction(actionCtx);
  }
  if (intent === 'spec-approve') {
    return handleCadenceSpecApproveAction(formData, actionCtx);
  }
  if (intent === 'gate') {
    return handleCadenceGateAction(formData, actionCtx);
  }
  return handleCadenceRunAction(formData, actionCtx);
}

export const clientAction = createPrimaryRouteClientAction<PortalCadenceActionResult>('/cadence');

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'CADENCE Builder // andrew-k.us',
    description:
      'Quota-gated prompt-to-artifact sandbox wired for live GKE Autopilot scale-from-zero execution.',
  });
}

export default function PortalCadenceRoute({ loaderData }: Route.ComponentProps) {
  return <CadenceRouteView loaderData={loaderData} />;
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
