import type { PixelRect } from "./clawd";
import type { AgentActivityState, AgentSpriteState, MageColorIndex } from "@/shared/types";
import { CLAWD_SPRITES, CLAWD_WIDTH, CLAWD_HEIGHT } from "./clawd";
import { CLAW_SPRITES, CLAW_WIDTH, CLAW_HEIGHT } from "./claw";
import {
  MAGE_COLORS,
  MAGE_WIDTH,
  MAGE_HEIGHT,
  makeMageSprite,
  makeMageWalk1,
  makeMageWalk2,
} from "./colored-mages";
import { CAT_WIDTH, CAT_HEIGHT, CAT_IDLE, CAT_WALK1, CAT_WALK2, CAT_SLEEP, CAT_STARTLED } from "./tabby-cat";
import { SPHYNX_WIDTH, SPHYNX_HEIGHT, SPHYNX_IDLE, SPHYNX_WALK1, SPHYNX_WALK2, SPHYNX_SLEEP, SPHYNX_STARTLED } from "./sphynx-cat";
import { GECKO_WIDTH, GECKO_HEIGHT, GECKO_IDLE, GECKO_WALK1, GECKO_WALK2, GECKO_SLEEP, GECKO_STARTLED } from "./gecko";
import { SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT, SPACE_CAT_IDLE, SPACE_CAT_WALK1, SPACE_CAT_WALK2, SPACE_CAT_SLEEP, SPACE_CAT_STARTLED } from "./space-cat";

export type CharacterType = "clawd" | "claw" | `mage-${MageColorIndex}` | "cat" | "sphynx" | "gecko" | "space-cat";

interface CachedSprite {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
}

function renderToOffscreen(
  rects: PixelRect[],
  width: number,
  height: number
): CachedSprite {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  for (const r of rects) {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  return { canvas, width, height };
}

export function buildSpriteCache(): Map<string, CachedSprite> {
  const cache = new Map<string, CachedSprite>();
  const states: AgentSpriteState[] = [
    "idle",
    "typing",
    "reading",
    "thinking",
    "waiting",
  ];

  for (const state of states) {
    cache.set(
      `clawd:${state}`,
      renderToOffscreen(CLAWD_SPRITES[state], CLAWD_WIDTH, CLAWD_HEIGHT)
    );
    cache.set(
      `claw:${state}`,
      renderToOffscreen(CLAW_SPRITES[state], CLAW_WIDTH, CLAW_HEIGHT)
    );
    for (let i = 0; i < 6; i++) {
      const color = MAGE_COLORS[i];
      cache.set(
        `mage-${i}:${state}`,
        renderToOffscreen(makeMageSprite(color), MAGE_WIDTH, MAGE_HEIGHT)
      );
    }
  }

  // Walk frames for mages
  for (let i = 0; i < 6; i++) {
    const color = MAGE_COLORS[i];
    cache.set(
      `mage-${i}:walk1`,
      renderToOffscreen(makeMageWalk1(color), MAGE_WIDTH, MAGE_HEIGHT)
    );
    cache.set(
      `mage-${i}:walk2`,
      renderToOffscreen(makeMageWalk2(color), MAGE_WIDTH, MAGE_HEIGHT)
    );
  }

  // Cat
  cache.set("cat:idle", renderToOffscreen(CAT_IDLE, CAT_WIDTH, CAT_HEIGHT));
  cache.set("cat:walk1", renderToOffscreen(CAT_WALK1, CAT_WIDTH, CAT_HEIGHT));
  cache.set("cat:walk2", renderToOffscreen(CAT_WALK2, CAT_WIDTH, CAT_HEIGHT));
  cache.set("cat:sleep", renderToOffscreen(CAT_SLEEP, CAT_WIDTH, CAT_HEIGHT));
  cache.set("cat:startled", renderToOffscreen(CAT_STARTLED, CAT_WIDTH, CAT_HEIGHT));

  // Sphynx cat
  cache.set("sphynx:idle", renderToOffscreen(SPHYNX_IDLE, SPHYNX_WIDTH, SPHYNX_HEIGHT));
  cache.set("sphynx:walk1", renderToOffscreen(SPHYNX_WALK1, SPHYNX_WIDTH, SPHYNX_HEIGHT));
  cache.set("sphynx:walk2", renderToOffscreen(SPHYNX_WALK2, SPHYNX_WIDTH, SPHYNX_HEIGHT));
  cache.set("sphynx:sleep", renderToOffscreen(SPHYNX_SLEEP, SPHYNX_WIDTH, SPHYNX_HEIGHT));
  cache.set("sphynx:startled", renderToOffscreen(SPHYNX_STARTLED, SPHYNX_WIDTH, SPHYNX_HEIGHT));

  // Gecko
  cache.set("gecko:idle", renderToOffscreen(GECKO_IDLE, GECKO_WIDTH, GECKO_HEIGHT));
  cache.set("gecko:walk1", renderToOffscreen(GECKO_WALK1, GECKO_WIDTH, GECKO_HEIGHT));
  cache.set("gecko:walk2", renderToOffscreen(GECKO_WALK2, GECKO_WIDTH, GECKO_HEIGHT));
  cache.set("gecko:sleep", renderToOffscreen(GECKO_SLEEP, GECKO_WIDTH, GECKO_HEIGHT));
  cache.set("gecko:startled", renderToOffscreen(GECKO_STARTLED, GECKO_WIDTH, GECKO_HEIGHT));

  // Space cat
  cache.set("space-cat:idle", renderToOffscreen(SPACE_CAT_IDLE, SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT));
  cache.set("space-cat:walk1", renderToOffscreen(SPACE_CAT_WALK1, SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT));
  cache.set("space-cat:walk2", renderToOffscreen(SPACE_CAT_WALK2, SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT));
  cache.set("space-cat:sleep", renderToOffscreen(SPACE_CAT_SLEEP, SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT));
  cache.set("space-cat:startled", renderToOffscreen(SPACE_CAT_STARTLED, SPACE_CAT_WIDTH, SPACE_CAT_HEIGHT));

  return cache;
}

export function getSprite(
  cache: Map<string, CachedSprite>,
  type: CharacterType,
  state: AgentActivityState | "walk1" | "walk2" | "sleep" | "startled"
): CachedSprite | undefined {
  return cache.get(`${type}:${state}`);
}
