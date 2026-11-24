import { type K8sPodEvent, K8sPodEventSchema } from './index.ts';

export interface PodEventStreamStore<TSnapshot> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TSnapshot;
  getServerSnapshot: () => TSnapshot;
  update: (updater: (current: TSnapshot) => TSnapshot) => void;
}

export interface CreatePodEventStreamStoreOptions<TSnapshot> {
  endpoint: string;
  initialSnapshot: TSnapshot;
  onPodEvent: (current: TSnapshot, event: K8sPodEvent) => TSnapshot;
}

export function createPodEventStreamStore<TSnapshot>(
  options: CreatePodEventStreamStoreOptions<TSnapshot>,
): PodEventStreamStore<TSnapshot> {
  let currentSnapshot = options.initialSnapshot;
  let eventSource: EventSource | null = null;
  const listeners = new Set<() => void>();

  const notifyListeners = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const applyPodEvent = (rawData: string): void => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawData);
    } catch {
      return;
    }
    const parsed = K8sPodEventSchema.safeParse(parsedJson);
    if (!parsed.success) return;

    const nextSnapshot = options.onPodEvent(currentSnapshot, parsed.data);
    if (nextSnapshot !== currentSnapshot) {
      currentSnapshot = nextSnapshot;
      notifyListeners();
    }
  };

  const ensureConnection = (): void => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    if (eventSource) return;

    try {
      const source = new EventSource(options.endpoint);
      eventSource = source;

      source.addEventListener('pod', event => {
        if (event instanceof MessageEvent && typeof event.data === 'string') {
          applyPodEvent(event.data);
        }
      });

      source.onerror = () => {
        // Close on stream EOF/error so simulated one-shot streams don't spin aggressively.
        source.close();
        if (eventSource === source) {
          eventSource = null;
        }
      };
    } catch {
      eventSource = null;
    }
  };

  const teardownConnection = (): void => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      ensureConnection();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        teardownConnection();
      }
    };
  };

  const update = (updater: (current: TSnapshot) => TSnapshot): void => {
    const nextSnapshot = updater(currentSnapshot);
    if (nextSnapshot !== currentSnapshot) {
      currentSnapshot = nextSnapshot;
      notifyListeners();
    }
  };

  return {
    subscribe,
    getSnapshot: () => currentSnapshot,
    getServerSnapshot: () => options.initialSnapshot,
    update,
  };
}
