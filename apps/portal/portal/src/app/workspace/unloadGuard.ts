export function generateClientCorrelationId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'pane-client-err';
}

export function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function waitForAbortablePromise(
  promise: Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>(resolveWait => {
    const done = () => {
      signal.removeEventListener('abort', done);
      resolveWait();
    };
    signal.addEventListener('abort', done, { once: true });
    void promise.finally(done);
  });
}

export interface InvocationUnloadTracker {
  readonly isUnloading: () => boolean;
  readonly dispose: () => void;
}

export function isAbortException(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return false;
}

export const BEFOREUNLOAD_RESET_MS = 1_500;

export function createInvocationUnloadTracker(
  beforeUnloadResetMs = BEFOREUNLOAD_RESET_MS,
): InvocationUnloadTracker {
  if (typeof window === 'undefined') {
    return {
      isUnloading: () => false,
      dispose: () => undefined,
    };
  }

  let unloading = false;
  let pageHidden = false;
  let resetTimer: number | undefined;
  let disposed = false;

  const clearResetTimer = () => {
    if (resetTimer !== undefined) {
      window.clearTimeout(resetTimer);
      resetTimer = undefined;
    }
  };

  const onBeforeUnload = () => {
    unloading = true;
    clearResetTimer();
    resetTimer = window.setTimeout(() => {
      resetTimer = undefined;
      if (!pageHidden) {
        unloading = false;
      }
    }, beforeUnloadResetMs);
  };

  const onPageHide = () => {
    clearResetTimer();
    pageHidden = true;
    unloading = true;
  };

  const onPageShow = () => {
    clearResetTimer();
    pageHidden = false;
    unloading = false;
  };

  const onUserInteraction = () => {
    if (!pageHidden && unloading) {
      clearResetTimer();
      unloading = false;
    }
  };

  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pointerdown', onUserInteraction);
  window.addEventListener('keydown', onUserInteraction);

  return {
    isUnloading: () => unloading,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearResetTimer();
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    },
  };
}
