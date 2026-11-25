// Bounded context: Manual-redirect HTTP transport and bounded response body reader for Agensi sync.
// Invariant: Pre-hop origin validation (<= 3 hops), cross-origin x-api-key stripping, and <= 512 KiB body cap.

import { emitAgensiSeamLog, isLoopbackHost, normalizeAllowedOrigins } from './agensi-filter.ts';

export const MAX_AGENSI_REDIRECTS = 3;
export const MAX_AGENSI_RESPONSE_BYTES = 512 * 1024;

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export interface FetchWithValidatedRedirectsOptions {
  readonly fetchImpl: typeof fetch;
  readonly headers: Headers;
  readonly signal: AbortSignal;
  readonly allowedOrigins: readonly string[];
  readonly correlationId?: string;
  readonly maxRedirects?: number;
}

export type ValidatedRedirectFetchResult =
  | {
      readonly ok: true;
      readonly response: Response;
      readonly effectiveUrl: string;
    }
  | {
      readonly ok: false;
      readonly errorCode: 'AGENSI_UNTRUSTED_ORIGIN';
      readonly message: string;
    };

export type BoundedResponseTextResult =
  | {
      readonly ok: true;
      readonly text: string;
    }
  | {
      readonly ok: false;
      readonly errorCode: 'AGENSI_PAYLOAD_TOO_LARGE';
      readonly message: string;
    };

function isOriginAllowedForFetch(
  candidateUrl: URL,
  initialUrl: URL,
  normalizedAllowed: ReadonlySet<string>,
): boolean {
  if (candidateUrl.username || candidateUrl.password) {
    return false;
  }
  const candidateOrigin = candidateUrl.origin.toLowerCase();
  if (candidateUrl.protocol === 'https:') {
    return normalizedAllowed.has(candidateOrigin);
  }
  if (candidateUrl.protocol === 'http:' && isLoopbackHost(candidateUrl.hostname)) {
    if (normalizedAllowed.has(candidateOrigin)) {
      return true;
    }
    return (
      initialUrl.protocol === 'http:' &&
      isLoopbackHost(initialUrl.hostname) &&
      candidateOrigin === initialUrl.origin.toLowerCase()
    );
  }
  return false;
}

/**
 * Executes a GET request with `redirect: 'manual'`, validating every redirect `Location` origin
 * pre-hop against `allowedOrigins` (or matching loopback) and stripping `x-api-key` cross-origin.
 */
export async function fetchWithValidatedRedirects(
  initialUrl: string,
  options: FetchWithValidatedRedirectsOptions,
): Promise<ValidatedRedirectFetchResult> {
  const parsedInitial = new URL(initialUrl);
  const normalizedAllowed = normalizeAllowedOrigins(options.allowedOrigins);
  const maxRedirects = options.maxRedirects ?? MAX_AGENSI_REDIRECTS;

  if (!isOriginAllowedForFetch(parsedInitial, parsedInitial, normalizedAllowed)) {
    emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
      correlationId: options.correlationId,
      reason: 'untrusted_initial_origin',
      hops: 0,
    });
    return {
      ok: false,
      errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
      message: 'Agensi upstream initial origin is not allowed.',
    };
  }

  let currentUrl = parsedInitial.toString();
  const currentHeaders = new Headers(options.headers);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await options.fetchImpl(currentUrl, {
      method: 'GET',
      headers: currentHeaders,
      signal: options.signal,
      redirect: 'manual',
    });

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      await response.body?.cancel().catch(() => {});
      const location = response.headers.get('location')?.trim();
      if (!location || hop >= maxRedirects) {
        emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
          correlationId: options.correlationId,
          reason: !location ? 'missing_location' : 'too_many_redirects',
          hops: hop,
        });
        return {
          ok: false,
          errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
          message: !location
            ? 'Agensi upstream redirect was missing a Location header.'
            : `Agensi upstream exceeded ${maxRedirects} redirect hops.`,
        };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
          correlationId: options.correlationId,
          reason: 'malformed_location',
          hops: hop + 1,
        });
        return {
          ok: false,
          errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
          message: 'Agensi upstream returned an invalid redirect URL.',
        };
      }

      if (!isOriginAllowedForFetch(nextUrl, parsedInitial, normalizedAllowed)) {
        emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
          correlationId: options.correlationId,
          reason: 'untrusted_origin',
          hops: hop + 1,
        });
        return {
          ok: false,
          errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
          message: 'Agensi upstream redirected to an untrusted origin.',
        };
      }

      const previousOrigin = new URL(currentUrl).origin.toLowerCase();
      if (nextUrl.origin.toLowerCase() !== previousOrigin) {
        currentHeaders.delete('x-api-key');
      }
      currentUrl = nextUrl.toString();
      continue;
    }

    const effectiveUrl = response.url || currentUrl;
    let parsedEffective: URL;
    try {
      parsedEffective = new URL(effectiveUrl);
    } catch {
      await response.body?.cancel().catch(() => {});
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
        correlationId: options.correlationId,
        reason: 'malformed_final_url',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
        message: 'Agensi upstream resolved to an invalid final URL.',
      };
    }

    if (!isOriginAllowedForFetch(parsedEffective, parsedInitial, normalizedAllowed)) {
      await response.body?.cancel().catch(() => {});
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
        correlationId: options.correlationId,
        reason: 'untrusted_final_origin',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
        message: 'Agensi upstream resolved to an untrusted final origin.',
      };
    }

    return { ok: true, response, effectiveUrl };
  }

  emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.untrusted_redirect', {
    correlationId: options.correlationId,
    reason: 'too_many_redirects',
    hops: maxRedirects,
  });
  return {
    ok: false,
    errorCode: 'AGENSI_UNTRUSTED_ORIGIN',
    message: `Agensi upstream exceeded ${maxRedirects} redirect hops.`,
  };
}

/**
 * Reads an HTTP response body as UTF-8 text while enforcing a strict streaming byte cap
 * (fast-failing on oversized `Content-Length` and cancelling the stream reader on overflow).
 */
export async function readBoundedResponseText(
  response: Response,
  maxBytes: number = MAX_AGENSI_RESPONSE_BYTES,
  correlationId?: string,
): Promise<BoundedResponseTextResult> {
  const rawContentLength = response.headers.get('content-length')?.trim();
  if (rawContentLength) {
    const declaredLength = Number(rawContentLength);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      await response.body?.cancel().catch(() => {});
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_too_large', {
        correlationId,
        reason: 'content_length_exceeded',
        maxBytes,
      });
      return {
        ok: false,
        errorCode: 'AGENSI_PAYLOAD_TOO_LARGE',
        message: `Agensi response exceeded ${maxBytes} bytes.`,
      };
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_too_large', {
        correlationId,
        reason: 'body_bytes_exceeded',
        maxBytes,
      });
      return {
        ok: false,
        errorCode: 'AGENSI_PAYLOAD_TOO_LARGE',
        message: `Agensi response exceeded ${maxBytes} bytes.`,
      };
    }
    return { ok: true, text };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_too_large', {
          correlationId,
          reason: 'stream_bytes_exceeded',
          maxBytes,
        });
        return {
          ok: false,
          errorCode: 'AGENSI_PAYLOAD_TOO_LARGE',
          message: `Agensi response exceeded ${maxBytes} bytes.`,
        };
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    ok: true,
    text: new TextDecoder('utf-8').decode(combined),
  };
}
