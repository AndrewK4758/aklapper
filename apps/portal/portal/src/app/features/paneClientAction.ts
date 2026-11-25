import { type ClientActionFunctionArgs, data } from 'react-router';

import {
  buildTypedPaneActionError,
  createTransportPublicError,
} from '../workspace/portalPaneTransport';
import type { PortalPaneRoute } from '../workspace/portalWorkspaceSnapshot';

export function createPrimaryRouteClientAction<T>(routePath: PortalPaneRoute) {
  return async function primaryRouteClientAction({
    request,
    serverAction,
  }: ClientActionFunctionArgs) {
    let clonedFormData: FormData;
    try {
      clonedFormData = await request.clone().formData();
    } catch {
      clonedFormData = new FormData();
    }

    try {
      return (await serverAction()) as T;
    } catch (error) {
      if (error instanceof Response && error.status >= 300 && error.status < 400) {
        throw error;
      }
      const publicError = createTransportPublicError({ error });
      const status = publicError.code === 'ERR_STREAM_TIMEOUT' ? 504 : 503;
      const typedError = buildTypedPaneActionError(routePath, clonedFormData, publicError) as T;
      return data(typedError, { status });
    }
  };
}
