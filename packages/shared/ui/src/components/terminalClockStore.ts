export function formatTerminalClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentSnapshot = formatTerminalClock(new Date());

function tick(): void {
  const next = formatTerminalClock(new Date());
  if (next !== currentSnapshot) {
    currentSnapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function subscribeTerminalClock(listener: () => void): () => void {
  if (listeners.size === 0) {
    currentSnapshot = formatTerminalClock(new Date());
    intervalId = setInterval(tick, 1_000);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function getTerminalClockSnapshot(): string {
  if (intervalId === null) {
    currentSnapshot = formatTerminalClock(new Date());
  }
  return currentSnapshot;
}
