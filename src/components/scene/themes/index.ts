export type { SceneTheme } from "./types";
export { forestTheme } from "./forest";
export { goldenRuinsTheme } from "./golden-ruins";
export { tropicalIslandTheme } from "./tropical-island";

import { forestTheme } from "./forest";
import { goldenRuinsTheme } from "./golden-ruins";
import { tropicalIslandTheme } from "./tropical-island";
import type { SceneTheme } from "./types";

export const ALL_THEMES: SceneTheme[] = [
  forestTheme,
  goldenRuinsTheme,
  tropicalIslandTheme,
];

export function getThemeById(id: string): SceneTheme {
  return ALL_THEMES.find((t) => t.id === id) ?? forestTheme;
}
