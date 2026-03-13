
import { useEffect } from "react";
import { useAgentOfficeStore, type MonitorStatus } from "@/components/store";

const POLL_INTERVAL = 30000; // 30 seconds
const KUMA_ENDPOINT = "/api/uptime-kuma";

export function useUptimeKuma() {
  const setMonitors = useAgentOfficeStore((s) => s.setMonitors);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(KUMA_ENDPOINT);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.monitors)) {
          const monitors: MonitorStatus[] = data.monitors.map((m: any) => ({
            id: m.id,
            name: m.name,
            up: m.up,
            ping: m.ping,
          }));
          setMonitors(monitors);
        }
      } catch (e) {
        // Silently fail - server might not be available
        console.debug("[uptime-kuma] Failed to fetch:", e);
      }
    }

    // Initial fetch
    fetchStatus();

    // Poll every 30s
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [setMonitors]);
}
