
import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentOfficeStore } from "../store";
import type { TimeMode, TowerSize, ThemeId, EditMode } from "../store";
import { ALL_THEMES, getThemeById } from "../scene/themes";
import {
  canvasToDOM,
  domToCanvas,
  type CanvasTransform,
} from "../canvas-transform";
import { getCachedAssignments } from "../scene/desk-layout";
import { getAgentPosition, getCatPosition, pokeCat, triggerFloat, getHealthPosterBounds, setAgentCharacter, getAgentCharacter, STARTERS, getLastDeskPos } from "../scene/renderer";
import { triggerUfo } from "../scene/environment";
import { TEAM_COLORS } from "@/shared/types";
import SlotMachine from "./lucky-wheel";
import type { Win } from "./lucky-wheel";

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

function HelpGuide() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const gameModeOn = useAgentOfficeStore((s) => s.gameModeOn);
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-[10px] px-1.5 py-0.5 rounded text-white/20 hover:text-white/50 transition-colors"
      >
        ?
      </button>
      {open && (
        <div
          className="absolute top-6 right-0 rounded-[7px] px-[14px] py-[12px] min-w-[280px] max-w-[320px] max-h-[80vh] overflow-y-auto space-y-3"
          style={{ backgroundColor: "rgba(31, 31, 36, 0.94)", animation: "panelReveal 0.15s ease-out" }}
        >
          <div className="font-mono text-[11px] text-white/80 font-bold">Agent Office</div>

          {/* Overview */}
          <div className="space-y-1">
            <div className="font-mono text-[8px] text-white/40 space-y-1 leading-[12px]">
              <div>Watches Claude Code sessions on this Mac and shows them as characters in the scene.</div>
              <div>Connects to the claw server (Pi) to drive the Yeelight and LED matrix based on agent activity.</div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-blue-300/70 font-bold">Shortcuts</div>
            <div className="font-mono text-[8px] text-white/40 space-y-0.5">
              <div className="flex justify-between"><span className="text-white/60">D</span><span>Toggle debug panel</span></div>
              <div className="flex justify-between"><span className="text-white/60">L</span><span>Toggle agent labels</span></div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-blue-300/70 font-bold">Controls</div>
            <div className="font-mono text-[8px] text-white/40 space-y-0.5">
              <div className="flex justify-between"><span className="text-white/60">clr</span><span>Reset agent tracking</span></div>
              <div className="flex justify-between"><span className="text-white/60">rst</span><span>SSH tower-reset on Pi</span></div>
              <div className="flex justify-between"><span className="text-white/60">slider</span><span>Yeelight brightness</span></div>
              <div className="flex justify-between"><span className="text-white/60">relay</span><span>Claw relay messages</span></div>
              <div className="flex justify-between"><span className="text-white/60">settings</span><span>Theme, tower, triggers</span></div>
            </div>
          </div>

          {/* Connection */}
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-blue-300/70 font-bold">Connection</div>
            <div className="font-mono text-[8px] text-white/40 space-y-0.5">
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400/60 shrink-0" /><span><span className="text-green-400/60">wifi</span> — LAN to claw</span></div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" /><span><span className="text-violet-400">tailscale</span> — VPN fallback</span></div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span><span className="text-red-400">claw down</span> — unreachable</span></div>
            </div>
            {clawHealth && (
              <div className="font-mono text-[8px] text-white/25 pt-0.5">
                Now: {!clawHealth.reachable ? "unreachable" : clawHealth.clawMode === "fallback" ? "tailscale" : "wifi"}
                {clawHealth.bleConnected ? " + BLE" : ""}
              </div>
            )}
          </div>

          {/* Agent types & states */}
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-blue-300/70 font-bold">Agents</div>
            <div className="font-mono text-[8px] text-white/40 space-y-0.5">
              <div><span className="text-[#c4856c]">CC</span> — Claude Code sessions &nbsp; <span className="text-[#c4856c]/60">sub</span> — subagents &nbsp; <span className="text-[#cc3333]">OC</span> — OpenClaw</div>
              <div><span className="text-sky-400/80">thinking</span> · <span className="text-amber-400/80">typing</span> · <span className="text-sky-400/80">reading</span> · <span className="text-neutral-400">idle</span> · <span className="text-neutral-500">lounging</span></div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-blue-300/70 font-bold">Troubleshooting</div>
            <div className="font-mono text-[8px] text-white/40 space-y-0.5">
              <div><span className="text-amber-400/70">stale build</span> — restart npm run dev</div>
              <div><span className="text-amber-400/70">no agents</span> — start a CC session</div>
              <div><span className="text-amber-400/70">claw down</span> — check Pi + port 9999</div>
              <div><span className="text-amber-400/70">lights stuck</span> — hit rst</div>
              <div><span className="text-amber-400/70">agents stuck</span> — hit clr to re-scan</div>
            </div>
          </div>

          {/* Game Guide — only when game mode is on */}
          {gameModeOn && (<>
            <div className="border-t border-white/10 pt-2">
              <div className="font-mono text-[11px] text-white/80 font-bold mb-2">Game Guide</div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-yellow-300/70 font-bold">EXP Awards</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div>Write / Edit: 8 exp</div>
                <div>Bash: 5 exp</div>
                <div>Read / Grep / Glob: 3 exp</div>
                <div>Agent (subagent): 10 exp</div>
                <div>Thinking: 1 exp (30s cooldown)</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-green-300/70 font-bold">Bonuses</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div>First Blood: +3 exp (first tool use)</div>
                <div>Streak: +5 exp (active 5+ min)</div>
                <div>Speed Combo: +2 exp (3 tools in 10s)</div>
                <div>Rivalry: +3 exp (2+ agents typing)</div>
                <div>Subagent Share: parent gets 50%</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-amber-300/70 font-bold">Critical Hits</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div>10% chance: 2x base exp</div>
                <div>Lucky Break (2%): 3x exp</div>
                <div>Both can stack</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-red-300/70 font-bold">Pokeball Tiers</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Standard (Lv 1)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Great Ball (Lv 20)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-800 inline-block border border-yellow-500/50" /> Ultra Ball (Lv 30)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Gold Top (Lv 50)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" style={{ boxShadow: "0 0 3px #ffcc44" }} /> Full Gold + Shimmer (Lv 75)</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-purple-300/70 font-bold">Titles</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div>Lv 1: Fresh Spawn / Rookie</div>
                <div>Lv 5: Apprentice / Initiate</div>
                <div>Lv 12: Journeyman / Scout</div>
                <div>Lv 20: Veteran / Knight</div>
                <div>Lv 30: Expert / Adept</div>
                <div>Lv 40: Commander / Sage</div>
                <div>Lv 50: Grand Master / Champion</div>
                <div>Lv 70: Ascended / Exalted</div>
                <div>Lv 90: Legendary / Mythic</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[9px] text-cyan-300/70 font-bold">Achievements</div>
              <div className="font-mono text-[8px] text-white/40 space-y-0.5">
                <div>👑 Centurion — Reach Lv 50</div>
                <div>🧠 Polymath — Master 5+ tools (50 uses each)</div>
                <div>🏃 Marathon — 2-hour streak</div>
                <div>🐚 Shell Shocked — 1000 Bash uses</div>
                <div>💥 Critical Mass — 100 critical hits</div>
              </div>
            </div>
          </>)}
        </div>
      )}
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
  const tower2Visible = useAgentOfficeStore((s) => s.tower2Visible);
  const setTower2Visible = useAgentOfficeStore((s) => s.setTower2Visible);
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
  const storageWarning = useAgentOfficeStore((s) => s.storageWarning);
  const dismissStorageWarning = useAgentOfficeStore((s) => s.dismissStorageWarning);
  const levelUpEvents = useAgentOfficeStore((s) => s.levelUpEvents);
  const expGainEvents = useAgentOfficeStore((s) => s.expGainEvents);
  const achievementEvents = useAgentOfficeStore((s) => s.achievementEvents);
  const luckyPokeballAgent = useAgentOfficeStore((s) => s.luckyPokeballAgent);
  const setLuckyPokeballAgent = useAgentOfficeStore((s) => s.setLuckyPokeballAgent);
  const luckyWheelAgent = useAgentOfficeStore((s) => s.luckyWheelAgent);
  const setLuckyWheelAgent = useAgentOfficeStore((s) => s.setLuckyWheelAgent);
  const cached = getCachedAssignments();
  const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
  if (cached) {
    for (const [id, asgn] of cached.assignments) {
      deskMap.set(id, asgn.desk);
    }
  }
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hudMenuId, setHudMenuId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [endGameOpen, setEndGameOpen] = useState(false);
  const [killConfirm, setKillConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const editPanelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!settingsOpen && !editOpen && !endGameOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (editOpen && editPanelRef.current && !editPanelRef.current.contains(e.target as Node)) {
        setEditOpen(false);
      }
      if (endGameOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-end-game-menu]")) {
          setEndGameOpen(false);
          setKillConfirm(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen, editOpen, endGameOpen]);

  // Close HUD agent menu on outside click
  useEffect(() => {
    if (hudMenuId === null) return;
    function handleClick() { setHudMenuId(null); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [hudMenuId]);

  // Lucky pokeball: pick a random desk-bound CC agent
  const triggerLuckyPokeball = useCallback(() => {
    const ccDesked = agents.filter(a =>
      a.source === "cc" &&
      (a.subagentClass === null || a.subagentClass === undefined) &&
      a.state !== "lounging" && a.state !== "departing" &&
      deskMap.has(a.id)
    );
    if (ccDesked.length === 0) return;
    const pick = ccDesked[Math.floor(Math.random() * ccDesked.length)];
    setLuckyPokeballAgent(pick.id);
    // Auto-clear after 30 seconds if not clicked
    setTimeout(() => {
      if (useAgentOfficeStore.getState().luckyPokeballAgent === pick.id) {
        setLuckyPokeballAgent(null);
      }
    }, 30000);
  }, [agents, deskMap, setLuckyPokeballAgent]);

  // Lucky pokeball timer: every 10-15 minutes
  useEffect(() => {
    if (!gameModeOn) return;
    const schedule = (): ReturnType<typeof setTimeout> => {
      const delay = (10 + Math.random() * 5) * 60 * 1000;
      return setTimeout(() => {
        triggerLuckyPokeball();
        timerId = schedule();
      }, delay);
    };
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, [gameModeOn, triggerLuckyPokeball]);

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
      // Lucky pokeball click — click anywhere near the agent or pokeball to activate
      const luckyId = useAgentOfficeStore.getState().luckyPokeballAgent;
      if (luckyId) {
        const pokePos = deskMap.get(luckyId);
        if (pokePos) {
          const oY = getThemeById(themeId).floorOffsetY ?? 0;
          // Check near the character (generous 20px radius) or the pokeball
          const charX = pokePos.characterX;
          const charY = pokePos.characterY + oY;
          const cdx = canvasPos.x - charX;
          const cdy = canvasPos.y - charY;
          if (Math.sqrt(cdx * cdx + cdy * cdy) < 20) {
            setLuckyWheelAgent(luckyId);
            setLuckyPokeballAgent(null);
            return;
          }
        }
      }

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
    [transform, deskMap, themeId, setLuckyWheelAgent, setLuckyPokeballAgent]
  );

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ pointerEvents: "auto" }}
    >
      {storageWarning && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-yellow-900/90 border border-yellow-500/30 rounded px-3 py-1.5 flex items-center gap-2">
          <span className="font-mono text-[10px] text-yellow-300/80">Storage full — settings may not persist</span>
          <button onClick={dismissStorageWarning} className="font-mono text-[9px] text-yellow-500/60 hover:text-yellow-300">dismiss</button>
        </div>
      )}
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
            animation: "panelReveal 0.25s ease-out",
          }}>
            <div className="flex flex-col gap-[15px]">
              {ccMains.map(a => {
                const teamHex = TEAM_COLORS[a.teamColor] ?? "#88cc88";
                const fill = (a.exp ?? 0) / (a.expToNext ?? 100);
                const isRecord = (a.level ?? 1) >= record && record > 1;
                const isDupe = nameSuffix.has(a.id);
                return (
                  <div key={a.id} className="group relative grid gap-x-[10px] gap-y-0 items-center"
                    style={{ gridTemplateColumns: "9px 96px auto 120px 8px" }}>
                    {/* Row 1 */}
                    <div className="w-[9px] h-[9px] rounded-full" style={{ backgroundColor: teamHex }} />
                    <span className="font-semibold text-[14px] text-white truncate leading-tight">
                      {(a.gameName ?? a.name) + (nameSuffix.get(a.id) ?? "")}{isRecord ? <span className="text-[11px] ml-1">🔥</span> : ""}
                    </span>
                    <span className="font-semibold text-[14px] whitespace-nowrap" style={{ opacity: isDupe ? 0.25 : 1 }}>
                      <span className="text-[#787878]">LV</span>
                      <span className="text-white">{a.level ?? 1}</span>
                      {a.luckyMultiplier && (
                        <span className="text-[10px] text-yellow-300/70 ml-1">
                          {a.luckyMultiplier.multiplier}x ({a.luckyMultiplier.usesLeft})
                        </span>
                      )}
                    </span>
                    <div className="relative" style={{ height: "14px", opacity: isDupe ? 0.25 : 1 }}>
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

                    {/* Row 2: title under name, badges + exp spanning under LV and bar */}
                    {!isDupe && <>
                    <div />
                    <span className="text-[11px] text-[#636363] truncate leading-tight">
                      {a.title ?? ""}
                    </span>
                    <span className="text-[10px] leading-tight flex items-center" style={{ gridColumn: "3 / 5" }}>
                      <span className="flex-1">
                        {(a.achievements ?? []).map(id => {
                          const ach = ACHIEVEMENT_DATA[id];
                          return ach ? <span key={id} className="mr-1 cursor-default" title={ach.name}>{ach.icon}</span> : null;
                        })}
                      </span>
                      <span className="text-[10px] text-[#636363]">
                        {`${a.exp ?? 0}/${a.expToNext ?? 100}`}
                      </span>
                    </span>
                    <div />
                    </>}
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
            onClick={() => {
              if (gameModeOn) {
                setEndGameOpen(!endGameOpen);
                setKillConfirm(false);
              } else {
                setGameModeOn(true);
              }
            }}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              gameModeOn
                ? "text-yellow-300/70 hover:text-yellow-300"
                : "text-white/20 hover:text-white/50"
            }`}
          >
            {gameModeOn ? "end game" : "play"}
          </button>
          {endGameOpen && gameModeOn && (
            <div
              data-end-game-menu
              className="absolute right-0 top-full mt-1 rounded-md overflow-hidden"
              style={{
                backgroundColor: "rgba(22, 22, 28, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                minWidth: killConfirm ? 180 : 100,
                zIndex: 50,
              }}
            >
              {!killConfirm ? (
                <>
                  <button
                    onClick={() => { setGameModeOn(false); setEndGameOpen(false); }}
                    className="block w-full text-left font-mono text-[10px] px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    pause
                  </button>
                  <button
                    onClick={() => setKillConfirm(true)}
                    className="block w-full text-left font-mono text-[10px] px-3 py-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                  >
                    kill
                  </button>
                </>
              ) : (
                <div className="px-3 py-2">
                  <div className="font-mono text-[9px] text-white/40 mb-2">
                    Wipe all EXP, levels, and names?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        fetch("/api/game-kill", { method: "POST" }).catch(() => {});
                        setGameModeOn(false);
                        setEndGameOpen(false);
                        setKillConfirm(false);
                      }}
                      className="font-mono text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      kill
                    </button>
                    <button
                      onClick={() => setKillConfirm(false)}
                      className="font-mono text-[10px] px-2 py-0.5 rounded text-white/40 hover:text-white/60 transition-colors"
                    >
                      cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unified help + game guide */}
        <HelpGuide />

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
            <div className="absolute top-6 right-0 rounded-[7px] py-1 min-w-[120px]" style={{ backgroundColor: "rgba(31, 31, 36, 0.94)", animation: "panelReveal 0.15s ease-out" }}>
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
          <div className="absolute top-6 right-0 rounded-[7px] px-[14px] py-[12px] min-w-[190px] space-y-2.5" style={{ backgroundColor: "rgba(31, 31, 36, 0.94)", animation: "panelReveal 0.15s ease-out" }}>
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

            {/* Tower 1 toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Tower 1</span>
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

            {/* Tower 2 toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-mono text-[10px] text-white/50">Tower 2</span>
              <button
                onClick={() => setTower2Visible(!tower2Visible)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  tower2Visible ? "bg-green-500/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                    tower2Visible ? "left-[13px]" : "left-[3px]"
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
                <button
                  onClick={() => triggerLuckyPokeball()}
                  className="font-mono text-[9px] text-white/50 bg-white/10 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors"
                >
                  lucky
                </button>
              </div>
            </div>

            {/* Light Test */}
            <div className="pt-1 border-t border-white/5 space-y-1">
              <span className="font-mono text-[10px] text-white/50 block">Light Test</span>
              {([
                ["sparkle", "level up", "✦", "text-yellow-300/70", "hover:bg-yellow-500/20"],
                ["thinking", "thinking", "◆", "text-amber-300/70", "hover:bg-amber-500/20"],
                ["active", "active", "●", "text-green-300/70", "hover:bg-green-500/20"],
                ["off", "off", "○", "text-white/25", "hover:bg-white/10"],
              ] as const).map(([action, label, icon, color, hover]) => (
                <div key={action} className="flex items-center gap-1">
                  <span className={`font-mono text-[7px] ${color} w-[36px] shrink-0`}>{label}</span>
                  <div className="flex gap-0.5 flex-1">
                    {[0, 1, 2, 3].map(slot => (
                      <button
                        key={slot}
                        onClick={() => fetch("/api/light-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, action }) })}
                        className={`flex-1 font-mono text-[9px] ${color} bg-white/5 ${hover} rounded py-0.5 transition-colors text-center`}
                        title={`${action} S${slot}`}
                      >{icon}</button>
                    ))}
                  </div>
                </div>
              ))}
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
                className="absolute font-mono font-bold px-2 py-1 bg-[#181825]/90 rounded whitespace-nowrap pointer-events-none"
                style={{
                  left: domPos.x,
                  top: domPos.y - 18 * transform.scale,
                  transform: "translateX(-50%)",
                  fontSize: "15px",
                  color: teamHex,
                  opacity: isHovered ? 1 : 0.8,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  letterSpacing: "0.02em",
                  animation: "toolReveal 0.2s ease-out",
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
                className="absolute font-mono font-bold whitespace-nowrap pointer-events-none flex flex-col items-center"
                style={{
                  left: domPos.x,
                  top: domPos.y + 12 * transform.scale,
                  transform: "translateX(-50%)",
                  opacity: isHovered ? 1 : (labelsOn || debugOn) ? 0.7 : 0,
                  animation: "labelReveal 0.2s ease-out",
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
                  const deskIdx = cached?.getDeskIndex(agent.id);
                  const slot = cached?.getSlot(agent.id);
                  if (deskIdx === undefined) return null;
                  return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                    d{deskIdx}{slot !== undefined ? ` q${slot}` : ""}
                  </span>;
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

      {/* Achievement earned toasts */}
      {achievementEvents.map((ev) => {
        const teamHex = TEAM_COLORS[ev.teamColor] ?? "#88cc88";
        return (
          <div
            key={ev.id}
            className="absolute left-1/2 z-40 pointer-events-none font-mono text-center"
            style={{
              top: "38%",
              transform: "translateX(-50%)",
              animation: "achievementFloat 4s ease-out forwards",
            }}
          >
            <div
              className="text-[22px]"
              style={{
                filter: `drop-shadow(0 0 8px ${teamHex})`,
              }}
            >
              {ev.icon}
            </div>
            <div
              className="text-[14px] font-bold tracking-wide mt-0.5"
              style={{
                color: "#ffffff",
                textShadow: `0 0 10px ${teamHex}, 0 2px 4px rgba(0,0,0,0.8)`,
              }}
            >
              {ev.name}
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{
                color: teamHex,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {ev.agentName} earned a badge!
            </div>
          </div>
        );
      })}

      {/* Slot Machine overlay */}
      {luckyWheelAgent && (() => {
        const slotAgent = agents.find(a => a.id === luckyWheelAgent);
        if (!slotAgent) return null;
        const teamHex = TEAM_COLORS[slotAgent.teamColor] ?? "#88cc88";
        const displayName = slotAgent.gameName ?? slotAgent.name;
        return (
          <SlotMachine
            agentName={displayName}
            teamColor={teamHex}
            onResult={(wins: Win[]) => {
              if (wins.length === 0) return;
              // Apply best multiplier with combined uses
              const best = wins.reduce((a, b) => a.multiplier >= b.multiplier ? a : b);
              const totalUses = wins.reduce((sum, w) => sum + w.uses, 0);
              fetch("/api/lucky-multiplier", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: luckyWheelAgent, multiplier: best.multiplier, uses: totalUses }),
              }).catch(() => {});
              useAgentOfficeStore.getState().addLevelUp(
                luckyWheelAgent,
                `${displayName} ${best.multiplier}x LUCKY!`,
                slotAgent.level ?? 1,
                String(slotAgent.teamColor)
              );
              if (best.multiplier >= 50) {
                const slot = cached?.getSlot(luckyWheelAgent);
                if (slot !== undefined) {
                  fetch("/api/sparkle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slot }),
                  }).catch(() => {});
                }
              }
            }}
            onClose={() => setLuckyWheelAgent(null)}
          />
        );
      })()}

      <style>{`
        @keyframes achievementFloat {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.5); }
          8% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.2); }
          15% { transform: translateX(-50%) translateY(0) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.95); }
        }
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
        @keyframes labelReveal {
          0% { opacity: 0; transform: translateX(-50%) translateY(3px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toolReveal {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes panelReveal {
          0% { opacity: 0; transform: translateY(3px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
