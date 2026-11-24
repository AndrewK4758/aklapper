import type { ActionFunctionArgs } from 'react-router';

import { processContactSubmission } from '../contact-submission.server';

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const { payload, status } = await processContactSubmission(request);
  return Response.json(payload, { status });
}
