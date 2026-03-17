
import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentOfficeStore } from "../store";
import type { TimeMode, TowerSize, ThemeId, EditMode } from "../store";
import { ALL_THEMES } from "../scene/themes";
import {
  canvasToDOM,
  domToCanvas,
  type CanvasTransform,
} from "../canvas-transform";
import { assignDesks } from "../scene/desk-layout";
import { getAgentPosition, getCatPosition, pokeCat, triggerFloat, getHealthPosterBounds, getAgentSlot } from "../scene/renderer";
import { triggerUfo } from "../scene/environment";
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
  const debugOn = useAgentOfficeStore((s) => s.debugOn);
  const setDebugOn = useAgentOfficeStore((s) => s.setDebugOn);
  const timeMode = useAgentOfficeStore((s) => s.timeMode);
  const setTimeMode = useAgentOfficeStore((s) => s.setTimeMode);
  const themeId = useAgentOfficeStore((s) => s.themeId);
  const setThemeId = useAgentOfficeStore((s) => s.setThemeId);
  const towerSize = useAgentOfficeStore((s) => s.towerSize);
  const setTowerSize = useAgentOfficeStore((s) => s.setTowerSize);
  const towerVisible = useAgentOfficeStore((s) => s.towerVisible);
  const setTowerVisible = useAgentOfficeStore((s) => s.setTowerVisible);
  const statusPosterOn = useAgentOfficeStore((s) => s.statusPosterOn);
  const setStatusPosterOn = useAgentOfficeStore((s) => s.setStatusPosterOn);
  const healthPosterOn = useAgentOfficeStore((s) => s.healthPosterOn);
  const setHealthPosterOn = useAgentOfficeStore((s) => s.setHealthPosterOn);
  const towerOpacity = useAgentOfficeStore((s) => s.towerOpacity);
  const setTowerOpacity = useAgentOfficeStore((s) => s.setTowerOpacity);
  const editMode = useAgentOfficeStore((s) => s.editMode);
  const setEditMode = useAgentOfficeStore((s) => s.setEditMode);
  const deskEligible = agents.filter((a) =>
    a.state !== "lounging" && a.state !== "departing" &&
    (a.subagentClass === null || a.subagentClass === undefined)
  );
  const deskMap = assignDesks(deskEligible.map((a) => a.id));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const editPanelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!settingsOpen && !editOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (editOpen && editPanelRef.current && !editPanelRef.current.contains(e.target as Node)) {
        setEditOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen, editOpen]);

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
        const walkPos = getAgentPosition(agent.id);
        const cx = walkPos ? walkPos.x : pos.characterX;
        const cy = walkPos ? walkPos.y : pos.characterY;
        const dx = canvasPos.x - cx;
        const dy = canvasPos.y - cy;
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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasPos = domToCanvas(
        transform,
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      // Health poster click
      const hpb = getHealthPosterBounds();
      if (hpb && canvasPos.x >= hpb.x && canvasPos.x <= hpb.x + hpb.w &&
          canvasPos.y >= hpb.y && canvasPos.y <= hpb.y + hpb.h) {
        useAgentOfficeStore.getState().toggleClawDetail();
        return;
      }
      // Cat click
      const catPos = getCatPosition();
      if (catPos) {
        const dx = canvasPos.x - catPos.x;
        const dy = canvasPos.y - catPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 15) {
          pokeCat();
        }
      }
    },
    [transform]
  );

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ pointerEvents: "auto" }}
    >
      {/* Edit + Settings buttons */}
      <div className="absolute top-2 right-2 z-30 flex items-center gap-1">
        {/* Edit button + dropdown */}
        <div ref={editPanelRef} className="relative">
          <button
            onClick={() => { setEditOpen((v) => !v); setSettingsOpen(false); }}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              editMode !== "none" ? "text-white/50" : "text-white/20 hover:text-white/50"
            }`}
          >
            edit
          </button>
          {editOpen && (
            <div className="absolute top-6 right-0 bg-[#1e1e2e]/95 border border-white/10 rounded-md py-1 min-w-[110px]">
              {([
                ["none", "Off"],
                ["background", "Background"],
                ["tower-decor", "Tower Decor"],
                ["lounge", "Lounge"],
                ["posters", "Posters"],
              ] as [string, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setEditMode(value as EditMode); setEditOpen(false); }}
                  className={`block w-full text-left font-mono text-[10px] px-3 py-1 transition-colors ${
                    editMode === value
                      ? "text-white/90 bg-white/10"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings button + popup */}
        <div ref={panelRef} className="relative">
        <button
          onClick={() => { setSettingsOpen((v) => !v); setEditOpen(false); }}
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

            {/* Debug toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Debug</span>
              <button
                onClick={() => setDebugOn(!debugOn)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  debugOn ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    debugOn ? "left-[13px]" : "left-[3px]"
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

            {/* Theme */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Theme</span>
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value as ThemeId)}
                className="w-full bg-white/10 text-white/70 font-mono text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none"
              >
                {ALL_THEMES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#1e1e2e]">
                    {t.name}
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

            {/* Status poster toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Monitors</span>
              <button
                onClick={() => setStatusPosterOn(!statusPosterOn)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  statusPosterOn ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    statusPosterOn ? "left-[13px]" : "left-[3px]"
                  }`}
                />
              </button>
            </label>

            {/* Health poster toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Claw</span>
              <button
                onClick={() => setHealthPosterOn(!healthPosterOn)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  healthPosterOn ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    healthPosterOn ? "left-[13px]" : "left-[3px]"
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
                <option value="monolith" className="bg-[#1e1e2e]">Monolith</option>
              </select>
            </div>

            {/* Tower opacity */}
            {towerSize !== "monolith" && (
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
            )}



            {/* Triggers */}
            <div className="pt-1 border-t border-white/5 space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Triggers</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => pokeCat()}
                  className="font-mono text-[9px] text-white/50 bg-white/10 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors"
                >
                  startle
                </button>
                <button
                  onClick={() => triggerFloat()}
                  className="font-mono text-[9px] text-white/50 bg-white/10 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors"
                >
                  float
                </button>
                <button
                  onClick={() => triggerUfo()}
                  className="font-mono text-[9px] text-white/50 bg-white/10 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors"
                >
                  ufo
                </button>
              </div>
            </div>

            {/* Build code */}
            <div className="pt-1 border-t border-white/5">
              <button
                onClick={() => navigator.clipboard.writeText(__BUILD_ID__)}
                className="font-mono text-[8px] text-white/25 hover:text-white/50 transition-colors"
                title="Click to copy build ID"
              >
                build: {__BUILD_ID__}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {agents.map((agent) => {
        // Use actual rendered position from the scene
        const walkPos = getAgentPosition(agent.id);
        const pos = deskMap.get(agent.id);
        if (!walkPos && !pos) return null;
        const charX = walkPos ? walkPos.x : pos!.characterX;
        const charY = walkPos ? walkPos.y : pos!.characterY;

        const domPos = canvasToDOM(transform, charX, charY);

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
                  top: domPos.y - 14 * transform.scale,
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
            {(isHovered || labelsOn || debugOn) && (
              <div
                className="absolute font-mono font-bold whitespace-nowrap pointer-events-none transition-opacity duration-150 flex flex-col items-center"
                style={{
                  left: domPos.x,
                  top: domPos.y + 16 * transform.scale,
                  transform: "translateX(-50%)",
                  opacity: isHovered ? 1 : (labelsOn || debugOn) ? 0.7 : 0,
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}
              >
                <span style={{
                  fontSize: "13px",
                  color: agent.source === "openclaw" ? "#cc3333" : teamHex,
                }}>
                  {agent.name}
                </span>
                {(labelsOn || debugOn) && (() => {
                  const slot = getAgentSlot(agent.id);
                  const deskIdx = deskEligible.indexOf(agent);
                  return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>d{deskIdx}{slot !== undefined ? ` s${slot}` : ""}</span>;
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
