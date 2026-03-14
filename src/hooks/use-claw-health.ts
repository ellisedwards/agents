import { useEffect } from "react";
import { useAgentOfficeStore, type ClawHealth } from "@/components/store";

const POLL_INTERVAL = 5000;
const ENDPOINT = "/api/claw-health";

export function useClawHealth() {
  const setClawHealth = useAgentOfficeStore((s) => s.setClawHealth);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) return;
        const data: ClawHealth = await res.json();
        setClawHealth(data);
      } catch (e) {
        console.debug("[claw-health] Failed to fetch:", e);
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [setClawHealth]);
}
