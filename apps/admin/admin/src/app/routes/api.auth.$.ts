import { handleAdminAuthGrpcBffRequest } from '@aklapper/node-runtime/grpc';
import { getOrCreateCorrelationId, getRequestContext } from '@aklapper/node-runtime/ssr/stream';

import type { Route } from './+types/api.auth.$';

function forwardAdminAuth(request: Request, splat: string, context: Route.LoaderArgs['context']) {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  return handleAdminAuthGrpcBffRequest(request, splat, {
    correlationId,
    ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
    signal: reqCtx?.signal ?? request.signal,
  });
}

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<Response> {
  return forwardAdminAuth(request, params['*'] ?? '', context);
}

export async function action({ request, params, context }: Route.ActionArgs): Promise<Response> {
  return forwardAdminAuth(request, params['*'] ?? '', context);
}
