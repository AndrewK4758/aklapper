import type { AskServiceStatus, PortalAskLoaderData, StreamResult } from '@aklapper/core';

export interface StreamLoaderEnvelope<T> {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<T>>;
}

export interface AskStreamLoaderEnvelope extends StreamLoaderEnvelope<PortalAskLoaderData> {
  readonly askStatusPayload: Promise<StreamResult<AskServiceStatus | undefined>>;
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

export function isAskStreamLoaderEnvelope(value: unknown): value is AskStreamLoaderEnvelope {
  if (!isStreamLoaderEnvelope<PortalAskLoaderData>(value)) return false;
  const candidate = value as unknown as Record<string, unknown>;
  return (
    candidate['askStatusPayload'] !== null &&
    typeof candidate['askStatusPayload'] === 'object' &&
    'then' in (candidate['askStatusPayload'] as object)
  );
}
