
import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentOfficeStore } from "../store";
import type { TimeMode, TowerSize } from "../store";
import {
  canvasToDOM,
  domToCanvas,
  type CanvasTransform,
} from "../canvas-transform";
import { assignDesks } from "../scene/desk-layout";
import { TEAM_COLORS } from "@/shared/types";

interface AgentLabelsProps {
  transform: CanvasTransform;
}

const HOVER_RADIUS = 22;

const TIME_OPTIONS: { value: TimeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "day", label: "Day" },
  { value: "dawn", label: "Dawn" },
  { value: "night", label: "Night" },
];

export function AgentLabels({ transform }: AgentLabelsProps) {
  const agents = useAgentOfficeStore((s) => s.agents);
  const labelsOn = useAgentOfficeStore((s) => s.labelsOn);
  const setLabelsOn = useAgentOfficeStore((s) => s.setLabelsOn);
  const timeMode = useAgentOfficeStore((s) => s.timeMode);
  const setTimeMode = useAgentOfficeStore((s) => s.setTimeMode);
  const towerSize = useAgentOfficeStore((s) => s.towerSize);
  const setTowerSize = useAgentOfficeStore((s) => s.setTowerSize);
  const towerVisible = useAgentOfficeStore((s) => s.towerVisible);
  const setTowerVisible = useAgentOfficeStore((s) => s.setTowerVisible);
  const towerOpacity = useAgentOfficeStore((s) => s.towerOpacity);
  const setTowerOpacity = useAgentOfficeStore((s) => s.setTowerOpacity);
  const deskMap = assignDesks(agents.map((a) => a.id));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasPos = domToCanvas(
        transform,
        e.clientX - rect.left,
        e.clientY - rect.top
      );

      let closest: string | null = null;
      let closestDist = HOVER_RADIUS;

      for (const agent of agents) {
        const pos = deskMap.get(agent.id);
        if (!pos) continue;
        const dx = canvasPos.x - pos.characterX;
        const dy = canvasPos.y - pos.characterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = agent.id;
        }
      }
      setHoveredId(closest);
    },
    [agents, deskMap, transform]
  );

  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ pointerEvents: "auto" }}
    >
      {/* Settings button + popup */}
      <div className="absolute top-2 right-2 z-10" ref={panelRef}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="font-mono text-[10px] px-1.5 py-0.5 rounded text-white/20 hover:text-white/50 transition-colors"
        >
          settings
        </button>

        {settingsOpen && (
          <div className="absolute top-6 right-0 bg-[#1e1e2e]/95 border border-white/10 rounded-md px-3 py-2.5 min-w-[140px] space-y-2.5">
            {/* Labels toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Labels</span>
              <button
                onClick={() => setLabelsOn(!labelsOn)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  labelsOn ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    labelsOn ? "left-[13px]" : "left-[3px]"
                  }`}
                />
              </button>
            </label>

            {/* Time of day */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Time</span>
              <select
                value={timeMode}
                onChange={(e) => setTimeMode(e.target.value as TimeMode)}
                className="w-full bg-white/10 text-white/70 font-mono text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none"
              >
                {TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#1e1e2e]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tower toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Tower</span>
              <button
                onClick={() => setTowerVisible(!towerVisible)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  towerVisible ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    towerVisible ? "left-[13px]" : "left-[3px]"
                  }`}
                />
              </button>
            </label>

            {/* Tower size */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Tower Size</span>
              <select
                value={towerSize}
                onChange={(e) => setTowerSize(e.target.value as TowerSize)}
                className="w-full bg-white/10 text-white/70 font-mono text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none"
              >
                <option value="small" className="bg-[#1e1e2e]">Small</option>
                <option value="medium" className="bg-[#1e1e2e]">Medium</option>
                <option value="large" className="bg-[#1e1e2e]">Large</option>
              </select>
            </div>

            {/* Tower opacity */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Tower Opacity</span>
              <input
                type="range"
                min={10}
                max={100}
                value={towerOpacity}
                onChange={(e) => setTowerOpacity(Number(e.target.value))}
                className="w-full h-1 accent-white/50"
              />
            </div>
          </div>
        )}
      </div>

      {agents.map((agent) => {
        const pos = deskMap.get(agent.id);
        if (!pos) return null;

        const domPos = canvasToDOM(
          transform,
          pos.characterX,
          pos.characterY
        );

        const isHovered = hoveredId === agent.id;
        const isActive = agent.currentTool !== null;
        const teamHex = TEAM_COLORS[agent.teamColor] ?? "#88cc88";

        return (
          <div key={agent.id}>
            {/* Tool label — always visible when active, colored by team */}
            {isActive && (
              <div
                className="absolute font-mono font-bold px-2 py-1 bg-[#181825]/90 rounded whitespace-nowrap pointer-events-none transition-opacity duration-150"
                style={{
                  left: domPos.x,
                  top: domPos.y - 21 * transform.scale,
                  transform: "translateX(-50%)",
                  fontSize: "15px",
                  color: teamHex,
                  opacity: isHovered ? 1 : 0.8,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  letterSpacing: "0.02em",
                }}
              >
                {agent.currentTool}
              </div>
            )}
            {/* Name tag — below character, on hover or always if labels on */}
            {(isHovered || labelsOn) && (
              <div
                className="absolute font-mono whitespace-nowrap pointer-events-none transition-opacity duration-150"
                style={{
                  left: domPos.x,
                  top: domPos.y + 16 * transform.scale,
                  transform: "translateX(-50%)",
                  fontSize: "10px",
                  color: agent.source === "openclaw" ? "#cc3333" : teamHex,
                  opacity: isHovered ? 1 : labelsOn ? 0.5 : 0,
                }}
              >
                {agent.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
