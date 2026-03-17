// Build the sprite library from all existing character definitions
import type { SpriteDefinition, SpriteFrame } from "./types";
import type { PixelRect } from "../characters/clawd";
import type { AgentSpriteState } from "@/shared/types";

import { CLAWD_SPRITES, CLAWD_WIDTH, CLAWD_HEIGHT } from "../characters/clawd";
import { CLAW_SPRITES, CLAW_WIDTH, CLAW_HEIGHT } from "../characters/claw";
import { CHARMANDER_SPRITES, CHARMANDER_WIDTH, CHARMANDER_HEIGHT } from "../characters/charmander";
import { SQUIRTLE_SPRITES, SQUIRTLE_WIDTH, SQUIRTLE_HEIGHT } from "../characters/squirtle";
import { BULBASAUR_SPRITES, BULBASAUR_WIDTH, BULBASAUR_HEIGHT } from "../characters/bulbasaur";
import { TRAINER_SPRITES, TRAINER_BLINK, TRAINER_WIDTH, TRAINER_HEIGHT } from "../characters/trainer";
import { PIKACHU_SPRITES, PIKACHU_WIDTH, PIKACHU_HEIGHT, PIKACHU_WALK1, PIKACHU_WALK2 } from "../characters/pikachu";
import { MEW_SPRITES, MEW_WIDTH, MEW_HEIGHT, MEW_WALK1, MEW_WALK2, MEW_SLEEP } from "../characters/mew";
import { CAT_WIDTH, CAT_HEIGHT, CAT_IDLE, CAT_WALK1, CAT_WALK2, CAT_SLEEP, CAT_STARTLED } from "../characters/tabby-cat";
import { SPHYNX_WIDTH, SPHYNX_HEIGHT, SPHYNX_IDLE, SPHYNX_WALK1, SPHYNX_WALK2, SPHYNX_SLEEP, SPHYNX_STARTLED } from "../characters/sphynx-cat";
import { GECKO_WIDTH, GECKO_HEIGHT, GECKO_IDLE, GECKO_WALK1, GECKO_WALK2, GECKO_SLEEP, GECKO_STARTLED } from "../characters/gecko";
import { SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT, SPACE_CAT_IDLE, SPACE_CAT_WALK1, SPACE_CAT_WALK2, SPACE_CAT_SLEEP, SPACE_CAT_STARTLED } from "../characters/space-cat";
import { JIGGLYPUFF_WIDTH, JIGGLYPUFF_HEIGHT, JIGGLYPUFF_IDLE, JIGGLYPUFF_WALK1, JIGGLYPUFF_WALK2, JIGGLYPUFF_SLEEP, JIGGLYPUFF_STARTLED } from "../characters/jigglypuff";
import { MAGE_COLORS, MAGE_WIDTH, MAGE_HEIGHT, makeMageSprite, makeMageWalk1, makeMageWalk2 } from "../characters/colored-mages";

const AGENT_STATES: AgentSpriteState[] = ["idle", "typing", "reading", "thinking", "waiting"];

function agentFrames(sprites: Record<AgentSpriteState, PixelRect[]>): SpriteFrame[] {
  return AGENT_STATES.map(s => ({ name: s, pixels: sprites[s] }));
}

function petFrames(idle: PixelRect[], walk1: PixelRect[], walk2: PixelRect[], sleep: PixelRect[], startled: PixelRect[]): SpriteFrame[] {
  return [
    { name: "idle", pixels: idle },
    { name: "walk1", pixels: walk1 },
    { name: "walk2", pixels: walk2 },
    { name: "sleep", pixels: sleep },
    { name: "startled", pixels: startled },
  ];
}

