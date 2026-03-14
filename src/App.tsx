import { useState } from "react";
import { useDemoAgents } from "@/hooks/use-demo-agents";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { useAgentOfficeStore } from "@/components/store";
import { OfficeCanvas } from "@/components/office-canvas";
import { type CanvasTransform } from "@/components/canvas-transform";
import { StatusBar } from "@/components/overlay/status-bar";
import { AgentLabels } from "@/components/overlay/agent-labels";
import { SpeechBubbles } from "@/components/overlay/speech-bubble";
import { PixelTower } from "@/components/overlay/pixel-tower";

export function App() {
  const isDemo = new URLSearchParams(window.location.search).get("demo") === "true";
  const agents = useAgentOfficeStore((s) => s.agents);
  const clawDetailOpen = useAgentOfficeStore((s) => s.clawDetailOpen);
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const toggleClawDetail = useAgentOfficeStore((s) => s.toggleClawDetail);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  useDemoAgents(isDemo);
  useAgentSSE(!isDemo);

  return (
    <div className="relative w-full h-screen bg-[#08080e] flex items-center justify-center">
      <OfficeCanvas onTransformChange={setTransform} />
      <AgentLabels transform={transform} />
      <SpeechBubbles transform={transform} />
      <PixelTower />
      <StatusBar />

      {/* Claw health detail panel */}
      {clawDetailOpen && clawHealth && (
        <div
          className="absolute inset-0 z-40"
          onClick={toggleClawDetail}
        >
          <div
            className="absolute top-12 left-12 bg-[#12121e]/95 border border-white/10 rounded-md p-3 min-w-[200px] font-mono text-[10px] space-y-2 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white/50 text-[9px] border-b border-white/10 pb-1 mb-1">Claw Server Diagnostics</div>
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
            {clawHealth.animationRunning && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Animation</span>
                <span className="text-yellow-400">running</span>
              </div>
            )}
            <div className="text-neutral-500 text-[8px] pt-1 border-t border-white/10">
              Auto-recovery: active | Polling: 5s
            </div>
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
