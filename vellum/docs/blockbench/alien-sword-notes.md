# alien_sword — build notes

Files in this directory:

| file | what it is |
| --- | --- |
| `alien_sword.bbmodel` | the model (Blockbench 4.x JSON, `model_format: "free"`), 53,761 bytes |
| `alien_sword.png` | the 64x64 texture, standalone |
| `build.mjs` | generates both, then verifies the result. Deterministic and re-runnable |
| `NOTES.md` | this file |

`node build.mjs` rewrites both outputs and prints a verification report. Running it twice
produces byte-identical files (confirmed with `md5sum`): there is no `Math.random`, no
timestamp, all 29 UUIDs are minted once and hard-coded at the top of the script, and all
texture noise comes from an integer hash of `(x, y, seed)`.

The PNG is written once and the *same buffer* is base64'd into `textures[0].source`, so the
embedded copy cannot drift from the standalone file. A check asserts this.

---

## 1. What I built

A **chitin-and-crystal alien sword**: a curved, tapering, asymmetric blade grown out of a
bio-mechanical hilt. Deliberately not a longsword with a new palette:

- **The blade is a curve made of straight boxes.** Five segments, each one shorter, narrower
  and thinner than the last. Each segment's `origin` is the joint at its base and its
  `rotation.z` is an *accumulated* sweep (2, 6, 11, 17, 24 degrees). The next joint is computed
  as `joint + R_z(angle) · (0, height, 0)`, so the segments stay welded together while the
  silhouette traces a scimitar arc. This is the interesting trick in the file: Blockbench cubes
  are axis-aligned boxes, but chaining their pivots like this gets you a real curve.
- **The cross-section is off-centre.** Every blade segment is placed at `-0.38·w .. +0.62·w`
  around its joint instead of `-w/2 .. +w/2`, so the blade has a thick dull spine on one side
  and a thin cutting edge on the other. It is not symmetric about its own axis.
- **Asymmetric everywhere else too.** One long two-segment guard horn sweeps *up* on +X; the
  other side gets a short hook sweeping *down* — not a mirror. Three back-swept barbs sit on
  the blade's dull edge only, each canted on a different yaw (+16, -20, +26) so no two read
  the same. A thin membrane flange hangs off the cutting-edge side of segment 2 with nothing
  opposite it. The grip has a single finger spur on one side.
- **Nothing is axis-aligned slab geometry.** All 22 cubes carry a non-zero `rotation`, and
  11 of them are rotated on two axes at once.

### Group hierarchy (4 top-level groups, 2 nested, 22 cubes)

```
[blade]   color 3   origin 0,16.1,0
  blade_seg_1 .. blade_seg_5        the curved chain
  blade_tip_shard                   canted point, rotated on Y and Z
  blade_fin                         asymmetric membrane flange
  [spines]  color 2   (nested)
    spine_barb_low / _mid / _high   back-swept barbs
  [core]    color 1   (nested)
    core_vein                       glowing rib, proud of both flat faces
[guard]   color 4   origin 0,14.45,0
  guard_socket, guard_horn_a, guard_horn_b, guard_hook_short
[grip]    color 6   origin 0,9.3,0
  grip_shaft, grip_ring_low, grip_ring_high, grip_spur
[pommel]  color 5   origin 0,4.2,0
  pommel_node, pommel_shard, pommel_hook
```

**22 cubes, 132 faces.** Rotated bounding box: **19.63 x 46.41 x 8.2**, inside the 32 x 48 x 32
budget. `color` is set per group (1..6) purely so the groups read apart in the outliner.

### The texture

64x64, painted procedurally with `pngjs`. The atlas is carved into **15 material regions that
tile the image exactly — 4096 of 4096 pixels, no gaps, no overlaps**:

