"use client";

import { useEffect, useRef, useState } from "react";

export interface RealtimeEvent {
  type: "match" | "message" | "read" | "typing";
  [key: string]: unknown;
}

/**
 * SSE subscription with automatic reconnection.
 *
 * EventSource reconnects on its own, but a dead server (or a proxy that
 * buffers) leaves the socket silently open. The watchdog closes and reopens
 * the stream if nothing — including heartbeats — arrives for 45s.
 */
export function useRealtime(onEvent: (event: RealtimeEvent) => void, enabled = true): boolean {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let lastActivity = Date.now();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/stream");

      source.onopen = () => {
        lastActivity = Date.now();
        setConnected(true);
      };

      const dispatch = (event: MessageEvent) => {
        lastActivity = Date.now();
        try {
          const parsed = JSON.parse(event.data) as RealtimeEvent;
          handlerRef.current(parsed);
        } catch {
          /* ignore malformed frames */
        }
      };

      source.addEventListener("match", dispatch as EventListener);
      source.addEventListener("message", dispatch as EventListener);
      source.addEventListener("read", dispatch as EventListener);
      source.addEventListener("typing", dispatch as EventListener);

      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (!closed) retry = setTimeout(connect, 2500);
      };
    };

    connect();

    watchdog = setInterval(() => {
      if (Date.now() - lastActivity > 45_000) {
        setConnected(false);
        source?.close();
        connect();
      }
    }, 15_000);

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (watchdog) clearInterval(watchdog);
      source?.close();
    };
  }, [enabled]);

  return connected;
}

export function useToast(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return [message, show];
}

export function relativeTime(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d`;
  return new Date(seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function clockTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function distanceLabel(km: number | null): string {
  if (km === null) return "";
  if (km < 1) return "In your city";
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}
