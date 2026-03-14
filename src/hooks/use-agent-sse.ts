
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

    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    es.onopen = () => {
      setConnectionStatus("connected");
      if (staleTimer) { clearTimeout(staleTimer); staleTimer = null; }
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
        staleTimer = setTimeout(() => setAgents([]), 5000);
      }
    };

    return () => es.close();
  }, [enabled, setAgents, setConnectionStatus]);
}
