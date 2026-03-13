
import { useEffect, useRef, useState } from "react";
import { useAgentOfficeStore } from "./store";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  computeTransform,
  type CanvasTransform,
} from "./canvas-transform";
import { buildSpriteCache } from "./characters/sprite-cache";
import { renderScene } from "./scene/renderer";
import { useUptimeKuma } from "@/hooks/use-uptime-kuma";

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
      const { agents, monitors, timeMode } = useAgentOfficeStore.getState();
      if (spriteCacheRef.current) {
        const timeOverride = timeMode === "auto" ? undefined : timeMode;
        renderScene(ctx, agents, spriteCacheRef.current, frameRef.current, monitors, timeOverride);
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
        style={{
          imageRendering: "pixelated",
          width: canvasStyle.width,
          height: canvasStyle.height,
        }}
      />
    </div>
  );
}
