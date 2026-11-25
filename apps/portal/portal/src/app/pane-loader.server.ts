import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { data, type RouterContextProvider } from 'react-router';

import type { StreamLoaderEnvelope } from './pane-loader';

export function runPaneSafeLoader<T>(
  request: Request,
  load: () => Promise<T>,
  options?: {
    readonly context?: Readonly<RouterContextProvider>;
    readonly source?: string;
    readonly headers?: HeadersInit;
  },
) {
  const correlationId = getOrCreateCorrelationId(request, options?.context);
  const envelope: StreamLoaderEnvelope<T> = {
    correlationId,
    payload: deferStreamResult(Promise.resolve().then(load), {
      request,
      context: options?.context,
      source: options?.source ?? 'portal.pane.loader',
    }),
  };
  return options?.headers ? data(envelope, { headers: options.headers }) : envelope;
}
