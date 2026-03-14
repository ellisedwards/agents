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
