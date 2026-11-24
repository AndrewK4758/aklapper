import { data } from 'react-router';

export interface PaneLoaderErrorEnvelope {
  readonly __paneLoaderError: true;
  readonly message: string;
}

export function isPaneFetcherRequest(request: Request): boolean {
  try {
    return new URL(request.url).searchParams.get('pane') === '1';
  } catch {
    return false;
  }
}

export function isPaneLoaderErrorEnvelope(value: unknown): value is PaneLoaderErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__paneLoaderError' in value &&
    (value as { readonly __paneLoaderError?: unknown }).__paneLoaderError === true
  );
}

export function unwrapPaneLoaderData<T>(
  value: T | PaneLoaderErrorEnvelope | undefined,
): T | undefined {
  if (value === undefined || isPaneLoaderErrorEnvelope(value)) {
    return undefined;
  }
  return value;
}

export async function runPaneSafeLoader<T>(
  request: Request,
  load: () => Promise<T>,
  headers?: HeadersInit,
) {
  try {
    const payload = await load();
    return headers ? data<T>(payload, { headers }) : data<T>(payload);
  } catch (error) {
    if (!isPaneFetcherRequest(request)) {
      throw error;
    }
    let path = request.url;
    try {
      path = new URL(request.url).pathname;
    } catch {
      // Keep raw URL string when parsing fails
    }
    console.error(
      JSON.stringify({
        event: 'portal.pane_loader.failed',
        path,
        error:
          error instanceof Response
            ? `HTTP ${error.status}`
            : error instanceof Error
              ? error.message
              : String(error),
      }),
    );
    const message =
      error instanceof Response
        ? `Request failed (HTTP ${error.status})`
        : 'Unable to load pane data.';
    return data<PaneLoaderErrorEnvelope>(
      { __paneLoaderError: true, message },
      { status: 200, ...(headers ? { headers } : {}) },
    );
  }
}
