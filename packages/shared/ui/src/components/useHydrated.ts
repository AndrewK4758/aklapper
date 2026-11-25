import { useSyncExternalStore } from 'react';

const subscribeHydrated = () => () => undefined;
const getClientHydrated = () => true;
const getServerHydrated = () => false;

/**
 * Returns `false` during SSR and the initial hydration pass, then synchronously flips to `true`
 * once React hydration has committed on the client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydrated, getClientHydrated, getServerHydrated);
}
