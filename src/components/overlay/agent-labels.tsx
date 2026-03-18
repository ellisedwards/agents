
import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentOfficeStore } from "../store";
import type { TimeMode, TowerSize, ThemeId, EditMode } from "../store";
import { ALL_THEMES, getThemeById } from "../scene/themes";
import {
  canvasToDOM,
  domToCanvas,
  type CanvasTransform,
} from "../canvas-transform";
import { assignDesks } from "../scene/desk-layout";
import { getAgentPosition, getCatPosition, pokeCat, triggerFloat, getHealthPosterBounds, getAgentSlot, getSlotMap, setAgentCharacter, getAgentCharacter, STARTERS, getLastDeskPos } from "../scene/renderer";
import { triggerUfo } from "../scene/environment";
import { TEAM_COLORS } from "@/shared/types";

const ACHIEVEMENT_DATA: Record<string, { icon: string; name: string }> = {
  "centurion": { icon: "\u{1F451}", name: "Centurion — Reach level 50" },
  "polymath": { icon: "\u{1F9E0}", name: "Polymath — Master 5+ tools" },
  "marathon": { icon: "\u{1F3C3}", name: "Marathon — 2-hour streak" },
  "shell-shocked": { icon: "\u{1F41A}", name: "Shell Shocked — 1000 Bash uses" },
  "critical-mass": { icon: "\u{1F4A5}", name: "Critical Mass — 100 critical hits" },
};

function toRoman(n: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ["X", "IX", "V", "IV", "I"];
  let r = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
  }
  return r;
}

interface AgentLabelsProps {
  transform: CanvasTransform;
}

const HOVER_RADIUS = 22;

