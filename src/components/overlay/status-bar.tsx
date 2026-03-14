
import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentOfficeStore } from "../store";

export function StatusBar() {
  const agents = useAgentOfficeStore((s) => s.agents);
  const status = useAgentOfficeStore((s) => s.connectionStatus);
  const relayMessages = useAgentOfficeStore((s) => s.relayMessages);
  const relaySeenCount = useAgentOfficeStore((s) => s.relaySeenCount);
  const markRelaySeen = useAgentOfficeStore((s) => s.markRelaySeen);
  const relayUnread = relayMessages.length - relaySeenCount;

  const ccCount = agents.filter((a) => a.source === "cc").length;
  const ocCount = agents.filter((a) => a.source === "openclaw").length;

  const [brightness, setBrightness] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [relayOpen, setRelayOpen] = useState(false);
  const relayPanelRef = useRef<HTMLDivElement>(null);

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

  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(() => {
    if (resetting) return;
    setResetting(true);
    fetch("/api/tower-reset", { method: "POST" })
      .then((r) => r.json())
      .then((d) => { if (!d.ok) console.error("[tower-reset]", d.error); })
      .catch((e) => console.error("[tower-reset]", e))
      .finally(() => setTimeout(() => setResetting(false), 3000));
  }, [resetting]);

  const toggleRelay = () => {
    const opening = !relayOpen;
    setRelayOpen(opening);
    markRelaySeen();
    if (opening) {
      requestAnimationFrame(() => {
        relayPanelRef.current?.scrollTo(0, relayPanelRef.current.scrollHeight);
      });
    }
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
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Clear stale agents"
        >
          clr
        </button>
      )}

      {/* Relay indicator */}
      {relayMessages.length > 0 && (
        <button
          onClick={toggleRelay}
          className="text-cyan-400/70 hover:text-cyan-300 flex items-center gap-1 relative transition-colors"
          title="Relay chat"
        >
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${relayUnread > 0 ? "bg-cyan-400 animate-pulse" : "bg-cyan-400/70"}`} />
          relay
          {relayUnread > 0 && (
            <span className="absolute -top-1.5 -right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 text-[7px] text-white flex items-center justify-center">
              {relayUnread}
            </span>
          )}
        </button>
      )}

      {/* Relay message panel */}
      {relayOpen && relayMessages.length > 0 && (
        <div ref={relayPanelRef} className="absolute bottom-7 left-4 w-80 max-h-48 overflow-y-auto bg-[#12121e]/95 border border-white/10 rounded-md p-2.5 space-y-1.5 font-mono text-[10px] z-50">
          <div className="text-white/30 text-[9px] mb-1">Relay chat</div>
          {relayMessages.map((m, i) => (
            <div key={i} className={m.from === "claw" ? "text-cyan-300/80" : "text-orange-300/70"}>
              <span className="text-neutral-500">{new Date(m.time).toLocaleTimeString()}</span>{" "}
              <span className="text-neutral-400">{m.from === "claw" ? "claw:" : "ao:"}</span>{" "}
              {m.msg}
            </div>
          ))}
        </div>
      )}

      {/* Brightness slider + reset — right side */}
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
          <button
            onClick={handleReset}
            disabled={resetting}
            className={`text-[9px] px-1 rounded transition-colors ${
              resetting ? "text-yellow-400 animate-pulse" : "text-neutral-500 hover:text-neutral-300"
            }`}
            title="Reset tower"
          >
            {resetting ? "..." : "rst"}
          </button>
        </div>
      )}
    </div>
  );
}