| region | box (x,y,w,h) | faces |
| --- | --- | --- |
| `BLADE_SIDE` | (0,0) 24x16 | 10 |
| `GRIP` | (24,0) 14x16 | 4 |
| `BAND` | (38,0) 26x16 | 10 |
| `BLADE_EDGE` | (0,16) 10x16 | 9 |
| `SPINE` | (10,16) 10x16 | 5 |
| `CORE_GLOW` | (20,16) 12x16 | 4 |
| `GUARD` | (32,16) 18x16 | 11 |
| `CRYSTAL` | (50,16) 14x16 | 10 |
| `DARK` | (0,32) 26x16 | 19 |
| `BARB` | (26,32) 16x16 | 17 |
| `TIP` | (42,32) 10x16 | 8 |
| `MEMBRANE` | (52,32) 12x16 | 3 |
| `POMMEL` | (0,48) 16x16 | 5 |
| `ROOT` | (16,48) 24x16 | 11 |
| `DETAIL` | (40,48) 24x16 | 6 |

Palette: chitin violet (`#221134` -> `#9667BA`), bioluminescent cyan (`#105674` -> `#DEFFFF`),
acid green on the barb tips, cold metal grey for the collars, and a near-black void for
undersides.

Every region gets the same base pass (`panel()`): a vertical gradient, per-pixel hash noise, an
explicitly **lightened top row** and an explicitly **darkened bottom row**. On top of that:

- **BLADE_SIDE** — dark at the base fading up, a hard bright cutting-edge highlight ramped over
  the right ~5 px, the dull spine crushed toward black on the left, a chevron scale pattern, and
  a branching cyan vein system with four hot nodes (drawn as a dim halo pass then a bright core
  pass).
- **GRIP** — a 45-degree wrapped cord on a 5 px period with a lit crest and a two-step groove
  shadow, crossed the other way by sinew threads. The band shading is **additive as well as
  multiplicative**; my first version was multiplicative only and the wrap vanished into the
  gradient's dark lower half.
- **BAND / GUARD / POMMEL / CRYSTAL** read as four clearly different materials: machined metal
  with rivets and their drop shadows; a ridged chitin plate with radial striations; a faceted
  diamond knot with a concentric seam and a glowing centre; and cyan crystal with facet lines.
- **BARB** fades chitin to acid green toward the point, with rib highlight/shadow every 3 px.
- **DETAIL** is an engraved glyph plate, tiled so the whole region carries art.

**UV assignment is a two-phase shelf packer.** Phase one records every face's required
rectangle; phase two sorts each region's rectangles by descending height and shelf-packs them.
Every face gets its **own** rectangle, sized 1:1 with the face in model units, so nothing is
stretched and no two faces claim the same pixels. Sorting matters: a naive first-come packer
overflowed two regions and produced 22 overlapping pairs. Verified: 132 rects, 0 overlaps,
1549/4096 px claimed, every rect within 1/8 px of its face's true size.

---

## 2. The Blockbench tools, and what each one writes

Written for someone implementing an editor. **Caveat up front:** `blockbench.net` and
`web.blockbench.net` are blocked from this environment, so I could not open the app or load this
file into it. Everything below is from prior knowledge of the tool plus what the format itself
implies. I have flagged the parts I am not certain about rather than smoothing over them.

### Add Cube

Creates one box. The modeller reaches for it constantly — it is the only primitive in the
cube-based formats.

In the file it appends an object to `elements` with `type: "cube"`, a fresh UUID, a default
`from`/`to` (a 1- or 2-unit box at the origin or at the 3D cursor), zeroed `rotation`, an
`origin`, and a `faces` object with all six faces present. It **also** appends that UUID to
`outliner` — into the currently selected group if there is one, otherwise at the root. Those two
writes always happen together: an element that exists in `elements` but is missing from
`outliner` is an orphan that will not appear in the tree.

### Move / Resize / Rotate (the three transform gizmos)

These are modes of the same gizmo, switched in the toolbar.

- **Move** translates the whole element. It adds the same delta to `from` **and** `to`. I am
  fairly confident it also moves `origin` by the same delta, so the pivot travels with the cube
  rather than being left behind — but I could not re-verify that in the app, and it is exactly
  the kind of detail an implementer should test rather than take from me.
- **Resize** drags one face outward or inward. It changes **one component of `from` or `to`**
  and nothing else. This is why `to >= from` is an invariant worth asserting: dragging a face
  past its opposite is how you get an inside-out box. Blockbench clamps this; a from-scratch
  implementation must too.
