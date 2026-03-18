import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { SpriteDefinition, SpriteFrame, EditorTool, SpriteCategory } from "./types";
import { pixelKey, parsePixelKey, pixelRectsToMap, mapToPixelRects, CATEGORY_DEFAULTS, EVOLUTION_SIZE_STEP } from "./types";
import { getBuiltInSprites, loadCustomSprites, saveCustomSprites } from "./sprite-library";
import {
  Pencil, Eraser, Pipette, PaintBucket, BoxSelect,
  FlipHorizontal2, FlipVertical2,
  Trash2, Undo2, Redo2, Save, ClipboardCopy,
  ImagePlus, Sparkles, Settings, X, ArrowLeft,
  Grid3x3, Eye, EyeOff, ZoomIn, Copy, Plus,
  Play, Square, MoreVertical, ArrowUpDown,
} from "lucide-react";

// ─── Expected states per category ───────────────────────────────────────────
const EXPECTED_STATES: Record<SpriteCategory, string[]> = {
  agent: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2", "blink"],
  subagent: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2"],
  pet: ["idle", "walk1", "walk2", "sleep", "startled"],
  manager: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2", "blink"],
  custom: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2", "sleep", "startled"],
};

// ─── Color palette ──────────────────────────────────────────────────────────
const PALETTE = [
  // Row 1: basics
  "#000000", "#ffffff", "#333333", "#666666", "#999999", "#cccccc",
  // Row 2: reds/oranges
  "#cc3333", "#dd4444", "#ee6655", "#ff4700", "#ff8844", "#ffaa44",
  // Row 3: yellows/greens
  "#ffcc44", "#ffee88", "#F8D830", "#44bb66", "#009D14", "#338888",
  // Row 4: blues/purples
  "#3355cc", "#4466dd", "#4ABDD8", "#88bbdd", "#8844aa", "#9955bb",
  // Row 5: skin/browns
  "#c4856c", "#b07a60", "#E58C6B", "#8a6a44", "#665533", "#3e3530",
  // Row 6: pinks/special
  "#FFCADF", "#F8CCD6", "#EB3B36", "#C8484D", "#AB3F00", "#8E7D03",
];

// ─── Selection rectangle type ───────────────────────────────────────────────
interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Image overlay state ────────────────────────────────────────────────────
interface ImageOverlay {
  src: string;           // data URL of the imported image
  imgEl: HTMLImageElement;
  x: number;             // grid position (can be fractional during drag)
  y: number;
  w: number;             // grid units
  h: number;
  opacity: number;       // 0-1
}

// ─── Color utility functions ────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, "0")).join("");
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function adjustBrightness(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const adjust = (v: number) => Math.max(0, Math.min(255, Math.round(
    amount > 0 ? v + (255 - v) * amount : v + v * amount
  )));
  return `#${adjust(r).toString(16).padStart(2, "0")}${adjust(g).toString(16).padStart(2, "0")}${adjust(b).toString(16).padStart(2, "0")}`;
}

// SVG cursors
const CURSOR_PENCIL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4 20l1.5-4.5L17 4l3 3L8.5 18.5z' fill='%23fff' stroke='%23000' stroke-width='1'/%3E%3Cpath d='M4 20l1.5-4.5 3 3z' fill='%23ffa' stroke='%23000' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;
const CURSOR_ERASER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='4' y='10' width='14' height='10' rx='2' fill='%23f8a' stroke='%23000' stroke-width='1' transform='rotate(-20 11 15)'/%3E%3C/svg%3E") 8 18, crosshair`;
const CURSOR_PICKER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='3' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3Ccircle cx='12' cy='12' r='3' fill='none' stroke='%23000' stroke-width='0.5'/%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`;

function getEditorCursor(tool: EditorTool, altHeld: boolean): string {
  if (altHeld) return CURSOR_PICKER;
  switch (tool) {
    case "pencil": return CURSOR_PENCIL;
    case "eraser": return CURSOR_ERASER;
    case "eyedropper": return CURSOR_PICKER;
    case "fill": return "crosshair";
    case "select": return "crosshair";
    default: return "crosshair";
  }
}

function snapToPalette(hex: string, palette: string[]): string {
  const rgb = hexToRgb(hex);
  let best = palette[0];
  let bestDist = Infinity;
  for (const p of palette) {
    const d = colorDistance(rgb, hexToRgb(p));
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

function extractPalette(pixels: [number, number, number, number][], maxColors = 16, mergeThreshold = 30): string[] {
  // Count color frequencies (ignore mostly transparent)
  const freq = new Map<string, number>();
  for (const [r, g, b, a] of pixels) {
    if (a < 128) continue;
    const hex = rgbToHex(r, g, b);
    freq.set(hex, (freq.get(hex) ?? 0) + 1);
  }

  // Sort by frequency
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

  // Merge similar colors
  const merged: string[] = [];
  for (const [hex] of sorted) {
    const rgb = hexToRgb(hex);
    const tooClose = merged.some(m => colorDistance(rgb, hexToRgb(m)) < mergeThreshold);
    if (!tooClose) merged.push(hex);
    if (merged.length >= maxColors) break;
  }

  return merged;
}

function rasterizeImage(
  img: HTMLImageElement,
  overlay: ImageOverlay,
  gridW: number,
  gridH: number,
): { pixels: Map<string, string>; palette: string[] } {
  // Draw the image at the overlay position onto a canvas matching the grid
  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext("2d")!;

  // Draw the image mapped from overlay grid coords to pixel coords
  ctx.drawImage(img, overlay.x, overlay.y, overlay.w, overlay.h);

  const imageData = ctx.getImageData(0, 0, gridW, gridH);
  const rawPixels: [number, number, number, number][] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    rawPixels.push([
      imageData.data[i],
      imageData.data[i + 1],
      imageData.data[i + 2],
      imageData.data[i + 3],
    ]);
  }

  // Extract palette from the raw pixels
  const palette = extractPalette(rawPixels);

  // Snap each pixel to the palette
  const result = new Map<string, string>();
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      const [r, g, b, a] = rawPixels[idx];
      if (a < 128) continue; // transparent
      const hex = rgbToHex(r, g, b);
      const snapped = snapToPalette(hex, palette);
      result.set(pixelKey(x, y), snapped);
    }
  }

  return { pixels: result, palette };
}

// ─── Preview component ─────────────────────────────────────────────────────
function SpritePreview({ pixels, width, height, scale = 1, className = "" }: {
  pixels: Map<string, string>;
  width: number;
  height: number;
  scale?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width * scale, height * scale);
    for (const [key, color] of pixels) {
      const { x, y } = parsePixelKey(key);
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }, [pixels, width, height, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={width * scale}
      height={height * scale}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ─── Library thumbnail ──────────────────────────────────────────────────────
function SpriteThumbnail({ sprite, selected, onClick }: {
  sprite: SpriteDefinition;
  selected: boolean;
  onClick: () => void;
}) {
  const idleFrame = sprite.frames[0];
  const pixels = useMemo(() => pixelRectsToMap(idleFrame?.pixels ?? []), [idleFrame]);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${
        selected ? "bg-white/15 ring-1 ring-white/30" : "hover:bg-white/8"
      }`}
    >
      <div className="bg-[#1a1a2e] rounded p-1 flex items-center justify-center" style={{ minWidth: 40, minHeight: 40 }}>
        <SpritePreview pixels={pixels} width={sprite.width} height={sprite.height} scale={2} />
      </div>
      <span className="font-mono text-[9px] text-white/50 truncate max-w-[60px]">{sprite.name}</span>
      <span className="font-mono text-[7px] text-white/20">{sprite.width}x{sprite.height}</span>
    </button>
  );
}

