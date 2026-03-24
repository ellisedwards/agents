import { useEffect, useState, useRef } from "react";
import { useAgentOfficeStore } from "@/components/store";
import { usePixelTower } from "@/hooks/use-pixel-tower";

type DebugSource = "pixels" | "agents" | "hooks" | "tower" | "esp" | "seats" | "claw" | "net";

interface LogEntry {
  time: number;
  source: DebugSource;
  text: string;
}

const MAX_LINES = 60;
const Q_INDICES: Record<string, number[]> = {
  Q0: [15, 16, 20, 21],
  Q1: [18, 19, 23, 24],
  Q2: [0, 1, 5, 6],
  Q3: [3, 4, 8, 9],
};

const SRC_COLORS: Record<DebugSource, string> = {
  pixels: "text-fuchsia-400",
  agents: "text-lime-400",
  hooks: "text-blue-400",
  tower: "text-orange-400",
  esp: "text-teal-400",
  seats: "text-amber-400",
  claw: "text-rose-400",
  net: "text-violet-400",
};

const ALL_SOURCES: DebugSource[] = ["pixels", "agents", "hooks", "tower", "esp", "seats", "claw", "net"];

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

// Syntax-highlight debug text like code
function colorizeText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let key = 0;
  // Split on tokens we want to colorize
  const regex = /(\w+)=([\w.?]+|\[[^\]]*\])|(\b(?:idle|thinking|typing|reading|waiting|active|off|connected|disconnected|on|OFF|DOWN|TRANSITION|none|clear|prompt-start|thinking-start|thinking-end|prompt-end|poll|assign|TTL|expired)\b)|(\b\d+(?:\.\d+)?(?:ms|s|%)?)\b|(\([^)]*\))|(\b(?:S\d):\w+)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }

    if (match[1] && match[2]) {
      // key=value pair
      parts.push(<span key={key++} className="text-blue-400/70">{match[1]}</span>);
      parts.push(<span key={key++} className="text-neutral-500">=</span>);
      const val = match[2];
      // Color the value based on content
      const valClass = /active|connected|on|up/i.test(val) ? "text-green-400/80"
        : /off|idle|none|clear|disconnected|OFF|DOWN/i.test(val) ? "text-neutral-500"
        : /thinking/i.test(val) ? "text-amber-400/80"
        : /typing|reading|waiting/i.test(val) ? "text-sky-400/80"
        : val.startsWith("[") ? "text-neutral-400"
        : "text-orange-300/80";
      parts.push(<span key={key++} className={valClass}>{val}</span>);
    } else if (match[3]) {
      // State keyword
      const word = match[3];
      const cls = /active|connected|on/i.test(word) ? "text-green-400/80"
        : /off|idle|none|clear|disconnected/i.test(word) ? "text-neutral-500"
        : /thinking|thinking-start|thinking-end/i.test(word) ? "text-amber-400/80"
        : /typing|reading|waiting|prompt-start|prompt-end/i.test(word) ? "text-sky-400/80"
        : /DOWN|TRANSITION|OFF|expired/i.test(word) ? "text-red-400"
        : /poll|assign|TTL/i.test(word) ? "text-teal-400/80"
        : "text-neutral-300";
      parts.push(<span key={key++} className={cls}>{word}</span>);
    } else if (match[4]) {
      // Number with unit
      parts.push(<span key={key++} className="text-emerald-400/70">{match[4]}</span>);
    } else if (match[5]) {
      // Parenthesized content like (Bash) or (active 12s)
      parts.push(<span key={key++} className="text-neutral-500">{match[5]}</span>);
    } else if (match[6]) {
      // Slot reference like S0:vacuum
      const [slot, name] = match[6].split(":");
      parts.push(<span key={key++} className="text-orange-400/70">{slot}</span>);
      parts.push(<span key={key++} className="text-neutral-500">:</span>);
      parts.push(<span key={key++} className="text-teal-400/70">{name}</span>);
    }

    lastIdx = match.index + match[0].length;
  }

  // Remaining text
  if (lastIdx < text.length) {
    parts.push(<span key={key++} className="text-neutral-300">{text.slice(lastIdx)}</span>);
  }

  return parts.length > 0 ? parts : [<span key={0} className="text-neutral-300">{text}</span>];
}

