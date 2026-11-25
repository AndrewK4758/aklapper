import {
  type AppErrorCode,
  type AskMode,
  type AskServiceStatus,
  type ContactActionResult,
  createPublicAppError,
  isPublicAppError,
  isStreamResult,
  type PublicAppError,
  type StreamResult,
} from '@aklapper/core';
import {
  isRouteErrorResponse,
  UNSAFE_decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol,
} from 'react-router';

import type { PortalAskActionResult } from '#pages/ask';
import type { PortalCadenceActionResult } from '#pages/cadence';

import {
  type AskStreamLoaderEnvelope,
  isAskStreamLoaderEnvelope,
  isStreamLoaderEnvelope,
  type StreamLoaderEnvelope,
} from '../pane-loader';
import type { PortalPaneRoute } from './portalWorkspaceSnapshot';
import {
  generateClientCorrelationId,
  isAbortException,
  isPlainRecord,
  waitForAbortablePromise,
} from './unloadGuard';

export { generateClientCorrelationId };

export const PORTAL_PANE_ROUTE_IDS: Readonly<Record<PortalPaneRoute, string>> = {
  '/agensi': 'routes/agensi',
  '/chat': 'routes/chat',
  '/cadence': 'routes/cadence',
  '/contact': 'routes/contact',
};

export type PaneLoadedEnvelope<T> = StreamLoaderEnvelope<T> | AskStreamLoaderEnvelope;

export interface PaneStreamTransport {
  readonly load: <T = unknown>(
    routePath: PortalPaneRoute,
    signal: AbortSignal,
  ) => Promise<PaneLoadedEnvelope<T>>;
  readonly submitAction: <T = unknown>(
    routePath: PortalPaneRoute,
    formData: FormData,
    signal?: AbortSignal,
  ) => Promise<T>;
}

export interface CreateSingleFetchPaneTransportOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const COOKIE_PRIMED_ROUTES = new Set<PortalPaneRoute>(['/chat', '/cadence']);
let guestSessionPrimed = false;
let guestSessionInflight: Promise<void> | null = null;

export function markGuestSessionPrimed(): void {
  if (typeof window === 'undefined') return;
  guestSessionPrimed = true;
}

export function resetGuestSessionBarrierForTest(): void {
  guestSessionPrimed = false;
  guestSessionInflight = null;
}

const ERROR_SPEC: Readonly<Record<string, readonly [AppErrorCode, string, string]>> = {
  '400': ['ERR_VALIDATION', 'Request could not be processed.', 'Review your inputs and retry.'],
  '404': [
    'ERR_NOT_FOUND',
    'Requested view could not be found.',
    'Return to terminal and try another view.',
  ],
  '422': ['ERR_VALIDATION', 'Request could not be processed.', 'Review your inputs and retry.'],
  '429': ['ERR_RATE_LIMITED', 'Too many requests right now.', 'Wait a moment and retry.'],
  '499': [
    'ERR_STREAM_ABORTED',
    'Request was cancelled before completion.',
    'Retry to reload this view.',
  ],
  '503': [
    'ERR_UPSTREAM_UNAVAILABLE',
    'Upstream service unreachable.',
    'Retry shortly or return to terminal.',
  ],
  '504': [
    'ERR_STREAM_TIMEOUT',
    'Section took too long to load.',
    'Retry loading or return to terminal.',
  ],
  net: [
    'ERR_UPSTREAM_UNAVAILABLE',
    'Unable to reach the server.',
    'Check your connection and retry.',
  ],
};

export function createTransportPublicError(options: {
  readonly error?: unknown;
  readonly status?: number;
  readonly correlationId?: string;
}): PublicAppError {
  const correlationId =
    options.correlationId?.trim().slice(0, 128) || generateClientCorrelationId();
  const { error, status } = options;

  if (isPublicAppError(error)) return error;
  if (isRouteErrorResponse(error)) {
    return isPublicAppError(error.data)
      ? error.data
      : createTransportPublicError({ status: error.status, correlationId });
  }

  let resolvedStatus = 503;
  let specKey = 'net';
  if (typeof status === 'number') {
    resolvedStatus = status >= 400 && status <= 599 ? status : 503;
    specKey = ERROR_SPEC[String(status)] ? String(status) : '503';
  } else if (isAbortException(error)) {
    resolvedStatus = 499;
    specKey = '499';
  } else if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || /timeout/i.test(error.message))
  ) {
    resolvedStatus = 504;
    specKey = '504';
  }
  const [code, message, action] = ERROR_SPEC[specKey] ?? ERROR_SPEC['net']!;
  return createPublicAppError({ code, status: resolvedStatus, message, action, correlationId });
}