- **Rotate** writes the `rotation` array **and leaves `from`/`to` completely alone**. This is
  the single most important thing to understand about the format: `from`/`to` always describe
  the *un-rotated, axis-aligned* box, and `rotation` is a transform applied on top of it about
  `origin`. You cannot read an element's world position out of `from`/`to` alone.

Holding the snap modifier quantises the drag (1 unit for move/resize, 22.5 degrees for rotate,
roughly).

### Pivot tool

Moves `origin` **without moving the box**. The modeller reaches for it whenever a rotation is
coming out wrong — the cube swings around the wrong point, so they drag the pivot to the hinge
and re-rotate.

In the file it changes only `origin`. Nothing else moves. In this model the Pivot tool is doing
most of the work conceptually: every blade segment's pivot sits at the joint at its *base*, not
at its centre, which is what makes the accumulated-rotation chain stay welded together. If the
pivots had been left at the default the segments would have fanned apart into a starburst.

Group pivots are the same idea one level up — a group's `origin` is the point its whole subtree
rotates about.

### Outliner and groups

The outliner is the tree on the left. Groups are folders; they are also bones once you animate.

In the file, `outliner` is an array whose entries are either a **UUID string** (a reference to an
element in `elements`) or a **nested group object** (`{name, uuid, origin, rotation, color,
children, ...}`) whose `children` is another such array. So the tree lives entirely in
`outliner`; `elements` is a flat pool that the tree points into. Two consequences an implementer
must handle:

1. Every element should be referenced **exactly once**. Zero references = invisible orphan.
   Two references = undefined behaviour. My verification asserts exactly-once.
2. Groups carry their own `origin` and `rotation`, and a group's rotation **composes with** its
   children's at render time. I deliberately left every group rotation at `[0,0,0]` and baked
   all rotation into the elements, so this file has exactly one source of truth per cube. If you
   are writing an importer, do not assume that.

Group `export`, `visibility`, `locked`, `isOpen` and `autouv` are UI/pipeline state, not geometry.

### Per-face UV vs Box UV

This is the format's biggest fork.

- **Box UV** (`box_uv: true`) is the classic Minecraft skin layout. The cube gets a single
  `uv_offset: [x, y]` and the six faces are *derived* from the cube's dimensions in the standard
  unwrapped-cross arrangement. You cannot move one face independently. It is fast, it keeps
  mirrored limbs consistent, and it is what entity/skin work uses.
- **Per-face UV** (`box_uv: false`) gives every face its own `uv: [x1, y1, x2, y2]` rectangle,
  freely placed. Slower to author, but it lets you point many faces at one painted patch, pack
  an atlas by hand, and stretch or mirror individual faces.

`meta.box_uv` is the *project default* for new cubes; each element also carries its own `box_uv`.
This model sets both to `false` and hand-places all 132 rectangles.

I am not certain whether Blockbench still writes a populated `faces` object when `box_uv` is
true. My expectation is that it does — writing out the derived values — and that they are
recomputed from `uv_offset` on load, so an importer should treat `uv_offset` as authoritative in
that mode. Worth testing before relying on it.

### The UV editor and face selection

The UV panel shows the texture with the selected face's rectangle drawn on it. Selecting a face
— by clicking it in the 3D viewport, or by clicking one of the six face buttons in the UV panel
— chooses which `uv` array your drag edits. Selecting several faces at once applies the edit to
all of them, which is how you flat-map a whole cube onto one patch quickly.

The panel also exposes the per-element `autouv` flag: `0` is manual (what this file uses),
non-zero hands UV placement back to Blockbench so it re-fits the rectangle whenever you resize
the cube. I believe `1` is auto and `2` is a "relative" auto mode, but I am not confident about
the exact enum and would check the source before implementing it.

Each face can also carry a `rotation` of 0/90/180/270 to spin the texture on that face. I did
not use it here, so it is absent from every face in this file — which is itself a useful
data point: **the field is optional and omitting it means 0.**

### The texture panel

Lists the project's textures. Import a PNG, create a blank one, reorder, or mark one as the
particle texture.

