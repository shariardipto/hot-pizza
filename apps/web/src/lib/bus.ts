/** Tiny event bus (replaces `$nuxt.$emit` / `$nuxt.$on` from the original app). */
type Handler = (payload?: any) => void;
const handlers = new Map<string, Set<Handler>>();

export type BusEvent = 'CLOSE_MENU' | 'updateCursor' | 'resetCursor' | 'routeChanged';

export const bus = {
  on(event: BusEvent, fn: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(fn);
    return () => {
      handlers.get(event)?.delete(fn);
    };
  },
  emit(event: BusEvent, payload?: unknown) {
    handlers.get(event)?.forEach((fn) => fn(payload));
  },
};
