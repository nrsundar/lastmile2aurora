import { useState, useCallback } from "react";

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
  const [connected] = useState(false);

  // WebSocket disabled — mixed content (HTTPS page can't open ws://)
  // Events are populated via API polling / simulate responses instead

  const clear = useCallback(() => setEvents([]), []);
  const addEvents = useCallback((newEvents: WSEvent[]) => {
    setEvents((prev) => [...newEvents, ...prev].slice(0, 200));
  }, []);
  return { events, connected, clear, addEvents };
}