In the file each entry is an object in `textures` with `width`/`height` (the image's real pixel
size) and `uv_width`/`uv_height` (the UV space the model addresses it in). Those are equal here
at 64, but they do not have to be — that is how you swap in a 4x-resolution texture without
touching a single UV number.

`internal: true` plus a `source` data URI means the image is **embedded in the .bbmodel**, which
is what this file does: the whole PNG is base64'd inline, so the model is self-contained. The
alternative is a linked texture referenced by `path`/`relative_path`. I believe `internal` and
`saved` together track whether the bytes live in the file and whether they have been flushed to
disk, but I would not swear to the precise semantics of `saved`.

Faces reference a texture by its **array index** (`"texture": 0`), not by its `uuid` or its `id`
string — even though the texture object carries both. That is an easy thing to get wrong when
writing an exporter, and it means **reordering the `textures` array silently re-skins the model.**
My verification checks every one of the 132 face indices resolves.

### The paint tools

All four operate on the texture only. **None of them touch the model JSON** — but they do need
a texture assigned to the face you are painting, or the click does nothing.

- **Brush** — paints pixels at the current colour, size and opacity. Painting in the 3D viewport
  projects the click through the face's UV rectangle to a texel, which is why a face with a
  degenerate (zero-area) UV cannot be painted on.
- **Paint bucket** — flood fill from the clicked texel, bounded by colour similarity and
  (usually) by the UV rectangle of the face you clicked, so a fill does not bleed across your
  whole atlas. This is one practical reason non-overlapping UV islands matter.
- **Eraser** — the brush writing alpha 0. It needs the texture to actually have an alpha channel;
  `alien_sword.png` is RGBA (`colorType: 6`) and fully opaque, so erasing would punch real holes.
- **Colour picker** — pure read. It samples a texel into the active colour swatch and writes
  **nothing**, to neither the texture nor the model.

Whatever those tools do lands in the texture's pixel data, and on save that data is re-encoded
into the `source` data URI for an internal texture, or written back to the PNG for a linked one.
The `.bbmodel` geometry is byte-identical before and after a painting session.

### The Element panel numeric fields

The right-hand panel for a selected cube. Modellers use it whenever precision beats dragging,
which for a mechanical object like this one is most of the time.

- **Position** and **Size** — these map to `from` and `to − from`. Blockbench shows you a corner
  plus an extent; the file stores two corners. So `to` is never edited directly: typing a new
  Size rewrites `to` as `from + size`. (I am reasonably confident Position is `from` rather than
  the box centre in the cube formats, but that is a detail I could not re-check in the app.)
- **Rotation** — the three Euler angles, writing `rotation` directly. Same field the gizmo writes.
- **Pivot** — `origin` directly. Same field the Pivot tool writes.
- **Inflate** — expands the *rendered* box outward by N units on all six sides **without
  changing `from`/`to` and without changing the UVs**. It is how you build a second shell around
  an existing shape — armour over a body, a fur layer over a mob — at a slightly larger size but
  with the exact same texture mapping and no z-fighting. It is written as an `inflate` field on
  the element. This model uses no inflate anywhere, so I omit the field entirely; I believe
  omitting it is equivalent to `0`, and Blockbench appears to only write it when non-zero, but
  a defensive importer should default it to 0 rather than assume presence.

### The format selector ("Generic Model" / `free` vs `java_block`)

Chosen in the New Project dialog, stored as `meta.model_format`. It is not cosmetic — it changes
which operations the editor will even let you perform.

I chose **`free`** ("Generic Model") for this sword, for one concrete reason: **`java_block`
restricts element rotation to a single axis at a time, at a fixed set of angles** (0, +/-22.5,
+/-45), because that is all the Minecraft Java block model renderer supports. This sword needs
arbitrary multi-axis rotation — the barbs are canted on both Y and Z, the tip shard is rotated
-14 on Y and +33 on Z, the blade segments sweep through 2/6/11/17/24 degrees. Every one of those
is illegal in `java_block`. `java_block` also clamps coordinates to roughly -16..32 and expects
the model to serve as a block in a 16-unit cube.