export function getBuiltInSprites(): SpriteDefinition[] {
  const sprites: SpriteDefinition[] = [];

  // Main agents
  sprites.push({
    id: "clawd", name: "Clawd", category: "agent",
    width: CLAWD_WIDTH, height: CLAWD_HEIGHT,
    frames: agentFrames(CLAWD_SPRITES), builtIn: true,
  });

  // Pokemon starters
  sprites.push({
    id: "charmander", name: "Charmander", category: "agent",
    width: CHARMANDER_WIDTH, height: CHARMANDER_HEIGHT,
    frames: agentFrames(CHARMANDER_SPRITES), builtIn: true,
  });
  sprites.push({
    id: "squirtle", name: "Squirtle", category: "agent",
    width: SQUIRTLE_WIDTH, height: SQUIRTLE_HEIGHT,
    frames: agentFrames(SQUIRTLE_SPRITES), builtIn: true,
  });
  sprites.push({
    id: "bulbasaur", name: "Bulbasaur", category: "agent",
    width: BULBASAUR_WIDTH, height: BULBASAUR_HEIGHT,
    frames: agentFrames(BULBASAUR_SPRITES), builtIn: true,
  });
  sprites.push({
    id: "mew", name: "Mew", category: "agent",
    width: MEW_WIDTH, height: MEW_HEIGHT,
    frames: [
      ...agentFrames(MEW_SPRITES),
      { name: "walk1", pixels: MEW_WALK1 },
      { name: "walk2", pixels: MEW_WALK2 },
      { name: "sleep", pixels: MEW_SLEEP },
    ],
    builtIn: true,
  });

  // Trainer (OpenClaw)
  sprites.push({
    id: "trainer", name: "Trainer", category: "manager",
    width: TRAINER_WIDTH, height: TRAINER_HEIGHT,
    frames: [
      ...agentFrames(TRAINER_SPRITES),
      { name: "blink", pixels: TRAINER_BLINK },
    ],
    builtIn: true,
  });

  // Subagents
  sprites.push({
    id: "claw", name: "Claw", category: "subagent",
    width: CLAW_WIDTH, height: CLAW_HEIGHT,
    frames: agentFrames(CLAW_SPRITES), builtIn: true,
  });
  sprites.push({
    id: "pikachu", name: "Pikachu", category: "subagent",
    width: PIKACHU_WIDTH, height: PIKACHU_HEIGHT,
    frames: [
      ...agentFrames(PIKACHU_SPRITES),
      { name: "walk1", pixels: PIKACHU_WALK1 },
      { name: "walk2", pixels: PIKACHU_WALK2 },
    ],
    builtIn: true,
  });

  // Mages
  const mageNames = ["Blue Mage", "Red Mage", "Purple Mage", "Orange Mage", "Gold Mage", "Teal Mage"];
  for (let i = 0; i < 6; i++) {
    const color = MAGE_COLORS[i];
    sprites.push({
      id: `mage-${i}`, name: mageNames[i], category: "subagent",
      width: MAGE_WIDTH, height: MAGE_HEIGHT,
      frames: [
        { name: "idle", pixels: makeMageSprite(color) },
        { name: "walk1", pixels: makeMageWalk1(color) },
        { name: "walk2", pixels: makeMageWalk2(color) },
      ],
      builtIn: true,
    });
  }

  // Pets
  sprites.push({
    id: "cat", name: "Tabby Cat", category: "pet",
    width: CAT_WIDTH, height: CAT_HEIGHT,
    frames: petFrames(CAT_IDLE, CAT_WALK1, CAT_WALK2, CAT_SLEEP, CAT_STARTLED),
    builtIn: true,
  });
  sprites.push({
    id: "sphynx", name: "Sphynx Cat", category: "pet",
    width: SPHYNX_WIDTH, height: SPHYNX_HEIGHT,
    frames: petFrames(SPHYNX_IDLE, SPHYNX_WALK1, SPHYNX_WALK2, SPHYNX_SLEEP, SPHYNX_STARTLED),
    builtIn: true,
  });
  sprites.push({
    id: "gecko", name: "Gecko", category: "pet",
    width: GECKO_WIDTH, height: GECKO_HEIGHT,
    frames: petFrames(GECKO_IDLE, GECKO_WALK1, GECKO_WALK2, GECKO_SLEEP, GECKO_STARTLED),
    builtIn: true,
  });
  sprites.push({
    id: "space-cat", name: "Space Cat", category: "pet",
    width: SPACE_CAT_WIDTH, height: SPACE_CAT_HEIGHT,
    frames: petFrames(SPACE_CAT_IDLE, SPACE_CAT_WALK1, SPACE_CAT_WALK2, SPACE_CAT_SLEEP, SPACE_CAT_STARTLED),
    builtIn: true,
  });
  sprites.push({
    id: "jigglypuff", name: "Jigglypuff", category: "pet",
    width: JIGGLYPUFF_WIDTH, height: JIGGLYPUFF_HEIGHT,
    frames: petFrames(JIGGLYPUFF_IDLE, JIGGLYPUFF_WALK1, JIGGLYPUFF_WALK2, JIGGLYPUFF_SLEEP, JIGGLYPUFF_STARTLED),
    builtIn: true,
  });

  return sprites;
}

// Load custom sprites from localStorage
const CUSTOM_SPRITES_KEY = "sprite-editor:custom-sprites";

export function loadCustomSprites(): SpriteDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SPRITES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SpriteDefinition[];
  } catch {
    return [];
  }
}

export function saveCustomSprites(sprites: SpriteDefinition[]): void {
  localStorage.setItem(CUSTOM_SPRITES_KEY, JSON.stringify(sprites));
}
