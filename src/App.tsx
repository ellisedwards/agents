import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
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
// HelpGuide is now inside agent-labels.tsx (unified ? panel in top bar)

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
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const debugOn = useAgentOfficeStore((s) => s.debugOn);
  const toggleClawDetail = useAgentOfficeStore((s) => s.toggleClawDetail);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [diagPos, setDiagPos] = useState({ x: 12, y: 12 });
  const diagDrag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onDiagMouseDown = useCallback((e: React.MouseEvent) => {
    diagDrag.current = { startX: e.clientX, startY: e.clientY, origX: diagPos.x, origY: diagPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!diagDrag.current) return;
      setDiagPos({
        x: diagDrag.current.origX + (ev.clientX - diagDrag.current.startX),
        y: diagDrag.current.origY + (ev.clientY - diagDrag.current.startY),
      });
    };
    const onUp = () => {
      diagDrag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [diagPos]);

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
      <StatusBar />
      <Toasts />
      {debugOn && <DebugPanel />}

      {/* Claw health detail panel — draggable */}
      {clawDetailOpen && clawHealth && (
          <div
            className="absolute bg-[#12121e]/95 border border-white/10 rounded-md p-3 min-w-[200px] font-mono text-[10px] space-y-2 z-50 select-none"
            style={{ left: diagPos.x, top: diagPos.y }}
            onMouseDown={onDiagMouseDown}
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
              <span className="text-white/50 text-[9px]">Claw Server Diagnostics</span>
              <button onClick={toggleClawDetail} className="text-neutral-500 hover:text-white text-[9px] ml-4">x</button>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Server</span>
              <span className={clawHealth.reachable ? "text-green-400" : "text-red-400"}>
                {clawHealth.reachable ? "reachable" : "unreachable"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Yeelight</span>
              <span className={clawHealth.yeelightConnected ? "text-green-400" : "text-red-400"}>
                {clawHealth.yeelightConnected ? "connected" : "disconnected"}
              </span>
            </div>
            {clawHealth.matrixMode && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Mode</span>
                <span className="text-cyan-400/70">{clawHealth.matrixMode}</span>
              </div>
            )}
            {clawHealth.brightness != null && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Brightness</span>
                <span className="text-neutral-300">{clawHealth.brightness}%</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-400">Slots</span>
              <span className="text-neutral-300 flex gap-1">
                {clawHealth.slots.map((s, i) => (
                  <span key={i} className={`w-2 h-2 rounded-sm inline-block ${
                    s === "active" ? "bg-green-400" : s === "off" ? "bg-neutral-600" : "bg-yellow-400"
                  }`} title={`Slot ${i}: ${s}`} />
                ))}
              </span>
            </div>
            {/* Slot detail — who owns each slot */}
            {clawHealth.slotsDetail && clawHealth.slotsDetail.some(s => s.name) && (
              <div className="space-y-0.5 pt-1 border-t border-white/5">
                {clawHealth.slotsDetail.map((sd, i) => (
                  sd.name ? (
                    <div key={i} className="flex justify-between">
                      <span className="text-neutral-500">S{i}: {sd.name}</span>
                      <span className="text-neutral-400">
                        {sd.ttl_remaining != null && sd.ttl_remaining > 0 ? `${sd.ttl_remaining}s` : sd.state}
                      </span>
                    </div>
                  ) : null
                ))}
                {(clawHealth.waitingCount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Waiting</span>
                    <span className="text-yellow-400">{clawHealth.waitingCount}</span>
                  </div>
                )}
              </div>
            )}
            {/* Zones */}
            {clawHealth.zones && (
              <div className="pt-1 border-t border-white/5">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Zones</span>
                  <span className="text-neutral-500 text-[8px]">
                    {[
                      clawHealth.zones.thinking !== "off" && `think:${clawHealth.zones.thinking}`,
                      clawHealth.zones.display !== "clear" && `disp:${clawHealth.zones.display}`,
                      `ctx:${clawHealth.zones.context}`,
                    ].filter(Boolean).join(" ")}
                  </span>
                </div>
              </div>
            )}
            {clawHealth.animationRunning && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Animation</span>
                <span className="text-yellow-400">running</span>
              </div>
            )}
            {clawHealth.transitionInProgress && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Transition</span>
                <span className="text-cyan-400">in progress</span>
              </div>
            )}
            {/* Uptime monitors */}
            {clawHealth.uptimeMonitors && clawHealth.uptimeMonitors.length > 0 && (
              <div className="pt-1 border-t border-white/5 space-y-0.5">
                <span className="text-neutral-500 text-[8px]">Network</span>
                {clawHealth.uptimeMonitors.map((m, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-neutral-400">{m.name}</span>
                    <span className={m.up ? "text-green-400/70" : "text-red-400"}>
                      {m.up ? `${m.ping}ms` : "down"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-neutral-500 text-[8px] pt-1 border-t border-white/10">
              Auto-recovery: active | Polling: 5s
            </div>
          </div>
      )}

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