`free` imposes none of that: any rotation on any axis, any coordinates, no export contract. The
cost is that the result is not directly usable as a Minecraft block — it is a generic mesh you
export to OBJ/glTF or render yourself.

Other values exist (`bedrock` for Bedrock entities, which uses bones and box UV; `modded_entity`;
`skin`; `optifine_entity`). An importer should branch on `meta.model_format` before validating
anything, because the constraints are per-format and the same JSON can be legal in one and
rejected in another.

---

## 3. Format notes that would trip up an implementer

**UVs are in texture pixel space, not normalised.** `uv: [x1, y1, x2, y2]` with values in
`0..64` here, not `0..1`. The space is the project's `resolution` (equivalently the texture's
`uv_width`/`uv_height`), *not* the texture's pixel dimensions — those can differ. Divide by
`uv_width`/`uv_height`, not by the image width, when you convert to GL coordinates.

**V grows downward.** `y1` is the *top* edge of the rectangle in image space. When you paint a
gradient meant to be "lit on top", the light end goes at the low-v end of the region. Easy to
paint upside down and not notice until the model is lit.

**Swapping a UV coordinate mirrors the face.** `x2 < x1` flips horizontally, `y2 < y1` flips
vertically. That means you cannot normalise a rectangle to `min/max` on load without destroying
mirroring — a real bug an implementer will hit. Every rectangle in this file is written with
`x1 < x2` and `y1 < y2`, and a check asserts none is zero-area.

**`origin` is not `from`.** `from`/`to` are the un-rotated box corners; `origin` is the pivot the
`rotation` is applied about, in the *same* coordinate space. `origin` is frequently outside the
box (every guard horn and barb in this file pivots at a joint on its inner end). To get world
space: `world = origin + R(rotation) · (p − origin)`.

**Rotation is Euler, and the order matters.** Blockbench is built on three.js, whose default
Euler order is `XYZ`. My bounding-box check applies `Rx(Ry(Rz(v)))` on that assumption. For
single-axis rotations it is irrelevant; for the eleven cubes here rotated on two axes it is not.
**I could not confirm the order against the real renderer** — if an importer disagrees, this is
the first thing to check, and the visible symptom is that two-axis cubes land in the wrong place
while one-axis cubes look fine.

**The outliner is the tree; `elements` is a flat pool.** The tree references elements by UUID
string, and nests groups as inline objects in the same `children` array — so a `children` entry
is polymorphic: `typeof entry === "string"` means element reference, otherwise it is a group.
Walking it requires that type test at every level.

**`box_uv` appears in two places with different meanings.** `meta.box_uv` is the project default
for newly created cubes; the per-element `box_uv` is what actually governs that cube. They can
disagree, and the element wins.

**Face texture references are array indices.** Not UUIDs, despite each texture carrying one.
Reordering `textures` re-skins the model. A face can also be untextured; I believe that is
written as `null` (and some versions use `-1`), so do not assume the field is always a valid
index.

**Optional fields are genuinely optional.** `inflate` and per-face `rotation` are absent
throughout this file because they are zero. An importer that does `element.inflate + 0` on a
missing field gets `NaN`. Default them explicitly.

**`visible_box: [1, 1, 0]`** — I do not actually know the precise semantics of this field. It
appears to scale the bounding box Blockbench uses for view framing/clipping, and `[1,1,0]` is the
default that a new project gets. I copied the default rather than guess at a better value. If
the model appears clipped in the viewport, this is a field to look at.

**`light_emission`** — I set it non-zero (2..9) on the six glowing parts (`core_vein` at 9, the
pommel shard, tip shard, the upper blade segments, `guard_horn_b`). I am **not confident it has
any visual effect in the `free` format** — my understanding is that it is primarily a Minecraft
export property. It is harmless metadata here and documents design intent, but do not read the
model's appearance from it.

---

## 4. Verification

`build.mjs` re-reads the bytes it just wrote to disk and runs 12 assertions. Current result,
verbatim from the last run:

