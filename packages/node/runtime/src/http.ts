import { createHmac, timingSafeEqual } from 'node:crypto';

export const INTERNAL_AUTH_HEADER = 'x-internal-auth';
export const INTERNAL_AUTH_VERSION = 'v1';

/**
 * Explicit development-only fallback secret used ONLY when NODE_ENV !== 'production' and
 * INTERNAL_AUTH_SECRET is unset. Production always fails closed.
 */
export const DEV_FALLBACK_INTERNAL_AUTH_SECRET =
  'aklapper-dev-internal-auth-secret-do-not-use-in-prod';

export type InternalAuthRole = 'admin' | 'guest' | 'service';

export interface InternalAuthClaims {
  role: InternalAuthRole;
  sub: string;
  iat: number;
  exp: number;
}

export interface SignInternalAuthTokenOptions {
  role: InternalAuthRole;
  subject: string;
  secret?: string;
  ttlSeconds?: number;
  nowSeconds?: number;
}

export interface UpstreamRequestOptions {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Readonly<Record<string, string>>;
  body?: BodyInit;
  timeoutMs?: number;
}

export interface ProxyJsonOptions {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  internalAuth?: SignInternalAuthTokenOptions;
  fetchImpl?: typeof fetch;
}

export interface ProxyJsonResult<T = unknown> {
  ok: boolean;
  status: number;
  headers: Headers;
  data: T | null;
  error?: string;
}

export interface ProxySseOptions {
  baseUrl: string;
  path: string;
  headers?: Readonly<Record<string, string>>;
  timeoutMs?: number;
  signal?: AbortSignal;
  internalAuth?: SignInternalAuthTokenOptions;
  fetchImpl?: typeof fetch;
}

const VALID_INTERNAL_ROLES = new Set<InternalAuthRole>(['admin', 'guest', 'service']);
const DEFAULT_TOKEN_TTL_SECONDS = 60;
const CLOCK_SKEW_TOLERANCE_SECONDS = 30;
const DEFAULT_PROXY_TIMEOUT_MS = 10_000;

export function joinUpstreamUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function resolveInternalAuthSecret(explicitSecret?: string): string {
  const direct = explicitSecret?.trim();
  if (direct) return direct;

  const fromEnv = process.env['INTERNAL_AUTH_SECRET']?.trim();
  if (fromEnv) return fromEnv;

  if (process.env['NODE_ENV'] !== 'production') {
    return DEV_FALLBACK_INTERNAL_AUTH_SECRET;
  }

  throw new Error('INTERNAL_AUTH_SECRET is required when NODE_ENV=production');
}

