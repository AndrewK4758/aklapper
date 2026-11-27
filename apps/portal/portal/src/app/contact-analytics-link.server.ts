import { bindPortalGuestSession, Code, ConnectError } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  isReactRouterPrerender,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';

import { requireGuestSession } from './guest-session.server';
import { extractClientRequestContext, resolvePortalApiUrl } from './portal-api.server';

const GUEST_BIND_TIMEOUT_MS = 1_500;

function formatSafeCaptureErrorDetail(error: unknown): string {
  if (error instanceof ConnectError) {
    return `grpc_${Code[error.code] ?? String(error.code)}`;
  }
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return 'ssr_capture_error';
}

export function logPortalAnalyticsCaptureFailure(
  logger: SsrStructuredLogger | undefined,
  correlationId: string,
  serviceName: string,
  error: unknown,
): void {
  const effectiveLogger = logger ?? createFallbackLogger(serviceName);
  effectiveLogger.warn(
    {
      seam_type: 'BOUNDARY_FAULT',
      event: 'portal.analytics.ssr_capture_failed',
      correlationId,
      detail: formatSafeCaptureErrorDetail(error),
    },
    'Non-blocking portal SSR analytics capture failed',
  );
}

export function readPassiveGuestSession(request: Request): string | null {
  try {
    return requireGuestSession(request);
  } catch {
    return null;
  }
}

export function triggerPortalGuestSessionBinding(
  request: Request,
  guestSessionId: string | null | undefined,
  logger?: SsrStructuredLogger,
  landingPath?: string,
): void {
  const trimmed = guestSessionId?.trim();
  const portalApiUrl = resolvePortalApiUrl();
  if (!trimmed || isReactRouterPrerender() || !portalApiUrl) {
    return;
  }
  const correlationId = getOrCreateCorrelationId(request);
  try {
    const { clientContext, signedClientIp } = extractClientRequestContext(request, trimmed);
    void bindPortalGuestSession(
      {
        baseUrl: portalApiUrl,
        internalAuth: { role: 'service', subject: 'portal-guest-bind' },
        signedClientIp,
        correlationId,
        timeoutMs: GUEST_BIND_TIMEOUT_MS,
        ...(logger ? { logger } : {}),
      },
      trimmed,
      landingPath ?? '/',
      clientContext,
    ).catch(error => {
      logPortalAnalyticsCaptureFailure(logger, correlationId, 'portal-guest-bind', error);
    });
  } catch (error) {
    // Fail-open: never impact guest-session routes
    logPortalAnalyticsCaptureFailure(logger, correlationId, 'portal-guest-bind', error);
  }
}
