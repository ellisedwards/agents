import { useRef, useState, useCallback } from "react";
import { useTower2 } from "@/hooks/use-tower2";
import { useAgentOfficeStore } from "../store";
import type { TowerSize } from "../store";

const SIZES: Partial<Record<TowerSize, { px: number; gap: number }>> = {
  small: { px: 12, gap: 6 },
  medium: { px: 24, gap: 12 },
  large: { px: 36, gap: 18 },
};

function brighten(hex: string, factor: number): string {
  if (!hex || hex === "#000000") return hex;
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `rgb(${r},${g},${b})`;
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
  const tower2Visible = useAgentOfficeStore((s) => s.tower2Visible);

  const [pos, setPos] = useState(loadT2Pos);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.max(0, dragRef.current.origX + (e.clientX - dragRef.current.startX)),
      y: Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      try { localStorage.setItem(T2_POS_KEY, JSON.stringify(pos)); } catch {}
    }
    dragRef.current = null;
  }, [pos]);

  if (!connected || !tower2Visible || towerSize === "monolith") return null;
  const sizeConfig = SIZES[towerSize];
  if (!sizeConfig) return null;

  const { px, gap } = sizeConfig;
  const cols = data.width || 5;
  const rows = data.height || 10;
  const pixels = data.pixels || [];

  const w = cols * (px + gap) - gap;
  const h = rows * (px + gap) - gap;

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
          {pixels.map((color, i) => {
            const col = i % cols;
            const row = (rows - 1) - Math.floor(i / cols);
            const isLit = color !== "#000000";
            const displayColor = isLit ? brighten(color, 2) : color;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: col * (px + gap),
                  top: row * (px + gap),
                  width: px,
                  height: px,
                  backgroundColor: isLit ? displayColor : "rgba(255,255,255,0.06)",
                  borderRadius: px / 2,
                  boxShadow: isLit
                    ? `0 0 ${px}px ${displayColor}aa, 0 0 ${px * 2}px ${displayColor}44`
                    : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
