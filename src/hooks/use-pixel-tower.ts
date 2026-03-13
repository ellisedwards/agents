
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
}

const EMPTY: PixelTowerData = {
  panels: {
    bottom: Array(25).fill("#000000"),
    middle: Array(25).fill("#000000"),
    top: Array(25).fill("#000000"),
  },
  claw: { pixel: 62, status: "idle", color: "#000000" },
};

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
        }
      } catch {
        if (active) setConnected(false);
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
