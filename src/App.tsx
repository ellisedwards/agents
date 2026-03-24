import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useDemoAgents } from "@/hooks/use-demo-agents";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { useAgentOfficeStore } from "@/components/store";
import { OfficeCanvas } from "@/components/office-canvas";
import { type CanvasTransform } from "@/components/canvas-transform";
import { StatusBar } from "@/components/overlay/status-bar";
import { AgentLabels } from "@/components/overlay/agent-labels";
import { SpeechBubbles } from "@/components/overlay/speech-bubble";
import { PixelTower } from "@/components/overlay/pixel-tower";
import { DebugPanel } from "@/components/overlay/debug-panel";
import { PixelEditor } from "@/components/overlay/pixel-editor";
import { Toasts } from "@/components/overlay/toasts";
import { PixelTower2 } from "@/components/overlay/pixel-tower2";
import { SystemStatusPanel } from "@/components/overlay/system-status-panel";

const LazySpriteEditor = lazy(() =>
  import("@/components/sprite-editor/SpriteEditor").then(m => ({ default: m.SpriteEditor }))
);

export function App() {
  if (new URLSearchParams(window.location.search).get("sprite-editor") === "true") {
    return <Suspense fallback={<div className="w-full h-screen bg-[#1a1a2e] flex items-center justify-center text-white/50 font-mono">Loading sprite editor...</div>}><LazySpriteEditor /></Suspense>;
  }

  const isDemo = new URLSearchParams(window.location.search).get("demo") === "true";
  const agents = useAgentOfficeStore((s) => s.agents);
  const clawDetailOpen = useAgentOfficeStore((s) => s.clawDetailOpen);
  const debugOn = useAgentOfficeStore((s) => s.debugOn);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useDemoAgents(isDemo);
  useAgentSSE(!isDemo);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = useAgentOfficeStore.getState();
      switch (e.key.toLowerCase()) {
        case "d": s.setDebugOn(!s.debugOn); break;
        case "l": s.setLabelsOn(!s.labelsOn); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#08080e] flex items-center justify-center">
      <OfficeCanvas onTransformChange={setTransform} canvasRef={canvasRef} />
      <AgentLabels transform={transform} />
      <PixelEditor canvasRef={canvasRef} />
      <SpeechBubbles transform={transform} />
      <PixelTower />
      <PixelTower2 />
      <StatusBar />
      <Toasts />
      {debugOn && <DebugPanel />}

      {clawDetailOpen && <SystemStatusPanel />}

      {isDemo && (
        <div className="absolute bottom-4 left-4 text-white font-mono text-xs opacity-40 space-y-1">
          {agents.map((a) => (
            <div key={a.id}>
              {a.name}: {a.state}
              {a.currentTool ? ` (${a.currentTool})` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
