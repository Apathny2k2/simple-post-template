# Voidling + Resonator — build notes

Everything here was authored directly against the `.bbmodel` JSON schema. **I never
opened Blockbench.** `blockbench.net` and `web.blockbench.net` are blocked by this
environment's egress policy, so nothing below has been confirmed by loading the files
into the real application. Where I am guessing at a field's exact semantics I say so
explicitly — see [§5a Things I could not verify](#5a-things-i-could-not-verify).

Regenerate everything with:

```
node build.mjs          # writes the 4 artefacts, then verifies them and exits non-zero on failure
node build.mjs --quiet  # same, no report
```

The build is deterministic: re-running overwrites all four outputs byte-for-byte
identically (checked with `sha256sum -c`). There is no randomness, clock, or network
access in it.

---

## 1. What I built

### 1.1 Voidling — `voidling.bbmodel` / `voidling.png`

`model_format: "free"`. **20 cubes, 16 bone groups, hierarchy 6 levels deep, 3
animations, 45 bone animators, 222 keyframes.** Bounding box `X -8.5..8.5`,
`Y 0..37.5`, `Z -5..5.25` — inside the 32 x 40 x 32 budget.

A stalking, hollow-chested creature. Its ribcage is an open frame — two flanks and a
shoulder yoke with nothing between them — and a loose energy core hovers *inside* that
cage, parented to its own bone so it can drift independently of the body. The
asymmetry is deliberate and threefold: one arm is a long three-segment grabber ending
in a grown crystal claw, the other is a stub ending in a crystal blade; and it has a
single horn, on its left only.

Bone tree (groups in **bold**, cubes in `code`):

```
root                      pivot (0, 12, 0)      -- the pelvis; everything hangs off this
├─ pelvis
├─ torso                  pivot (0, 15, 0)      -- waist; breathing + sway live here
│  ├─ flank_left, flank_right, yoke
│  ├─ core                pivot (0, 18, 0)      -- the caged orb, free to drift
│  │  └─ core
│  ├─ head                pivot (0, 25.5, 0)    -- base of the neck, not the skull centre
│  │  ├─ head, crest, horn
│  │  └─ jaw              pivot (0, 26.5, -1)   -- hinge at the back of the jawline
│  │     └─ jaw
│  ├─ arm_left            pivot (-6, 24, 0)     -- shoulder
│  │  ├─ upperarm_left
│  │  └─ forearm_left     pivot (-6.75, 16.5, 0)  -- elbow
│  │     ├─ forearm_left
│  │     └─ claw_left     pivot (-6.75, 9, 0)     -- wrist
│  │        └─ claw_left
│  ├─ arm_right           pivot (6, 24, 0)      -- shoulder
│  │  ├─ upperarm_right
│  │  └─ blade_right      pivot (6.75, 18.5, 0)
│  │     └─ blade_right
│  └─ tendril_upper       pivot (0, 21.5, 2.75)
│     ├─ tendril_upper
│     └─ tendril_lower    pivot (0, 16.5, 4)
│        └─ tendril_lower
├─ leg_left               pivot (-2.5, 10.5, 0) -- hip
│  ├─ thigh_left
│  └─ shin_left           pivot (-2.75, 5.5, 0) -- knee
│     └─ shin_left
└─ leg_right              pivot (2.5, 10.5, 0)
   ├─ thigh_right
   └─ shin_right          pivot (2.75, 5.5, 0)
```

Every pivot sits on the joint it represents, not at the cube's centre. `forearm_left`
pivots at `y = 16.5`, which is exactly where `upperarm_left` ends and `forearm_left`
begins — that is what makes the elbow bend instead of shear.

#### Animations

| name | loop | length | bones | keyframes | channels |
|---|---|---|---|---|---|
| `animation.voidling.idle` | `loop` | 3.2 s | 14 | 77 | rotation, position, scale |
| `animation.voidling.walk` | `loop` | 1.2 s | 16 | 75 | rotation, position, scale |
| `animation.voidling.strike` | `once` | 1.0 s | 15 | 70 | rotation, position, scale |

**idle** — breathing is on `torso` **scale** (chest widens to 1.035 on X/Z while
shortening to 0.985 on Y, then overshoots the other way), not on rotation, because
scale is what a ribcage actually does. `torso` also carries a slow 2 degree rotational
sway. `head` traces a lazy figure across 5 keyframes. `root` has a half-unit
**position** hover. `core` is the busiest bone — **16 keyframes across all three
channels**: a 5-key position float, a 6-key scale pulse (1.10 / 0.94 / 1.08 / 0.97 …,
deliberately irregular so the beat is not metronomic), and a 5-key rotation wobble.
The tendrils, both arms and the jaw all drift on their own periods so nothing lines up.

**walk** — 1.2 s cycle. `leg_left` is at +26 degrees (forward) at t=0 while `leg_right`
is at -24; they swap at t=0.6, so the legs are exactly 180 degrees out of phase. The
shins fire their knee-bend half a beat after their thigh. The arms counter-swing
against the legs on the same period. `root` carries a two-bounce position bob (peaks at
0.3 and 0.9, one per footfall) plus a Z-axis roll, and `torso` and `head` counter-rotate
against each other on Y so the head stays roughly forward while the shoulders twist.

**strike** — a one-shot blade attack. Wind-up to t=0.25 (`arm_right` back to -70
degrees, torso coiled +26 on Y), release at t=0.42 (`arm_right` to +58, torso
uncoiling to -32, `root` lunging 3 units forward on **position**), recovery to t=1.0.
The core uses a **`step`** keyframe at t=0.22 so it snaps dark on the wind-up rather
than fading, then flares to scale 1.5 on impact. This is the one animation using
`loop: "once"`, which is why the loop-closure rule does not apply to it.

### 1.2 Resonator — `resonator_block.bbmodel` / `resonator_block.png`

`model_format: "java_block"`, resolution 32 x 32. **9 elements**, 3 groups, bbox
`X 2.4..13.6`, `Y 0..14.5`, `Z 2.5..13.5` — every coordinate inside `0..16`.

A steel plinth; two posts on opposite corners with a glowing resonite inlay running up
each; a brass collar clamped around a resonite crystal suspended between them; a brass
tuning yoke slung across the diagonal; and two obsidian heat fins, one bolted to each
post, tilted 22.5 degrees off it. The crystal spire runs up *through* the yoke and
pokes out the top.

| element | from | to | rotation |
|---|---|---|---|
| `plinth` | 3, 0, 3 | 13, 2, 13 | — |
| `post_a` | 3.5, 2, 3.5 | 6.5, 12, 6.5 | — |
| `post_b` | 9.5, 2, 9.5 | 12.5, 12, 12.5 | — |
| `yoke` | 7, 12, 2.5 | 9, 13.5, 13.5 | Y +45 |
| `vent_a` | 2.4, 3.5, 3.5 | 3.8, 9.5, 6.5 | X +22.5 |
| `vent_b` | 12.2, 3.5, 9.5 | 13.6, 9.5, 12.5 | X -22.5 |
| `coil` | 5, 5.5, 5 | 11, 7, 11 | — |
| `core_shard` | 6.5, 4, 6.5 | 9.5, 10.5, 9.5 | Y +45 |
| `shard_tip` | 7, 10.5, 7 | 9, 14.5, 9 | Y +45 |

Interior detail comes from stacking at different orientations: the crystal and yoke sit
at 45 degrees, the collar and posts sit square, so the two systems read as separate
mechanisms rather than one shape. Note `coil` fully surrounds `core_shard` at that
height — it is meant to; the crystal is visible above and below the collar.

### 1.3 Textures

`voidling.png` is 64 x 64, `resonator_block.png` is 32 x 32, both RGBA. Both are
written standalone **and** embedded in the matching `.bbmodel` as
`textures[0].source = "data:image/png;base64,…"`. The verifier decodes the embedded
base64 and byte-compares it against the file on disk, so they cannot drift.

Neither is a flat fill. Colour is defined as **six-stop ramps per material**
(`carapace`, `voidflesh`, `energy`, `crystal`, `bone`, `membrane` for the mob;
`steel`, `brass`, `resonite`, `obsidian` for the block) and every texel samples its
ramp at a *fractional* index built from: a directional light term per face normal
(up +1.95, east +0.85, north +0.10, south -0.55, west -0.85, down -1.95 — sun high
and slightly east), an intra-face gradient (top lit, bottom shaded on side faces; a
soft dome on up faces), a bevel pass that darkens the 1px rim and puts a bright lip on
the top row, a material pattern (plate seams and rivets on carapace, drifting motes on
voidflesh, radial glow rings on energy, diagonal facets on crystal, growth striations
on bone, branching veins on membrane, brushed lines on steel, machined hatch on brass,
slats on obsidian), and a small hash-based dither. On top of that sit per-cube
overlays: the glowing eye band and brow ridge on `head`'s north face, teeth along
`jaw`, a hot leading edge on `crest`, a rune ring on the `coil` top, the lit inlay
strips on the posts, and the fin slats.

---

## 2. UV packing: what per-face UV actually buys you

Both textures use **strictly disjoint** per-face rectangles. Every one of the
voidling's 120 faces and the resonator's 54 faces owns a private patch of the atlas;
the verifier does the full O(n^2) pairwise overlap test and reports zero.

`build.mjs` packs them with a deterministic skyline bottom-left packer (rects sorted by
height desc, then width desc, then name — the name tiebreak is what keeps it stable),
and searches a fixed descending list of texel densities for the first that fits:

```
voidling        64x64   1.1  texels/model unit   88.4% atlas occupancy
resonator_block 32x32   0.8  texels/model unit   82.4% atlas occupancy
```

That search is not decoration, and the resonator is the interesting case. **Strictly
disjoint per-face UVs for that block do not fit in 32 x 32 at 1 texel per model unit.**
Its total face area is ~960 texels against 1024 available, and no packer gets 94%
occupancy on heterogeneous rects. The plinth alone eats 280 texels, 200 of them on its
up and down faces — and its down face is never visible once the block is placed.

This is exactly why real Minecraft Java block models *reuse* texture regions across
faces: the canonical vanilla block maps all six faces to `[0, 0, 16, 16]` of one 16x16
image. Disjoint UVs are the right call for a character, where you want to paint a
unique eye on one face; they are usually the wrong call for a block, where the same
plate should read identically on all four sides. I kept them disjoint here because the
brief asked for it, and paid for it with 0.8 texels/unit — about 80% of vanilla 16x16
density. An implementer should know the tradeoff exists rather than assume disjoint is
always correct.

The gutters between packed rects are left fully transparent (alpha 0), which is also
what makes the empty region visibly distinct from painted black.

---

## 3. The Blockbench tools, and how each one lands in the file

This is the part worth reading if you are building an editor. For each tool: what it
does, when a modeller reaches for it, and what changes on disk.

### Add Cube
Creates one axis-aligned box. Pretty much everything in a Blockbench model is one of
these — the whole format is "boxes with textured faces", there is no mesh topology to
speak of (Blockbench does have a separate mesh element type in free-form formats, but
none of the Minecraft formats accept it).

**On disk:** one entry in `elements[]` with `"type": "cube"`, a `uuid`, `from` and `to`
(opposite corners, `to >= from` on every axis), and a `faces` object with all six of
`north / east / south / west / up / down`. A newly added cube is dropped at the current
selection's position with default UVs; the modeller immediately moves and resizes it.

Sizes here are in **model units**, which for Minecraft formats are 1/16 of a block. The
voidling's head is `from [-4, 25.5, -4] to [4, 32.5, 3]` — 8 wide, 7 tall, 7 deep,
half a block wide. Free-form formats happily take fractional coordinates; I use `.5`
throughout to get sub-pixel thicknesses on the flanks and limbs.

### Add Group (bone)
Creates an empty container in the Outliner. A group is a transform node: it has an
`origin` (the pivot), a `rotation`, and children. Children can be cubes or more groups.
**A group is the unit of animation** — the animator can only key things that are
groups. If a limb is not in its own group, it cannot be animated, full stop.

**On disk:** a nested object in `outliner[]`. Its `children` array is *heterogeneous*:
plain strings are element UUIDs, objects are child groups. That mixed array is the
single most implementation-relevant quirk of the format.

```json
{ "name": "arm_left", "origin": [-6, 24, 0], "rotation": [0,0,0],
  "uuid": "…", "export": true, "isOpen": true, "locked": false,
  "visibility": true, "autouv": false,
  "children": ["<element-uuid>", { "name": "forearm_left", … }] }
```

Note that `elements[]` is a **flat** list and `outliner[]` is the tree over it. The two
are joined only by UUID. Nothing in `elements[]` says which group owns it. My verifier
therefore checks both directions: every UUID string in the outliner resolves to a real
element, and every element is referenced exactly once (zero references = an orphan that
renders but cannot be animated; two = a structural corruption).

### Move / Resize / Rotate
The three transform gizmos, switched with the toolbar or `V` / `S` / `R` by default.

- **Move** translates the selection. On a cube it shifts `from` and `to` together; on a
  group it shifts the group's `origin` *and* effectively all descendants.
- **Resize** drags one face outward. It edits `from` or `to` on one axis only — this is
  the tool that has no analogue in a normal 3D package, because you are dragging a slab
  boundary, not vertices.
- **Rotate** spins the selection about its pivot. On a cube it writes
  `elements[i].rotation` (degrees, `[x, y, z]`) and rotates about `elements[i].origin`.
  On a group it writes `outliner[…].rotation` and rotates the whole subtree about the
  group's origin.

The critical asymmetry: **cube rotation and group rotation are different things**. Cube
rotation is modelling — baked into the shape, static at runtime. Group rotation is
rigging — it is the rest pose that the animator offsets from. The voidling's `horn` is a
*cube* rotation (`[-18, 0, 24]`, a permanent sweep up-and-back), while every bone in
the file sits at `[0, 0, 0]` so the animations have a clean zero to work from.

### The Pivot tool — the one that matters
Pivot mode moves a group's `origin` without moving its contents. It is a two-line diff
in the file and it is the entire difference between a rig that works and one that does
not, because **`origin` is the point every rotation in every animation turns about.**

Put `arm_left`'s origin at the cube's centre and a shoulder raise makes the arm
pinwheel through the torso. Put it at `[-6, 24, 0]` — the actual shoulder socket, the
top-inner corner of the upper arm — and the same keyframe raises the arm. The keyframe
data is identical; only the pivot changed.

Consequences worth internalising:

- Pivots are in **model space**, not local space, in the saved file. Two nested bones
  both store absolute coordinates.
- A chain works when each child's pivot sits where the parent's geometry ends:
  `arm_left` at y=24 (shoulder), `forearm_left` at y=16.5 (elbow, = the bottom of
  `upperarm_left` / the top of `forearm_left`), `claw_left` at y=9 (wrist). Get one
  wrong and that joint visibly telescopes when it bends.
- A bone's pivot does **not** have to be inside its geometry. `torso`'s pivot is at
  y=15, the waist, which is below the bottom of `yoke` and outside `flank_*`. That is
  correct: you want the chest to lean from the waist.
- `core`'s pivot is at the centre of the orb because it spins in place.

### The Outliner
The left-hand tree panel. It is not just a list — reparenting in it *is* rigging, since
drag-and-drop changes the transform hierarchy. It also carries per-node `visibility`,
`locked`, `export` and `isOpen` flags, all of which round-trip to the file; `isOpen` is
pure UI state (is the twisty expanded) that happens to be persisted.

**On disk:** the `outliner[]` array, plus the fact that ordering within `children` is
preserved. Render order for transparent faces can depend on it.

### Per-face UV vs Box UV
Two mutually exclusive UV modes, toggled per project (`meta.box_uv`) and overridable
per cube (`elements[i].box_uv`).

- **Box UV** is the Minecraft-classic mode. You give the cube one `uv_offset` and the
  six faces are derived automatically as an unfolded cross net whose size is dictated by
  the cube's dimensions. Cheap, tidy, and how vanilla entity models work — but you get
  no say in where any individual face lands, and resizing the cube silently relocates
  its texture.
- **Per-face UV** (`box_uv: false`, what both models here use) gives every face its own
  explicit `uv: [x1, y1, x2, y2]`. More work, total control.

**UVs are in texture pixel space, not normalised 0..1.** A 64x64 texture takes values
`0..64`. The scale factor is `textures[i].uv_width` / `uv_height`, which is why
`resolution` and the texture's `uv_width`/`uv_height` need to agree — my verifier
asserts that, plus that every rect is inside bounds and non-degenerate.

Because the rect is explicit, `x1 > x2` mirrors the face horizontally and `y1 > y2`
flips it vertically. I emit only `x2 > x1, y2 > y1` rects; I did not use flips.

### Texture and paint tools
Blockbench has an in-app paint mode — brush, eraser, bucket, colour picker, gradient,
plus a layers system (`textures[i].layers_enabled`) — and you can paint either on the
2D texture panel or directly onto the 3D model, which back-projects the stroke through
the UVs. In practice the second is what makes per-face UV bearable: you click the
creature's face, not a rectangle in an atlas.

I have no GUI here, so `build.mjs` is the paint tool: it knows each face's rect, its
normal, and its material, and shades accordingly. That is actually *more* information
than a human painter has — a human has to remember which rect is the underside.

**On disk:** the texture is a full entry in `textures[]` carrying its own `uuid`, name,
`width`/`height` (the image) and `uv_width`/`uv_height` (the UV space — normally equal,
but they can differ), plus the image itself as a base64 data URI in `source`. Faces
reference it by **index** (`"texture": 0`) into the `textures` array.

### Animate mode
A separate mode (top-right tab); the model panel is replaced by a timeline.

- **Animations list.** A project holds many. Each has a `name` (the
  `animation.<entity>.<action>` convention is a Bedrock/Molang idiom, kept here for
  familiarity), a `length` in **seconds**, a `loop` mode, and `snapping` (24 = the
  timeline snaps the playhead and new keyframes to 1/24 s).
- **The timeline and playhead.** Horizontal axis is time, one row per animated bone,
  sub-rows per channel. Scrubbing the playhead evaluates every animator at that time
  and pushes the result onto the rig — so the viewport is showing you interpolated
  output, not stored data. Nothing about the playhead position is saved.
- **Bone animators.** Selecting a group in Animate mode creates an animator row for it.
  **The animator is keyed in the file by the group's UUID:**

  ```json
  "animators": {
    "<uuid of the 'head' group>": { "name": "head", "type": "bone", "keyframes": [ … ] }
  }
  ```

  The `"name": "head"` string is a convenience label. **The UUID is the binding.**
  Rename the bone and animations follow; regenerate the bone's UUID and every animation
  on it silently stops applying. My verifier asserts every animator key resolves to a
  real group in the outliner, which is the check that catches this.
- **Channels.** `rotation` (degrees), `position` (model units, relative to the rest
  pose), `scale` (multiplier, 1 = unchanged). Each is keyed independently — a bone can
  have four rotation keys and two scale keys at completely unrelated times, which is
  how you get motion that does not feel like everything is on the same beat. All three
  store a `data_points: [{x, y, z}]` triple. `data_points` is an *array* because
  Blockbench supports a second point for random-range variation; one entry is the norm.
  Values may be numeric strings holding Molang expressions in Bedrock-ish formats; I
  kept to plain numbers.
- **Keyframes.** A time plus a value on one channel. `interpolation` per keyframe:
  - `linear` — straight line to the next key. Mechanical. Used for the snap phases of
    `strike` and the core's rotation wobble in `idle`.
  - `catmullrom` — a Catmull-Rom spline through neighbouring keys. Smooth, overshoots
    slightly, and is what makes organic motion look organic. The default choice for
    almost everything in `idle` and `walk`.
  - `bezier` — per-keyframe tangent handles, stored as `bezier_left_time`,
    `bezier_left_value`, `bezier_right_time`, `bezier_right_value` (each an `[x, y, z]`
    triple, so handles can differ per axis) with `bezier_linked` controlling whether
    the two sides move together. Maximum control, most work. Every keyframe I emit
    carries these fields at their neutral defaults even though none use `bezier` mode,
    because they appear to be expected to be present.
  - `step` — hold the previous value, then jump. No blending at all. Used once, on the
    core's scale at t=0.22 in `strike`, so the core snaps dark instead of fading.
- **Looping.** `loop` is `"loop"`, `"once"` or `"hold"`. For `"loop"` the value at
  `t = length` must equal the value at `t = 0` *per channel*, or the animation visibly
  jerks once per cycle. This is not enforced by the format and is easy to get wrong, so
  it is one of the verifier's checks: for every `loop: "loop"` animation, every
  animator, every channel — there must be a keyframe at exactly 0 and at exactly
  `length`, and their `data_points` must match component-wise. Both looping animations
  pass.

  A caveat I want to be honest about: **matching endpoint values makes the loop
  continuous in position, not in velocity.** With `catmullrom`, the spline at the seam
  is computed from the neighbouring keyframes, and I do not know whether Blockbench
  wraps around the loop to pick the neighbour on the far side. If it does not, there is
  a small tangent discontinuity at the seam that no amount of endpoint matching fixes.
  I could not test this.

---

## 4. Format constraints: `java_block` vs `free`

`free` imposes essentially nothing. Any coordinate, any rotation on any number of axes
simultaneously, arbitrary resolution.

`java_block` mirrors what Minecraft's own JSON block model format accepts, because a
Blockbench `java_block` project exists to be exported to one. The limits are the
renderer's, not the editor's:

1. **Coordinates within `-16..32`.** One block is `0..16`. Minecraft allows one block of
   overhang on each side for things like fence posts and chains. I kept everything in
   `0..16` as the brief asked — a block that stays inside its own cell behaves
   predictably with culling, lighting and block-placement collision.

2. **One rotation axis per element, `"axis": "x" | "y" | "z"`.** The vanilla format
   literally has a single-axis field; there is nowhere to put a second. This is the
   constraint that most shapes a `java_block` model: you cannot tilt something in two
   directions, so compound angles have to be faked by composing separate elements.
   The voidling's `horn` uses `[-18, 0, 24]` — two axes at once — precisely to show
   what `free` permits and `java_block` forbids.

3. **Angle restricted to -45, -22.5, 0, 22.5, 45.** Minecraft's `FaceBakery` bakes
   element rotation into static vertex positions at model-load time and only handles
   these five. Anything else is rejected by the game's model loader.

4. **Resolution 16 or 32** in practice, since the texture has to be a block texture.

My verifier enforces 1, 2 and 3 on every element of `resonator_block.bbmodel` and 1 in
its stricter `0..16` form.

There are two more real constraints I *complied with* but did not write checks for,
because nothing in the model comes near them: `java_block` does not accept mesh
elements (only cubes), and it does not support Box UV per-cube overrides in the same
way. Also worth knowing for an implementer: vanilla's `rescale` flag (Blockbench's
`"rescale"`, false everywhere here) only has meaning on a rotated element — it scales
the element up to compensate for the rotation shrinking its bounding box.

