import { useEffect, useRef, useState, useCallback } from "react";
import { useTower2 } from "@/hooks/use-tower2";
import { useAgentOfficeStore } from "../store";
import type { TowerSize } from "../store";

const COLS = 5;
const ROWS = 3;

// Perimeter path clockwise from bottom-left (12 pixels)
const PERIMETER: [number, number][] = [
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], // bottom L→R
  [4, 1],                                   // right mid
  [4, 0], [3, 0], [2, 0], [1, 0], [0, 0], // top R→L
  [0, 1],                                   // left mid
];

const TRAIL_LENGTH = 4;
const STEP_MS = 120;
const GOLD_HEAD = "#331A00";

function goldTrail(brightness: number): string {
  const r = Math.round(0x33 * brightness);
  const g = Math.round(0x1A * brightness);
  return `rgb(${r},${g},0)`;
}

const SIZES: Partial<Record<TowerSize, { px: number; gap: number }>> = {
  small: { px: 12, gap: 6 },
  medium: { px: 24, gap: 12 },
  large: { px: 36, gap: 18 },
};

function dotColor(status: string): string {
  if (status === "green") return "#00cc44";
  if (status === "red" || status === "down") return "#cc3333";
  if (status === "yellow" || status === "warning") return "#ccaa00";
  return "#333";
}

const T2_POS_KEY = "agent-office-tower2-pos";

function loadT2Pos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(T2_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: 12, y: 180 };
}

export function PixelTower2() {
  const { data, connected } = useTower2();
  const towerSize = useAgentOfficeStore((s) => s.towerSize);

  const [pos, setPos] = useState(loadT2Pos);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const newPos = {
      x: Math.max(0, dragRef.current.origX + (e.clientX - dragRef.current.startX)),
      y: Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY)),
    };
    setPos(newPos);
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      try { localStorage.setItem(T2_POS_KEY, JSON.stringify(pos)); } catch {}
    }
    dragRef.current = null;
  }, [pos]);

  // Animation state
  const [headIdx, setHeadIdx] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [doneFlash, setDoneFlash] = useState(false);
  const prevMode = useRef(data.mode);

  useEffect(() => {
    const isAnimating = data.mode === "thinking" || data.mode === "typing";
    if (isAnimating) {
      if (!animRef.current) {
        animRef.current = setInterval(() => {
          setHeadIdx(prev => (prev + 1) % PERIMETER.length);
        }, STEP_MS);
      }
    } else {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    }
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [data.mode]);

  useEffect(() => {
    if (prevMode.current === "thinking" && data.mode === "done") {
      setDoneFlash(true);
      setTimeout(() => setDoneFlash(false), 500);
    }
    prevMode.current = data.mode;
  }, [data.mode]);

  const tower2Visible = useAgentOfficeStore((s) => s.tower2Visible);
  if (!connected || !tower2Visible || towerSize === "monolith") return null;
  const sizeConfig = SIZES[towerSize];
  if (!sizeConfig) return null;

  const { px, gap } = sizeConfig;
  const isChasing = data.mode === "thinking" || data.mode === "typing";

  // Build pixel grid
  const grid: string[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill("rgba(255,255,255,0.06)")
  );

  if (doneFlash) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid[r][c] = "#003300";
  } else if (isChasing) {
    for (let t = 0; t < TRAIL_LENGTH; t++) {
      const idx = (headIdx - t + PERIMETER.length) % PERIMETER.length;
      const [col, row] = PERIMETER[idx];
      const brightness = Math.pow(0.7, t);
      grid[row][col] = t === 0 ? GOLD_HEAD : goldTrail(brightness);
    }
  } else if (data.mode === "dots" && data.dots.length > 0) {
    // Spread dots across the grid, filling row by row
    for (let i = 0; i < Math.min(data.dots.length, COLS * ROWS); i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      grid[r][c] = dotColor(data.dots[i].status);
    }
  }

  const w = COLS * (px + gap) - gap;
  const h = ROWS * (px + gap) - gap;

  return (
    <div
      className="absolute z-20 cursor-grab active:cursor-grabbing select-none"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="flex flex-col rounded-md bg-black/80 backdrop-blur-sm p-2">
        <div className="relative" style={{ width: w, height: h }}>
          {grid.flatMap((row, r) =>
            row.map((color, c) => {
              const isLit = color !== "rgba(255,255,255,0.06)";
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: c * (px + gap),
                    top: r * (px + gap),
                    width: px,
                    height: px,
                    backgroundColor: color,
                    borderRadius: px / 2,
                    boxShadow: isLit
                      ? `0 0 ${px}px ${color}aa, 0 0 ${px * 2}px ${color}44`
                      : undefined,
                    transition: isChasing ? "background-color 0.08s" : "background-color 0.3s",
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
