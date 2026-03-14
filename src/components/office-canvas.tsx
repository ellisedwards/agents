
import { useEffect, useRef, useState } from "react";
import { useAgentOfficeStore } from "./store";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  computeTransform,
  type CanvasTransform,
} from "./canvas-transform";
import { buildSpriteCache } from "./characters/sprite-cache";
import { renderScene, pokeCat, getCatPosition } from "./scene/renderer";
import { domToCanvas } from "./canvas-transform";
import { useUptimeKuma } from "@/hooks/use-uptime-kuma";
import { useClawHealth } from "@/hooks/use-claw-health";
import { useRelay } from "@/hooks/use-relay";
import { getThemeById } from "./scene/themes";

interface OfficeCanvasProps {
  onTransformChange?: (t: CanvasTransform) => void;
}

export function OfficeCanvas({ onTransformChange }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<CanvasTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const spriteCacheRef = useRef<ReturnType<typeof buildSpriteCache> | null>(
    null
  );
  const [canvasStyle, setCanvasStyle] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const frameRef = useRef(0);

  // Poll UptimeKuma status
  useUptimeKuma();
  useClawHealth();
  useRelay();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    spriteCacheRef.current = buildSpriteCache();

    function updateSize() {
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      transformRef.current = computeTransform(width, height);
      onTransformChange?.(transformRef.current);
      setCanvasStyle({
        width: CANVAS_WIDTH * transformRef.current.scale,
        height: CANVAS_HEIGHT * transformRef.current.scale,
      });
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    updateSize();

    // Game loop (30fps)
    const TARGET_MS = 1000 / 30;
    let lastTime = 0;
    let rafId: number;

    function loop(time: number) {
      rafId = requestAnimationFrame(loop);
      const delta = time - lastTime;
      if (delta < TARGET_MS) return;
      lastTime = time - (delta % TARGET_MS);

      frameRef.current++;
      const { agents, monitors, timeMode, themeId } = useAgentOfficeStore.getState();
      if (spriteCacheRef.current) {
        const timeOverride = timeMode === "auto" ? undefined : timeMode;
        const theme = getThemeById(themeId);
        renderScene(ctx, agents, spriteCacheRef.current, frameRef.current, monitors, timeOverride, theme);
      }
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [onTransformChange]);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const canvasPos = domToCanvas(
            transformRef.current,
            e.clientX - rect.left,
            e.clientY - rect.top
          );
          const catPos = getCatPosition();
          if (catPos) {
            const dx = canvasPos.x - catPos.x;
            const dy = canvasPos.y - catPos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 12) {
              pokeCat();
            }
          }
        }}
        style={{
          imageRendering: "pixelated",
          width: canvasStyle.width,
          height: canvasStyle.height,
        }}
      />
    </div>
  );
}
