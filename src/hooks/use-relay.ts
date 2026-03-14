import { useEffect } from "react";
import { useAgentOfficeStore, type RelayMessage } from "@/components/store";

const POLL_INTERVAL = 5000;
const ENDPOINT = "/api/relay";

export function useRelay() {
  const setRelayMessages = useAgentOfficeStore((s) => s.setRelayMessages);

  useEffect(() => {
    async function fetchRelay() {
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.replies)) {
          setRelayMessages(data.replies as RelayMessage[]);
        }
      } catch (e) {
        console.debug("[relay] Failed to fetch:", e);
      }
    }

    fetchRelay();
    const interval = setInterval(fetchRelay, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [setRelayMessages]);
}
