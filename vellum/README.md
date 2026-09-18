# Vellum

A 3D model editor UI, built from the pencil sketches. React + Vite + TypeScript,
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

## The material

One surface: **midnight velvet navy**. There is no light theme and no theme
toggle - the whole app lives on a single deep navy field, defined once in
`src/styles/tokens.css`.

**Liquid glass.** Every surface above the background is the same three-part
recipe: a translucent tint, a `backdrop-filter` blur that saturates what it
samples, and a rim lit along the top edge with a specular sheen laid over it
(`.glass` in `base.css`, repeated inline where a component needs its own
geometry). Glass over a flat fill reads as a grey box, so `body::before`
carries a slow-drifting field of navy and wax light for the blurs to pick up,
and `body::after` lays a fine grain over it for the velvet.

**Candle wax red** carries every affordance. Buttons, the active nav lozenge,
selected outliner rows, tool toggles, switches, focus rings and the dashed
reserved regions are all outlined in wax (`--wax-400`), lit with a matching
glow. It is the only saturated colour in the app, so anything you can press is
the thing that glows.

**Bouncy.** Motion runs on overshooting springs rather than ease curves:
`--spring` for most transitions, `--spring-lg` where the overshoot should
read. Buttons and tools compress on press and spring back, the nav lozenge and
pagination pips pop into place, library cards bounce to 1.2x on hover, menus
scale in from their anchor corner, panel chevrons swing, and the settings
switch knob stretches as it throws.

Two notes on `backdrop-filter`, both of which bit during the build:

- An ancestor with `backdrop-filter` becomes the *backdrop root*, so a popover
  inside the menu bar or the library panel samples nothing and a thin tint
  renders see-through. Menus are therefore near-opaque by design.
- `height: 100%` collapses to zero when the parent's height comes from
  `min-height` or flex sizing rather than a definite height, so `.scene3d`
  fills its parent by `inset` instead.

**Type.** Inter and JetBrains Mono, self-hosted as `woff2` under `public/fonts`
with latin + latin-ext subsets and `unicode-range` splits. No request leaves
the origin.

**Layout.** Fluid throughout - `clamp()` gutters, `auto-fit` / `auto-fill`
grids, and `dvh` in the editor. In the editor the viewport runs full-bleed and
the two tool columns float over it as glass rails, so what you see through them
is the model itself; the rails are drag-resizable, and below 900px the whole
thing stacks.

**The card.** `src/components/Card.tsx` is the one section container, as the
sketch asks. Solid where a region is filled, dashed where it is reserved.

**The renderer is a stand-in, not an engine.** `src/components/Model3D.tsx`
builds each box out of six transformed `div`s inside a `preserve-3d` scene:
flat three-tone shading, a CSS grid floor, drag-to-orbit, and a keyframed spin
for the library cards. There is no mesh, no camera and no raster pipeline - it
is there so the viewport reads as a viewport.

## What works, and what does not

Interactive: routing, scene/shelf selection, library search + pagination, card
hover (spin, 1.2x bounce) and its actions menu, settings search and sections,
and in the editor - menus, mode and tool switching, panel collapse and resize,
outliner selection with per-node hide/lock, the colour picker, UV face
selection, numeric fields (type or drag the axis chip to scrub), quad view,
grid toggle, and timeline playback.

Not wired, by design: the dashboard entirely, plus saving, exporting, real
geometry editing and anything that would need a backend.
