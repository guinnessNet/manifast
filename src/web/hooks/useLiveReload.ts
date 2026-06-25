import { useEffect, useRef, useState } from "react";
import type { WsMessage } from "@shared/types";

export type ConnStatus = "connecting" | "open" | "closed";

/**
 * Subscribe to /ws. Calls onMessage for each change event. On reconnect after a
 * drop it calls onResync (so the caller can re-fetch the full workspace).
 * Reconnects with exponential backoff.
 */
export function useLiveReload(
  onMessage: (m: WsMessage) => void,
  onResync: () => void,
): ConnStatus {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const onMessageRef = useRef(onMessage);
  const onResyncRef = useRef(onResync);
  onMessageRef.current = onMessage;
  onResyncRef.current = onResync;

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);

      ws.onopen = () => {
        setStatus("open");
        if (attempt > 0) onResyncRef.current();
        attempt = 0;
      };
      ws.onmessage = (e) => {
        try {
          onMessageRef.current(JSON.parse(e.data as string) as WsMessage);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (disposed) return;
        attempt++;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return status;
}
