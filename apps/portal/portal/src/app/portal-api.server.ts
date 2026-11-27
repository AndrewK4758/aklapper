import {
  createPublicAppError,
  type PortalAboutLoaderData,
  type PortalAgensiLoaderData,
  type PortalAskLoaderData,
  type PortalCadenceLoaderData,
  type PortalContactLoaderData,
  type PortalHomeLoaderData,
  type PortalRootLoaderData,
} from '@aklapper/core';
import {
  DEFAULT_GUEST_QUOTA,
  getPrerenderPortalAboutData,
  getPrerenderPortalAgensiData,
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalRootData,
} from '@aklapper/core/prerender';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import { resolveAnalyticsClientIp } from '@aklapper/node-runtime/analytics';
import {
  getPortalAboutContent,
  getPortalAgensiCatalog,
  getPortalAskContent,
  getPortalCadenceContent,
  getPortalContactContent,
  getPortalHomeContent,
  getPortalRootContent,
  listCadenceRuns,
  signInternalClientIpHeader,
  type GrpcCallMetadata,
  type PortalClientRequestContextInput,
} from '@aklapper/node-runtime/grpc';
import {
  isReactRouterPrerender,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';

const DEFAULT_PORTAL_RPC_TIMEOUT_MS = 3_500;

export interface PortalGrpcLoaderOptions {
  readonly correlationId: string;
  readonly logger?: SsrStructuredLogger;
  readonly signal?: AbortSignal;
}

export interface ExtractedClientRequestContext {
  readonly clientContext: PortalClientRequestContextInput;
  readonly signedClientIp: string;
}

export function resolvePortalApiUrl(): string | undefined {
  return process.env['PORTAL_API_URL']?.trim() || undefined;
}

export function resolveCadenceDemoUrl(): string | undefined {
  return process.env['CADENCE_DEMO_URL']?.trim() || undefined;
}

export function createUpstreamUnavailableError(serviceName: string, correlationId: string): Error {
  return Object.assign(new Error(`${serviceName} upstream URL is not configured`), {
    status: 503,
    statusText: 'Service Unavailable',
    data: createPublicAppError({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
      message: 'Upstream service unreachable.',
      action: 'Retry shortly or go home.',
      correlationId,
    }),
  });
}

export function extractClientRequestContext(
  request: Request,
  guestSessionId?: string | null,
): ExtractedClientRequestContext {
  const clientIp = resolveAnalyticsClientIp(request);
  const signedClientIp = signInternalClientIpHeader(clientIp);
  const headers = request.headers;
  const cloudCountry = headers.get('x-cloud-country') ?? headers.get('cf-ipcountry') ?? '';
  const cloudRegion = headers.get('x-cloud-region') ?? '';

  return {
    signedClientIp,
    clientContext: {
      userAgent: headers.get('user-agent') ?? '',
      referer: headers.get('referer') ?? '',
      host: headers.get('host') ?? '',
      requestUrl: request.url,
      cloudCountry,
      cloudRegion,
      guestSessionId: guestSessionId?.trim() ?? '',
    },
  };
}

export async function withPortalPrerenderFallback<T>(
  prerenderFactory: () => T,
  remoteCall: (portalApiUrl: string) => Promise<T>,
  correlationId: string,
): Promise<T> {
  const portalApiUrl = resolvePortalApiUrl();
  if (isReactRouterPrerender()) {
    if (!portalApiUrl) {
      return prerenderFactory();
    }
    try {
      return await remoteCall(portalApiUrl);
    } catch {
      return prerenderFactory();
    }
  }
  if (!portalApiUrl) {
    throw createUpstreamUnavailableError('portal-api', correlationId);
  }
  return remoteCall(portalApiUrl);
}

function buildContentMeta(
  baseUrl: string,
  subject: string,
  options: PortalGrpcLoaderOptions,
  role: 'service' | 'guest' = 'service',
): GrpcCallMetadata {
  return {
    baseUrl,
    internalAuth: { role, subject },
    correlationId: options.correlationId,
    timeoutMs: DEFAULT_PORTAL_RPC_TIMEOUT_MS,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  };
}

export function loadPortalRootDataWithPrerender(
  options: PortalGrpcLoaderOptions,
): Promise<PortalRootLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalRootData,
    baseUrl => getPortalRootContent(buildContentMeta(baseUrl, 'portal-root', options)),
    options.correlationId,
  );
}

export function loadPortalHomeDataWithPrerender(
  options: PortalGrpcLoaderOptions,
): Promise<PortalHomeLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalHomeData,
    baseUrl => getPortalHomeContent(buildContentMeta(baseUrl, 'portal-home', options)),
    options.correlationId,
  );
}

export function loadPortalAboutDataWithPrerender(
  options: PortalGrpcLoaderOptions,
): Promise<PortalAboutLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalAboutData,
    baseUrl => getPortalAboutContent(buildContentMeta(baseUrl, 'portal-about', options)),
    options.correlationId,
  );
}

export function loadPortalAgensiDataWithPrerender(
  options: PortalGrpcLoaderOptions & { readonly forceRefresh?: boolean },
): Promise<PortalAgensiLoaderData> {
  return withPortalPrerenderFallback(
    () => getPrerenderPortalAgensiData(resolveAgensiCreatorHandle()),
    async baseUrl => {
      const result = await getPortalAgensiCatalog(
        buildContentMeta(baseUrl, 'portal-agensi', options),
        { forceRefresh: options.forceRefresh ?? false },
      );
      return {
        content: result.content,
        skills: result.skills,
        catalogMeta: result.catalogMeta,
      };
    },
    options.correlationId,
  );
}

export function loadPortalAskDataWithPrerender(
  sessionId: string | undefined,
  options: PortalGrpcLoaderOptions,
): Promise<PortalAskLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalAskData,
    baseUrl =>
      getPortalAskContent(
        buildContentMeta(
          baseUrl,
          sessionId?.trim() || 'portal-ask',
          options,
          sessionId?.trim() ? 'guest' : 'service',
        ),
        sessionId,
      ),
    options.correlationId,
  );
}

export function loadPortalCadenceDataWithPrerender(
  sessionId: string | undefined,
  options: PortalGrpcLoaderOptions,
): Promise<PortalCadenceLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalCadenceData,
    async portalApiUrl => {
      const cadenceDemoUrl = resolveCadenceDemoUrl();
      if (!cadenceDemoUrl) {
        throw createUpstreamUnavailableError('cadence-demo', options.correlationId);
      }
      const trimmedSession = sessionId?.trim() || 'guest_anonymous';
      const [cadenceContent, runsResult] = await Promise.all([
        getPortalCadenceContent(buildContentMeta(portalApiUrl, 'portal-cadence', options)),
        listCadenceRuns(buildContentMeta(cadenceDemoUrl, trimmedSession, options, 'guest'), {
          sessionId: sessionId ?? '',
          limit: 8,
        }),
      ]);
      return {
        content: cadenceContent.content,
        presets: [...cadenceContent.presets],
        quota: runsResult.quota ?? DEFAULT_GUEST_QUOTA,
        recentRuns: [...runsResult.runs],
        goldenRuns: [...runsResult.goldenRuns],
      };
    },
    options.correlationId,
  );
}

export function loadPortalContactDataWithPrerender(
  options: PortalGrpcLoaderOptions,
): Promise<PortalContactLoaderData> {
  return withPortalPrerenderFallback(
    getPrerenderPortalContactData,
    baseUrl => getPortalContactContent(buildContentMeta(baseUrl, 'portal-contact', options)),
    options.correlationId,
  );
}