**On the two 45-degree Y rotations:** rotation about `+Y` by `+45` maps `+Z` to
`(+X, +Z)` — the same matrix in three.js (which Blockbench renders with) and in
Minecraft's `FaceBakery`. So the `yoke`, whose long axis is Z, lands on the
`post_a (-X,-Z)` to `post_b (+X,+Z)` diagonal, which is where I want it. **I derived
that on paper and confirmed it with my own raycast preview renderer, not in
Blockbench.** If the app's handedness differs from my reading, the yoke sits on the
other diagonal and the posts look unconnected; the fix is flipping `45` to `-45` on
`yoke`, `core_shard` and `shard_tip`.

---

## 5. Format notes for an implementer

Things that would trip you up, roughly in order of how much time they would cost:

1. **`outliner[].children` is a heterogeneous array.** Strings are element UUIDs,
   objects are nested groups. Do not type it as one or the other.
2. **`elements[]` is flat; the tree lives only in `outliner[]`.** There is no parent
   pointer on an element. Loading needs a UUID index; saving needs both structures kept
   in sync. Validate that the mapping is a bijection — an element referenced twice or
   zero times is silently broken, not a parse error.
3. **UVs are texture pixels, not normalised.** And the scale is
   `textures[i].uv_width`/`uv_height`, which is *not necessarily* the PNG's
   `width`/`height` — Blockbench lets you paint a 64x64 model on a 512x512 image by
   keeping `uv_width` at 64. If you assume `uv == pixel`, high-res texture packs break.
