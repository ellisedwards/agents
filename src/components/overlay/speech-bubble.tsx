
import { useAgentOfficeStore } from "../store";
import { canvasToDOM, type CanvasTransform } from "../canvas-transform";
import { assignDesks } from "../scene/desk-layout";

interface SpeechBubblesProps {
  transform: CanvasTransform;
}

export function SpeechBubbles({ transform }: SpeechBubblesProps) {
  const agents = useAgentOfficeStore((s) => s.agents);
  const waitingAgents = agents.filter((a) => a.state === "waiting");
  const deskMap = assignDesks(agents.map((a) => a.id));

  return (
    <>
      {waitingAgents.map((agent) => {
        const pos = deskMap.get(agent.id);
        if (!pos) return null;

        const domPos = canvasToDOM(
          transform,
          pos.characterX,
          pos.characterY
        );

        return (
          <div
            key={agent.id}
            className="absolute bg-white text-neutral-800 font-mono rounded px-2 py-0.5 pointer-events-none"
            style={{
              left: domPos.x,
              top: domPos.y - 24 * transform.scale,
              transform: "translateX(-50%)",
              fontSize: `${Math.max(8, 9 * transform.scale)}px`,
            }}
          >
            needs input
            <div
              className="absolute w-2 h-2 bg-white rotate-45"
              style={{ bottom: -3, left: "calc(50% - 4px)" }}
            />
          </div>
        );
      })}
    </>
  );
}
