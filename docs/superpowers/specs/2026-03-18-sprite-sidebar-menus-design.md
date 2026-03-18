# Sprite Editor Sidebar Menus & Evolution Grouping

## Goal

Add ellipsis context menus to sprite thumbnails in the sprite editor sidebar, with duplicate, add-evolution, and delete actions. Group evolution chains visually so related sprites appear together.

## Sidebar Layout Changes

### Evolution Grouping

The sidebar currently shows all sprites in a flat 2-column grid. After this change:

- Base sprites (those without `evolutionOf`) are the main entries
- Evolution stages appear nested underneath their base, indented, at smaller scale
- Clicking a base sprite's row expands/collapses its evolution chain
- Each evolution shows a small badge: `Evo 2`, `Evo 3`, etc.
- Evolutions are still individually selectable for editing

### Ellipsis Menu

Each sprite thumbnail shows a three-dot (vertical ellipsis) icon on hover, top-right corner. Clicking it opens a small dropdown with:

#### Duplicate
- Available on: ALL sprites (built-in and custom)
- Creates a new custom sprite with:
  - ID: `custom-{Date.now()}`
  - Name: `{originalName}_copy`
  - Same category, width, height
  - Deep copy of all frames and pixel data
  - `builtIn: false`
  - No evolution link — independent sprite
  - `evolutionStage: 0`
- If the sprite has evolutions, show "Duplicate All" which clones the entire chain (base + all evolutions, with correct `evolutionOf` links between the copies)

#### Add Evolution
- Available on: ALL sprites
- Same behavior as existing `addEvolution`:
  - ID: `{parentId}-evo{nextStage}`
  - Name: `{parentName} Evo {nextStage + 1}`
  - Width/height: parent + 4px each (EVOLUTION_SIZE_STEP)
  - Empty idle frame
  - `evolutionOf: parentId`, `evolutionStage: nextStage`
- Selects the new evolution for editing

#### Delete
- Available on: custom sprites AND these built-ins: `mew`, `pikachu`, `jigglypuff`
- NOT available on: `charmander`, `squirtle`, `bulbasaur`, `clawd`, `claw`, `trainer`, `tabby-cat`, `sphynx-cat`, `gecko`, `space-cat`, and all colored mage variants
- Rule: sprite is deletable if `!sprite.builtIn` OR `DELETABLE_BUILTINS.includes(sprite.id)`
- If the sprite has evolutions, show confirmation: "Delete {name} and its {n} evolutions?"
- Deleting an evolution does not delete the base or siblings

## Data Model

No changes to `SpriteDefinition` type. The `DELETABLE_BUILTINS` list is a new constant:

```typescript
const DELETABLE_BUILTINS = new Set(["mew", "pikachu", "jigglypuff"]);
```

Deletability check:
```typescript
const canDelete = !sprite.builtIn || DELETABLE_BUILTINS.has(sprite.id);
```

## Files

| File | Change |
|------|--------|
| `src/components/sprite-editor/SpriteEditor.tsx` | Update `SpriteThumbnail` with ellipsis menu, add evolution grouping to sidebar, add duplicate/delete handlers |
| `src/components/sprite-editor/sprite-library.ts` | No changes needed |
| `src/components/sprite-editor/types.ts` | No changes needed |
