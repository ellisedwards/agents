
import { useEffect } from "react";
import { useAgentOfficeStore } from "@/components/store";
import type { AgentState } from "@/shared/types";

const RECONNECT_MS = 3000; // retry every 3s when disconnected
const STALE_MS = 5000;     // clear agents after 5s disconnect

export function useAgentSSE(enabled: boolean) {
  const setAgents = useAgentOfficeStore((s) => s.setAgents);
  const setConnectionStatus = useAgentOfficeStore(
    (s) => s.setConnectionStatus
  );

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      setConnectionStatus("connecting");
      es = new EventSource("/api/agents");

      es.onopen = () => {
        setConnectionStatus("connected");
        if (staleTimer) { clearTimeout(staleTimer); staleTimer = null; }
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      };

      es.onmessage = (event) => {
        try {
          const agents: AgentState[] = JSON.parse(event.data);
          setAgents(agents);
          setConnectionStatus("connected");
          if (staleTimer) { clearTimeout(staleTimer); staleTimer = null; }
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        setConnectionStatus("disconnected");
        // Clear stale agents after 5s of disconnect so they don't freeze
        if (!staleTimer) {
          staleTimer = setTimeout(() => setAgents([]), STALE_MS);
        }
        // Close the dead connection and schedule a fresh reconnect.
        // EventSource's built-in retry can stall — this ensures we
        // keep trying on a predictable interval.
        if (es) { es.close(); es = null; }
        if (!reconnectTimer && !disposed) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, RECONNECT_MS);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (es) es.close();
      if (staleTimer) clearTimeout(staleTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [enabled, setAgents, setConnectionStatus]);
}
