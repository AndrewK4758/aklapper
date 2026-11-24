import { handleAdminAuthBffRequest } from '@aklapper/db/auth';

import type { Route } from './+types/api.auth.$';

export async function loader({ request, params }: Route.LoaderArgs): Promise<Response> {
  return handleAdminAuthBffRequest(request, params['*'] ?? '');
}

export async function action({ request, params }: Route.ActionArgs): Promise<Response> {
  return handleAdminAuthBffRequest(request, params['*'] ?? '');
}
