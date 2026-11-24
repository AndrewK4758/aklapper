import { handleAdminAuthBffRequest } from '@aklapper/db/auth';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

export async function loader({ request, params }: LoaderFunctionArgs): Promise<Response> {
  return handleAdminAuthBffRequest(request, params['*'] ?? '');
}

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  return handleAdminAuthBffRequest(request, params['*'] ?? '');
}