4. **Group `origin` is absolute model space, even for nested groups.** Not relative to
   the parent. Easy to get backwards if you come from glTF.
5. **Cube `rotation` and group `rotation` are unrelated mechanisms.** Cube rotation is
   geometry; group rotation is the rig's rest pose. Animation offsets the latter.
6. **Animators are keyed by group UUID, with `name` as a redundant label.** Any tool
   that regenerates UUIDs on load will silently detach every animation. Treat UUIDs as
   stable identity, not as a serialisation detail.
7. **`animations` is a top-level array, but `animators` inside it is an object** keyed
   by UUID. Mixed collection styles in the same subtree.
8. **`data_points` is an array of `{x,y,z}`**, normally length 1, and the values may be
   numbers *or* numeric strings (Molang expressions). Parse defensively.
9. **Loop closure is a convention, not a schema rule.** Nothing rejects a `loop: "loop"`
   animation whose endpoints disagree; it just looks wrong. Worth a lint in any editor.
10. **The embedded texture is a data URI**, so a `.bbmodel` is fully self-contained and
    large — `voidling.bbmodel` is 251 KiB, of which 12 KiB is base64 PNG and the rest is
    pretty-printed geometry and 222 keyframes. `relative_path` and `path` point at the
    external copy; `internal: true` and `saved: false` describe whether the texture
    lives in the file or on disk. If you write both, keep them identical — my verifier
    base64-decodes `source` and byte-compares it against the standalone `.png`.
