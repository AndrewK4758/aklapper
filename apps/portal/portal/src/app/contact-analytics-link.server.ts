import { bindPortalGuestSession } from '@aklapper/node-runtime/grpc';
import {
  getOrCreateCorrelationId,
  isReactRouterPrerender,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';

import { requireGuestSession } from './guest-session.server';
import { extractClientRequestContext, resolvePortalApiUrl } from './portal-api.server';

const GUEST_BIND_TIMEOUT_MS = 1_500;

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
  try {
    const correlationId = getOrCreateCorrelationId(request);
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
    ).catch(() => undefined);
  } catch {
    // Fail-open: never impact guest-session routes
  }
}
