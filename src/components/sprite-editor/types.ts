import type { PixelRect } from "../characters/clawd";

export type SpriteCategory = "agent" | "pet" | "subagent" | "custom";

export interface SpriteFrame {
  name: string; // e.g. "idle", "typing", "walk1"
  pixels: PixelRect[];
}

export interface SpriteDefinition {
  id: string;
  name: string;
  category: SpriteCategory;
  width: number;
  height: number;
  frames: SpriteFrame[];
  builtIn: boolean; // true = from code, false = user-created
}

export type EditorTool = "pencil" | "eraser" | "eyedropper" | "fill" | "move";

export interface EditorState {
  activeSpriteId: string | null;
  activeFrameIndex: number;
  tool: EditorTool;
  color: string;
  zoom: number; // pixels per cell
  showGrid: boolean;
  // Pixel data for the current frame being edited
  pixels: Map<string, string>; // "x,y" -> color
  undoStack: Array<Map<string, string>>;
  redoStack: Array<Map<string, string>>;
}

export function pixelKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parsePixelKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function pixelRectsToMap(rects: PixelRect[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rects) {
    for (let dy = 0; dy < r.h; dy++) {
      for (let dx = 0; dx < r.w; dx++) {
        map.set(pixelKey(r.x + dx, r.y + dy), r.color);
      }
    }
  }
  return map;
}

export function mapToPixelRects(map: Map<string, string>): PixelRect[] {
  const rects: PixelRect[] = [];
  for (const [key, color] of map) {
    const { x, y } = parsePixelKey(key);
    rects.push({ x, y, w: 1, h: 1, color });
  }
  return rects;
}
