// Tiny event bus. Phases subscribe on mount and call the returned disposer on
// unmount, so nothing from a dead screen keeps listening.

export function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    emit(type, payload) {
      for (const fn of handlers.get(type) ?? []) fn(payload);
      for (const fn of handlers.get('*') ?? []) fn({ type, payload });
    },
    clear() { handlers.clear(); },
  };
}

export const bus = createBus();
