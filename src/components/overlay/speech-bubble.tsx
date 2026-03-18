
import { useAgentOfficeStore } from "../store";
import { canvasToDOM, type CanvasTransform } from "../canvas-transform";
import { getCachedAssignments } from "../scene/desk-layout";
import { getAgentPosition } from "../scene/renderer";

interface SpeechBubblesProps {
  transform: CanvasTransform;
}

export function SpeechBubbles({ transform }: SpeechBubblesProps) {
  const agents = useAgentOfficeStore((s) => s.agents);
  const cached = getCachedAssignments();
  const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
  if (cached) {
    for (const [id, asgn] of cached.assignments) {
      deskMap.set(id, asgn.desk);
    }
  }
  const waitingAgents = agents.filter((a) => a.state === "waiting");

  return (
    <>
      {waitingAgents.map((agent) => {
        const pos = deskMap.get(agent.id);
        if (!pos) return null;

        const walkPos = getAgentPosition(agent.id);
        const charX = walkPos ? walkPos.x : pos.characterX;
        const charY = walkPos ? walkPos.y : pos.characterY;

        const domPos = canvasToDOM(transform, charX, charY);

        return (
          <div
            key={agent.id}
            className="absolute bg-[#2a2a3a]/90 text-amber-300/80 font-mono rounded px-1.5 py-0.5 pointer-events-none border border-white/10"
            style={{
              left: domPos.x,
              top: domPos.y - 20 * transform.scale,
              transform: "translateX(-50%)",
              fontSize: `${Math.max(6, 7 * transform.scale)}px`,
            }}
          >
            needs input
            <div
              className="absolute w-1.5 h-1.5 bg-[#2a2a3a]/90 rotate-45 border-r border-b border-white/10"
              style={{ bottom: -3, left: "calc(50% - 3px)" }}
            />
          </div>
        );
      })}
    </>
  );
}
