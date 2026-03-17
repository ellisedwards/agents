import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { SpriteDefinition, SpriteFrame, EditorTool, SpriteCategory } from "./types";
import { pixelKey, parsePixelKey, pixelRectsToMap, mapToPixelRects } from "./types";
import { getBuiltInSprites, loadCustomSprites, saveCustomSprites } from "./sprite-library";
import {
  Pencil, Eraser, Pipette, PaintBucket, BoxSelect,
  FlipHorizontal2, FlipVertical2,
  Trash2, Undo2, Redo2, Save, ClipboardCopy,
  ImagePlus, Sparkles, Settings, X, ArrowLeft,
  Grid3x3, Eye, EyeOff, ZoomIn, Copy, Plus,
  Play, Square,
} from "lucide-react";

// ─── Expected states per category ───────────────────────────────────────────
const EXPECTED_STATES: Record<SpriteCategory, string[]> = {
  agent: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2", "blink"],
  subagent: ["idle", "typing", "reading", "thinking", "waiting", "walk1", "walk2"],
  pet: ["idle", "walk1", "walk2", "sleep", "startled"],
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
    function handleKey(e: KeyboardEvent) {
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
      // Arrow keys shift all pixels
      else if (e.key === "ArrowUp") { e.preventDefault(); shiftPixels(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); shiftPixels(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); shiftPixels(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); shiftPixels(1, 0); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
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

    if (tool === "eyedropper") {
      const c = pixels.get(pixelKey(x, y));
      if (c) setColor(c);
      setTool("pencil");
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
  }, [selected, zoom, tool, color, pixels, pushUndo, floodFill, selection, selectionStart, selectedPixels, movingSelection, moveStart, isInSelection, clearSelection]);

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
    // Save custom sprites
    const customs = updatedSprites.filter(s => !s.builtIn);
    saveCustomSprites(customs);
  }, [selected, pixels, frameIndex, allSprites, markDirty]);

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
  }, [selected, selectedId, pixels, frameIndex, allSprites, dirtySprites, markDirty]);

  // Create new custom sprite
  const createNew = useCallback(() => {
    const id = `custom-${Date.now()}`;
    const sprite: SpriteDefinition = {
      id,
      name: "New Sprite",
      category: "custom",
      width: 16,
      height: 16,
      frames: [{ name: "idle", pixels: [] }],
      builtIn: false,
    };
    const updated = [...allSprites, sprite];
    setAllSprites(updated);
    saveCustomSprites(updated.filter(s => !s.builtIn));
    setSelectedId(id);
    setFrameIndex(0);
  }, [allSprites]);

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

  const canvasWidth = (selected?.width ?? 16) * zoom;
  const canvasHeight = (selected?.height ?? 16) * zoom;

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
              onClick={createNew}
              className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "agent", "subagent", "pet", "custom"] as const).map(cat => (
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
          className="flex-1 flex items-center justify-center overflow-auto p-4"
          style={{ backgroundColor: canvasBg }}
          onClick={e => { if (e.target === e.currentTarget) clearSelection(); }}
        >
          {selected ? (
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className={tool === "select" ? "cursor-crosshair" : "cursor-crosshair"}
                style={{ imageRendering: "pixelated" }}
                onMouseDown={e => { if (e.button === 2) return; setDrawing(true); handleCanvasInteraction(e, true); }}
                onMouseMove={e => { if (drawing) handleCanvasInteraction(e, false); }}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => { setDrawing(false); setMovingSelection(false); }}
                onContextMenu={handleContextMenu}
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
                pixels={pixels}
                width={selected.width}
                height={selected.height}
                zoom={zoom}
                showGrid={showGrid}
                showCheckerboard={showCheckerboard}
                canvasBg={canvasBg}
                selection={selection}
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
              <button
                key={`${frame.name}-${i}`}
                onClick={() => setFrameIndex(i)}
                className={`w-full flex items-center gap-2 p-1.5 rounded mb-1 transition-colors ${
                  frameIndex === i ? "bg-white/15" : "hover:bg-white/8"
                }`}
              >
                <div className="bg-[#1a1a2e] rounded p-0.5 flex items-center justify-center" style={{ minWidth: 24, minHeight: 24 }}>
                  <SpritePreview pixels={fp} width={selected.width} height={selected.height} scale={1} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[9px] text-white/50">{frame.name}</span>
                  {!isExpected && <span className="text-[7px] text-white/20">custom</span>}
                </div>
                {frame.pixels.length === 0 && (
                  <span className="text-[7px] text-yellow-400/40 ml-auto">empty</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sprite info */}
        {selected && (
          <div className="p-3 border-t border-white/10 space-y-1">
            <div className="text-[10px] text-white/40">{selected.name}</div>
            <div className="text-[8px] text-white/20">{selected.category} {selected.builtIn ? "(built-in)" : "(custom)"}</div>
            <div className="flex gap-1">
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

      {/* Marching ants animation */}
      <style>{`
        @keyframes marching-ants {
          0% { border-color: rgba(255,255,255,0.8); }
          50% { border-color: rgba(0,0,0,0.8); }
          100% { border-color: rgba(255,255,255,0.8); }
        }
      `}</style>
    </div>
  );
}

// ─── Canvas renderer (draws pixels + grid + selection highlight) ─────────────
function CanvasRenderer({ canvasRef, pixels, width, height, zoom, showGrid, showCheckerboard, canvasBg, selection }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  pixels: Map<string, string>;
  width: number;
  height: number;
  zoom: number;
  showGrid: boolean;
  showCheckerboard: boolean;
  canvasBg: string;
  selection: SelectionRect | null;
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
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
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
  }, [pixels, width, height, zoom, showGrid, showCheckerboard, canvasBg, selection]);

  return null;
}