```
  [PASS] JSON parses
         53761 bytes, model_format=free
  [PASS] every faces.*.texture index exists in textures
         132 faces resolve against 1 texture(s)
  [PASS] outliner uuids resolve; every element referenced exactly once
         22 elements, 6 groups: /blade /blade/spines /blade/core /guard /grip /pommel
  [PASS] to[i] >= from[i] on every axis
         66 axis comparisons
  [PASS] every face UV inside [0,0,64,64] and non-degenerate
         132 face rects in range
  [PASS] face UV rect matches the face size 1:1 (no stretching)
         all 132 rects within 1/8 px of their face size
  [PASS] no UV region overflowed its shelf packer
         BLADE_SIDE 12/16  GRIP 7.5/16  BAND 6/16  BLADE_EDGE 14/16  SPINE 11.5/16
         CORE_GLOW 7/16  GUARD 12/16  CRYSTAL 6.5/16  DARK 13.5/16  BARB 9/16
         TIP 10/16  MEMBRANE 8/16  POMMEL 14/16  ROOT 5.5/16  DETAIL 7.5/16
  [PASS] no two faces claim overlapping texture pixels
         132 rects, 0 overlaps, 1549/4096 px claimed
  [PASS] embedded texture matches alien_sword.png byte for byte
         11316 bytes identical
  [PASS] texture is a 64x64 PNG with real pixel art
         64x64, 4096/4096 opaque px, 2978 distinct colours
  [PASS] rotated model fits a 32 x 48 x 32 bounding box
         size 19.63 x 46.41 x 8.2  (min -8.22,-0.13,-4.1 / max 11.42,46.29,4.1)
  [PASS] cube count is in the 14..22 range
         22 cubes

12/12 checks passed; 22 cubes, 132 faces
```

The four checks the brief asked for are all there (JSON parses; face texture indices resolve;
outliner UUIDs resolve with exactly-once referencing; `to >= from`; UVs inside `[0,0,64,64]`),
plus eight more I added because they caught real bugs.

### Things that failed and were fixed

1. **Two UV regions overflowed and 22 face-rect pairs overlapped.** The first packer was a
   single-pass, first-come shelf allocator; `BAND` and `CRYSTAL` ran out of vertical space and
   wrapped back to their own origin, silently stacking rectangles. Fixed by deferring UV
   assignment to a second phase and sorting each region's rectangles by descending height before
   packing, plus re-proportioning the 15 regions to match measured demand.
2. **The model was 54.66 units tall against a 48 budget.** Shortened the blade segments and
   compressed the hilt by 1.6 units; now 46.41.
3. **The grip's wrap pattern was invisible.** The band shading was purely multiplicative and the
   region's gradient crushed its lower half to near-black, so the ridges disappeared. Made the
   shading additive as well. Same fix applied to the guard's striations.
4. **The `core_vein` was a full-depth 11-unit slab** that swallowed the lower quarter of the
   sword when seen edge-on. Shortened to 6.8 units and slimmed so it reads as a power core in the
   ricasso rather than a box.

Bugs 3 and 4 were only visible by *looking* at the output, not from assertions — I upscaled the
atlas 9x and wrote a throwaway orthographic rasteriser (painter's algorithm, flat shading, face
colour sampled from the atlas) to render front, side and three-quarter views. Those scripts are
in `../probe-a-preview/` and are not deliverables.

### What I could **not** verify

- **The file has never been opened in Blockbench.** `blockbench.net` and `web.blockbench.net`
  are blocked by this environment's egress policy. The model is authored against the format spec
  I was given plus prior knowledge; it is self-consistent and my own renderer reads it fine, but
  "Blockbench loads this without complaint" is unverified.
- **Euler rotation order** (`XYZ` assumed, per three.js's default). Affects the eleven two-axis
  cubes only.
- Whether **`light_emission`** does anything in `free` format.
- The exact semantics of **`visible_box`**, **`saved`**, and the **`autouv`** enum.
- Whether **omitting `inflate`** and the per-face **`rotation`** field is preferred to writing
  explicit zeros. Both are absent here.
- Several claims in section 2 about *UI* behaviour — most notably whether the Move tool drags
  `origin` along with the box. Flagged inline where relevant.
