export type { SceneTheme } from "./types";
export { forestTheme } from "./forest";
export { goldenRuinsTheme } from "./golden-ruins";
export { tropicalIslandTheme } from "./tropical-island";
export { lunarBaseTheme } from "./lunar-base";
export { palletTownTheme } from "./pallet-town";
export { pokemoonTheme } from "./pokemoon";

import { forestTheme } from "./forest";
import { goldenRuinsTheme } from "./golden-ruins";
import { tropicalIslandTheme } from "./tropical-island";
import { lunarBaseTheme } from "./lunar-base";
import { palletTownTheme } from "./pallet-town";
import { pokemoonTheme } from "./pokemoon";
import type { SceneTheme } from "./types";

export const ALL_THEMES: SceneTheme[] = [
  forestTheme,
  goldenRuinsTheme,
  tropicalIslandTheme,
  lunarBaseTheme,
  palletTownTheme,
  pokemoonTheme,
];

export function getThemeById(id: string): SceneTheme {
  return ALL_THEMES.find((t) => t.id === id) ?? forestTheme;
}
