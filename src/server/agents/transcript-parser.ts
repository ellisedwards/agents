import type { AgentActivityState } from "../../shared/types";

const TYPING_TOOLS = new Set(["Write", "Edit", "Bash"]);
const READING_TOOLS = new Set([
  "Read",
  "Grep",
  "Glob",
  "WebFetch",
  "WebSearch",
]);

export interface ParsedEvent {
  type: "state_change" | "sub_agent_spawn" | "turn_end";
  state?: AgentActivityState;
  toolName?: string;
}

export function parseTranscriptLine(line: string): ParsedEvent | null {
  let parsed: any;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed?.type) return null;

  // Turn ended
  if (
    parsed.type === "system" &&
    parsed.subtype === "turn_duration"
  ) {
    return { type: "turn_end" };
  }

  // Assistant message
  if (parsed.type === "assistant") {
    const content = parsed.message?.content;
    if (!Array.isArray(content)) return null;

    const toolUse = content.find(
      (c: any) => c.type === "tool_use"
    );

    if (toolUse) {
      const name = toolUse.name;

      // Sub-agent spawn
      if (name === "Agent" || name === "Task") {
        return { type: "sub_agent_spawn", toolName: name };
      }

      // AskUserQuestion → waiting
      if (name === "AskUserQuestion") {
        return {
          type: "state_change",
          state: "waiting",
          toolName: name,
        };
      }

      // Tool → typing or reading
      const state: AgentActivityState = TYPING_TOOLS.has(name)
        ? "typing"
        : READING_TOOLS.has(name)
          ? "reading"
          : "typing"; // default unknown tools to typing

      return { type: "state_change", state, toolName: name };
    }

    // Text-only assistant message
    const hasText = content.some(
      (c: any) => c.type === "text" && c.text?.length > 0
    );
    if (hasText) {
      // Text-only with stop_reason=end_turn → turn is actually done
      // (no more tool calls coming — agent finished responding)
      if (parsed.message?.stop_reason === "end_turn") {
        return { type: "turn_end" };
      }
      return { type: "state_change", state: "thinking" };
    }
  }

  return null;
}
