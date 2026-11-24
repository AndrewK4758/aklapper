import { getOrCreateCorrelationId, getRequestContext } from '@aklapper/node-runtime/ssr/stream';

import { processContactSubmission } from '../contact-submission.server';
import type { Route } from './+types/api.contact';

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const { payload, status } = await processContactSubmission(request, {
    correlationId,
    logger: reqCtx?.logger,
  });
  return Response.json(payload, {
    status,
    headers: { 'X-Correlation-Id': correlationId },
  });
}
