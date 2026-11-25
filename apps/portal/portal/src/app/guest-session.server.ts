import { randomUUID } from 'node:crypto';

import { isReactRouterPrerender } from '@aklapper/db';
import {
  GUEST_SESSION_COOKIE_NAME,
  isSecureRequest,
  parseCookieHeader,
  serializeSessionCookie,
  signGuestSessionCookie,
  verifyGuestSessionCookie,
} from '@aklapper/node-runtime/auth';

const GUEST_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface ResolvedGuestSession {
  readonly sessionId: string;
  readonly setCookieHeader?: string;
}

export function requireGuestSession(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  return verifyGuestSessionCookie(cookies[GUEST_SESSION_COOKIE_NAME]);
}

export function resolveGuestSession(request: Request): ResolvedGuestSession {
  if (isReactRouterPrerender()) {
    return { sessionId: 'guest_prerender' };
  }
  const existingSessionId = requireGuestSession(request);
  if (existingSessionId) {
    return { sessionId: existingSessionId };
  }

  const sessionId = `guest_${randomUUID().replaceAll('-', '')}`;
  const signedCookieValue = signGuestSessionCookie(sessionId);
  const secure = isSecureRequest(request.url, request.headers.get('x-forwarded-proto'));
  const setCookieHeader = serializeSessionCookie(GUEST_SESSION_COOKIE_NAME, signedCookieValue, {
    maxAgeSeconds: GUEST_SESSION_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
  });

  return { sessionId, setCookieHeader };
}