export function buildTypedPaneActionError(
  routePath: PortalPaneRoute,
  formData: FormData,
  publicError: PublicAppError,
):
  | ContactActionResult
  | PortalAskActionResult
  | PortalCadenceActionResult
  | Record<string, unknown> {
  const meta = {
    code: publicError.code,
    action: publicError.action,
    correlationId: publicError.correlationId,
  };
  if (routePath === '/contact') {
    return {
      ok: false,
      source: 'server',
      formError: publicError.message,
      fieldErrors: {},
      ...meta,
    };
  }
  if (routePath === '/chat') {
    const mode: AskMode =
      String(formData.get('mode') ?? 'qa').trim() === 'jd_match' ? 'jd_match' : 'qa';
    return { ok: false, mode, error: publicError.message, ...meta };
  }
  if (routePath === '/cadence') {
    const raw = String(formData.get('intent') ?? 'run').trim();
    const intent = raw === 'gate' || raw === 'spec-approve' || raw === 'reset' ? raw : 'run';
    return { ok: false, intent, error: publicError.message, ...meta };
  }
  return { ok: false, error: publicError.message, ...meta };
}

function settleStreamPromise<T>(
  promise: Promise<StreamResult<T>>,
  correlationId: string,
): Promise<StreamResult<T>> {
  const settled = Promise.resolve(promise).then(
    value =>
      isStreamResult<T>(value)
        ? value
        : { ok: false as const, error: createTransportPublicError({ correlationId }) },
    (error: unknown) => ({
      ok: false as const,
      error: createTransportPublicError({ error, correlationId }),
    }),
  );
  void settled.catch(() => undefined);
  return settled;
}

export function settleEnvelopeStreams<T>(envelope: PaneLoadedEnvelope<T>): PaneLoadedEnvelope<T> {
  if (isAskStreamLoaderEnvelope(envelope)) {
    return {
      ...envelope,
      payload: settleStreamPromise(envelope.payload, envelope.correlationId),
      askStatusPayload: settleStreamPromise<AskServiceStatus | undefined>(
        envelope.askStatusPayload,
        envelope.correlationId,
      ),
    };
  }
  return {
    ...envelope,
    payload: settleStreamPromise(envelope.payload, envelope.correlationId),
  };
}

function failedEnvelope<T>(publicError: PublicAppError): StreamLoaderEnvelope<T> {
  return {
    correlationId: publicError.correlationId,
    payload: Promise.resolve<StreamResult<T>>({ ok: false, error: publicError }),
  };
}

async function decodeSingleFetchBody(
  response: Response,
  correlationId: string,
): Promise<
  | { readonly ok: true; readonly value: Record<PropertyKey, unknown> }
  | { readonly ok: false; readonly error: PublicAppError }
> {
  const fail = (status: number) => ({
    ok: false as const,
    error: createTransportPublicError({ status, correlationId }),
  });
  if (response.status === 204 && response.headers.has('X-Remix-Redirect')) return fail(503);
  if (response.status >= 400 && !response.headers.has('X-Remix-Response')) {
    return fail(response.status);
  }
  if (!response.body) return fail(503);
  const decoded = await UNSAFE_decodeViaTurboStream(
    response.body,
    typeof window !== 'undefined' ? window : globalThis,
  );
  void decoded.done.catch(() => undefined);
  if (
    !isPlainRecord(decoded.value) ||
    UNSAFE_SingleFetchRedirectSymbol in decoded.value ||
    'redirect' in decoded.value
  ) {
    return fail(503);
  }
  return { ok: true, value: decoded.value };
}