11. **`from`/`to` are not normalised.** The format does not guarantee `to > from`, so
    check it; a reversed box renders inside-out.
12. **Fractional coordinates are fine in `free`** and used throughout here. Do not
    assume integers.

### 5a. Things I could not verify

Stated plainly, because guessing confidently would be worse than admitting it. None of
the following has been round-tripped through the real application:

- **Whether Blockbench opens these files at all.** That is the big one. Everything else
  is a detail inside it.
- **The exact `interpolation` string values.** I used `"linear"`, `"catmullrom"`,
  `"step"` and I am fairly confident those are the lowercase identifiers, but I did not
  confirm capitalisation or whether `"bezier"` is spelled that way.
- **Whether `faces.*.texture` is an index or a texture UUID.** The spec I was given says
  index and I emitted `0`; I have a vague recollection that some Blockbench versions
  write the texture's UUID string there instead. If a loader rejects the number, that is
  the first thing to try.
- **`ambientocclusion` and `front_gui_light`** on the `java_block` project root. I
  believe these are the right keys and placement; I am not certain, and they are
  cosmetic if wrong.
- **UV orientation on `up` and `down` faces.** Box UV flips the down face vertically by
  convention. With explicit per-face rects I wrote plain unflipped rectangles, and
  because I generated the art per-rect it is self-consistent either way — but the
  top/bottom shading gradient on those two faces may read rotated from what I intended.