export function DebugPanel() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<DebugSource>>(new Set(ALL_SOURCES));
  const scrollRef = useRef<HTMLDivElement>(null);
  const agents = useAgentOfficeStore((s) => s.agents);
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const { data: pixelData, connected: pixelConnected } = usePixelTower();

  const toggleFilter = (src: DebugSource) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  };

  // Track previous values to only log changes
  const prevPixels = useRef("");
  const prevAgents = useRef("");
  const prevClaw = useRef("");

  // SSE subscription for server-pushed debug events
  useEffect(() => {
    const es = new EventSource("/api/debug-events");
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as { source: DebugSource; text: string; time: number };
        setLog((prev) => [...prev.slice(-MAX_LINES), { time: evt.time, source: evt.source, text: evt.text }]);
      } catch {}
    };
    return () => es.close();
  }, []);

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
      text: `${"act=" + activity.padEnd(10)}quads=[${quads}]`,
    };
    setLog((prev) => [...prev.slice(-MAX_LINES), entry]);
  }, [pixelData, pixelConnected]);

  // Agent state changes — log only agents that changed
  const prevAgentStates = useRef(new Map<string, string>());
  useEffect(() => {
    if (!agents.length) return;
    const now = Date.now();
    const entries: LogEntry[] = [];
    const currentStates = new Map<string, string>();

    for (const a of agents) {
      const stateStr = `${a.state}${a.currentTool ? `(${a.currentTool})` : ""}`;
      currentStates.set(a.name, stateStr);
      const prev = prevAgentStates.current.get(a.name);
      if (prev !== stateStr) {
        entries.push({
          time: now,
          source: "agents",
          text: `${a.name.padEnd(14)}${stateStr}`,
        });
      }
    }

    // Detect departures
    for (const [name] of prevAgentStates.current) {
      if (!currentStates.has(name)) {
        entries.push({ time: now, source: "agents", text: `${name.padEnd(14)}departed` });
      }
    }

    prevAgentStates.current = currentStates;
    if (entries.length > 0) {
      setLog((prev) => [...prev.slice(-MAX_LINES), ...entries]);
    }
  }, [agents]);

  // Track additional previous values
  const prevSlots = useRef("");
  const prevNetwork = useRef("");

  // Claw health changes — core status
  useEffect(() => {
    if (!clawHealth) return;
    const yee = clawHealth.yeelightConnected ? "on" : "OFF";
    const waiting = (clawHealth.waitingCount ?? 0) > 0 ? `  wait=${clawHealth.waitingCount}` : "";
    const transition = clawHealth.transitionInProgress ? "  TRANSITION" : "";
    const key = `${clawHealth.matrixMode}|${clawHealth.slots.join(",")}|${yee}${waiting}${transition}`;
    if (key === prevClaw.current) return;
    prevClaw.current = key;
    const entry: LogEntry = {
      time: Date.now(),
      source: "claw",
      text: `${"yee=" + yee.padEnd(4)}${"mode=" + (clawHealth.matrixMode ?? "?").padEnd(10)}${"slots=[" + clawHealth.slots.join(",") + "]"}${waiting}${transition}`,
    };
    setLog((prev) => [...prev.slice(-MAX_LINES), entry]);
  }, [clawHealth]);

  // Seat detail changes — who owns which seat
  useEffect(() => {
    if (!clawHealth?.slotsDetail) return;
    const detail = clawHealth.slotsDetail
      .map((sd, i) => sd.name ? `${"S" + i + ":" + sd.name}`.padEnd(18) + `${sd.ttl_remaining != null && sd.ttl_remaining > 0 ? `${sd.ttl_remaining}s` : sd.state}` : null)
      .filter(Boolean)
      .join("  ") || "empty";
    if (detail === prevSlots.current) return;
    prevSlots.current = detail;
    setLog((prev) => [...prev.slice(-MAX_LINES), { time: Date.now(), source: "seats" as const, text: detail }]);
  }, [clawHealth?.slotsDetail]);

  // Network monitor changes
  useEffect(() => {
    if (!clawHealth?.uptimeMonitors) return;
    const summary = clawHealth.uptimeMonitors
      .map(m => `${m.name.padEnd(12)}${(m.up ? `${m.ping}ms` : "DOWN").padEnd(8)}`)
      .join("");
    if (summary === prevNetwork.current) return;
    prevNetwork.current = summary;
    setLog((prev) => [...prev.slice(-MAX_LINES), { time: Date.now(), source: "net" as const, text: summary }]);
  }, [clawHealth?.uptimeMonitors]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="absolute top-2 left-2 z-50 bg-black/90 border border-white/10 rounded font-mono text-[10px] leading-[16px] w-[560px] max-h-[320px] flex flex-col select-none">
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-white/10">
        <span className="text-white/40 text-[9px] uppercase tracking-widest">Signal Debug</span>
        <span className="flex gap-1 text-[8px]">
          {ALL_SOURCES.map((src) => {
            const active = activeFilters.has(src);
            return (
              <span
                key={src}
                onClick={() => toggleFilter(src)}
                className={`cursor-pointer px-1.5 py-0.5 rounded-full transition-all ${
                  active ? SRC_COLORS[src] : "text-neutral-600 line-through"
                }`}
                style={active ? { backgroundColor: `color-mix(in srgb, currentColor 15%, transparent)` } : undefined}
              >
                {src}
              </span>
            );
          })}
        </span>
      </div>
      <div ref={scrollRef} className="overflow-y-auto px-3 py-1.5 flex-1">
        {log.length === 0 && (
          <div className="text-neutral-500 py-2">Waiting for signals...</div>
        )}
        {log.filter((entry) => activeFilters.has(entry.source)).map((entry, i) => (
          <div key={i} className="grid grid-cols-[80px_56px_1fr] hover:bg-white/[0.03] px-1 -mx-1 rounded">
            <span className="text-neutral-600">{fmt(entry.time)}</span>
            <span className={SRC_COLORS[entry.source]}>{entry.source}</span>
            <span className="whitespace-pre overflow-hidden text-ellipsis">{colorizeText(entry.text)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
