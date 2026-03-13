
import { useEffect } from "react";
import { useAgentOfficeStore } from "@/components/store";
import type { AgentState } from "@/shared/types";

export function useAgentSSE(enabled: boolean) {
  const setAgents = useAgentOfficeStore((s) => s.setAgents);
  const setConnectionStatus = useAgentOfficeStore(
    (s) => s.setConnectionStatus
  );

  useEffect(() => {
    if (!enabled) return;

    setConnectionStatus("connecting");
    const es = new EventSource("/api/agents");

    es.onopen = () => setConnectionStatus("connected");

    es.onmessage = (event) => {
      try {
        const agents: AgentState[] = JSON.parse(event.data);
        setAgents(agents);
        setConnectionStatus("connected");
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      setConnectionStatus("disconnected");
      // EventSource auto-reconnects
    };

    return () => es.close();
  }, [enabled, setAgents, setConnectionStatus]);
}
