import { handleAnalyticsIngestRequest } from '@aklapper/db/analytics';
import type { ActionFunctionArgs } from 'react-router';

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  return handleAnalyticsIngestRequest(request);
}
