import { useEffect, useRef, useState, useCallback } from "react";

interface WSEvent {
  type: string;
  query_hash?: string;
  oracle_ms?: number;
  pg_ms?: number;
  passed?: boolean;
  regression?: boolean;
}

export function useWebSocket() {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    if (!apiUrl || apiUrl.startsWith("https:")) {
      // Can't do ws:// from https:// page (mixed content). Skip WebSocket.
      setConnected(false);
      return;
    }
    const base = apiUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/ws/stream`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data) as WSEvent;
      setEvents((prev) => [data, ...prev].slice(0, 200));
    };
    return () => ws.close();
  }, []);

  const clear = useCallback(() => setEvents([]), []);
  return { events, connected, clear };
}
