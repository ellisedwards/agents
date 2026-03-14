
import { useCallback, useRef } from "react";
import { usePixelTower } from "@/hooks/use-pixel-tower";
import { useAgentOfficeStore } from "../store";
import type { TowerSize } from "../store";

const COLS = 5;
const ROWS = 5;

// Medium is the base. Small and large are true 0.5x/1.5x scales.
// Gap is ~50% of dot size for breathing room between dots.
const SIZES: Partial<Record<TowerSize, { px: number; gap: number; panelGap: number }>> = {
  small: { px: 12, gap: 6, panelGap: 8 },
  medium: { px: 24, gap: 12, panelGap: 16 },
  large: { px: 36, gap: 18, panelGap: 24 },
};

function brighten(hex: string, factor: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `rgb(${r},${g},${b})`;
}

function Panel({
  pixels,
  diffuse,
  px,
  gap,
}: {
  pixels: string[];
  diffuse?: boolean;
  px: number;
  gap: number;
}) {
  const w = COLS * (px + gap) - gap;
  const h = ROWS * (px + gap) - gap;
  return (
    <div className="relative" style={{ width: w, height: h }}>
      {pixels.map((color, i) => {
        const col = i % COLS;
        const row = (ROWS - 1) - Math.floor(i / COLS);
        const isLit = color !== "#000000";
        const displayColor = isLit && diffuse ? brighten(color, 2) : color;

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
              zIndex: 1,
            }}
          />
        );
      })}
      {diffuse && (
        <>
          <div
            className="absolute inset-0 rounded-sm pointer-events-none"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              backdropFilter: "blur(20px)",
              overflow: "hidden",
              zIndex: 5,
            }}
          />
          <div
            className="absolute inset-0 rounded-sm pointer-events-none"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              backdropFilter: "blur(20px)",
              overflow: "hidden",
              zIndex: 6,
            }}
          />
        </>
      )}
    </div>
  );
}

export function PixelTower() {
  const { data, connected } = usePixelTower();
  const towerSize = useAgentOfficeStore((s) => s.towerSize);
  const towerVisible = useAgentOfficeStore((s) => s.towerVisible);
  const towerPos = useAgentOfficeStore((s) => s.towerPos);
  const setTowerPos = useAgentOfficeStore((s) => s.setTowerPos);
  const towerOpacity = useAgentOfficeStore((s) => s.towerOpacity);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: towerPos.x, origY: towerPos.y };
  }, [towerPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const towerW = e.currentTarget.offsetWidth;
    const rawX = dragRef.current.origX + (e.clientX - dragRef.current.startX);
    const rawY = dragRef.current.origY + (e.clientY - dragRef.current.startY);
    setTowerPos({
      x: Math.max(0, Math.min(rawX, bounds.width - towerW)),
      y: Math.max(-bounds.height / 2, Math.min(rawY, bounds.height / 2)),
    });
  }, [setTowerPos]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Obelisk mode renders in the canvas scene, not as an overlay
  if (!connected || !towerVisible || towerSize === "obelisk") return null;
  const sizeConfig = SIZES[towerSize];
  if (!sizeConfig) return null;

  const { px, gap, panelGap } = sizeConfig;
  const panelH = ROWS * (px + gap) - gap;
  const totalH = 3 * panelH + 2 * panelGap + 16;

  return (
    <div
      className="absolute z-20 cursor-grab active:cursor-grabbing select-none"
      style={{
        left: towerPos.x,
        top: `calc(50% + ${towerPos.y}px)`,
        opacity: towerOpacity / 100,
        transform: `translateY(-${totalH / 2}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="flex flex-col rounded-md bg-black/80 backdrop-blur-sm p-2"
        style={{ gap: panelGap }}
      >
        <Panel pixels={data.panels.top} diffuse px={px} gap={gap} />
        <Panel pixels={data.panels.middle} px={px} gap={gap} />
        <Panel pixels={data.panels.bottom} px={px} gap={gap} />
      </div>
    </div>
  );
}
