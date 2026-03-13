
import { useEffect, useRef } from "react";
import { useAgentOfficeStore } from "@/components/store";
import { createMockAgents, cycleMockState } from "@/shared/mock-data";
import type { AgentState } from "@/shared/types";

export function useDemoAgents(enabled: boolean, agentCount = 5) {
  const setAgents = useAgentOfficeStore((s) => s.setAgents);
  const setConnectionStatus = useAgentOfficeStore(
    (s) => s.setConnectionStatus
  );
  const agentsRef = useRef<AgentState[]>([]);

  useEffect(() => {
    if (!enabled) return;

    agentsRef.current = createMockAgents(agentCount);
    setAgents(agentsRef.current);
    setConnectionStatus("connected");

    const interval = setInterval(() => {
      agentsRef.current = cycleMockState(agentsRef.current);
      setAgents(agentsRef.current);
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, agentCount, setAgents, setConnectionStatus]);
}
