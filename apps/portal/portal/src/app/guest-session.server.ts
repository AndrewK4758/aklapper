import { randomUUID } from 'node:crypto';

import {
  GUEST_SESSION_COOKIE_NAME,
  isSecureRequest,
  parseCookieHeader,
  serializeSessionCookie,
} from '@aklapper/node-runtime/auth';

const GUEST_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,96}$/;

export interface ResolvedGuestSession {
  readonly sessionId: string;
  readonly setCookieHeader?: string;
}

export function resolveGuestSession(request: Request): ResolvedGuestSession {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const existing = cookies[GUEST_SESSION_COOKIE_NAME]?.trim();
  if (existing && SESSION_ID_RE.test(existing)) {
    return { sessionId: existing };
  }

  const sessionId = `guest_${randomUUID().replaceAll('-', '')}`;
  const secure = isSecureRequest(request.url, request.headers.get('x-forwarded-proto'));
  const setCookieHeader = serializeSessionCookie(GUEST_SESSION_COOKIE_NAME, sessionId, {
    maxAgeSeconds: GUEST_SESSION_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
  });

  return { sessionId, setCookieHeader };
}
