# TODO

## UI Polish
- Fix label/tool-name collision (labels overlap when agents are close together, e.g. "Bash" tool label collides with name labels)
- Add subtle reveal animations to HTML overlay elements (labels, HUD, settings panel) — slight 2-3px rise-in on appear, fade transitions
- Update settings panel styling to closer match the HUD design (rounded corners, semi-transparent dark bg, consistent font sizing)

## Architecture
- Manifest-driven asset system — PNG/JSON furniture definitions instead of TypeScript sprite arrays. Each asset is a folder with PNGs + manifest.json declaring sprites, rotations, animation frames. Needed for the background/furniture editor with object stamps, vegetation, etc. Reference: pixel-agents project uses this pattern successfully.