- **Whether `catmullrom` wraps across the loop seam** (see §3, Looping).
- **`light_emission`** — I used 12 on the voidling's core and 10 on the shards, assuming
  a 0..15 range mirroring Minecraft light levels. Unconfirmed.
- **Euler order for multi-axis cube rotation.** The horn's `[-18, 0, 24]` will land
  somewhere slightly different under XYZ vs ZYX composition. My preview renderer uses
  `Rz * Ry * Rx`; if Blockbench composes the other way the horn's sweep angle shifts a
  few degrees. Cosmetic.
- **`allow_mirror_modeling`, `render_order`, `visible_box`, `snapping`, and the
  animation-level `saved` / `path` fields.** Copied from the spec or from convention;
  semantics unverified.
- **How the animations actually look.** I reasoned about phase, pivot placement and
  overshoot, and I checked the rest pose geometry with my own orthographic raycast
  renderer, but I never watched a frame play.

---

## 6. Verification

`build.mjs` writes all four files and then re-reads them **from disk** — it validates
the reparsed JSON and the bytes on disk, not the in-memory objects it just built — and
exits non-zero on any failure.

Checks run per model:

| check | scope |
|---|---|
| JSON reparses from disk | both |
| `resolution` matches the texture's `uv_width`/`uv_height` | both |
| embedded base64 decodes to bytes identical to the standalone `.png` | both |
| every `faces.*.texture` is an in-range index into `textures[]` | both |
| every `to[i] >= from[i]` | both |
| every face UV inside `0..uv_width` / `0..uv_height`, and non-degenerate | both |
| no two face UV rects overlap (full pairwise) | both |
| every outliner UUID string resolves to a real element | both |
| every element referenced **exactly once** in the outliner | both |
| element and group UUIDs unique | both |
| every animator key is a real group UUID | voidling |
| every keyframe `time` within `[0, length]` | voidling |
| no two keyframes on the same bone+channel at the same time | voidling |
| every `loop: "loop"` animation has keyframes at t=0 **and** t=`length` on every bone+channel, with matching `data_points` | voidling |
| every coordinate within `0..16` | resonator |
| every rotation single-axis | resonator |
| every rotation angle in {-45, -22.5, 0, 22.5, 45} | resonator |

