import { createPublicAppError } from '@aklapper/core';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';

import type { Route } from './+types/api.not-found';

function buildApiNotFoundResponse(
  request: Request,
  context: Route.LoaderArgs['context'],
): Response {
  const correlationId = getOrCreateCorrelationId(request, context);
  const publicError = createPublicAppError({
    code: 'ERR_NOT_FOUND',
    status: 404,
    message: 'Resource could not be found.',
    action: 'Verify the URL or return home.',
    correlationId,
  });

  return Response.json(publicError, {
    status: 404,
    headers: { 'X-Correlation-Id': correlationId },
  });
}

export function loader({ request, context }: Route.LoaderArgs): Response {
  return buildApiNotFoundResponse(request, context);
}

export function action({ request, context }: Route.ActionArgs): Response {
  return buildApiNotFoundResponse(request, context);
}
