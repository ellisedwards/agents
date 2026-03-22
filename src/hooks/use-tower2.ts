import { useEffect, useState } from "react";

const POLL_INTERVAL = 250;

export interface Tower2Data {
  mode: string;
  animating: boolean;
  dots: { name: string; status: string }[];
  pixels: string[];
  width: number;
  height: number;
}

const EMPTY: Tower2Data = { mode: "idle", animating: false, dots: [], pixels: [], width: 5, height: 10 };

export function useTower2() {
  const [data, setData] = useState<Tower2Data>(EMPTY);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    let failures = 0;

    async function poll() {
      while (active) {
        try {
          const res = await fetch("/api/tower2-pixels", { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const json = await res.json();
            if (active && json.ok) {
              setData(prev => ({ ...prev, ...json }));
              setConnected(true);
              failures = 0;
            }
          } else {
            failures++;
          }
        } catch {
          failures++;
        }
        if (failures >= 5 && active) setConnected(false);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    }

    poll();
    return () => { active = false; };
  }, []);

  return { data, connected };
}
