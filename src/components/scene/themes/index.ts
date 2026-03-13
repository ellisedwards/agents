export type { SceneTheme } from "./types";
export { forestTheme } from "./forest";
export { goldenRuinsTheme } from "./golden-ruins";
export { mysteriousOasisTheme } from "./mysterious-oasis";
export { starkMonumentalTheme } from "./stark-monumental";

import { forestTheme } from "./forest";
import { goldenRuinsTheme } from "./golden-ruins";
import { mysteriousOasisTheme } from "./mysterious-oasis";
import { starkMonumentalTheme } from "./stark-monumental";
import type { SceneTheme } from "./types";

export const ALL_THEMES: SceneTheme[] = [
  forestTheme,
  goldenRuinsTheme,
  mysteriousOasisTheme,
  starkMonumentalTheme,
];

export function getThemeById(id: string): SceneTheme {
  return ALL_THEMES.find((t) => t.id === id) ?? forestTheme;
}
