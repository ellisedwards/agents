import { useEffect, useRef, useCallback, useState } from "react";
import { useAgentOfficeStore } from "../store";
import type { EditMode } from "../store";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../canvas-transform";

export interface DecoPixel {
  x: number;
  y: number;
  color: string;
}

type Tool = "pencil" | "eraser" | "eyedropper";
type BrushSize = 1 | 2 | 4;

interface UndoAction {
  added: DecoPixel[];
  removed: DecoPixel[];
}

function storageKey(themeId: string, mode: EditMode): string {
  return `pixelEditor:${themeId}:${mode}`;
}

const decoPixelCache = new Map<string, DecoPixel[]>();

export function loadDecoPixels(themeId: string, mode: EditMode): DecoPixel[] {
  const cacheKey = `${themeId}:${mode}`;
  const cached = decoPixelCache.get(cacheKey);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(storageKey(themeId, mode));
    if (raw) {
      const parsed = JSON.parse(raw) as DecoPixel[];
      decoPixelCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {}
  const empty: DecoPixel[] = [];
  decoPixelCache.set(cacheKey, empty);
  return empty;
}

function saveDecoPixels(themeId: string, mode: EditMode, pixels: DecoPixel[]) {
  try {
    localStorage.setItem(storageKey(themeId, mode), JSON.stringify(pixels));
    decoPixelCache.delete(`${themeId}:${mode}`);
  } catch {}
}

function pixelKey(x: number, y: number): string {
  return `${x},${y}`;
}

function formatExport(pixels: DecoPixel[], themeId?: string, mode?: string): string {
  const header = themeId ? `// theme: ${themeId}, layer: ${mode || "unknown"}\n` : "";
  if (pixels.length === 0) return `${header}const decorations: PixelRect[] = [];`;
  const lines = pixels.map(
    (p) => `  { x: ${p.x}, y: ${p.y}, w: 1, h: 1, color: "${p.color}" },`
  );
  return `${header}const decorations: PixelRect[] = [\n${lines.join("\n")}\n];`;
}

/** Adjust hex color brightness by a factor (-1 to +1, 0 = no change) */
function adjustBrightness(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const adjust = (v: number) => Math.max(0, Math.min(255, Math.round(
    amount > 0 ? v + (255 - v) * amount : v + v * amount
  )));
  return `#${adjust(r).toString(16).padStart(2, "0")}${adjust(g).toString(16).padStart(2, "0")}${adjust(b).toString(16).padStart(2, "0")}`;
}

// SVG cursors encoded as data URIs
const CURSOR_PENCIL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4 20l1.5-4.5L17 4l3 3L8.5 18.5z' fill='%23fff' stroke='%23000' stroke-width='1'/%3E%3Cpath d='M4 20l1.5-4.5 3 3z' fill='%23ffa' stroke='%23000' stroke-width='0.5'/%3E%3Cpath d='M17 4l3 3' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 2 22, crosshair`;
const CURSOR_ERASER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='4' y='10' width='14' height='10' rx='2' fill='%23f8a' stroke='%23000' stroke-width='1' transform='rotate(-20 11 15)'/%3E%3Crect x='4' y='14' width='14' height='6' rx='1' fill='%23fff' stroke='%23000' stroke-width='0.5' transform='rotate(-20 11 17)'/%3E%3C/svg%3E") 8 18, crosshair`;
const CURSOR_PICKER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6' stroke='%23fff' stroke-width='1.5'/%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6' stroke='%23000' stroke-width='0.5'/%3E%3Ccircle cx='12' cy='12' r='3' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3Ccircle cx='12' cy='12' r='3' fill='none' stroke='%23000' stroke-width='0.5'/%3E%3C/svg%3E") 12 12, crosshair`;

function getCursor(tool: Tool): string {
  switch (tool) {
    case "pencil": return CURSOR_PENCIL;
    case "eraser": return CURSOR_ERASER;
    case "eyedropper": return CURSOR_PICKER;
  }
}

const MODE_LABELS: Record<string, string> = {
  background: "BG",
  "tower-decor": "TOWER",
  lounge: "LOUNGE",
  posters: "POSTERS",
};

interface PixelEditorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function PixelEditor({ canvasRef }: PixelEditorProps) {
  const editMode = useAgentOfficeStore((s) => s.editMode);
  const setEditMode = useAgentOfficeStore((s) => s.setEditMode);
  const themeId = useAgentOfficeStore((s) => s.themeId);

  const [tool, setTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState<BrushSize>(1);
  const [color, setColor] = useState("#ff0000");
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null);
  const pickerPreviewRef = useRef<HTMLDivElement>(null);

  const pixelsRef = useRef<Map<string, DecoPixel>>(new Map());
  const sessionStartRef = useRef<DecoPixel[]>([]);
  const undoStackRef = useRef<UndoAction[]>([]);
  const currentActionRef = useRef<UndoAction | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lockedAxisRef = useRef<"x" | "y" | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  const [clearMenuOpen, setClearMenuOpen] = useState(false);
  const [shadePreview, setShadePreview] = useState(false);
  const shadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    if (editMode === "none") return;
    const down = (e: KeyboardEvent) => {
      // Alt for temporary eyedropper
      if (e.key === "Alt") { e.preventDefault(); setAltHeld(true); return; }
      // Don't capture when typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      switch (e.key) {
        case "1": setBrushSize(1); break;
        case "2": setBrushSize(2); break;
        case "3": setBrushSize(4); break;
        case "z": if (!e.metaKey && !e.ctrlKey) handleUndoRef.current(); break;
        case "Z": if (e.metaKey || e.ctrlKey) handleUndoRef.current(); break;
        case "[":
          setColor((c) => adjustBrightness(c, -0.1));
          setShadePreview(true);
          if (shadeTimerRef.current) clearTimeout(shadeTimerRef.current);
          shadeTimerRef.current = setTimeout(() => setShadePreview(false), 1200);
          break;
        case "]":
          setColor((c) => adjustBrightness(c, 0.1));
          setShadePreview(true);
          if (shadeTimerRef.current) clearTimeout(shadeTimerRef.current);
          shadeTimerRef.current = setTimeout(() => setShadePreview(false), 1200);
          break;
        case "t": setToolbarVisible((v) => !v); break;
        case "Escape": setEditMode("none"); break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [editMode, setEditMode]);

  // Ref to latest undo handler (avoids stale closure in keyboard handler)
  const handleUndoRef = useRef(() => {});

  // Load pixels when mode/theme changes
  useEffect(() => {
    if (editMode === "none") return;
    const loaded = loadDecoPixels(themeId, editMode);
    const map = new Map<string, DecoPixel>();
    for (const p of loaded) map.set(pixelKey(p.x, p.y), p);
    pixelsRef.current = map;
    sessionStartRef.current = [...loaded];
    undoStackRef.current = [];
  }, [editMode, themeId]);

  const saveCurrentPixels = useCallback(() => {
    if (editMode === "none") return;
    const arr = Array.from(pixelsRef.current.values());
    saveDecoPixels(themeId, editMode, arr);
  }, [editMode, themeId]);

  const applyBrush = useCallback(
    (canvasX: number, canvasY: number, erasing: boolean) => {
      const map = pixelsRef.current;
      const action = currentActionRef.current!;
      const cx = Math.floor(canvasX);
      const cy = Math.floor(canvasY);

      for (let dy = 0; dy < brushSize; dy++) {
        for (let dx = 0; dx < brushSize; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px < 0 || py < 0 || px >= CANVAS_WIDTH || py >= CANVAS_HEIGHT) continue;
          const key = pixelKey(px, py);

          if (erasing) {
            const existing = map.get(key);
            if (existing) {
              action.removed.push(existing);
              map.delete(key);
            }
          } else {
            const existing = map.get(key);
            if (existing) {
              if (existing.color === color) continue;
              action.removed.push(existing);
            }
            const pixel: DecoPixel = { x: px, y: py, color };
            action.added.push(pixel);
            map.set(key, pixel);
          }
        }
      }
      saveCurrentPixels();
    },
    [brushSize, color, saveCurrentPixels]
  );

  const getCanvasPos = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
      };
    },
    [canvasRef]
  );

  // Update highlight + coordinates display directly (no re-render)
  const updateHighlight = useCallback(
    (e: React.MouseEvent) => {
      const el = highlightRef.current;
      const coordsEl = coordsRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
      const px = Math.floor(cx);
      const py = Math.floor(cy);

      if (el) {
        const domX = rect.left + (px / CANVAS_WIDTH) * rect.width;
        const domY = rect.top + (py / CANVAS_HEIGHT) * rect.height;
        const pixelW = (brushSize / CANVAS_WIDTH) * rect.width;
        const pixelH = (brushSize / CANVAS_HEIGHT) * rect.height;
        el.style.left = `${domX}px`;
        el.style.top = `${domY}px`;
        el.style.width = `${pixelW}px`;
        el.style.height = `${pixelH}px`;
        el.style.opacity = "1";
      }

      if (coordsEl) {
        coordsEl.textContent = `${px},${py}`;
      }

      // Eyedropper color preview
      const previewEl = pickerPreviewRef.current;
      if (previewEl) {
        const isPickerMode = altHeld || tool === "eyedropper";
        if (isPickerMode) {
          // Sample color at pixel position
          const key = `${px},${py}`;
          const pixel = pixelsRef.current.get(key);
          const sampleColor = pixel ? pixel.color : null;
          // Also check rendered canvas for background colors
          const ctx = canvas.getContext("2d");
          let displayColor = sampleColor;
          if (!displayColor && ctx) {
            const imgData = ctx.getImageData(px, py, 1, 1).data;
            if (imgData[3] > 0) {
              displayColor = `#${imgData[0].toString(16).padStart(2,"0")}${imgData[1].toString(16).padStart(2,"0")}${imgData[2].toString(16).padStart(2,"0")}`;
            }
          }
          if (displayColor) {
            previewEl.style.left = `${e.clientX + 16}px`;
            previewEl.style.top = `${e.clientY + 8}px`;
            previewEl.style.backgroundColor = displayColor;
            previewEl.style.opacity = "1";
          } else {
            previewEl.style.opacity = "0";
          }
        } else {
          previewEl.style.opacity = "0";
        }
      }
    },
    [canvasRef, brushSize, altHeld, tool]
  );

  const hideHighlight = useCallback(() => {
    const el = highlightRef.current;
    if (el) el.style.opacity = "0";
    const coordsEl = coordsRef.current;
    if (coordsEl) coordsEl.textContent = "";
    const previewEl = pickerPreviewRef.current;
    if (previewEl) previewEl.style.opacity = "0";
  }, []);

  const pickColor = useCallback(
    (pos: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const px = Math.floor(pos.x);
      const py = Math.floor(pos.y);
      const data = ctx.getImageData(px, py, 1, 1).data;
      const hex = `#${data[0].toString(16).padStart(2, "0")}${data[1].toString(16).padStart(2, "0")}${data[2].toString(16).padStart(2, "0")}`;
      setColor(hex);
    },
    [canvasRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editMode === "none") return;
      const pos = getCanvasPos(e);
      if (!pos) return;

      if ((tool === "eyedropper" || altHeld) && e.button === 0) {
        pickColor(pos);
        if (tool === "eyedropper") setTool("pencil");
        return;
      }

      const erasing = e.button === 2 || tool === "eraser";
      currentActionRef.current = { added: [], removed: [] };
      isDraggingRef.current = true;
      dragStartRef.current = { x: Math.floor(pos.x), y: Math.floor(pos.y) };
      lockedAxisRef.current = null;
      applyBrush(pos.x, pos.y, erasing);
    },
    [editMode, tool, altHeld, getCanvasPos, applyBrush, pickColor]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updateHighlight(e);
      if (!isDraggingRef.current || editMode === "none") return;
      const pos = getCanvasPos(e);
      if (!pos) return;

      if (e.shiftKey && dragStartRef.current) {
        if (!lockedAxisRef.current) {
          const dx = Math.abs(Math.floor(pos.x) - dragStartRef.current.x);
          const dy = Math.abs(Math.floor(pos.y) - dragStartRef.current.y);
          if (dx > 1 || dy > 1) {
            lockedAxisRef.current = dx >= dy ? "x" : "y";
          }
        }
        if (lockedAxisRef.current === "x") pos.y = dragStartRef.current.y;
        else if (lockedAxisRef.current === "y") pos.x = dragStartRef.current.x;
      } else {
        lockedAxisRef.current = null;
      }

      const erasing = (e.buttons & 2) !== 0 || tool === "eraser";
      applyBrush(pos.x, pos.y, erasing);
    },
    [editMode, tool, getCanvasPos, applyBrush, updateHighlight]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    lockedAxisRef.current = null;
    const action = currentActionRef.current;
    if (action && (action.added.length > 0 || action.removed.length > 0)) {
      const stack = undoStackRef.current;
      stack.push(action);
      if (stack.length > 50) stack.shift();
      saveCurrentPixels();
    }
    currentActionRef.current = null;
  }, [saveCurrentPixels]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    const action = stack.pop();
    if (!action) return;
    const map = pixelsRef.current;
    for (const p of action.added) map.delete(pixelKey(p.x, p.y));
    for (const p of action.removed) map.set(pixelKey(p.x, p.y), p);
    saveCurrentPixels();
  }, [saveCurrentPixels]);

  // Keep ref in sync for keyboard handler
  handleUndoRef.current = handleUndo;

  const handleClearSession = useCallback(() => {
    const map = pixelsRef.current;
    map.clear();
    for (const p of sessionStartRef.current) map.set(pixelKey(p.x, p.y), p);
    undoStackRef.current = [];
    saveCurrentPixels();
    setClearMenuOpen(false);
  }, [saveCurrentPixels]);

  const handleClearAll = useCallback(() => {
    const map = pixelsRef.current;
    map.clear();
    undoStackRef.current = [];
    saveCurrentPixels();
    setClearMenuOpen(false);
  }, [saveCurrentPixels]);

  const [exportLabel, setExportLabel] = useState("Export");
  const handleExport = useCallback(() => {
    const arr = Array.from(pixelsRef.current.values());
    const text = formatExport(arr, themeId, editMode);
    navigator.clipboard.writeText(text).then(() => {
      setExportLabel("Copied!");
      setTimeout(() => setExportLabel("Export"), 1200);
    });
  }, []);

  if (editMode === "none") return null;

  return (
    <>
      {/* Brush highlight */}
      <div
        ref={highlightRef}
        className="pointer-events-none fixed z-20"
        style={{
          opacity: 0,
          backgroundColor: tool === "eraser"
            ? "rgba(255,100,100,0.10)"
            : "rgba(100,160,255,0.10)",
          border: "1px solid",
          borderColor: tool === "eraser"
            ? "rgba(255,100,100,0.25)"
            : "rgba(100,160,255,0.20)",
          transition: "opacity 0.1s",
        }}
      />

      {/* Eyedropper color preview — follows cursor */}
      <div
        ref={pickerPreviewRef}
        className="pointer-events-none fixed z-30"
        style={{
          opacity: 0,
          width: 14,
          height: 14,
          border: "2px solid rgba(255,255,255,0.8)",
          borderRadius: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          transition: "opacity 0.1s",
        }}
      />

      {/* Shade preview — appears briefly on [ / ] */}
      {shadePreview && (
        <div
          className="fixed z-40 flex items-center gap-1.5 pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            animation: "fadeIn 0.1s ease-out",
          }}
        >
          {/* Darker shade */}
          <div
            className="rounded-sm"
            style={{
              width: 24,
              height: 24,
              backgroundColor: adjustBrightness(color, -0.1),
              border: "2px solid rgba(255,255,255,0.15)",
            }}
          />
          {/* Current color — highlighted */}
          <div
            className="rounded-sm"
            style={{
              width: 32,
              height: 32,
              backgroundColor: color,
              border: "2px solid rgba(255,255,255,0.8)",
              boxShadow: "0 0 8px rgba(255,255,255,0.3)",
            }}
          />
          {/* Lighter shade */}
          <div
            className="rounded-sm"
            style={{
              width: 24,
              height: 24,
              backgroundColor: adjustBrightness(color, 0.1),
              border: "2px solid rgba(255,255,255,0.15)",
            }}
          />
        </div>
      )}

      {/* Invisible overlay for mouse events */}
      <div
        className="absolute inset-0 z-20"
        style={{ cursor: getCursor(altHeld ? "eyedropper" : tool) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => { handleMouseUp(); hideHighlight(); }}
        onMouseEnter={updateHighlight}
        onContextMenu={handleContextMenu}
      />

      {/* Coordinates + toggle button — always visible at bottom-left */}
      <div className="absolute bottom-8 left-2 z-30 flex items-center gap-2">
        <button
          onClick={() => setToolbarVisible((v) => !v)}
          className="font-mono text-[9px] px-2 py-1 rounded bg-[#1e1e2e]/90 border border-white/10 text-white/50 hover:text-white/80 transition-colors"
        >
          {MODE_LABELS[editMode] ?? editMode} {toolbarVisible ? "▼" : "▲"}
        </button>
        <span
          ref={coordsRef}
          className="font-mono text-[9px] text-white/40 min-w-[40px]"
        />
        {/* Color swatch + brightness hint */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => colorInputRef.current?.click()}
            className="w-5 h-4 rounded border border-white/20"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-[8px] text-white/25">[/]</span>
        </div>
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />
      </div>

      {/* Toolbar — bottom center, toggleable */}
      {toolbarVisible && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1e1e2e]/95 border border-white/10 rounded-md px-3 py-1.5">
          {/* Brush sizes */}
          {([1, 2, 4] as BrushSize[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                brushSize === s
                  ? "bg-white/25 text-white"
                  : "text-white/50 hover:bg-white/10"
              }`}
              title={`Shortcut: ${i + 1}`}
            >
              {s}x{s}
            </button>
          ))}

          <span className="w-px h-4 bg-white/10" />

          {/* Tools */}
          {(["pencil", "eraser", "eyedropper"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                tool === t
                  ? "bg-white/25 text-white"
                  : "text-white/50 hover:bg-white/10"
              }`}
              title={t === "eyedropper" ? "Alt for temp pick" : undefined}
            >
              {t === "pencil" ? "Draw" : t === "eraser" ? "Erase" : "Pick"}
            </button>
          ))}

          <span className="w-px h-4 bg-white/10" />

          {/* Actions */}
          <button
            onClick={handleUndo}
            className="font-mono text-[9px] text-white/50 hover:text-white/80 px-1 transition-colors"
            title="Shortcut: Z"
          >
            Undo
          </button>
          <div className="relative inline-flex">
            <button
              onClick={() => setClearMenuOpen((v) => !v)}
              className="font-mono text-[9px] text-white/50 hover:text-white/80 px-1 transition-colors"
            >
              Clear
            </button>
            {clearMenuOpen && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1e1e2e] border border-white/15 rounded-md py-1 min-w-[100px] z-40 shadow-lg">
                <button
                  onClick={handleClearSession}
                  className="block w-full text-left font-mono text-[9px] text-white/60 hover:bg-white/10 hover:text-white/90 px-3 py-1.5 transition-colors"
                >
                  This session
                </button>
                <button
                  onClick={handleClearAll}
                  className="block w-full text-left font-mono text-[9px] text-red-400/70 hover:bg-white/10 hover:text-red-300 px-3 py-1.5 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setClearMenuOpen(false)}
                  className="block w-full text-left font-mono text-[9px] text-white/30 hover:bg-white/10 hover:text-white/50 px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleExport}
            className="font-mono text-[9px] text-white/50 hover:text-white/80 px-1 transition-colors"
          >
            {exportLabel}
          </button>

          <span className="w-px h-4 bg-white/10" />

          <button
            onClick={() => setEditMode("none")}
            className="font-mono text-[9px] text-red-400/70 hover:text-red-300 px-1 transition-colors"
            title="Shortcut: Esc"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