export function createSingleFetchPaneTransport(
  options: CreateSingleFetchPaneTransportOptions = {},
): PaneStreamTransport {
  const baseUrl = options.baseUrl ?? '';
  const resolveFetch = (): typeof fetch => options.fetchImpl ?? globalThis.fetch;

  const fetchWithColdSessionBarrier = async (
    routePath: PortalPaneRoute,
    url: string,
    signal: AbortSignal,
  ): Promise<Response> => {
    const doFetch = () =>
      resolveFetch()(url, { method: 'GET', credentials: 'same-origin', signal });
    if (!COOKIE_PRIMED_ROUTES.has(routePath) || guestSessionPrimed) return doFetch();

    while (!guestSessionPrimed && guestSessionInflight !== null) {
      await waitForAbortablePromise(guestSessionInflight, signal);
      if (signal.aborted) return doFetch();
    }
    if (guestSessionPrimed) return doFetch();

    const barrier = Promise.withResolvers<void>();
    guestSessionInflight = barrier.promise;
    try {
      const response = await doFetch();
      if (
        response.status !== 204 &&
        (response.headers.has('X-Remix-Response') ||
          (response.status >= 200 && response.status < 400))
      ) {
        guestSessionPrimed = true;
      }
      return response;
    } finally {
      if (guestSessionInflight === barrier.promise) guestSessionInflight = null;
      barrier.resolve();
    }
  };

  const load = async <T = unknown>(
    routePath: PortalPaneRoute,
    signal: AbortSignal,
  ): Promise<PaneLoadedEnvelope<T>> => {
    const routeId = PORTAL_PANE_ROUTE_IDS[routePath];
    const url = `${baseUrl}${routePath}.data?pane=1&_routes=${encodeURIComponent(routeId)}`;
    const fallbackId = generateClientCorrelationId();
    const fail = (opts: { error?: unknown; status?: number; correlationId?: string }) =>
      failedEnvelope<T>(createTransportPublicError({ correlationId: fallbackId, ...opts }));

    try {
      const response = await fetchWithColdSessionBarrier(routePath, url, signal);
      const correlationId = response.headers.get('x-correlation-id')?.trim() || fallbackId;
      const decoded = await decodeSingleFetchBody(response, correlationId);
      if (!decoded.ok) return failedEnvelope<T>(decoded.error);

      const routeResult = decoded.value[routeId];
      if (!isPlainRecord(routeResult)) {
        return fail({
          error: 'error' in decoded.value ? decoded.value['error'] : undefined,
          correlationId,
        });
      }
      if ('error' in routeResult) return fail({ error: routeResult['error'], correlationId });
      if ('data' in routeResult) {
        const routeData = routeResult['data'];
        if (isStreamLoaderEnvelope<T>(routeData)) return settleEnvelopeStreams(routeData);
        if (routeData !== undefined) {
          return {
            correlationId,
            payload: Promise.resolve<StreamResult<T>>({ ok: true, data: routeData as T }),
          };
        }
      }
      return fail({ status: 503, correlationId });
    } catch (error) {
      return fail({ error });
    }
  };

  const submitAction = async <T = unknown>(
    routePath: PortalPaneRoute,
    formData: FormData,
    signal?: AbortSignal,
  ): Promise<T> => {
    const routeId = PORTAL_PANE_ROUTE_IDS[routePath];
    const url = `${baseUrl}${routePath}.data?_routes=${encodeURIComponent(routeId)}`;
    const fallbackId = generateClientCorrelationId();
    const fail = (opts: { error?: unknown; status?: number; correlationId?: string }) =>
      buildTypedPaneActionError(
        routePath,
        formData,
        createTransportPublicError({ correlationId: fallbackId, ...opts }),
      ) as T;

    try {
      const response = await resolveFetch()(url, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
        signal,
      });
      const correlationId = response.headers.get('x-correlation-id')?.trim() || fallbackId;
      const decoded = await decodeSingleFetchBody(response, correlationId);
      if (!decoded.ok) return buildTypedPaneActionError(routePath, formData, decoded.error) as T;

      const target =
        'data' in decoded.value || 'error' in decoded.value
          ? decoded.value
          : isPlainRecord(decoded.value[routeId])
            ? decoded.value[routeId]
            : null;
      if (target && 'error' in target) return fail({ error: target['error'], correlationId });
      if (target && 'data' in target && target['data'] !== undefined) return target['data'] as T;
      return fail({ status: 503, correlationId });
    } catch (error) {
      return fail({ error });
    }
  };

  return { load, submitAction };
}

export const browserSingleFetchPaneTransport: PaneStreamTransport =
  createSingleFetchPaneTransport();

let activePaneTransport: PaneStreamTransport = browserSingleFetchPaneTransport;

export function getActivePaneTransport(): PaneStreamTransport {
  return activePaneTransport;
}

export function setActivePaneTransportForTest(transport: PaneStreamTransport | null): void {
  activePaneTransport = transport ?? browserSingleFetchPaneTransport;
}

export function submitPortalPaneAction<T = unknown>(
  routePath: PortalPaneRoute,
  formData: FormData,
  signal?: AbortSignal,
): Promise<T> {
  return activePaneTransport.submitAction<T>(routePath, formData, signal);
}
