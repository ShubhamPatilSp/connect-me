/**
 * In-process pub/sub for realtime delivery (SSE).
 *
 * Single-instance deployments fan out directly through an EventEmitter.
 * For multi-instance deployments, swap `publish`/`subscribe` for Redis pub/sub
 * or Postgres LISTEN/NOTIFY — the call sites do not change.
 */

import { EventEmitter } from "node:events";

export type BusEvent =
  | { type: "match"; matchId: string; userId: string; name: string; photo: string | null }
  | { type: "message"; matchId: string; messageId: number; senderId: string; body: string; createdAt: number }
  | { type: "read"; matchId: string; readerId: string; readAt: number }
  | { type: "typing"; matchId: string; userId: string };

const g = globalThis as unknown as { __connexaBus?: EventEmitter };

function bus(): EventEmitter {
  if (!g.__connexaBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    g.__connexaBus = emitter;
  }
  return g.__connexaBus;
}

export function publish(userId: string, event: BusEvent): void {
  bus().emit(`user:${userId}`, event);
}

export function subscribe(userId: string, fn: (event: BusEvent) => void): () => void {
  const channel = `user:${userId}`;
  bus().on(channel, fn);
  return () => bus().off(channel, fn);
}
