import type { AgentState, AgentSpriteState, MageColorIndex } from "./types";

const STATES: AgentSpriteState[] = [
  "idle",
  "thinking",
  "typing",
  "reading",
  "idle",
  "waiting",
];

const TOOLS_BY_STATE: Record<AgentSpriteState, string[]> = {
  idle: [],
  thinking: [],
  typing: ["Edit", "Write", "Bash"],
  reading: ["Read", "Grep", "Glob", "WebFetch"],
  waiting: ["AskUserQuestion"],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createMockAgents(count: number): AgentState[] {
  const agents: AgentState[] = [];
  const now = Date.now();

  // Always include one OpenClaw agent
  agents.push({
    id: "openclaw-main",
    source: "openclaw",
    state: "idle",
    currentTool: null,
    name: "claw-main",
    parentId: null,
    subagentClass: null,
    teamColor: 0 as MageColorIndex,
    lastActivity: now,
  });

  // CC agents
  for (let i = 0; i < count - 1; i++) {
    const isSubAgent = i > 1 && Math.random() > 0.6;
    const teamColor = (isSubAgent ? 0 : i % 6) as MageColorIndex;
    agents.push({
      id: `cc-session-${i}`,
      source: "cc",
      state: "idle",
      currentTool: null,
      name: isSubAgent ? `sub-${i}` : `cc-${i + 1}`,
      parentId: isSubAgent ? "cc-session-0" : null,
      subagentClass: isSubAgent ? (i % 6) as MageColorIndex : null,
      teamColor,
      lastActivity: now,
    });
  }

  return agents;
}

export function cycleMockState(agents: AgentState[]): AgentState[] {
  const now = Date.now();
  return agents.map((agent) => {
    // ~30% chance to transition on each cycle
    if (Math.random() > 0.3) return agent;

    const currentIdx = STATES.indexOf(agent.state as AgentSpriteState);
    const nextIdx = (currentIdx + 1) % STATES.length;
    const nextState = STATES[nextIdx];
    const tools = TOOLS_BY_STATE[nextState];

    return {
      ...agent,
      state: nextState,
      currentTool: tools.length > 0 ? pickRandom(tools) : null,
      lastActivity: now,
    };
  });
}