function ServerInfo() {
  const [info, setInfo] = useState<{ buildId: string; serverStartedAt: string } | null>(null);
  useEffect(() => {
    fetch("/api/build-id")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);
  if (!info?.serverStartedAt) return null;
  const started = new Date(info.serverStartedAt);
  const ago = Math.floor((Date.now() - started.getTime()) / 60000);
  const timeStr = ago < 1 ? "just now" : ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ${ago % 60}m ago`;
  const match = info.buildId === __BUILD_ID__;
  return (
    <div className="font-mono text-[8px] text-white/25">
      server: {timeStr}
      {!match && <span className="text-yellow-400/60 ml-1">(stale)</span>}
    </div>
  );
}

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
  const gameModeOn = useAgentOfficeStore((s) => s.gameModeOn);
  const setGameModeOn = useAgentOfficeStore((s) => s.setGameModeOn);
  const hudPosition = useAgentOfficeStore((s) => s.hudPosition);
  const setHudPosition = useAgentOfficeStore((s) => s.setHudPosition);
  const killAgent = useAgentOfficeStore((s) => s.killAgent);
  const levelUpEvents = useAgentOfficeStore((s) => s.levelUpEvents);
  const expGainEvents = useAgentOfficeStore((s) => s.expGainEvents);
  const deskEligible = agents.filter((a) =>
    a.state !== "lounging" && a.state !== "departing" &&
    (a.subagentClass === null || a.subagentClass === undefined)
  );
  const deskMap = assignDesks(deskEligible.map((a) => a.id), getSlotMap());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hudMenuId, setHudMenuId] = useState<string | null>(null);
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

  // Close HUD agent menu on outside click
  useEffect(() => {
    if (hudMenuId === null) return;
    function handleClick() { setHudMenuId(null); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [hudMenuId]);

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
      {/* Game mode floating stats panel */}
      {gameModeOn && editMode === "none" && (() => {
        const ccMains = agents.filter(a => a.source === "cc" && (a.subagentClass === null || a.subagentClass === undefined));
        if (ccMains.length === 0) return null;
        // Build "II", "III" suffixes for agents sharing the same gameName
        const nameCount = new Map<string, number>();
        const nameSuffix = new Map<string, string>();
        for (const a of ccMains) {
          const base = a.gameName ?? a.name;
          const idx = (nameCount.get(base) ?? 0) + 1;
          nameCount.set(base, idx);
          if (idx > 1) nameSuffix.set(a.id, ` ${toRoman(idx)}`);
        }
        // If a name appeared more than once, the first instance keeps the bare name
        const record = parseInt(localStorage.getItem("game-mode-record") ?? "1", 10);
        const maxLevel = Math.max(...ccMains.map(a => a.level ?? 1), 1);
        if (maxLevel > record) localStorage.setItem("game-mode-record", String(maxLevel));
        return (
          <div className={`absolute z-30 rounded-[7px] px-[14px] py-[12px] ${
            hudPosition === "top-left" ? "top-2 left-2" :
            hudPosition === "bottom-left" ? "left-2" :
            "right-2"
          }`} style={{
            backgroundColor: "rgba(31, 31, 36, 0.94)",
            ...(hudPosition !== "top-left" ? { bottom: "calc(1.5rem + 8px)" } : {}),
          }}>
            <div className="flex flex-col gap-[15px]">
              {ccMains.map(a => {
                const teamHex = TEAM_COLORS[a.teamColor] ?? "#88cc88";
                const fill = (a.exp ?? 0) / (a.expToNext ?? 100);
                const isRecord = (a.level ?? 1) >= record && record > 1;
                return (
                  <div key={a.id} className="group relative grid gap-x-[10px] gap-y-0 items-center"
                    style={{ gridTemplateColumns: "9px 96px auto 120px 8px" }}>
                    {/* Row 1 */}
                    <div className="w-[9px] h-[9px] rounded-full" style={{ backgroundColor: teamHex }} />
                    <span className="font-semibold text-[14px] text-white truncate leading-tight">
                      {(a.gameName ?? a.name) + (nameSuffix.get(a.id) ?? "")}{isRecord ? <span className="text-[11px] ml-1">🔥</span> : ""}
                    </span>
                    <span className="font-semibold text-[14px] whitespace-nowrap">
                      <span className="text-[#787878]">LV</span>
                      <span className="text-white">{a.level ?? 1}</span>
                    </span>
                    <div className="relative" style={{ height: "14px" }}>
                      <div className="absolute inset-0 rounded-[3.5px]" style={{ backgroundColor: teamHex, opacity: 0.33 }} />
                      {fill > 0 && (
                        <div className="absolute top-0 left-0 h-full rounded-[3.5px]" style={{ width: `${Math.max(fill * 100, 5)}%`, backgroundColor: teamHex }} />
                      )}
                      <div className="absolute inset-0 rounded-[3.5px] border-[1.5px] border-[#696969]" />
                    </div>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setHudMenuId(hudMenuId === a.id ? null : a.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-white/30 hover:text-white/60"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="2" r="1" fill="currentColor"/><circle cx="5" cy="5" r="1" fill="currentColor"/><circle cx="5" cy="8" r="1" fill="currentColor"/></svg>
                      </button>
                      {hudMenuId === a.id && (
                        <div className="absolute right-0 top-5 z-50 bg-[#1e1e2e]/95 border border-white/10 rounded-md py-1 min-w-[90px] shadow-lg">
                          <button
                            onClick={() => {
                              const name = prompt("Rename:", a.gameName ?? a.name);
                              if (name) {
                                fetch("/api/rename-agent", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ agentId: a.id, name }),
                                }).catch(() => {});
                              }
                              setHudMenuId(null);
                            }}
                            className="block w-full text-left text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80"
                          >Rename</button>
                          <button
                            onClick={() => { killAgent(a.id); setHudMenuId(null); }}
                            className="block w-full text-left text-[9px] px-3 py-1 text-red-400/60 hover:bg-red-400/10 hover:text-red-400"
                          >Kill</button>
                        </div>
                      )}
                    </div>

                    {/* Row 2: title under name, achievements under LV, exp under bar */}
                    <div />
                    <span className="text-[11px] text-[#636363] truncate leading-tight">
                      {a.title ?? ""}
                    </span>
                    <span className="text-[10px] leading-tight">
                      {(a.achievements ?? []).map(id => {
                        const ach = ACHIEVEMENT_DATA[id];
                        return ach ? <span key={id} className="mr-px cursor-default" title={ach.name}>{ach.icon}</span> : null;
                      })}
                    </span>
                    <span className="text-[10px] text-[#636363] text-right leading-tight">
                      {a.exp ?? 0}/{a.expToNext ?? 100}
                    </span>
                    <div />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Play / Edit / Settings buttons */}
      <div className="absolute top-2 right-2 z-30 flex items-center gap-1">
        {/* Play/Stop game button */}
        <div className="relative">
          <button
            onClick={() => setGameModeOn(!gameModeOn)}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              gameModeOn
                ? "text-yellow-300/70 hover:text-yellow-300"
                : "text-white/20 hover:text-white/50"
            }`}
          >
            {gameModeOn ? "end game" : "play"}
          </button>
        </div>

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
            <div className="absolute top-6 right-0 bg-[#1e1e2e]/95 border border-white/10 rounded-md py-1 min-w-[120px]">
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
              <div className="border-t border-white/5 my-1" />
              <button
                onClick={() => { setEditOpen(false); window.location.href = "/?sprite-editor=true"; }}
                className="block w-full text-left font-mono text-[10px] px-3 py-1 transition-colors text-white/50 hover:bg-white/10 hover:text-white/80"
              >
                Sprite Editor
              </button>
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

            {/* Game Mode toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Game Mode</span>
              <button
                onClick={() => setGameModeOn(!gameModeOn)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  gameModeOn ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    gameModeOn ? "left-[13px]" : "left-[3px]"
                  }`}
                />
              </button>
            </label>

            {/* HUD position */}
            {gameModeOn && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-white/50 block">HUD Position</span>
                <select
                  value={hudPosition}
                  onChange={(e) => setHudPosition(e.target.value as import("../store").HudPosition)}
                  className="w-full bg-white/10 text-white/70 font-mono text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none"
                >
                  <option value="top-left" className="bg-[#1e1e2e]">Top Left</option>
                  <option value="bottom-left" className="bg-[#1e1e2e]">Bottom Left</option>
                  <option value="bottom-right" className="bg-[#1e1e2e]">Bottom Right</option>
                </select>
              </div>
            )}

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

            {/* Light Test */}
            <div className="pt-1 border-t border-white/5 space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Light Test</span>
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map(slot => (
                  <div key={slot} className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[8px] text-white/30">S{slot}</span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => fetch("/api/light-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, action: "sparkle" }) })}
                        className="font-mono text-[7px] text-yellow-300/60 bg-yellow-500/10 hover:bg-yellow-500/20 rounded px-1 py-0.5 transition-colors"
                      >sparkle</button>
                      <button
                        onClick={() => fetch("/api/light-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, action: "thinking" }) })}
                        className="font-mono text-[7px] text-amber-300/60 bg-amber-500/10 hover:bg-amber-500/20 rounded px-1 py-0.5 transition-colors"
                      >think</button>
                      <button
                        onClick={() => fetch("/api/light-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, action: "active" }) })}
                        className="font-mono text-[7px] text-green-300/60 bg-green-500/10 hover:bg-green-500/20 rounded px-1 py-0.5 transition-colors"
                      >active</button>
                      <button
                        onClick={() => fetch("/api/light-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, action: "off" }) })}
                        className="font-mono text-[7px] text-white/30 bg-white/5 hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
                      >off</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Character picker — only for starter themes */}
            {getThemeById(themeId).skins?.agent === "starter" && (() => {
              const ccAgents = agents.filter(a => a.source === "cc" && (a.subagentClass === null || a.subagentClass === undefined));
              if (ccAgents.length === 0) return null;
              return (
                <div className="pt-1 border-t border-white/5 space-y-1">
                  <span className="font-mono text-[10px] text-white/50 block">Characters</span>
                  {ccAgents.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] text-white/40 truncate max-w-[50px]">{a.name}</span>
                      <select
                        value={getAgentCharacter(a.id) ?? "charmander"}
                        onChange={(e) => { setAgentCharacter(a.id, e.target.value as any); }}
                        className="bg-white/10 text-white/70 font-mono text-[9px] rounded px-1 py-0.5 border border-white/10 outline-none"
                      >
                        {STARTERS.map(s => (
                          <option key={s} value={s} className="bg-[#1e1e2e]">{s}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Build + server info */}
            <div className="pt-1 border-t border-white/5 space-y-0.5">
              <button
                onClick={() => navigator.clipboard.writeText(__BUILD_ID__)}
                className="font-mono text-[8px] text-white/25 hover:text-white/50 transition-colors block"
                title="Click to copy build ID"
              >
                build: {__BUILD_ID__}
              </button>
              <ServerInfo />
            </div>
          </div>
        )}
        </div>
      </div>

      {agents.map((agent) => {
        // Use actual rendered position from the scene
        const walkPos = getAgentPosition(agent.id);
        const pos = deskMap.get(agent.id);
        const savedDesk = getLastDeskPos(agent.id);
        if (!walkPos && !pos && !savedDesk) return null;
        const oY = getThemeById(themeId).floorOffsetY ?? 0;
        // Lounging CC agents: keep label at desk, not wandering position
        const isLounging = agent.state === "lounging";
        const labelPos = (isLounging && savedDesk) ? savedDesk : null;
        const charX = labelPos ? labelPos.x : walkPos ? walkPos.x : pos ? pos.characterX : savedDesk!.x;
        const charY = labelPos ? labelPos.y : walkPos ? walkPos.y : pos ? pos.characterY + oY : savedDesk!.y;

        const domPos = canvasToDOM(transform, charX, charY);

        const isHovered = hoveredId === agent.id;
        const isActive = agent.currentTool !== null;
        const isSubagent = agent.subagentClass !== null && agent.subagentClass !== undefined;
        const teamHex = TEAM_COLORS[agent.teamColor] ?? "#88cc88";

        return (
          <div key={agent.id}>
            {/* Tool label — always visible when active, colored by team */}
            {isActive && (
              <div
                className="absolute font-mono font-bold px-2 py-1 bg-[#181825]/90 rounded whitespace-nowrap pointer-events-none transition-opacity duration-150"
                style={{
                  left: domPos.x,
                  top: domPos.y - 22 * transform.scale,
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
            {/* +EXP floating text */}
            {gameModeOn && expGainEvents
              .filter(ev => ev.agentId === agent.id)
              .map(ev => (
                <div
                  key={ev.id}
                  className="absolute font-semibold whitespace-nowrap pointer-events-none"
                  style={{
                    left: domPos.x,
                    top: domPos.y - 30 * transform.scale,
                    transform: "translateX(-50%)",
                    fontSize: "14px",
                    color: "#ffffff",
                    textShadow: `0 0 6px ${teamHex}, 0 1px 4px rgba(0,0,0,0.8)`,
                    animation: "expFloat 1.5s ease-out forwards",
                  }}
                >
                  +{ev.amount}
                </div>
              ))
            }
            {/* Name tag — below character (subagents only in debug mode) */}
            {(isHovered || (labelsOn && (!isSubagent || debugOn)) || debugOn) && (
              <div
                className="absolute font-mono font-bold whitespace-nowrap pointer-events-none transition-opacity duration-150 flex flex-col items-center"
                style={{
                  left: domPos.x,
                  top: domPos.y + 16 * transform.scale,
                  transform: "translateX(-50%)",
                  opacity: isHovered ? 1 : (labelsOn || debugOn) ? 0.7 : 0,
                }}
              >
                <span
                  className="px-2 py-0.5 rounded"
                  style={{
                    fontSize: "13px",
                    color: "#ffffff",
                    backgroundColor: gameModeOn ? `${teamHex}cc` : "#181825e6",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  }}
                >
                  {gameModeOn && agent.gameName ? agent.gameName : agent.name}
                </span>
                {debugOn && (() => {
                  const slot = getAgentSlot(agent.id);
                  if (slot === undefined) return null;
                  return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>d{slot} s{slot}</span>;
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* Level-up toasts */}
      {levelUpEvents.map((ev) => {
        const teamHex = TEAM_COLORS[ev.teamColor] ?? "#88cc88";
        const age = Date.now() - ev.ts;
        return (
          <div
            key={ev.id}
            className="absolute left-1/2 z-40 pointer-events-none font-mono text-center"
            style={{
              top: "30%",
              transform: "translateX(-50%)",
              animation: "levelUpFloat 3s ease-out forwards",
            }}
          >
            <div
              className="text-[18px] font-bold tracking-wide"
              style={{
                color: "#ffcc44",
                textShadow: `0 0 12px ${teamHex}, 0 0 24px ${teamHex}80, 0 2px 4px rgba(0,0,0,0.8)`,
              }}
            >
              LEVEL UP!
            </div>
            <div
              className="text-[13px] mt-0.5"
              style={{
                color: teamHex,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {ev.name} reached Lv{ev.level}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes levelUpFloat {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.8); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
          20% { transform: translateX(-50%) translateY(0) scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.95); }
        }
        @keyframes expFloat {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-25px); }
        }
      `}</style>
    </div>
  );
}
