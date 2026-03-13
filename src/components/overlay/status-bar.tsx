
import { useAgentOfficeStore } from "../store";

export function StatusBar() {
  const agents = useAgentOfficeStore((s) => s.agents);
  const status = useAgentOfficeStore((s) => s.connectionStatus);

  const ccCount = agents.filter((a) => a.source === "cc").length;
  const ocCount = agents.filter((a) => a.source === "openclaw").length;

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
    </div>
  );
}
