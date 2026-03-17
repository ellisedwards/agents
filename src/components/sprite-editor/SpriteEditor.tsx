import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { SpriteDefinition, SpriteFrame, EditorTool, SpriteCategory } from "./types";
import { pixelKey, parsePixelKey, pixelRectsToMap, mapToPixelRects } from "./types";
import { getBuiltInSprites, loadCustomSprites, saveCustomSprites } from "./sprite-library";

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
  const [animating, setAnimating] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selected = allSprites.find(s => s.id === selectedId) ?? null;

  // Load frame pixels when selection changes
  useEffect(() => {
    if (!selected) { setPixels(new Map()); return; }
    const frame = selected.frames[frameIndex];
    if (!frame) { setPixels(new Map()); return; }
    setPixels(pixelRectsToMap(frame.pixels));
    setUndoStack([]);
    setRedoStack([]);
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "b" || e.key === "p") setTool("pencil");
      else if (e.key === "e") setTool("eraser");
      else if (e.key === "i") setTool("eyedropper");
      else if (e.key === "g") setShowGrid(v => !v);
      else if (e.key === "f") setTool("fill");
      else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "z" && e.shiftKey || e.key === "y")) { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undoStack, redoStack]);

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

  const handleCanvasInteraction = useCallback((e: React.MouseEvent, isStart: boolean) => {
    if (!selected || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || x >= selected.width || y < 0 || y >= selected.height) return;

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
  }, [selected, zoom, tool, color, pixels, pushUndo, floodFill]);

  // Save current pixels back to sprite definition
  const saveFrame = useCallback(() => {
    if (!selected) return;
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
  }, [selected, pixels, frameIndex, allSprites]);

  // Export as TypeScript
  const exportTS = useCallback(() => {
    if (!selected) return;
    const rects = mapToPixelRects(pixels);
    const lines = rects.map(r => `  { x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h}, color: "${r.color}" },`);
    const frame = selected.frames[frameIndex];
    const text = `// ${selected.name} - ${frame?.name ?? "frame"} (${selected.width}x${selected.height})\nconst ${frame?.name ?? "frame"}: PixelRect[] = [\n${lines.join("\n")}\n];`;
    navigator.clipboard.writeText(text);
  }, [selected, pixels, frameIndex]);

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
          <div className="flex gap-1">
            {([
              ["pencil", "B"],
              ["eraser", "E"],
              ["eyedropper", "I"],
              ["fill", "F"],
            ] as [EditorTool, string][]).map(([t, key]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  tool === t ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/8"
                }`}
                title={`${t} (${key})`}
              >
                {t}
              </button>
            ))}
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
            <span className="text-[9px] text-white/30">Zoom</span>
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

          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="w-3 h-3" />
            <span className="text-[9px] text-white/40">Grid</span>
          </label>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-1">
            <button onClick={undo} disabled={undoStack.length === 0}
              className="text-[10px] px-2 py-1 rounded text-white/40 hover:text-white/70 hover:bg-white/8 disabled:opacity-20">
              Undo
            </button>
            <button onClick={redo} disabled={redoStack.length === 0}
              className="text-[10px] px-2 py-1 rounded text-white/40 hover:text-white/70 hover:bg-white/8 disabled:opacity-20">
              Redo
            </button>
            <button onClick={saveFrame}
              className="text-[10px] px-2 py-1 rounded bg-green-600/30 text-green-300 hover:bg-green-600/50 transition-colors">
              Save
            </button>
            <button onClick={exportTS}
              className="text-[10px] px-2 py-1 rounded text-white/40 hover:text-white/70 hover:bg-white/8">
              Export TS
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-[#08080e] p-4">
          {selected ? (
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="cursor-crosshair"
                style={{ imageRendering: "pixelated" }}
                onMouseDown={e => { setDrawing(true); handleCanvasInteraction(e, true); }}
                onMouseMove={e => { if (drawing) handleCanvasInteraction(e, false); }}
                onMouseUp={() => setDrawing(false)}
                onMouseLeave={() => setDrawing(false)}
              />
              {/* Render pixels + grid on canvas */}
              <CanvasRenderer
                canvasRef={canvasRef}
                pixels={pixels}
                width={selected.width}
                height={selected.height}
                zoom={zoom}
                showGrid={showGrid}
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
                  {animating ? "Stop" : "Animate"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Frames */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/40">FRAMES</span>
            <button onClick={duplicateFrame} className="text-[9px] text-white/30 hover:text-white/60" title="Duplicate current frame">dup</button>
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
    </div>
  );
}

// ─── Canvas renderer (draws pixels + grid) ──────────────────────────────────
function CanvasRenderer({ canvasRef, pixels, width, height, zoom, showGrid }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  pixels: Map<string, string>;
  width: number;
  height: number;
  zoom: number;
  showGrid: boolean;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Clear
    ctx.clearRect(0, 0, width * zoom, height * zoom);

    // Checkerboard background (transparency indicator)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isLight = (x + y) % 2 === 0;
        ctx.fillStyle = isLight ? "#1e1e2e" : "#16161e";
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }

    // Draw pixels
    for (const [key, color] of pixels) {
      const { x, y } = parsePixelKey(key);
      ctx.fillStyle = color;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
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
  }, [pixels, width, height, zoom, showGrid]);

  return null;
}
