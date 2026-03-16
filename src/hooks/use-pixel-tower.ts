
import { useEffect, useState } from "react";

const PIXEL_ENDPOINT = "/api/pixels";
const POLL_INTERVAL = 100; // 100ms for smooth canvas rendering
const REACT_UPDATE_INTERVAL = 250; // React state updates for HTML overlay

export interface PixelTowerData {
  panels: {
    bottom: string[];
    middle: string[];
    top: string[];
  };
  claw: {
    pixel: number;
    status: string;
    color: string;
  };
  clawActivity?: string;
}

const EMPTY: PixelTowerData = {
  panels: {
    bottom: Array(25).fill("#000000"),
    middle: Array(25).fill("#000000"),
    top: Array(25).fill("#000000"),
  },
  claw: { pixel: 62, status: "idle", color: "#000000" },
};

// Global accessor for canvas renderer (avoids prop threading)
let _latestData: PixelTowerData = EMPTY;
let _latestConnected = false;
export function getPixelTowerData(): { data: PixelTowerData; connected: boolean } {
  return { data: _latestData, connected: _latestConnected };
}

export function usePixelTower() {
  const [data, setData] = useState<PixelTowerData>(EMPTY);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    let lastReactUpdate = 0;
    let consecutiveFailures = 0;

    async function loop() {
      while (active) {
        try {
          const res = await fetch(PIXEL_ENDPOINT, { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const json = await res.json();
            if (active && json.panels) {
              _latestData = json;
              _latestConnected = true;
              consecutiveFailures = 0;
              const now = Date.now();
              if (now - lastReactUpdate > REACT_UPDATE_INTERVAL) {
                setData(json);
                setConnected(true);
                lastReactUpdate = now;
              }
            }
          } else {
            consecutiveFailures++;
          }
        } catch {
          consecutiveFailures++;
        }
        // Only mark disconnected after 5 consecutive failures (~0.5s of no data)
        if (consecutiveFailures >= 5 && active) {
          _latestConnected = false;
          setConnected(false);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
    }

    loop();
    return () => { active = false; };
  }, []);

  return { data, connected };
}