// ─── Main Editor ────────────────────────────────────────────────────────────
export function SpriteEditor() {
  const [allSprites, setAllSprites] = useState<SpriteDefinition[]>(() => [
    ...getBuiltInSprites(),
    ...loadCustomSprites(),
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [tool, setTool] = useState<EditorTool>("pencil");
  const [color, setColor] = useState("#ff4700");
  const [zoom, setZoom] = useState(20);
  const [showGrid, setShowGrid] = useState(true);
  const [pixels, setPixels] = useState<Map<string, string>>(new Map());
  const [undoStack, setUndoStack] = useState<Array<Map<string, string>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Map<string, string>>>([]);
  const [drawing, setDrawing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SpriteCategory | "all">("all");
  const [showCheckerboard, setShowCheckerboard] = useState(true);
  const [canvasBg, setCanvasBg] = useState("#d4d4d4");
  const [animating, setAnimating] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Selection state
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedPixels, setSelectedPixels] = useState<Map<string, string>>(new Map());
  const [movingSelection, setMovingSelection] = useState(false);
  const [moveStart, setMoveStart] = useState<{ x: number; y: number } | null>(null);

  // Clipboard for copy/paste frames
  const clipboardRef = useRef<Map<string, string> | null>(null);

  // Evolution overlay — ghost of previous form + A/B/C compare
  const [evoOverlayOn, setEvoOverlayOn] = useState(false);
  const [evoCompareIdx, setEvoCompareIdx] = useState<number | null>(null); // index into evolution chain

  // Alt-eyedropper and cursor highlight
  const [altHeld, setAltHeld] = useState(false);
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null);

  // Image import overlay state
  const [imageOverlay, setImageOverlay] = useState<ImageOverlay | null>(null);
  const [draggingOverlay, setDraggingOverlay] = useState<"move" | "resize" | null>(null);
  const [overlayDragStart, setOverlayDragStart] = useState<{ mx: number; my: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const [rasterizedPalette, setRasterizedPalette] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("sprite-editor-api-key") ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track which sprites were edited this session
  const [dirtySprites, setDirtySprites] = useState<Set<string>>(new Set());

  const selected = allSprites.find(s => s.id === selectedId) ?? null;

  // Evolution chain for the current sprite
  const evoChain = useMemo(() => {
    if (!selected) return [];
    // Find all sprites in the same evolution chain
    const rootId = selected.evolutionOf ?? selected.id;
    return allSprites
      .filter(s => s.id === rootId || s.evolutionOf === rootId)
      .sort((a, b) => (a.evolutionStage ?? 0) - (b.evolutionStage ?? 0));
  }, [selected, allSprites]);

  // Get overlay pixels from a different evolution stage (for ghost overlay)
  const evoOverlayPixels = useMemo(() => {
    if (!evoOverlayOn || !selected || evoChain.length < 2) return null;
    // Find the previous evolution form
    const currentStage = selected.evolutionStage ?? 0;
    const prev = evoChain.find(s => (s.evolutionStage ?? 0) === currentStage - 1);
    if (!prev) return null;
    const idleFrame = prev.frames.find(f => f.name === "idle") ?? prev.frames[0];
    if (!idleFrame) return null;
    return { pixels: pixelRectsToMap(idleFrame.pixels), width: prev.width, height: prev.height };
  }, [evoOverlayOn, selected, evoChain]);

  // A/B/C compare pixels — show a different evo's idle frame at 1:1
  const evoComparePixels = useMemo(() => {
    if (evoCompareIdx === null || !evoChain[evoCompareIdx]) return null;
    const sprite = evoChain[evoCompareIdx];
    const idleFrame = sprite.frames.find(f => f.name === (selected?.frames[frameIndex]?.name ?? "idle")) ?? sprite.frames[0];
    if (!idleFrame) return null;
    return { pixels: pixelRectsToMap(idleFrame.pixels), width: sprite.width, height: sprite.height };
  }, [evoCompareIdx, evoChain, selected, frameIndex]);

  // Load frame pixels when selection changes
  useEffect(() => {
    if (!selected) { setPixels(new Map()); return; }
    const frame = selected.frames[frameIndex];
    if (!frame) { setPixels(new Map()); return; }
    setPixels(pixelRectsToMap(frame.pixels));
    setUndoStack([]);
    setRedoStack([]);
    setSelection(null);
    setSelectedPixels(new Map());
  }, [selectedId, frameIndex, selected?.id]);

  // Animation loop
  useEffect(() => {
    if (!animating || !selected) return;
    const walkFrames = selected.frames.filter(f => f.name === "walk1" || f.name === "walk2" || f.name === "idle");
    if (walkFrames.length === 0) return;
    const id = setInterval(() => {
      setAnimFrame(prev => (prev + 1) % walkFrames.length);
    }, 250);
    return () => clearInterval(id);
  }, [animating, selected]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-50), new Map(pixels)]);
    setRedoStack([]);
  }, [pixels]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, new Map(pixels)]);
      setPixels(last);
      return prev.slice(0, -1);
    });
  }, [pixels]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack(u => [...u, new Map(pixels)]);
      setPixels(last);
      return prev.slice(0, -1);
    });
  }, [pixels]);

  // Flip horizontal
  const flipH = useCallback(() => {
    if (!selected) return;
    pushUndo();
    const newPixels = new Map<string, string>();
    for (const [key, c] of pixels) {
      const { x, y } = parsePixelKey(key);
      newPixels.set(pixelKey(selected.width - 1 - x, y), c);
    }
    setPixels(newPixels);
  }, [selected, pixels, pushUndo]);

  // Flip vertical
  const flipV = useCallback(() => {
    if (!selected) return;
    pushUndo();
    const newPixels = new Map<string, string>();
    for (const [key, c] of pixels) {
      const { x, y } = parsePixelKey(key);
      newPixels.set(pixelKey(x, selected.height - 1 - y), c);
    }
    setPixels(newPixels);
  }, [selected, pixels, pushUndo]);

  // Shift all pixels by dx, dy
  const shiftPixels = useCallback((dx: number, dy: number) => {
    if (!selected) return;
    pushUndo();

    if (selection && selectedPixels.size > 0) {
      // Move only selected pixels
      const newPixels = new Map(pixels);
      // Remove selected pixels from old positions
      for (const [key] of selectedPixels) {
        newPixels.delete(key);
      }
      // Place at new positions
      const newSelected = new Map<string, string>();
      for (const [key, c] of selectedPixels) {
        const { x, y } = parsePixelKey(key);
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < selected.width && ny >= 0 && ny < selected.height) {
          newPixels.set(pixelKey(nx, ny), c);
          newSelected.set(pixelKey(nx, ny), c);
        }
      }
      setPixels(newPixels);
      setSelectedPixels(newSelected);
      setSelection(prev => prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null);
    } else {
      // Move all pixels
      const newPixels = new Map<string, string>();
      for (const [key, c] of pixels) {
        const { x, y } = parsePixelKey(key);
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < selected.width && ny >= 0 && ny < selected.height) {
          newPixels.set(pixelKey(nx, ny), c);
        }
      }
      setPixels(newPixels);
    }
  }, [selected, pixels, pushUndo, selection, selectedPixels]);

  // Clear current frame
  const clearFrame = useCallback(() => {
    if (!selected) return;
    pushUndo();
    setPixels(new Map());
  }, [selected, pushUndo]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(null);
    setSelectedPixels(new Map());
    setMovingSelection(false);
    setMoveStart(null);
    setSelectionStart(null);
  }, []);

  // Handle image file import
  const handleImageImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Fit the image to the grid while preserving aspect ratio
        const aspect = img.width / img.height;
        let w = selected.width;
        let h = Math.round(w / aspect);
        if (h > selected.height) {
          h = selected.height;
          w = Math.round(h * aspect);
        }
        setImageOverlay({
          src,
          imgEl: img,
          x: 0,
          y: 0,
          w,
          h,
          opacity: 0.5,
        });
        setRasterizedPalette(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    // Reset file input so re-importing the same file works
    e.target.value = "";
  }, [selected]);

  // Rasterize the overlay image into pixels
  const handleRasterize = useCallback(() => {
    if (!imageOverlay || !selected) return;
    pushUndo();
    const { pixels: rasterized, palette } = rasterizeImage(
      imageOverlay.imgEl,
      imageOverlay,
      selected.width,
      selected.height,
    );
    setPixels(rasterized);
    setRasterizedPalette(palette);
  }, [imageOverlay, selected, pushUndo]);

  // AI Clean
  const handleAiClean = useCallback(async () => {
    if (!selected || !imageOverlay || !rasterizedPalette) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setAiLoading(true);
    try {
      const currentPixels: [number, number, string][] = [];
      for (const [key, color] of pixels) {
        const { x, y } = parsePixelKey(key);
        currentPixels.push([x, y, color]);
      }
      const response = await fetch("/api/ai/pixel-clean", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageOverlay.src,
          currentPixels,
          palette: rasterizedPalette,
          width: selected.width,
          height: selected.height,
          apiKey,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(`AI Clean failed: ${err.error || response.statusText}`);
        return;
      }
      const data = await response.json();
      if (data.pixels && Array.isArray(data.pixels)) {
        pushUndo();
        const cleaned = new Map<string, string>();
        for (const p of data.pixels) {
          if (Array.isArray(p) && p.length >= 3) {
            cleaned.set(pixelKey(p[0], p[1]), p[2]);
          }
        }
        setPixels(cleaned);
      }
    } catch (err: any) {
      alert(`AI Clean error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [selected, imageOverlay, rasterizedPalette, apiKey, pixels, pushUndo]);

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) localStorage.setItem("sprite-editor-api-key", apiKey);
    else localStorage.removeItem("sprite-editor-api-key");
  }, [apiKey]);

  // Overlay drag handlers
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    if (!imageOverlay) return;
    setDraggingOverlay(mode);
    setOverlayDragStart({
      mx: e.clientX,
      my: e.clientY,
      ox: imageOverlay.x,
      oy: imageOverlay.y,
      ow: imageOverlay.w,
      oh: imageOverlay.h,
    });
  }, [imageOverlay]);

  useEffect(() => {
    if (!draggingOverlay || !overlayDragStart || !imageOverlay) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - overlayDragStart.mx) / zoom;
      const dy = (e.clientY - overlayDragStart.my) / zoom;
      if (draggingOverlay === "move") {
        setImageOverlay(prev => prev ? { ...prev, x: overlayDragStart.ox + dx, y: overlayDragStart.oy + dy } : null);
      } else {
        const newW = Math.max(1, Math.round(overlayDragStart.ow + dx));
        const newH = Math.max(1, Math.round(overlayDragStart.oh + dy));
        setImageOverlay(prev => prev ? { ...prev, w: newW, h: newH } : null);
      }
    };
    const handleUp = () => {
      setDraggingOverlay(null);
      setOverlayDragStart(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingOverlay, overlayDragStart, imageOverlay, zoom]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Alt for temporary eyedropper
      if (e.key === "Alt") { e.preventDefault(); setAltHeld(true); return; }

      // Don't handle shortcuts if a text input is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "b" || e.key === "p") setTool("pencil");
      else if (e.key === "e") setTool("eraser");
      else if (e.key === "i") setTool("eyedropper");
      else if (e.key === "g") setShowGrid(v => !v);
      else if (e.key === "f") setTool("fill");
      else if (e.key === "s") setTool("select");
      else if (e.key === "Escape") clearSelection();
      else if (e.key === "[") setColor(c => adjustBrightness(c, -0.1));
      else if (e.key === "]") setColor(c => adjustBrightness(c, 0.1));
      else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "z" && e.shiftKey || e.key === "y")) { e.preventDefault(); redo(); }
      // Copy/Paste frame (Cmd+C / Cmd+V)
      else if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        e.preventDefault();
        clipboardRef.current = new Map(pixels);
      }
      else if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        if (clipboardRef.current) {
          pushUndo();
          setPixels(new Map(clipboardRef.current));
        }
      }
      // Arrow keys shift pixels
      else if (e.key === "ArrowUp") { e.preventDefault(); shiftPixels(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); shiftPixels(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); shiftPixels(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); shiftPixels(1, 0); }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Alt") setAltHeld(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [undoStack, redoStack, pixels, pushUndo, shiftPixels, clearSelection, undo, redo]);

  // Flood fill
  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    if (!selected) return;
    const targetColor = pixels.get(pixelKey(startX, startY)) ?? null;
    if (targetColor === fillColor) return;
    const newPixels = new Map(pixels);
    const stack = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = pixelKey(x, y);
      if (visited.has(key)) continue;
      if (x < 0 || x >= selected.width || y < 0 || y >= selected.height) continue;
      const currentColor = newPixels.get(key) ?? null;
      if (currentColor !== targetColor) continue;
      visited.add(key);
      if (fillColor === null) newPixels.delete(key);
      else newPixels.set(key, fillColor);
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
    setPixels(newPixels);
  }, [pixels, selected]);

  // Check if a pixel is inside the selection
  const isInSelection = useCallback((px: number, py: number): boolean => {
    if (!selection) return false;
    return px >= selection.x && px < selection.x + selection.w &&
           py >= selection.y && py < selection.y + selection.h;
  }, [selection]);

  const handleCanvasInteraction = useCallback((e: React.MouseEvent, isStart: boolean) => {
    if (!selected || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || x >= selected.width || y < 0 || y >= selected.height) {
      if (isStart && selection) clearSelection();
      return;
    }

    // Right-click eyedropper
    if (e.button === 2) {
      const c = pixels.get(pixelKey(x, y));
      if (c) setColor(c);
      return;
    }

    if (tool === "eyedropper" || altHeld) {
      const c = pixels.get(pixelKey(x, y));
      if (c) setColor(c);
      if (tool === "eyedropper") setTool("pencil");
      return;
    }

    if (tool === "fill" && isStart) {
      pushUndo();
      floodFill(x, y, color);
      return;
    }

    // Select tool
    if (tool === "select") {
      if (isStart) {
        // Check if clicking inside existing selection to move it
        if (selection && isInSelection(x, y) && selectedPixels.size > 0) {
          setMovingSelection(true);
          setMoveStart({ x, y });
          return;
        }
        // Start new selection
        clearSelection();
        setSelectionStart({ x, y });
        setSelection({ x, y, w: 1, h: 1 });
      } else {
        // Dragging to form selection or moving
        if (movingSelection && moveStart && selection) {
          const dx = x - moveStart.x;
          const dy = y - moveStart.y;
          if (dx === 0 && dy === 0) return;

          pushUndo();
          // Move selected pixels
          const newPixels = new Map(pixels);
          // Remove old positions of selected pixels
          for (const [key] of selectedPixels) {
            newPixels.delete(key);
          }
          // Place at new positions
          const newSelectedPixels = new Map<string, string>();
          for (const [key, c] of selectedPixels) {
            const pos = parsePixelKey(key);
            const nx = pos.x + dx;
            const ny = pos.y + dy;
            if (nx >= 0 && nx < selected.width && ny >= 0 && ny < selected.height) {
              newPixels.set(pixelKey(nx, ny), c);
              newSelectedPixels.set(pixelKey(nx, ny), c);
            }
          }
          setPixels(newPixels);
          setSelectedPixels(newSelectedPixels);
          setSelection({
            x: selection.x + dx,
            y: selection.y + dy,
            w: selection.w,
            h: selection.h,
          });
          setMoveStart({ x, y });
        } else if (selectionStart) {
          // Resize selection rectangle
          const sx = Math.min(selectionStart.x, x);
          const sy = Math.min(selectionStart.y, y);
          const ex = Math.max(selectionStart.x, x);
          const ey = Math.max(selectionStart.y, y);
          setSelection({ x: sx, y: sy, w: ex - sx + 1, h: ey - sy + 1 });
        }
      }
      return;
    }

    if (isStart) pushUndo();

    setPixels(prev => {
      const next = new Map(prev);
      if (tool === "eraser") {
        next.delete(pixelKey(x, y));
      } else {
        next.set(pixelKey(x, y), color);
      }
      return next;
    });
  }, [selected, zoom, tool, color, pixels, pushUndo, floodFill, selection, selectionStart, selectedPixels, movingSelection, moveStart, isInSelection, clearSelection, altHeld]);

  // Finalize selection on mouseUp (capture pixels inside selection)
  const handleCanvasMouseUp = useCallback(() => {
    setDrawing(false);
    if (tool === "select" && movingSelection) {
      setMovingSelection(false);
      setMoveStart(null);
      return;
    }
    if (tool === "select" && selection && selectionStart) {
      // Single click (1x1 with no real drag) = deselect
      if (selection.w <= 1 && selection.h <= 1) {
        clearSelection();
        return;
      }
      // Capture pixels within the selection
      const captured = new Map<string, string>();
      for (let py = selection.y; py < selection.y + selection.h; py++) {
        for (let px = selection.x; px < selection.x + selection.w; px++) {
          const key = pixelKey(px, py);
          const c = pixels.get(key);
          if (c) captured.set(key, c);
        }
      }
      setSelectedPixels(captured);
      setSelectionStart(null);
    }
  }, [tool, selection, selectionStart, pixels, movingSelection, clearSelection]);

  // Right-click handler to prevent context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!selected || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || x >= selected.width || y < 0 || y >= selected.height) return;
    const c = pixels.get(pixelKey(x, y));
    if (c) setColor(c);
  }, [selected, zoom, pixels]);

  // Save current pixels back to sprite definition
  const markDirty = useCallback(() => {
    if (selectedId) setDirtySprites(prev => new Set(prev).add(selectedId));
  }, [selectedId]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string, ms = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  const saveFrame = useCallback(() => {
    if (!selected) return;
    markDirty();
    const rects = mapToPixelRects(pixels);
    const updatedSprites = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = [...s.frames];
      frames[frameIndex] = { ...frames[frameIndex], pixels: rects };
      return { ...s, frames };
    });
    setAllSprites(updatedSprites);
    // Save custom sprites to localStorage
    const customs = updatedSprites.filter(s => !s.builtIn);
    saveCustomSprites(customs);
    showToast("Frame saved");
  }, [selected, pixels, frameIndex, allSprites, markDirty, showToast]);

  // Export as TypeScript
  // Export patch — compact format for Claude to apply to source files
  // Includes ALL sprites edited this session
  const [exportLabel, setExportLabel] = useState("Export Patch");
  const exportPatch = useCallback(() => {
    // Save current frame first so it's included
    if (selected) markDirty();

    // Collect all dirty sprites (plus current if it has unsaved changes)
    const idsToExport = new Set(dirtySprites);
    if (selectedId) idsToExport.add(selectedId);

    if (idsToExport.size === 0) return;

    const patches: Array<Record<string, unknown>> = [];
    for (const id of idsToExport) {
      const sprite = allSprites.find(s => s.id === id);
      if (!sprite) continue;

      const frames: Record<string, Array<[number, number, string]>> = {};
      for (let fi = 0; fi < sprite.frames.length; fi++) {
        const frame = sprite.frames[fi];
        // Use live pixels for current sprite+frame, stored data otherwise
        const rects = (id === selectedId && fi === frameIndex)
          ? mapToPixelRects(pixels)
          : frame.pixels;
        const compact = rects.flatMap(r => {
          const entries: Array<[number, number, string]> = [];
          for (let dy = 0; dy < r.h; dy++) {
            for (let dx = 0; dx < r.w; dx++) {
              entries.push([r.x + dx, r.y + dy, r.color]);
            }
          }
          return entries;
        });
        frames[frame.name] = compact;
      }
      patches.push({
        sprite: sprite.id,
        name: sprite.name,
        category: sprite.category,
        size: [sprite.width, sprite.height],
        builtIn: sprite.builtIn,
        file: sprite.builtIn ? `src/components/characters/${sprite.id}.ts` : null,
        frames,
      });
    }

    const header = patches.map(p => p.name).join(", ");
    const text = `SPRITE PATCH (${patches.length} sprite${patches.length > 1 ? "s" : ""}): ${header}\n\`\`\`json\n${JSON.stringify(patches.length === 1 ? patches[0] : patches)}\n\`\`\``;
    navigator.clipboard.writeText(text);
    setExportLabel(`Copied ${patches.length}!`);
    setTimeout(() => setExportLabel("Export Patch"), 1200);
    showToast(`Copied ${patches.length} sprite${patches.length > 1 ? "s" : ""} to clipboard — paste to Claude Code`);
  }, [selected, selectedId, pixels, frameIndex, allSprites, dirtySprites, markDirty]);

  // New sprite dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newCategory, setNewCategory] = useState<SpriteCategory>("agent");
  const [newName, setNewName] = useState("");
  const [newWidth, setNewWidth] = useState(16);
  const [newHeight, setNewHeight] = useState(17);

  // Update dimensions when category changes
  useEffect(() => {
    const d = CATEGORY_DEFAULTS[newCategory];
    setNewWidth(d.width);
    setNewHeight(d.height);
  }, [newCategory]);

  const createNew = useCallback(() => {
    if (!newName.trim()) return;
    const id = `custom-${Date.now()}`;
    const sprite: SpriteDefinition = {
      id,
      name: newName.trim(),
      category: newCategory,
      width: newWidth,
      height: newHeight,
      frames: [{ name: "idle", pixels: [] }],
      builtIn: false,
      evolutionStage: 0,
    };
    const updated = [...allSprites, sprite];
    setAllSprites(updated);
    saveCustomSprites(updated.filter(s => !s.builtIn));
    setSelectedId(id);
    setFrameIndex(0);
    setShowNewDialog(false);
    setNewName("");
  }, [allSprites, newName, newCategory, newWidth, newHeight]);

  // Add evolution to current sprite
  const addEvolution = useCallback(() => {
    if (!selected) return;
    const parentStage = selected.evolutionStage ?? 0;
    const nextStage = parentStage + 1;
    const id = `${selected.id}-evo${nextStage}`;
    const sprite: SpriteDefinition = {
      id,
      name: `${selected.name} Evo ${nextStage + 1}`,
      category: selected.category,
      width: selected.width + EVOLUTION_SIZE_STEP,
      height: selected.height + EVOLUTION_SIZE_STEP,
      frames: [{ name: "idle", pixels: [] }],
      builtIn: false,
      evolutionOf: selected.id,
      evolutionStage: nextStage,
    };
    const updated = [...allSprites, sprite];
    setAllSprites(updated);
    saveCustomSprites(updated.filter(s => !s.builtIn));
    setSelectedId(id);
    setFrameIndex(0);
    showToast(`Evolution stage ${nextStage + 1} created (${sprite.width}x${sprite.height})`);
  }, [selected, allSprites, showToast]);

  // Add frame to current sprite
  const addFrame = useCallback((name: string) => {
    if (!selected || !name) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      return { ...s, frames: [...s.frames, { name, pixels: [] }] };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    setFrameIndex(selected.frames.length);
  }, [selected, allSprites]);

  // Duplicate frame
  const duplicateFrame = useCallback(() => {
    if (!selected) return;
    const currentFrame = selected.frames[frameIndex];
    if (!currentFrame) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = [...s.frames];
      frames.splice(frameIndex + 1, 0, { name: `${currentFrame.name}_copy`, pixels: [...currentFrame.pixels] });
      return { ...s, frames };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    setFrameIndex(frameIndex + 1);
  }, [selected, frameIndex, allSprites]);

  // Rename a frame
  const renameFrame = useCallback((fi: number, newName: string) => {
    if (!selected || !newName) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = [...s.frames];
      frames[fi] = { ...frames[fi], name: newName };
      return { ...s, frames };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    markDirty();
  }, [selected, allSprites, markDirty]);

  // Swap two frames (for remap — swap this frame's name with another)
  const swapFrameNames = useCallback((fi: number, targetName: string) => {
    if (!selected) return;
    const targetIdx = selected.frames.findIndex(f => f.name === targetName);
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = [...s.frames];
      if (targetIdx >= 0) {
        // Swap names between the two frames
        const oldName = frames[fi].name;
        frames[fi] = { ...frames[fi], name: targetName };
        frames[targetIdx] = { ...frames[targetIdx], name: oldName };
      } else {
        // Target name doesn't exist yet — just rename this frame
        frames[fi] = { ...frames[fi], name: targetName };
      }
      return { ...s, frames };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    markDirty();
  }, [selected, allSprites, markDirty]);

  // Delete a frame
  const deleteFrame = useCallback((fi: number) => {
    if (!selected || selected.frames.length <= 1) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = s.frames.filter((_, idx) => idx !== fi);
      return { ...s, frames };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    if (frameIndex >= fi && frameIndex > 0) setFrameIndex(frameIndex - 1);
    markDirty();
  }, [selected, allSprites, frameIndex, markDirty]);

  // Copy frame pixels to another frame (overwrite or swap)
  const copyFrameTo = useCallback((sourceIdx: number, targetIdx: number, mode: "overwrite" | "swap") => {
    if (!selected) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      const frames = [...s.frames];
      const sourcePixels = [...frames[sourceIdx].pixels];
      if (mode === "swap") {
        const targetPixels = [...frames[targetIdx].pixels];
        frames[sourceIdx] = { ...frames[sourceIdx], pixels: targetPixels };
        frames[targetIdx] = { ...frames[targetIdx], pixels: sourcePixels };
      } else {
        frames[targetIdx] = { ...frames[targetIdx], pixels: sourcePixels };
      }
      return { ...s, frames };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
    markDirty();
    // If we're viewing the target, reload its pixels
    if (frameIndex === targetIdx || (mode === "swap" && frameIndex === sourceIdx)) {
      const sprite = updated.find(s => s.id === selected.id);
      if (sprite) {
        setPixels(pixelRectsToMap(sprite.frames[frameIndex].pixels));
      }
    }
  }, [selected, allSprites, frameIndex, markDirty]);

  // Frame context menu state
  const [frameMenuIdx, setFrameMenuIdx] = useState<number | null>(null);
  const frameMenuRef = useRef<HTMLDivElement>(null);

  // Close frame menu on outside click
  useEffect(() => {
    if (frameMenuIdx === null) return;
    const handler = (e: MouseEvent) => {
      if (frameMenuRef.current && !frameMenuRef.current.contains(e.target as Node)) {
        setFrameMenuIdx(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [frameMenuIdx]);

  // Delete custom sprite
  const deleteSprite = useCallback(() => {
    if (!selected || selected.builtIn) return;
    const updated = allSprites.filter(s => s.id !== selected.id);
    setAllSprites(updated);
    saveCustomSprites(updated.filter(s => !s.builtIn));
    setSelectedId(null);
  }, [selected, allSprites]);

  // Resize sprite
  const resizeSprite = useCallback(() => {
    if (!selected) return;
    const input = prompt(`New size (WxH, current: ${selected.width}x${selected.height}):`, `${selected.width}x${selected.height}`);
    if (!input) return;
    const [w, h] = input.split("x").map(Number);
    if (!w || !h || w < 1 || h < 1 || w > 64 || h > 64) return;
    const updated = allSprites.map(s => {
      if (s.id !== selected.id) return s;
      return { ...s, width: w, height: h };
    });
    setAllSprites(updated);
    if (!selected.builtIn) saveCustomSprites(updated.filter(s => !s.builtIn));
  }, [selected, allSprites]);

  const filteredSprites = categoryFilter === "all"
    ? allSprites
    : allSprites.filter(s => s.category === categoryFilter);

  // When comparing evolutions, use the compare sprite's dimensions
  const displayWidth = evoComparePixels ? evoComparePixels.width : (selected?.width ?? 16);
  const displayHeight = evoComparePixels ? evoComparePixels.height : (selected?.height ?? 16);
  const displayPixels = evoComparePixels ? evoComparePixels.pixels : pixels;
  const canvasWidth = displayWidth * zoom;
  const canvasHeight = displayHeight * zoom;

  // Animation preview pixels
  const animPixels = useMemo(() => {
    if (!animating || !selected) return pixels;
    const walkFrames = selected.frames.filter(f => f.name === "walk1" || f.name === "walk2" || f.name === "idle");
    const frame = walkFrames[animFrame % walkFrames.length];
    return frame ? pixelRectsToMap(frame.pixels) : pixels;
  }, [animating, selected, animFrame, pixels]);

  return (
    <div className="w-full h-screen bg-[#0a0a14] flex font-mono text-white select-none">
      {/* ─── Left: Library ────────────────────────────────────── */}
      <div className="w-[200px] bg-[#0e0e1a] border-r border-white/10 flex flex-col">
        <div className="p-3 border-b border-white/10">
          {/* Exit button */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => { window.location.href = "/"; }}
              className="text-[10px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
              title="Back to Office"
            >
              <ArrowLeft size={12} /> <span>Back to Office</span>
            </button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/60 font-bold tracking-wider">SPRITES</span>
            <button
              onClick={() => setShowNewDialog(true)}
              className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "agent", "subagent", "pet", "manager", "custom"] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${
                  categoryFilter === cat ? "bg-white/20 text-white/80" : "text-white/30 hover:text-white/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1">
            {filteredSprites.map(sprite => (
              <SpriteThumbnail
                key={sprite.id}
                sprite={sprite}
                selected={selectedId === sprite.id}
                onClick={() => { setSelectedId(sprite.id); setFrameIndex(0); }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Center: Canvas ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-10 bg-[#12121e] border-b border-white/10 flex items-center px-3 gap-3">
          {/* Tools */}
          <div className="flex gap-0.5">
            {([
              ["pencil", "B", Pencil],
              ["eraser", "E", Eraser],
              ["eyedropper", "I", Pipette],
              ["fill", "F", PaintBucket],
              ["select", "S", BoxSelect],
            ] as [EditorTool, string, typeof Pencil][]).map(([t, key, Icon]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`p-1.5 rounded transition-colors ${
                  tool === t ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/8"
                }`}
                title={`${t} (${key})`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Flip buttons */}
          <div className="flex gap-0.5">
            <button onClick={flipH} className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors" title="Flip Horizontal">
              <FlipHorizontal2 size={14} />
            </button>
            <button onClick={flipV} className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors" title="Flip Vertical">
              <FlipVertical2 size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Color */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-6 h-6 rounded border border-white/20"
              style={{ backgroundColor: color }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-0 h-0 opacity-0 absolute"
            />
            <span className="text-[10px] text-white/40">{color}</span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <ZoomIn size={12} className="text-white/30" />
            <input
              type="range"
              min={8}
              max={40}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-16 h-1 accent-white/50"
            />
            <span className="text-[9px] text-white/40">{zoom}x</span>
          </div>

          <button onClick={() => setShowGrid(v => !v)} className={`p-1.5 rounded transition-colors ${showGrid ? "bg-white/15 text-white/70" : "text-white/30 hover:text-white/50"}`} title="Toggle Grid (G)">
            <Grid3x3 size={14} />
          </button>
          <button onClick={() => setShowCheckerboard(v => !v)} className={`p-1.5 rounded transition-colors ${showCheckerboard ? "bg-white/15 text-white/70" : "text-white/30 hover:text-white/50"}`} title="Toggle Transparency">
            {showCheckerboard ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          <div className="w-px h-5 bg-white/10" />

          {/* Canvas background color */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-white/30">BG</span>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "color";
                input.value = canvasBg;
                input.onchange = () => setCanvasBg(input.value);
                input.click();
              }}
              className="w-4 h-4 rounded border border-white/20"
              style={{ backgroundColor: canvasBg }}
            />
            {canvasBg !== "#d4d4d4" && (
              <button onClick={() => setCanvasBg("#d4d4d4")} className="text-[8px] text-white/30 hover:text-white/50">rst</button>
            )}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Import / AI */}
          <div className="flex gap-1 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors flex items-center gap-1"
              title="Import an image to trace"
            >
              <ImagePlus size={14} />
              <span className="text-[9px]">Import</span>
            </button>
            {imageOverlay && (
              <>
                <button
                  onClick={handleRasterize}
                  className="text-[10px] px-2 py-1 rounded bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 transition-colors"
                >
                  Rasterize
                </button>
                {rasterizedPalette && (
                  <button
                    onClick={handleAiClean}
                    disabled={aiLoading}
                    className="text-[10px] px-2 py-1 rounded bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiLoading ? <span className="inline-block w-3 h-3 border border-cyan-300 border-t-transparent rounded-full animate-spin" /> : <Sparkles size={12} />}
                    <span className="text-[9px]">AI Clean</span>
                  </button>
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((imageOverlay.opacity) * 100)}
                  onChange={e => setImageOverlay(prev => prev ? { ...prev, opacity: Number(e.target.value) / 100 } : null)}
                  className="w-12 h-1 accent-white/50"
                  title="Overlay opacity"
                />
                <button
                  onClick={() => { setImageOverlay(null); setRasterizedPalette(null); }}
                  className="text-[10px] px-1 py-1 rounded text-red-400/50 hover:text-red-400 transition-colors"
                  title="Remove overlay"
                >
                  <X size={12} />
                </button>
              </>
            )}
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`text-[10px] px-1.5 py-1 rounded transition-colors ${showSettings ? "bg-white/15 text-white/70" : "text-white/30 hover:text-white/50"}`}
              title="API Settings"
            >
              <Settings size={14} />
            </button>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-0.5">
            <button onClick={clearFrame} className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8" title="Clear frame">
              <Trash2 size={14} />
            </button>
            <button onClick={undo} disabled={undoStack.length === 0} className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8 disabled:opacity-20" title="Undo (Cmd+Z)">
              <Undo2 size={14} />
            </button>
            <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/8 disabled:opacity-20" title="Redo (Cmd+Shift+Z)">
              <Redo2 size={14} />
            </button>
            <button onClick={saveFrame} className="p-1.5 rounded bg-green-600/30 text-green-300 hover:bg-green-600/50 transition-colors" title="Save frame">
              <Save size={14} />
            </button>
            <button onClick={exportPatch}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
                dirtySprites.size > 0
                  ? "bg-blue-600/30 text-blue-300 hover:bg-blue-600/50"
                  : "text-white/40 hover:text-white/70 hover:bg-white/8"
              }`} title="Export Patch">
              <ClipboardCopy size={14} />
              {dirtySprites.size > 0 && <span className="text-[9px]">{dirtySprites.size}</span>}
            </button>
          </div>
        </div>

        {/* Settings panel (API key) */}
        {showSettings && (
          <div className="bg-[#16162a] border-b border-white/10 px-3 py-2 flex items-center gap-3">
            <span className="text-[10px] text-white/40">Anthropic API Key:</span>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 max-w-[300px] bg-white/5 text-white/70 text-[10px] font-mono rounded px-2 py-1 border border-white/10 outline-none focus:border-white/30"
            />
            {apiKey && <span className="text-[9px] text-green-400/60">saved</span>}
          </div>
        )}

        {/* Canvas area — click on empty space to deselect */}
        <div
          className="flex-1 flex items-center justify-center overflow-auto p-4 relative"
          style={{ backgroundColor: canvasBg }}
          onClick={e => { if (e.target === e.currentTarget) clearSelection(); }}
        >
          {/* Canvas info label + evolution controls */}
          {selected && (
            <div className="absolute top-3 left-3 z-10 font-mono">
              <div className="text-[10px] text-black/30 pointer-events-none">
                <span className="font-semibold">{selected.name}</span>
                <span className="mx-1.5">·</span>
                <span>{selected.category}</span>
                <span className="mx-1.5">·</span>
                <span>{selected.width}×{selected.height}</span>
                {selected.evolutionStage !== undefined && selected.evolutionStage > 0 && (
                  <span className="ml-1.5 text-purple-500/50">evo {selected.evolutionStage + 1}</span>
                )}
              </div>
              {/* Evolution controls — only show when sprite has an evolution chain */}
              {evoChain.length > 1 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {/* Ghost overlay toggle */}
                  <button
                    onClick={() => setEvoOverlayOn(!evoOverlayOn)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      evoOverlayOn ? "bg-purple-500/30 text-purple-300" : "bg-black/10 text-black/30 hover:text-black/50"
                    }`}
                    title="Toggle ghost overlay of previous evolution (10% opacity)"
                  >
                    Ghost
                  </button>
                  {/* A/B/C compare buttons */}
                  <div className="flex gap-0.5">
                    {evoChain.map((evo, idx) => (
                      <button
                        key={evo.id}
                        onClick={() => {
                          if (evo.id === selected.id) {
                            setEvoCompareIdx(null); // viewing current, clear compare
                          } else {
                            setEvoCompareIdx(evoCompareIdx === idx ? null : idx);
                          }
                        }}
                        className={`text-[9px] w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          evo.id === selected.id
                            ? "bg-purple-500/40 text-purple-200 font-bold"
                            : evoCompareIdx === idx
                              ? "bg-orange-500/30 text-orange-300"
                              : "bg-black/10 text-black/30 hover:text-black/50"
                        }`}
                        title={`${evo.name} (${evo.width}×${evo.height})`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {selected ? (
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                style={{ imageRendering: "pixelated", cursor: getEditorCursor(tool, altHeld) }}
                onMouseDown={e => { if (e.button === 2) return; setDrawing(true); handleCanvasInteraction(e, true); }}
                onMouseMove={e => {
                  // Track hover pixel for highlight
                  const rect = canvasRef.current!.getBoundingClientRect();
                  const px = Math.floor((e.clientX - rect.left) / zoom);
                  const py = Math.floor((e.clientY - rect.top) / zoom);
                  if (px >= 0 && px < (selected?.width ?? 0) && py >= 0 && py < (selected?.height ?? 0)) {
                    setHoverPixel({ x: px, y: py });
                    // Update highlight overlay
                    if (highlightRef.current) {
                      highlightRef.current.style.left = `${px * zoom}px`;
                      highlightRef.current.style.top = `${py * zoom}px`;
                      highlightRef.current.style.width = `${zoom}px`;
                      highlightRef.current.style.height = `${zoom}px`;
                      highlightRef.current.style.opacity = "1";
                    }
                    if (coordsRef.current) coordsRef.current.textContent = `${px},${py}`;
                  } else {
                    setHoverPixel(null);
                    if (highlightRef.current) highlightRef.current.style.opacity = "0";
                    if (coordsRef.current) coordsRef.current.textContent = "";
                  }
                  if (drawing) handleCanvasInteraction(e, false);
                }}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  setDrawing(false);
                  setMovingSelection(false);
                  setHoverPixel(null);
                  if (highlightRef.current) highlightRef.current.style.opacity = "0";
                  if (coordsRef.current) coordsRef.current.textContent = "";
                }}
                onContextMenu={handleContextMenu}
              />
              {/* Pixel highlight cursor */}
              <div
                ref={highlightRef}
                className="absolute pointer-events-none border border-white/50 mix-blend-difference"
                style={{ opacity: 0, transition: "opacity 0.05s" }}
              />
              {/* Coordinate display */}
              <div
                ref={coordsRef}
                className="absolute -bottom-5 left-0 font-mono text-[9px] text-white/30 pointer-events-none"
              />
              {/* Image overlay */}
              {imageOverlay && (
                <img
                  src={imageOverlay.src}
                  alt="overlay"
                  style={{
                    position: "absolute",
                    left: imageOverlay.x * zoom,
                    top: imageOverlay.y * zoom,
                    width: imageOverlay.w * zoom,
                    height: imageOverlay.h * zoom,
                    opacity: imageOverlay.opacity,
                    pointerEvents: "none",
                    imageRendering: "pixelated",
                  }}
                />
              )}
              {/* Overlay drag handle (move) */}
              {imageOverlay && (
                <div
                  style={{
                    position: "absolute",
                    left: imageOverlay.x * zoom,
                    top: imageOverlay.y * zoom,
                    width: imageOverlay.w * zoom,
                    height: imageOverlay.h * zoom,
                    border: "1px dashed rgba(200,100,255,0.6)",
                    cursor: "move",
                  }}
                  onMouseDown={e => handleOverlayMouseDown(e, "move")}
                >
                  {/* Resize handle (bottom-right corner) */}
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      width: 8,
                      height: 8,
                      background: "rgba(200,100,255,0.8)",
                      cursor: "nwse-resize",
                      borderRadius: 2,
                    }}
                    onMouseDown={e => handleOverlayMouseDown(e, "resize")}
                  />
                </div>
              )}
              {/* Selection overlay */}
              {selection && (
                <div
                  style={{
                    position: "absolute",
                    left: selection.x * zoom,
                    top: selection.y * zoom,
                    width: selection.w * zoom,
                    height: selection.h * zoom,
                    border: "1px dashed rgba(255,255,255,0.8)",
                    pointerEvents: "none",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                    animation: "marching-ants 0.5s linear infinite",
                  }}
                />
              )}
              {/* Render pixels + grid on canvas */}
              <CanvasRenderer
                canvasRef={canvasRef}
                pixels={displayPixels}
                width={displayWidth}
                height={displayHeight}
                zoom={zoom}
                showGrid={showGrid}
                showCheckerboard={showCheckerboard}
                canvasBg={canvasBg}
                selection={evoCompareIdx !== null ? null : selection}
                evoOverlay={evoCompareIdx !== null ? null : evoOverlayPixels}
              />
            </div>
          ) : (
            <div className="text-white/20 text-[12px]">Select a sprite from the library</div>
          )}
        </div>

        {/* Palette */}
        <div className="bg-[#12121e] border-t border-white/10 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-sm border transition-transform ${
                  color === c ? "border-white scale-125 z-10" : "border-white/10 hover:border-white/30"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right: Preview + Frames ──────────────────────────── */}
      <div className="w-[200px] bg-[#0e0e1a] border-l border-white/10 flex flex-col">
        {/* Preview */}
        <div className="p-3 border-b border-white/10">
          <span className="text-[10px] text-white/40 block mb-2">PREVIEW</span>
          <div className="flex flex-col items-center gap-2">
            {/* 1:1 preview */}
            <div className="bg-[#1a1a2e] rounded p-3 flex items-center justify-center" style={{ minHeight: 40 }}>
              {selected && <SpritePreview pixels={animating ? animPixels : pixels} width={selected.width} height={selected.height} scale={1} />}
            </div>
            {/* 3x preview */}
            <div className="bg-[#1a1a2e] rounded p-3 flex items-center justify-center">
              {selected && <SpritePreview pixels={animating ? animPixels : pixels} width={selected.width} height={selected.height} scale={3} />}
            </div>
            {selected && (
              <div className="flex gap-2 items-center">
                <span className="text-[9px] text-white/30">{selected.width}x{selected.height}</span>
                <button
                  onClick={() => setAnimating(!animating)}
                  className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                    animating ? "bg-yellow-500/30 text-yellow-300" : "bg-white/8 text-white/40 hover:text-white/60"
                  }`}
                >
                  {animating ? <Square size={10} /> : <Play size={10} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Frames */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/40">FRAMES</span>
            <button onClick={duplicateFrame} className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/8" title="Duplicate current frame">
              <Copy size={12} />
            </button>
          </div>

          {/* Expected states dropdown */}
          {selected && (() => {
            const expected = EXPECTED_STATES[selected.category] ?? EXPECTED_STATES.custom;
            const existingNames = new Set(selected.frames.map(f => f.name));
            const missing = expected.filter(s => !existingNames.has(s));
            return (
              <div className="mb-2">
                <select
                  value=""
                  onChange={e => {
                    const v = e.target.value;
                    if (!v) return;
                    if (v === "__custom__") {
                      const name = prompt("Frame name:");
                      if (name) addFrame(name);
                    } else {
                      addFrame(v);
                    }
                    e.target.value = "";
                  }}
                  className="w-full bg-white/5 text-white/50 font-mono text-[9px] rounded px-2 py-1 border border-white/10 outline-none"
                >
                  <option value="" className="bg-[#1e1e2e]">+ Add state...</option>
                  {missing.length > 0 && (
                    <optgroup label="Expected" className="bg-[#1e1e2e]">
                      {missing.map(s => (
                        <option key={s} value={s} className="bg-[#1e1e2e]">{s}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Custom" className="bg-[#1e1e2e]">
                    <option value="__custom__" className="bg-[#1e1e2e]">Custom name...</option>
                  </optgroup>
                </select>
              </div>
            );
          })()}

          {/* Frame list */}
          {selected?.frames.map((frame, i) => {
            const fp = pixelRectsToMap(frame.pixels);
            const expected = EXPECTED_STATES[selected.category] ?? EXPECTED_STATES.custom;
            const isExpected = expected.includes(frame.name);
            return (
              <div key={`${frame.name}-${i}`} className="relative mb-1">
                <div
                  onClick={() => setFrameIndex(i)}
                  className={`w-full flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                    frameIndex === i ? "bg-white/15" : "hover:bg-white/8"
                  }`}
                >
                  <div className="bg-[#1a1a2e] rounded p-0.5 flex items-center justify-center" style={{ minWidth: 24, minHeight: 24 }}>
                    <SpritePreview pixels={fp} width={selected.width} height={selected.height} scale={1} />
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-[9px] text-white/50">{frame.name}</span>
                    {!isExpected && <span className="text-[7px] text-white/20">custom</span>}
                  </div>
                  {frame.pixels.length === 0 && (
                    <span className="text-[7px] text-yellow-400/40">empty</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setFrameMenuIdx(frameMenuIdx === i ? null : i); }}
                    className="p-0.5 rounded text-white/20 hover:text-white/50 hover:bg-white/10"
                  >
                    <MoreVertical size={10} />
                  </button>
                </div>

                {/* Frame context menu */}
                {frameMenuIdx === i && (
                  <div ref={frameMenuRef} className="absolute right-0 top-8 z-50 bg-[#1e1e2e]/95 border border-white/10 rounded-md py-1 min-w-[130px] shadow-lg">
                    <button
                      onClick={() => {
                        const name = prompt("Rename to:", frame.name);
                        if (name && name !== frame.name) renameFrame(i, name);
                        setFrameMenuIdx(null);
                      }}
                      className="block w-full text-left font-mono text-[9px] px-3 py-1.5 text-white/50 hover:bg-white/10 hover:text-white/80"
                    >
                      Rename
                    </button>
                    <div className="border-t border-white/5 my-0.5" />
                    <div className="px-3 py-1 text-[8px] text-white/25">Copy pixels to...</div>
                    {selected.frames.map((targetFrame, ti) => {
                      if (ti === i) return null;
                      const hasPixels = targetFrame.pixels.length > 0;
                      return (
                        <button
                          key={`copy-${ti}`}
                          onClick={() => {
                            if (hasPixels) {
                              const action = prompt(
                                `"${targetFrame.name}" already has pixels.\nType "overwrite" to replace, or "swap" to swap pixels:`,
                                "overwrite"
                              );
                              if (action === "overwrite") {
                                copyFrameTo(i, ti, "overwrite");
                              } else if (action === "swap") {
                                copyFrameTo(i, ti, "swap");
                              }
                            } else {
                              copyFrameTo(i, ti, "overwrite");
                            }
                            setFrameMenuIdx(null);
                          }}
                          className="block w-full text-left font-mono text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80 flex items-center gap-1.5"
                        >
                          <Copy size={9} className="text-white/25" />
                          {targetFrame.name}
                          {hasPixels && <span className="text-[7px] text-yellow-400/40 ml-auto">has data</span>}
                        </button>
                      );
                    })}
                    <div className="border-t border-white/5 my-0.5" />
                    <div className="px-3 py-1 text-[8px] text-white/25">Remap to...</div>
                    {expected.filter(s => s !== frame.name).map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          swapFrameNames(i, s);
                          setFrameMenuIdx(null);
                        }}
                        className="block w-full text-left font-mono text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80 flex items-center gap-1.5"
                      >
                        <ArrowUpDown size={9} className="text-white/25" />
                        {s}
                        {selected.frames.some(f => f.name === s) && (
                          <span className="text-[7px] text-yellow-400/40 ml-auto">swap</span>
                        )}
                      </button>
                    ))}
                    {selected.frames.length > 1 && (
                      <>
                        <div className="border-t border-white/5 my-0.5" />
                        <button
                          onClick={() => {
                            deleteFrame(i);
                            setFrameMenuIdx(null);
                          }}
                          className="block w-full text-left font-mono text-[9px] px-3 py-1.5 text-red-400/60 hover:bg-red-400/10 hover:text-red-400"
                        >
                          Delete frame
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sprite info + evolution */}
        {selected && (
          <div className="p-3 border-t border-white/10 space-y-2">
            <div>
              <div className="text-[10px] text-white/40">{selected.name}</div>
              <div className="text-[8px] text-white/20">
                {selected.category} {selected.builtIn ? "(built-in)" : "(custom)"}
                {selected.evolutionStage !== undefined && ` · evo ${selected.evolutionStage + 1}`}
              </div>
            </div>
            {/* Evolution chain */}
            {(() => {
              const chain = allSprites.filter(s =>
                s.id === selected.id ||
                s.evolutionOf === selected.id ||
                (selected.evolutionOf && (s.id === selected.evolutionOf || s.evolutionOf === selected.evolutionOf))
              ).sort((a, b) => (a.evolutionStage ?? 0) - (b.evolutionStage ?? 0));
              if (chain.length > 1) {
                return (
                  <div className="flex gap-1 items-center">
                    <span className="text-[8px] text-white/20">Chain:</span>
                    {chain.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedId(s.id); setFrameIndex(0); }}
                        className={`text-[8px] px-1 py-0.5 rounded ${s.id === selected.id ? "bg-purple-500/30 text-purple-300" : "bg-white/5 text-white/30 hover:text-white/60"}`}
                      >
                        {s.evolutionStage !== undefined ? `Evo ${s.evolutionStage + 1}` : s.name}
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex gap-1 flex-wrap">
              {selected.category === "agent" && (
                <button onClick={addEvolution} className="text-[8px] text-purple-300/60 hover:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">+ Evolution</button>
              )}
              {!selected.builtIn && (
                <>
                  <button onClick={resizeSprite} className="text-[8px] text-white/30 hover:text-white/60 bg-white/5 px-1.5 py-0.5 rounded">Resize</button>
                  <button onClick={deleteSprite} className="text-[8px] text-red-400/50 hover:text-red-400 bg-white/5 px-1.5 py-0.5 rounded">Delete</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e2e] border border-white/10 rounded-lg px-4 py-2 text-[12px] text-white/70 shadow-xl animate-[fadeInUp_0.2s_ease-out]">
          {toast}
        </div>
      )}

      {/* New sprite dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewDialog(false)}>
          <div className="bg-[#1e1e2e] border border-white/10 rounded-lg p-5 min-w-[300px] space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-[13px] text-white/70 font-semibold">New Sprite</div>

            <div className="space-y-1">
              <label className="text-[9px] text-white/40 block">Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="My Sprite"
                className="w-full bg-white/5 text-white/80 text-[11px] rounded px-2 py-1.5 border border-white/10 outline-none focus:border-white/30"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") createNew(); }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-white/40 block">Type</label>
              <div className="flex gap-1 flex-wrap">
                {(["agent", "pet", "subagent", "manager", "custom"] as SpriteCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`text-[9px] px-2 py-1 rounded transition-colors ${
                      newCategory === cat ? "bg-white/20 text-white/80" : "bg-white/5 text-white/30 hover:text-white/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="text-[8px] text-white/20">{CATEGORY_DEFAULTS[newCategory].description}</div>
            </div>

            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-[9px] text-white/40 block">Width</label>
                <input
                  type="number" min={4} max={64} value={newWidth}
                  onChange={e => setNewWidth(Number(e.target.value))}
                  className="w-full bg-white/5 text-white/80 text-[11px] rounded px-2 py-1.5 border border-white/10 outline-none"
                />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-[9px] text-white/40 block">Height</label>
                <input
                  type="number" min={4} max={64} value={newHeight}
                  onChange={e => setNewHeight(Number(e.target.value))}
                  className="w-full bg-white/5 text-white/80 text-[11px] rounded px-2 py-1.5 border border-white/10 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowNewDialog(false)} className="text-[10px] px-3 py-1 rounded text-white/40 hover:text-white/60">Cancel</button>
              <button onClick={createNew} disabled={!newName.trim()} className="text-[10px] px-3 py-1 rounded bg-blue-600/40 text-blue-200 hover:bg-blue-600/60 disabled:opacity-30">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Marching ants animation */}
      <style>{`
        @keyframes marching-ants {
          0% { border-color: rgba(255,255,255,0.8); }
          50% { border-color: rgba(0,0,0,0.8); }
          100% { border-color: rgba(255,255,255,0.8); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Canvas renderer (draws pixels + grid + selection highlight) ─────────────
function CanvasRenderer({ canvasRef, pixels, width, height, zoom, showGrid, showCheckerboard, canvasBg, selection, evoOverlay }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  pixels: Map<string, string>;
  width: number;
  height: number;
  zoom: number;
  showGrid: boolean;
  showCheckerboard: boolean;
  canvasBg: string;
  selection: SelectionRect | null;
  evoOverlay: { pixels: Map<string, string>; width: number; height: number } | null;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Clear
    ctx.clearRect(0, 0, width * zoom, height * zoom);

    // Background: checkerboard or solid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (showCheckerboard) {
          const isLight = (x + y) % 2 === 0;
          ctx.fillStyle = isLight ? "#ffffff" : "#e0e0e0";
        } else {
          ctx.fillStyle = canvasBg;
        }
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }

    // Draw evolution overlay ghost (10% opacity, bottom-center aligned)
    if (evoOverlay) {
      ctx.globalAlpha = 0.1;
      const offsetX = Math.floor((width - evoOverlay.width) / 2);
      const offsetY = height - evoOverlay.height; // bottom-aligned
      for (const [key, color] of evoOverlay.pixels) {
        const { x, y } = parsePixelKey(key);
        ctx.fillStyle = color;
        ctx.fillRect((x + offsetX) * zoom, (y + offsetY) * zoom, zoom, zoom);
      }
      ctx.globalAlpha = 1;
    }

    // Draw pixels
    for (const [key, color] of pixels) {
      const { x, y } = parsePixelKey(key);
      ctx.fillStyle = color;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }

    // Highlight selected pixels
    if (selection) {
      ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
      ctx.fillRect(
        selection.x * zoom,
        selection.y * zoom,
        selection.w * zoom,
        selection.h * zoom
      );
    }

    // Grid
    if (showGrid && zoom >= 8) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, height * zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(width * zoom, y * zoom + 0.5);
        ctx.stroke();
      }
    }
  }, [pixels, width, height, zoom, showGrid, showCheckerboard, canvasBg, selection, evoOverlay]);

  return null;
}
