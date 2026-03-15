
import { useEffect, useState } from "react";

const PIXEL_ENDPOINT = "/api/pixels";
const POLL_INTERVAL = 500; // 500ms for smooth updates

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

    async function poll() {
      try {
        const res = await fetch(PIXEL_ENDPOINT);
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.panels) {
          setData(json);
          setConnected(true);
          _latestData = json;
          _latestConnected = true;
        }
      } catch {
        if (active) {
          setConnected(false);
          _latestConnected = false;
        }
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { data, connected };
}
