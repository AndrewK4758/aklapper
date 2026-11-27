export const SINGLE_PROXY_HOP = (_address: string, hop: number): boolean => hop === 0;

export class GcpOidcTokenError extends Error {
  readonly code = 'GCP_OIDC_TOKEN_UNAVAILABLE';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GcpOidcTokenError';
  }
}

export type OidcResolutionBranch =
  | 'cache_hit'
  | 'metadata_refreshed'
  | 'retry_401_refreshed'
  | 'skipped_non_gcp_target'
  | 'metadata_unavailable';

export interface ResolveGcpIdentityTokenOptions {
  metadataUrl?: string;
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
  nowMs?: number;
  env?: Record<string, string | undefined>;
}

const DEFAULT_GCP_METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
const METADATA_IDENTITY_TIMEOUT_MS = 2_000;
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_FALLBACK_TTL_MS = 300_000;

interface CachedIdentityToken {
  readonly token: string;
  readonly expMs: number;
}

const identityTokenCache = new Map<string, CachedIdentityToken>();

export function clearGcpIdentityTokenCacheForTest(): void {
  identityTokenCache.clear();
}

export function evictGcpIdentityTokenCache(audience: string): void {
  const key = audience.trim();
  if (key) {
    identityTokenCache.delete(key);
  }
}

export function emitOidcResolutionSeam(
  branch: OidcResolutionBranch,
  audience: string,
  detail?: string,
): void {
  const payload = {
    event: 'runtime.oidc_token.resolution',
    seam: 'RULE_DIVERGENCE',
    branch,
    audience,
    ...(detail ? { detail } : {}),
  };
  if (branch === 'metadata_unavailable' || branch === 'retry_401_refreshed') {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

export function extractRightmostForwardedIp(
  forwardedFor: string | null | undefined,
  realIp?: string | null,
  fallback = 'unknown',
): string {
  const hops = forwardedFor
    ?.split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (hops && hops.length > 0) {
    return hops[hops.length - 1]!;
  }
  const normalizedReal = realIp?.trim();
  if (normalizedReal) {
    return normalizedReal;
  }
  return fallback;
}

export function resolveAnalyticsClientIp(request: Request): string {
  return extractRightmostForwardedIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    '127.0.0.1',
  );
}

export function shouldAttachGcpOidcToken(
  baseUrl: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith('.run.app')) {
    return true;
  }
  const explicitHosts = env['GCP_OIDC_AUDIENCE_HOSTS']
    ?.split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(explicitHosts?.includes(hostname));
}

function parseJwtExpiryMs(jwt: string, nowMs: number): number {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return nowMs + DEFAULT_FALLBACK_TTL_MS;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return nowMs + DEFAULT_FALLBACK_TTL_MS;
  }
  return nowMs + DEFAULT_FALLBACK_TTL_MS;
}

export async function resolveGcpIdentityToken(
  audience: string,
  options: ResolveGcpIdentityTokenOptions = {},
): Promise<string> {
  const normalizedAudience = audience.trim();
  if (!normalizedAudience) {
    throw new GcpOidcTokenError('GCP_OIDC_TOKEN_UNAVAILABLE: non-empty OIDC audience is required');
  }

  const nowMs = options.nowMs ?? Date.now();
  const cached = identityTokenCache.get(normalizedAudience);
  if (!options.forceRefresh && cached && cached.expMs - TOKEN_EXPIRY_SAFETY_MARGIN_MS > nowMs) {
    emitOidcResolutionSeam('cache_hit', normalizedAudience);
    return cached.token;
  }

  const env = options.env ?? process.env;
  const baseMetadataUrl =
    options.metadataUrl?.trim() ||
    env['GCP_METADATA_IDENTITY_URL']?.trim() ||
    DEFAULT_GCP_METADATA_IDENTITY_URL;
  const fetchFn = options.fetchImpl ?? fetch;

  let requestUrl: string;
  try {
    const parsedMeta = new URL(baseMetadataUrl);
    if (!parsedMeta.searchParams.has('audience')) {
      parsedMeta.searchParams.set('audience', normalizedAudience);
    }
    if (!parsedMeta.searchParams.has('format')) {
      parsedMeta.searchParams.set('format', 'full');
    }
    requestUrl = parsedMeta.toString();
  } catch (error) {
    emitOidcResolutionSeam('metadata_unavailable', normalizedAudience, 'invalid_metadata_url');
    throw new GcpOidcTokenError(
      `GCP_OIDC_TOKEN_UNAVAILABLE: invalid GCP metadata URL "${baseMetadataUrl}"`,
      { cause: error },
    );
  }

  try {
    const response = await fetchFn(requestUrl, {
      method: 'GET',
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(METADATA_IDENTITY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`metadata server responded with status ${response.status}`);
    }
    const token = (await response.text()).trim();
    if (!token) {
      throw new Error('metadata server returned empty OIDC identity token');
    }
    const expMs = parseJwtExpiryMs(token, nowMs);
    identityTokenCache.set(normalizedAudience, { token, expMs });
    emitOidcResolutionSeam(
      options.forceRefresh ? 'retry_401_refreshed' : 'metadata_refreshed',
      normalizedAudience,
    );
    return token;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unreachable';
    emitOidcResolutionSeam('metadata_unavailable', normalizedAudience, detail);
    throw new GcpOidcTokenError(
      `GCP_OIDC_TOKEN_UNAVAILABLE: failed fetching OIDC identity token for ${normalizedAudience} (${detail})`,
      { cause: error },
    );
  }
}
