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
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = import.meta.env.VITE_API_URL?.replace(/^https?:/, proto) ?? `${proto}//${window.location.host}`;
    const ws = new WebSocket(`${base}/ws/stream`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data) as WSEvent;
      setEvents((prev) => [data, ...prev].slice(0, 200));
    };
    return () => ws.close();
  }, []);

  const clear = useCallback(() => setEvents([]), []);
  return { events, connected, clear };
}
