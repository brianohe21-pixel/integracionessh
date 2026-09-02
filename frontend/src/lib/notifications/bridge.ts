import type { RealtimeEvent } from "@/lib/realtime/events";

type RealtimeListener = (event: RealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();

export function subscribeRealtimeEvents(listener: RealtimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitRealtimeEvent(event: RealtimeEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
