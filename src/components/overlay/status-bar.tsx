
import { useState, useEffect, useCallback } from "react";
import { useAgentOfficeStore } from "../store";

export function StatusBar() {
  const agents = useAgentOfficeStore((s) => s.agents);
  const status = useAgentOfficeStore((s) => s.connectionStatus);

  const ccCount = agents.filter((a) => a.source === "cc").length;
  const ocCount = agents.filter((a) => a.source === "openclaw").length;

  const [brightness, setBrightness] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Poll brightness every 10s (only when not dragging)
  useEffect(() => {
    let active = true;
    const poll = () => {
      if (dragging) return;
      fetch("/api/brightness")
        .then((r) => r.json())
        .then((d) => { if (active && d.brightness != null) setBrightness(d.brightness); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, [dragging]);

  const handleBrightness = useCallback((val: number) => {
    setBrightness(val);
    fetch(`/api/brightness/${val}`).catch(() => {});
  }, []);

  const handleClear = () => {
    fetch("/api/agents/clear", { method: "POST" }).catch(() => {});
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#08080e]/95 flex items-center px-3 gap-4 font-mono text-[10px]">
      <span className="text-neutral-500">
        {status === "connecting" && "Scanning for agents..."}
        {status === "disconnected" && (
          <span className="text-yellow-500">Reconnecting...</span>
        )}
        {status === "connected" &&
          (agents.length === 0 ? "No active agents" : `${agents.length} agents`)}
      </span>
      {status === "connected" && ccCount > 0 && (
        <span className="text-[#c4856c] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c4856c] inline-block" />
          CC: {ccCount}
        </span>
      )}
      {status === "connected" && ocCount > 0 && (
        <span className="text-[#cc3333] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#cc3333] inline-block" />
          OC: {ocCount}
        </span>
      )}
      {status === "connected" && ccCount > 0 && (
        <button
          onClick={handleClear}
          className="text-neutral-500 hover:text-neutral-300 transition-colors underline"
          title="Clear stale agents"
        >
          clear
        </button>
      )}

      {/* Brightness slider — right side */}
      {brightness !== null && (
        <div className="ml-auto flex items-center gap-2 text-neutral-500">
          <span className="text-[9px]">💡</span>
          <input
            type="range"
            min={1}
            max={100}
            value={brightness}
            onChange={(e) => handleBrightness(Number(e.target.value))}
            onMouseDown={() => setDragging(true)}
            onMouseUp={() => setDragging(false)}
            onTouchStart={() => setDragging(true)}
            onTouchEnd={() => setDragging(false)}
            className="w-16 h-1 accent-yellow-500/70"
            title={`Brightness: ${brightness}%`}
          />
          <span className="text-[9px] w-5 text-right">{brightness}</span>
        </div>
      )}
    </div>
  );
}