Last run:

```
=== voidling ===
  . texture 64x64  uv scale 1.1 texel/unit  atlas occupancy 88.4%  bbmodel 250.7 KiB  png 9022 B
  . elements=20 groups=16 depth=6 faces=120 animations=3 animators=45 keyframes=222
  . bbox  X -8.5..8.5  Y 0..37.5  Z -5..5.25
  PASS  all checks green

=== resonator_block ===
  . texture 32x32  uv scale 0.8 texel/unit  atlas occupancy 82.4%  bbmodel 19.5 KiB  png 2547 B
  . elements=9 groups=3 depth=3 faces=54 animations=0 animators=0 keyframes=0
  . bbox  X 2.4..13.6  Y 0..14.5  Z 2.5..13.5
  PASS  all checks green

ALL CHECKS PASSED
```

### Negative testing

A green suite proves nothing unless the checks can actually fail, so I mutated the
finished models twelve ways and re-ran `verify()` on each. **All twelve were caught:**

| mutation | first failure reported |
|---|---|
| shift the `head` rotation value at t=3.2 | `idle/head/rotation: t=0 {...} != t=3.2 {...}` |
| set `pelvis.to[1]` below `from[1]` | `pelvis: to[1] < from[1]` |
| push a face UV to x2=999 | `flank_left.north: uv [...] outside 0..64/0..64` |
| copy one cube's `up` UV onto another | `uv overlap: flank_right.up vs yoke.up` |
| set `faces.down.texture` to 7 | `core.down: texture index 7 out of range` |
| drop a cube's UUID from its group's children | `element "flank_left" referenced 0 times (expected 1)` |
| re-key an animator to a UUID that is not a group | `walk: animator key deadbeef-… is not a group uuid` |
| move a keyframe to t=99 | `strike/root/position: time 99 outside 0..1` |
| corrupt 8 bytes of the embedded base64 | `embedded texture bytes differ from the standalone .png` |
| set a block coordinate to 17 | `plinth: to[0]=17 outside 0..16` |
| give `yoke` rotation `[22.5, 45, 0]` | `yoke: rotation uses more than one axis` |
| give `yoke` rotation `[0, 30, 0]` | `yoke: rotation angle 30 not in {-45, -22.5, 0, 22.5, 45}` |

Nothing failed on the final run. Two things *did* fail earlier and were fixed in the
geometry rather than in the checker — both found by eye in an orthographic raycast
preview I wrote as a throwaway, not by the assertions:

- The `horn` was leaving a 0.2-unit gap at the skull (its rotated inner-bottom corner
  landed at `x = -4.20` against a head edge at `x = -4.00`). Widened and sunk into the
  skull so the base is enclosed.
- `vent` was floating completely detached from the block, and `shard_tip` was buried
  under the `yoke` where nothing could see it. The fins are now bolted to the posts and
  mirrored, and the spire runs up through the yoke and out the top.

Worth noting as a lesson: **no assertion in the list above would have caught either
one.** "Is this cube attached to anything" and "is this cube visible" are not schema
properties. Rendering it and looking was the only thing that found them.