export function signInternalAuthToken(options: SignInternalAuthTokenOptions): string {
  const { role, subject, secret, ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS } = options;
  if (!VALID_INTERNAL_ROLES.has(role)) {
    throw new Error(`Invalid internal auth role: ${String(role)}`);
  }
  const normalizedSub = subject.trim();
  if (!normalizedSub) {
    throw new Error('Internal auth token subject must be non-empty');
  }
  const resolvedSecret = resolveInternalAuthSecret(secret);
  const iat = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(1, Math.floor(ttlSeconds));

  const payload: InternalAuthClaims = {
    role,
    sub: normalizedSub,
    iat,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${INTERNAL_AUTH_VERSION}.${payloadB64}`;
  const sigB64 = createHmac('sha256', resolvedSecret).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

export function verifyInternalAuthToken(
  token: string | null | undefined,
  secret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): InternalAuthClaims | null {
  if (!token) return null;

  let resolvedSecret: string;
  try {
    resolvedSecret = resolveInternalAuthSecret(secret);
  } catch {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [version, payloadB64, sigB64] = parts;
  if (version !== INTERNAL_AUTH_VERSION || !payloadB64 || !sigB64) {
    return null;
  }

  const signingInput = `${version}.${payloadB64}`;
  const expectedSig = createHmac('sha256', resolvedSecret).update(signingInput).digest();
  const actualSig = Buffer.from(sigB64, 'base64url');
  if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<InternalAuthClaims>;
  if (
    typeof candidate.role !== 'string' ||
    !VALID_INTERNAL_ROLES.has(candidate.role as InternalAuthRole) ||
    typeof candidate.sub !== 'string' ||
    candidate.sub.trim().length === 0 ||
    typeof candidate.iat !== 'number' ||
    !Number.isFinite(candidate.iat) ||
    typeof candidate.exp !== 'number' ||
    !Number.isFinite(candidate.exp)
  ) {
    return null;
  }

  if (candidate.exp <= nowSeconds) return null;
  if (candidate.iat > nowSeconds + CLOCK_SKEW_TOLERANCE_SECONDS) return null;

  return {
    role: candidate.role as InternalAuthRole,
    sub: candidate.sub,
    iat: candidate.iat,
    exp: candidate.exp,
  };
}

function buildCompositeSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'TimeoutError' || error.name === 'AbortError';
}

export async function proxyJson<T = unknown>(
  options: ProxyJsonOptions,
): Promise<ProxyJsonResult<T>> {
  const {
    baseUrl,
    path,
    method = 'GET',
    headers = {},
    body,
    timeoutMs = DEFAULT_PROXY_TIMEOUT_MS,
    signal,
    internalAuth,
    fetchImpl = fetch,
  } = options;

  const targetUrl = joinUpstreamUrl(baseUrl, path);
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('accept')) {
    requestHeaders.set('accept', 'application/json');
  }
  if (internalAuth) {
    requestHeaders.set(INTERNAL_AUTH_HEADER, signInternalAuthToken(internalAuth));
  }

  let encodedBody: BodyInit | undefined;
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer) {
      encodedBody = body as BodyInit;
    } else {
      encodedBody = JSON.stringify(body);
      if (!requestHeaders.has('content-type')) {
        requestHeaders.set('content-type', 'application/json');
      }
    }
  }

  try {
    const response = await fetchImpl(targetUrl, {
      method,
      headers: requestHeaders,
      body: encodedBody,
      signal: buildCompositeSignal(timeoutMs, signal),
    });

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    let data: T | null = null;
    if (response.status !== 204 && response.status !== 304) {
      const rawText = await response.text();
      if (rawText.length > 0) {
        if (contentType.includes('application/json') || contentType.includes('+json')) {
          try {
            data = JSON.parse(rawText) as T;
          } catch {
            data = null;
          }
        } else {
          data = rawText as unknown as T;
        }
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      data,
      ...(!response.ok ? { error: `UPSTREAM_HTTP_${response.status}` } : {}),
    };
  } catch (error) {
    const timedOut = isTimeoutError(error);
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      headers: new Headers(),
      data: null,
      error: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
    };
  }
}

export async function proxySse(options: ProxySseOptions): Promise<Response> {
  const {
    baseUrl,
    path,
    headers = {},
    timeoutMs,
    signal,
    internalAuth,
    fetchImpl = fetch,
  } = options;

  const targetUrl = joinUpstreamUrl(baseUrl, path);
  const requestHeaders = new Headers(headers);
  requestHeaders.set('accept', 'text/event-stream');
  if (internalAuth) {
    requestHeaders.set(INTERNAL_AUTH_HEADER, signInternalAuthToken(internalAuth));
  }

  const effectiveSignal =
    timeoutMs !== undefined ? buildCompositeSignal(timeoutMs, signal) : signal;

  try {
    const upstream = await fetchImpl(targetUrl, {
      method: 'GET',
      headers: requestHeaders,
      signal: effectiveSignal,
    });

    if (!upstream.ok || !upstream.body) {
      const fallbackBody = await upstream.text().catch(() => '');
      return Response.json(
        {
          error: `UPSTREAM_SSE_${upstream.status}`,
          message: fallbackBody || 'Upstream SSE stream unavailable',
        },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }

    const responseHeaders = new Headers({
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = isTimeoutError(error);
    return Response.json(
      {
        error: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        message: 'Failed to connect to upstream SSE stream',
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
