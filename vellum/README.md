# Vellum

A minimal 3D model editor UI, built from the pencil sketches. React + Vite + TypeScript,
no UI framework, no component library, no WebGL.

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build
```

## Screens

| Route | Sheet | What it is |
| --- | --- | --- |
| `#/` | sheet 3 | Dash. **Static and stale on purpose** - fixed figures, inert controls, placeholder copy. |
| `#/projects` | sheet 2 | First scene. Pick a scene, then a shelf (Items / Mobs & Anim.). |
| `#/projects/:scene/:kind` | sheet 2 | The shared library panel. `< Back`, category tabs, card grid, `< 1 2 3 >`. |
| `#/settings/:section` | sheet 1 | Search + section list, free sections above the `Paid tiers` divider. |
| `#/editor/:assetId` | - | The Blockbench-shaped editor, reached from a card's `...` → Open in Editor. |

## Notes on the build

**Palette.** Two families - midnight navy and parchment - defined once in
`src/styles/tokens.css` and re-pointed per theme. Light (parchment) is the default;
the toggle in the top bar flips the app to midnight. The editor is always midnight,
whichever theme the app is on, because you cannot judge a texture against parchment.

**Type.** Inter and JetBrains Mono, self-hosted as `woff2` under `public/fonts` with
latin + latin-ext subsets and `unicode-range` splits. No request leaves the origin.

**Layout.** Fluid throughout - `clamp()` gutters, `auto-fit` / `auto-fill` grids, and
`dvh` in the editor. The editor's side columns are drag-resizable; below 900px the
three columns stack.

**The card.** `src/components/Card.tsx` is the one section container, as the sketch
asks. Solid on the dashboard, dashed wherever a region is reserved but unfilled.

**The renderer is a stand-in, not an engine.** `src/components/Model3D.tsx` builds each
box out of six transformed `div`s inside a `preserve-3d` scene: flat three-tone shading,
a CSS grid floor, drag-to-orbit, and a keyframed spin for the library cards. There is no
mesh, no camera and no raster pipeline - it is there so the viewport reads as a viewport.

## What works, and what does not

Interactive: routing, theme, scene/shelf selection, library search + pagination, card
hover (spin, 1.2x bounce) and its actions menu, settings search and sections, and in the
editor - menus, mode and tool switching, panel collapse and resize, outliner selection
with per-node hide/lock, the colour picker, UV face selection, numeric fields
(type or drag the axis chip to scrub), quad view, grid toggle, and timeline playback.

Not wired, by design: the dashboard entirely, plus saving, exporting, real geometry
editing and anything that would need a backend.
