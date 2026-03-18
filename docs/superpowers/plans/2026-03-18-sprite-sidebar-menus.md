# Sprite Sidebar Menus & Evolution Carousel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ellipsis context menus (duplicate, evolve, delete) to sprite thumbnails and replace flat evolution listing with an in-place carousel.

**Architecture:** All changes are in `SpriteEditor.tsx`. The `SpriteThumbnail` component gains carousel state and an ellipsis dropdown. New handler functions (`duplicateSprite`, `deleteSprite`) are added to the main `SpriteEditor` component and passed down. The sidebar grid filters out evolution sprites, showing only base sprites with in-thumbnail carousel navigation.

**Tech Stack:** React, TypeScript, Tailwind

**Spec:** `docs/superpowers/specs/2026-03-18-sprite-sidebar-menus-design.md`

---

### Task 1: Filter evolutions from sidebar grid and add carousel to SpriteThumbnail

**Files:**
- Modify: `src/components/sprite-editor/SpriteEditor.tsx`

This task changes the sidebar to only show base sprites, with L/R arrows to cycle through evolutions in-place.

- [ ] **Step 1: Filter evolutions from sidebar grid (~line 1198)**

Replace:
```typescript
const filteredSprites = categoryFilter === "all"
  ? allSprites
  : allSprites.filter(s => s.category === categoryFilter);
```
With:
```typescript
const filteredSprites = (categoryFilter === "all"
  ? allSprites
  : allSprites.filter(s => s.category === categoryFilter)
).filter(s => !s.evolutionOf); // only show base sprites in grid
```

- [ ] **Step 2: Build evolution chains lookup (add near filteredSprites)**

```typescript
// Build evolution chains: baseId → [base, evo1, evo2, ...] sorted by stage
const evoChains = useMemo(() => {
  const chains = new Map<string, SpriteDefinition[]>();
  for (const s of allSprites) {
    const rootId = s.evolutionOf ?? s.id;
    if (!chains.has(rootId)) chains.set(rootId, []);
    chains.get(rootId)!.push(s);
  }
  for (const chain of chains.values()) {
    chain.sort((a, b) => (a.evolutionStage ?? 0) - (b.evolutionStage ?? 0));
  }
  return chains;
}, [allSprites]);
```

- [ ] **Step 3: Add carousel state tracking**

Add state to `SpriteEditor`:
```typescript
const [carouselIndex, setCarouselIndex] = useState<Map<string, number>>(new Map());
```

- [ ] **Step 4: Rewrite SpriteThumbnail to support carousel**

Replace the `SpriteThumbnail` component (~lines 217-239) with:

```tsx
function SpriteThumbnail({ sprite, chain, carouselIdx, selected, onClick, onCarouselChange, onMenuAction }: {
  sprite: SpriteDefinition;
  chain: SpriteDefinition[];   // full evolution chain [base, evo1, evo2, ...]
  carouselIdx: number;         // which stage is showing
  selected: boolean;
  onClick: (sprite: SpriteDefinition) => void;
  onCarouselChange: (spriteId: string, idx: number) => void;
  onMenuAction: (action: "duplicate" | "duplicate-all" | "evolve" | "delete", sprite: SpriteDefinition) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displaySprite = chain[carouselIdx] ?? sprite;
  const hasChain = chain.length > 1;
  const idleFrame = displaySprite.frames[0];
  const pixels = useMemo(() => pixelRectsToMap(idleFrame?.pixels ?? []), [idleFrame]);
  const canDelete = !displaySprite.builtIn || DELETABLE_BUILTINS.has(displaySprite.id);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className={`relative group flex flex-col items-center gap-1 p-2 rounded transition-colors cursor-pointer ${
        selected ? "bg-white/15 ring-1 ring-white/30" : "hover:bg-white/8"
      }`}
      onClick={() => onClick(displaySprite)}
    >
      {/* Ellipsis menu button */}
      <div ref={menuRef} className="absolute top-1 right-1 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white/60 transition-opacity"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="2" r="1" fill="currentColor"/><circle cx="5" cy="5" r="1" fill="currentColor"/><circle cx="5" cy="8" r="1" fill="currentColor"/></svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-5 bg-[#1e1e2e]/95 border border-white/10 rounded-md py-1 min-w-[100px] shadow-lg">
            <button
              onClick={(e) => { e.stopPropagation(); onMenuAction("duplicate", displaySprite); setMenuOpen(false); }}
              className="block w-full text-left text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80"
            >Duplicate</button>
            {hasChain && (
              <button
                onClick={(e) => { e.stopPropagation(); onMenuAction("duplicate-all", displaySprite); setMenuOpen(false); }}
                className="block w-full text-left text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80"
              >Duplicate All</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onMenuAction("evolve", displaySprite); setMenuOpen(false); }}
              className="block w-full text-left text-[9px] px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white/80"
            >Add Evolution</button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onMenuAction("delete", displaySprite); setMenuOpen(false); }}
                className="block w-full text-left text-[9px] px-3 py-1 text-red-400/60 hover:bg-red-400/10 hover:text-red-400"
              >Delete</button>
            )}
          </div>
        )}
      </div>

      {/* Sprite preview with carousel arrows */}
      <div className="bg-[#1a1a2e] rounded p-1 flex items-center justify-center relative" style={{ minWidth: 40, minHeight: 40 }}>
        {hasChain && carouselIdx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onCarouselChange(sprite.id, carouselIdx - 1); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-[10px] px-0.5"
          >◀</button>
        )}
        <SpritePreview pixels={pixels} width={displaySprite.width} height={displaySprite.height} scale={2} />
        {hasChain && carouselIdx < chain.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onCarouselChange(sprite.id, carouselIdx + 1); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-[10px] px-0.5"
          >▶</button>
        )}
      </div>
      <span className="font-mono text-[9px] text-white/50 truncate max-w-[60px]">{displaySprite.name}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[7px] text-white/20">{displaySprite.width}x{displaySprite.height}</span>
        {hasChain && (
          <span className="font-mono text-[7px] text-white/30">{carouselIdx + 1}/{chain.length}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add DELETABLE_BUILTINS constant (near top of file, after imports)**

```typescript
const DELETABLE_BUILTINS = new Set(["mew", "pikachu", "jigglypuff"]);
```

- [ ] **Step 6: Update sidebar grid to pass new props (~line 1257)**

Replace:
```tsx
{filteredSprites.map(sprite => (
  <SpriteThumbnail
    key={sprite.id}
    sprite={sprite}
    selected={selectedId === sprite.id}
    onClick={() => { setSelectedId(sprite.id); setFrameIndex(0); }}
  />
))}
```
With:
```tsx
{filteredSprites.map(sprite => {
  const chain = evoChains.get(sprite.id) ?? [sprite];
  const idx = carouselIndex.get(sprite.id) ?? 0;
  const displaySprite = chain[idx] ?? sprite;
  return (
    <SpriteThumbnail
      key={sprite.id}
      sprite={sprite}
      chain={chain}
      carouselIdx={idx}
      selected={selectedId === displaySprite.id}
      onClick={(s) => { setSelectedId(s.id); setFrameIndex(0); }}
      onCarouselChange={(id, newIdx) => {
        setCarouselIndex(prev => new Map(prev).set(id, newIdx));
      }}
      onMenuAction={handleMenuAction}
    />
  );
})}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/sprite-editor/SpriteEditor.tsx
git commit -m "feat: sprite sidebar evolution carousel and ellipsis menu UI"
```

---

### Task 2: Add duplicate, delete, and menu action handlers

**Files:**
- Modify: `src/components/sprite-editor/SpriteEditor.tsx`

- [ ] **Step 1: Add `duplicateSprite` handler (add near `addEvolution` ~line 1027)**

```typescript
const duplicateSprite = useCallback((sprite: SpriteDefinition) => {
  const id = `custom-${Date.now()}`;
  const copy: SpriteDefinition = {
    ...sprite,
    id,
    name: `${sprite.name}_copy`,
    builtIn: false,
    evolutionOf: undefined,
    evolutionStage: 0,
    frames: sprite.frames.map(f => ({ name: f.name, pixels: [...f.pixels] })),
  };
  const updated = [...allSprites, copy];
  setAllSprites(updated);
  saveCustomSprites(updated.filter(s => !s.builtIn));
  setSelectedId(id);
  setFrameIndex(0);
  showToast(`Duplicated as ${copy.name}`);
}, [allSprites, showToast]);
```

- [ ] **Step 2: Add `duplicateChain` handler**

```typescript
const duplicateChain = useCallback((sprite: SpriteDefinition) => {
  const rootId = sprite.evolutionOf ?? sprite.id;
  const chain = allSprites
    .filter(s => s.id === rootId || s.evolutionOf === rootId)
    .sort((a, b) => (a.evolutionStage ?? 0) - (b.evolutionStage ?? 0));

  const baseId = `custom-${Date.now()}`;
  const copies: SpriteDefinition[] = chain.map((s, i) => ({
    ...s,
    id: i === 0 ? baseId : `${baseId}-evo${i}`,
    name: i === 0 ? `${s.name}_copy` : `${s.name}_copy`,
    builtIn: false,
    evolutionOf: i === 0 ? undefined : baseId,
    evolutionStage: s.evolutionStage,
    frames: s.frames.map(f => ({ name: f.name, pixels: [...f.pixels] })),
  }));

  const updated = [...allSprites, ...copies];
  setAllSprites(updated);
  saveCustomSprites(updated.filter(s => !s.builtIn));
  setSelectedId(baseId);
  setFrameIndex(0);
  showToast(`Duplicated ${chain.length} sprites`);
}, [allSprites, showToast]);
```

- [ ] **Step 3: Add `deleteSprite` handler**

```typescript
const deleteSprite = useCallback((sprite: SpriteDefinition) => {
  const canDelete = !sprite.builtIn || DELETABLE_BUILTINS.has(sprite.id);
  if (!canDelete) return;

  // Find evolutions of this sprite
  const evolutions = allSprites.filter(s => s.evolutionOf === sprite.id);
  if (evolutions.length > 0) {
    if (!confirm(`Delete ${sprite.name} and its ${evolutions.length} evolution(s)?`)) return;
  }

  // Delete sprite + its evolutions (but not siblings or parent)
  const deleteIds = new Set([sprite.id, ...evolutions.map(s => s.id)]);
  const updated = allSprites.filter(s => !deleteIds.has(s.id));
  setAllSprites(updated);
  saveCustomSprites(updated.filter(s => !s.builtIn));
  if (selectedId && deleteIds.has(selectedId)) {
    setSelectedId(null);
  }
  showToast(`Deleted ${sprite.name}${evolutions.length > 0 ? ` and ${evolutions.length} evolution(s)` : ""}`);
}, [allSprites, selectedId, showToast]);
```

- [ ] **Step 4: Add `handleMenuAction` dispatcher**

```typescript
const handleMenuAction = useCallback((action: "duplicate" | "duplicate-all" | "evolve" | "delete", sprite: SpriteDefinition) => {
  switch (action) {
    case "duplicate": duplicateSprite(sprite); break;
    case "duplicate-all": duplicateChain(sprite); break;
    case "evolve":
      // Reuse existing addEvolution logic but for arbitrary sprite
      setSelectedId(sprite.id);
      // Small timeout to let selection update, then trigger evolution
      setTimeout(() => addEvolution(), 0);
      break;
    case "delete": deleteSprite(sprite); break;
  }
}, [duplicateSprite, duplicateChain, deleteSprite, addEvolution]);
```

Note: The `evolve` action via the menu sets the selected sprite first, then calls `addEvolution` which operates on `selected`. The timeout ensures the state update propagates. If this is flaky, an alternative is to refactor `addEvolution` to accept a sprite parameter — but try the simple approach first.

- [ ] **Step 5: Commit**

```bash
git add src/components/sprite-editor/SpriteEditor.tsx
git commit -m "feat: duplicate, delete, and evolve handlers for sprite sidebar menu"
```

---

### Task 3: Verify and clean up

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit 2>&1 | grep sprite-editor
```

Expected: No new errors from sprite-editor files.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Builds successfully.

- [ ] **Step 3: Manual test checklist**

Open `localhost:4747/?sprite-editor=true` and verify:
- [ ] Sidebar shows only base sprites (no evolution entries in grid)
- [ ] Sprites with evolutions show L/R arrows and `1/N` indicator
- [ ] Clicking arrows cycles preview, name, and size
- [ ] Clicking thumbnail selects the displayed stage for editing
- [ ] Ellipsis menu appears on hover (top-right dots)
- [ ] "Duplicate" creates a `_copy` sprite, selects it
- [ ] "Duplicate All" clones entire evolution chain with correct links
- [ ] "Add Evolution" creates +4px evolution stage
- [ ] "Delete" only appears on custom sprites + mew/pikachu/jigglypuff
- [ ] Deleting a base sprite with evolutions shows confirmation and deletes chain
- [ ] Deleting an evolution does not delete siblings or parent
- [ ] Built-in protected sprites (charmander, etc.) have no Delete option

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: sprite editor sidebar menus and evolution carousel"
```
