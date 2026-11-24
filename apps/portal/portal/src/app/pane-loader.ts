import type { StreamResult } from '@aklapper/core';

export interface PaneLoaderErrorEnvelope {
  readonly __paneLoaderError: true;
  readonly message: string;
}

export interface StreamLoaderEnvelope<T> {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<T>>;
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

export function isStreamLoaderEnvelope<T>(value: unknown): value is StreamLoaderEnvelope<T> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['correlationId'] === 'string' &&
    candidate['payload'] !== null &&
    typeof candidate['payload'] === 'object' &&
    'then' in (candidate['payload'] as object)
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
