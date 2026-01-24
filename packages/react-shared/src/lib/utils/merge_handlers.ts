export function mergeEventHandlers(...handlers: Array<((e: any) => void) | undefined>) {
  return (e: any) => {
    handlers.forEach(handler => {
      if (typeof handler === 'function') {
        handler(e);
      }
    });
  };
}
