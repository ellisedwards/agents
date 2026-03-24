import { useState, useCallback, useRef } from "react";
import { useAgentOfficeStore } from "@/components/store";

type Section = "claw" | "tower" | "agents" | "esp" | "recovery";

export function SystemStatusPanel() {
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const agents = useAgentOfficeStore((s) => s.agents);
  const toggleClawDetail = useAgentOfficeStore((s) => s.toggleClawDetail);

  const [expanded, setExpanded] = useState<Set<Section>>(new Set(["claw"]));
  const [pos, setPos] = useState({ x: 12, y: 12 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const toggle = (section: Section) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  if (!clawHealth) return null;

  const mode = clawHealth.mode || "offline";
  const modeBg = mode === "home" ? "rgba(34,197,94,0.1)" : mode === "away" ? "rgba(168,85,247,0.1)" : "rgba(239,68,68,0.1)";
  const modeColor = mode === "home" ? "text-green-400" : mode === "away" ? "text-purple-400" : "text-red-400";
  const modeHost = mode === "home" ? "LAN" : mode === "away" ? "Tailscale" : "—";

  const ccAgents = agents.filter((a) => a.source === "cc" && a.subagentClass == null);
  const subAgents = agents.filter((a) => a.source === "cc" && a.subagentClass != null);
  const ocAgents = agents.filter((a) => a.source === "openclaw");

  const te = clawHealth.towerEngine;
  const esp = clawHealth.esp32;
  const rec = clawHealth.recovery;

  return (
    <div
      className="absolute bg-[#12121e]/95 border border-white/10 rounded-md p-3 min-w-[240px] font-mono text-[10px] space-y-0 z-50 select-none"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
        <span className="text-white/50 text-[9px] uppercase tracking-widest">System Status</span>
        <button onClick={toggleClawDetail} className="text-neutral-500 hover:text-white text-[9px] ml-4">x</button>
      </div>

      {/* Mode banner */}
      <div className="rounded px-2 py-1 mb-1" style={{ background: modeBg }}>
        <div className="flex justify-between">
          <span className={modeColor}>● {mode.toUpperCase()}</span>
          <span className="text-neutral-500 text-[9px]">{modeHost}</span>
        </div>
      </div>

      {/* --- Claw Server --- */}
      <SectionHeader label="Claw Server" expanded={expanded.has("claw")} onClick={() => toggle("claw")}
        summary={clawHealth.reachable ? <span className="text-green-400 text-[9px]">reachable</span> : <span className="text-red-400 text-[9px]">unreachable</span>} />
      {expanded.has("claw") && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Server" value={clawHealth.reachable ? "reachable" : "unreachable"} ok={clawHealth.reachable} />
          <Row label="Yeelight" value={clawHealth.yeelightConnected ? "connected" : "disconnected"} ok={clawHealth.yeelightConnected} />
          {clawHealth.matrixMode && <Row label="Mode" value={clawHealth.matrixMode} />}
          {clawHealth.brightness != null && <Row label="Brightness" value={`${clawHealth.brightness}%`} />}
          <div className="flex justify-between">
            <span className="text-neutral-400">Slots</span>
            <span className="flex gap-1">
              {clawHealth.slots.map((s, i) => (
                <span key={i} className={`w-2 h-2 rounded-sm inline-block ${s === "active" ? "bg-green-400" : s === "off" ? "bg-neutral-600" : "bg-yellow-400"}`} title={`Slot ${i}: ${s}`} />
              ))}
            </span>
          </div>
          {clawHealth.slotsDetail?.some((s) => s.name) && (
            <div className="space-y-0.5 pt-0.5 border-t border-white/5">
              {clawHealth.slotsDetail.map((sd, i) => sd.name ? (
                <div key={i} className="flex justify-between">
                  <span className="text-neutral-500">S{i}: {sd.name}</span>
                  <span className="text-neutral-400">{sd.ttl_remaining != null && sd.ttl_remaining > 0 ? `${sd.ttl_remaining}s` : sd.state}</span>
                </div>
              ) : null)}
              {(clawHealth.waitingCount ?? 0) > 0 && <Row label="Waiting" value={String(clawHealth.waitingCount)} warn />}
            </div>
          )}
          {clawHealth.zones && (
            <div className="text-neutral-500 text-[8px] pt-0.5 border-t border-white/5">
              {[clawHealth.zones.thinking !== "off" && `think:${clawHealth.zones.thinking}`, clawHealth.zones.display !== "clear" && `disp:${clawHealth.zones.display}`, `ctx:${clawHealth.zones.context}`].filter(Boolean).join(" ")}
            </div>
          )}
          {clawHealth.animationRunning && <Row label="Animation" value="running" warn />}
          {clawHealth.transitionInProgress && <Row label="Transition" value="in progress" cyan />}
        </div>
      )}

      {/* --- Tower Engine --- */}
      <SectionHeader label="Tower Engine" expanded={expanded.has("tower")} onClick={() => toggle("tower")}
        summary={te?.active ? <span className="text-green-400 text-[9px]">active</span> : <span className="text-neutral-500 text-[9px]">idle</span>} />
      {expanded.has("tower") && te && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Hirst" value={te.hirstPhase} warn={te.hirstPhase !== "off"} />
          <div className="flex justify-between">
            <span className="text-neutral-400">Slots</span>
            <span className="flex gap-1">
              {te.slotStates.map((s, i) => (
                <span key={i} className={`w-2 h-2 rounded-sm inline-block ${s === "active" ? "bg-green-400" : s === "off" ? "bg-neutral-600" : "bg-yellow-400"}`} title={`Slot ${i}: ${s}`} />
              ))}
            </span>
          </div>
          {mode !== "home" && <div className="text-neutral-500 text-[8px]">simulated (local engine)</div>}
        </div>
      )}

      {/* --- Agents --- */}
      <SectionHeader label="Agents" expanded={expanded.has("agents")} onClick={() => toggle("agents")}
        summary={<span className="text-[#c4856c] text-[9px]">CC:{ccAgents.length} OC:{ocAgents.length}</span>} />
      {expanded.has("agents") && (
        <div className="pl-2 space-y-0.5 pb-1">
          {agents.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span className="text-neutral-400 truncate max-w-[120px]">{a.name}</span>
              <span className={a.state === "thinking" ? "text-amber-400" : a.state === "typing" || a.state === "reading" ? "text-sky-400" : "text-neutral-500"}>
                {a.state}{a.currentTool ? `(${a.currentTool})` : ""}
              </span>
            </div>
          ))}
          {subAgents.length > 0 && <div className="text-neutral-500 text-[8px]">{subAgents.length} subagent{subAgents.length > 1 ? "s" : ""}</div>}
        </div>
      )}

      {/* --- ESP32 --- */}
      <SectionHeader label="ESP32 Buddy" expanded={expanded.has("esp")} onClick={() => toggle("esp")}
        summary={esp?.polling ? <span className="text-teal-400 text-[9px]">polling {esp.lastPoll ? `${Math.round((Date.now() - esp.lastPoll) / 1000)}s ago` : ""}</span> : <span className="text-neutral-500 text-[9px]">idle</span>} />
      {expanded.has("esp") && esp && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Status" value={esp.polling ? "polling" : "idle"} ok={esp.polling} />
          {esp.lastPoll && <Row label="Last poll" value={`${Math.round((Date.now() - esp.lastPoll) / 1000)}s ago`} />}
        </div>
      )}

      {/* --- Recovery --- */}
      <SectionHeader label="Recovery" expanded={expanded.has("recovery")} onClick={() => toggle("recovery")}
        summary={<span className="text-neutral-500 text-[9px]">{rec?.enabled ? "enabled" : "disabled"}</span>} />
      {expanded.has("recovery") && rec && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Status" value={rec.enabled ? `active (${mode})` : `disabled (${mode})`} ok={rec.enabled} />
          {rec.inProgress && <Row label="Action" value="in progress" warn />}
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function SectionHeader({ label, expanded, onClick, summary }: { label: string; expanded: boolean; onClick: () => void; summary: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 cursor-pointer border-b border-white/5 hover:bg-white/[0.03]" onClick={onClick}>
      <span className={expanded ? "text-neutral-200" : "text-neutral-400"}>
        {expanded ? "▾" : "▸"} {label}
      </span>
      {!expanded && summary}
    </div>
  );
}

function Row({ label, value, ok, warn, cyan }: { label: string; value: string; ok?: boolean; warn?: boolean; cyan?: boolean }) {
  const color = ok === true ? "text-green-400" : ok === false ? "text-red-400" : warn ? "text-yellow-400" : cyan ? "text-cyan-400" : "text-neutral-300";
  return (
    <div className="flex justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
