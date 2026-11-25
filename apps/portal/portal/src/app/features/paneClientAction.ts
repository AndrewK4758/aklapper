import { type ClientActionFunctionArgs, data } from 'react-router';

import {
  buildTypedPaneActionError,
  createTransportPublicError,
} from '../workspace/portalPaneTransport';
import type { PortalPaneRoute } from '../workspace/portalWorkspaceSnapshot';

let isPageUnloading = false;
let unloadListenersBound = false;

function ensureUnloadListeners(): void {
  if (unloadListenersBound || typeof window === 'undefined') {
    return;
  }
  unloadListenersBound = true;
  const markUnloading = () => {
    isPageUnloading = true;
  };
  const clearUnloading = () => {
    isPageUnloading = false;
  };
  window.addEventListener('beforeunload', markUnloading);
  window.addEventListener('pagehide', markUnloading);
  window.addEventListener('pageshow', clearUnloading);
}

function isAbortException(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return false;
}

export function createPrimaryRouteClientAction<T>(routePath: PortalPaneRoute) {
  return async function primaryRouteClientAction({
    request,
    serverAction,
  }: ClientActionFunctionArgs) {
    ensureUnloadListeners();

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
      // Preserve navigation/reload aborts so pending turn recovery in sessionStorage is not wiped on unload.
      if (isPageUnloading || request.signal.aborted || isAbortException(error)) {
        throw error;
      }
      const publicError = createTransportPublicError({ error });
      const status = publicError.code === 'ERR_STREAM_TIMEOUT' ? 504 : 503;
      const typedError = buildTypedPaneActionError(routePath, clonedFormData, publicError) as T;
      return data(typedError, { status });
    }
  };
}
