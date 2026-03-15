import { useEffect, useState, useRef } from "react";
import { useAgentOfficeStore } from "@/components/store";
import { usePixelTower } from "@/hooks/use-pixel-tower";

interface LogEntry {
  time: number;
  source: "pixels" | "agents" | "claw";
  text: string;
}

const MAX_LINES = 60;
const Q_INDICES: Record<string, number[]> = {
  Q0: [15, 16, 20, 21],
  Q1: [18, 19, 23, 24],
  Q2: [0, 1, 5, 6],
  Q3: [3, 4, 8, 9],
};

function quadrantSummary(top: string[]): string {
  return Object.entries(Q_INDICES)
    .map(([name, idxs]) => {
      const lit = idxs.some((i) => top[i] && top[i] !== "#000000");
      return lit ? name : null;
    })
    .filter(Boolean)
    .join(",") || "none";
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

const SRC_COLORS: Record<string, string> = {
  pixels: "text-cyan-400",
  agents: "text-green-400",
  claw: "text-yellow-400",
};

export function DebugPanel() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agents = useAgentOfficeStore((s) => s.agents);
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const { data: pixelData, connected: pixelConnected } = usePixelTower();

  // Track previous values to only log changes
  const prevPixels = useRef("");
  const prevAgents = useRef("");
  const prevClaw = useRef("");

  // Pixel tower changes
  useEffect(() => {
    if (!pixelConnected) return;
    const top = pixelData.panels?.top || [];
    const activity = (pixelData as any).clawActivity || "?";
    const quads = quadrantSummary(top);
    const key = `${activity}|${quads}`;
    if (key === prevPixels.current) return;
    prevPixels.current = key;
    const entry: LogEntry = {
      time: Date.now(),
      source: "pixels",
      text: `activity=${activity}  quads=[${quads}]`,
    };
    setLog((prev) => [...prev.slice(-MAX_LINES), entry]);
  }, [pixelData, pixelConnected]);

  // Agent state changes
  useEffect(() => {
    if (!agents.length) return;
    const summary = agents
      .map((a) => `${a.name}:${a.state}${a.currentTool ? `(${a.currentTool})` : ""}`)
      .join("  ");
    if (summary === prevAgents.current) return;
    prevAgents.current = summary;
    const entry: LogEntry = {
      time: Date.now(),
      source: "agents",
      text: summary,
    };
    setLog((prev) => [...prev.slice(-MAX_LINES), entry]);
  }, [agents]);

  // Claw health changes
  useEffect(() => {
    if (!clawHealth) return;
    const key = `${clawHealth.matrixMode}|${clawHealth.slots.join(",")}`;
    if (key === prevClaw.current) return;
    prevClaw.current = key;
    const entry: LogEntry = {
      time: Date.now(),
      source: "claw",
      text: `mode=${clawHealth.matrixMode}  slots=[${clawHealth.slots.join(",")}]`,
    };
    setLog((prev) => [...prev.slice(-MAX_LINES), entry]);
  }, [clawHealth]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="absolute top-2 left-2 z-50 bg-black/85 border border-white/10 rounded font-mono text-[9px] leading-[13px] w-[420px] max-h-[300px] flex flex-col select-none">
      <div className="flex justify-between items-center px-2 py-1 border-b border-white/10">
        <span className="text-white/50 text-[8px] uppercase tracking-wider">Signal Debug</span>
        <span className="flex gap-2 text-[8px]">
          <span className="text-cyan-400">pixels</span>
          <span className="text-green-400">agents</span>
          <span className="text-yellow-400">claw</span>
        </span>
      </div>
      <div ref={scrollRef} className="overflow-y-auto px-2 py-1 flex-1">
        {log.length === 0 && (
          <div className="text-neutral-500 py-2">Waiting for signals...</div>
        )}
        {log.map((entry, i) => (
          <div key={i} className="flex gap-2 whitespace-nowrap">
            <span className="text-neutral-500 shrink-0">{fmt(entry.time)}</span>
            <span className={`shrink-0 w-[42px] ${SRC_COLORS[entry.source]}`}>{entry.source}</span>
            <span className="text-neutral-300 overflow-hidden text-ellipsis">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
