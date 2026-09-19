# Vellum

A 3D model editor UI, built from the pencil sketches. React + Vite + TypeScript,
no UI framework, no component library, no WebGL.

```bash
pnpm install
pnpm dev             # http://localhost:5173
pnpm build           # dist/
pnpm build:single    # dist/vellum.html - one self-contained file
```

`build:single` folds the build into a single HTML file: every stylesheet and
module chunk inlined, the woff2 faces embedded as data URIs, the favicon along
with them. Nothing is fetched at runtime, so the result opens by double-click,
attaches to an email, or drops onto any static host. Pass `--fragment` for page
content without the `<html>/<head>/<body>` wrapper, for hosts that supply their
own document skeleton, and `--out <path>` to write somewhere other than `dist/`.

Two details it handles, both of which bite otherwise: non-ASCII is escaped to
`\uXXXX` so the page is correct even where a host serves it without a charset
declaration, and any absolute reference left un-inlined fails the build rather
than shipping a page that silently 404s its own assets.

## Screens

| Route | Sheet | What it is |
| --- | --- | --- |
| `#/` | sheet 3 | Dash. Fed by a plugin through the documented API; the built-in sample until one reports. |
| `#/projects` | sheet 2 | First scene. Pick a shelf: Items, or Mobs & Anim. |
| `#/projects/:scene/:shelf` | sheet 2 | The shared library panel. `< Back`, shelf tabs, **New model**, card grid, `< 1 2 3 >`. Cards are grouped by what each model is for. |
| `#/settings/:section` | sheet 1 | Search + section list, free sections above the `Manage` divider. |
| `#/editor/:sampleId` | - | The editor. Opens `.vellum`, imports `.bbmodel`, saves `.vellum`. |
| `#/editor/new/:kind/:subtype/:name` | - | The same editor, on a model built from the URL. This is where **New model** lands. |

## `.vellum` — the native model format

Every model this engine writes is a `.vellum`. A `.bbmodel` is an **import
source**: opening one and saving is the migration, and after that the model is a
`.vellum` forever. `src/lib/vellum.ts` implements the format; the `.bbmodel`
sources for the bundled samples are kept under `docs/blockbench/source` as the
import record only.

Not a zip and not a custom binary: a compact, key-ordered UTF-8 JSON document
with a Vellum-owned schema. The extension is ours; the encoding is JSON so
`git diff` on a model keeps working.

```
{"vellum":{"format":"model","version":5},"name":"voidling","kind":"mobs","subtype":"hostile","resolution":{…},"bones":[…],"cubes":[…],"textures":[…],"clips":[…],"behaviour":{…},"config":{…}}
```

Four properties are load-bearing, and the round-trip test asserts each rather
than trusting good intentions:

1. **No magic number.** Identity is the *first JSON key*, so a well-formed file
   begins byte-for-byte with `HEADER_PREFIX`.
2. **Key order is structural.** Top-level keys are written in schema order and
   faces are sorted, so a model whose faces reshuffle does not turn every diff
   into noise.
3. **Absent, never null.** Optional keys are omitted rather than written `null`.
4. **Upgrading is the reader's job,** in memory, on every read. The writer always
   stamps `CURRENT_VERSION` — never the version it was handed.

Two refusals, both by name rather than by failing somewhere in the middle of a
cube: a file from a **newer Vellum** than this one, which cannot be known to mean
what this one would assume; and a **foreign file** — no `vellum` header, or a
`format` that is not `model`.

### What a model says it is

Two fields, and they answer different questions.

**`kind`** is what the model *is* — `items`, `mobs` or `blocks`. It picks the
validation rules: a block is checked against the -16..32 range and its fixed
rotation angles, an item against the 16-unit slot it is rendered in.

**`subtype`** is what it is *for*, within its kind — a weapon, a tool, a
consumable or misc; a hostile, neutral or docile mob. It changes no geometry.
What it changes is which rules apply (a consumable with no use clip is a
consumable in name only; a hostile with no attack clip will swing on its idle),
where the card files itself on the shelf, and how the world view places it.

`consumables` used to be a fourth `kind`, which put it beside `items` as though
holding a potion were a different act from holding a sword. Version 3 split the
two questions apart, and the reader upgrades an old document in memory:
`kind: "consumables"` becomes `kind: "items", subtype: "consumable"`. That is
the same claim in a shape that can also describe a weapon.

A subtype the kind does not offer is dropped on read rather than carried.
Absent means *nobody said*, which every reader already handles; a nonsense
subtype is a claim nothing downstream could act on.

### Behaviours — what makes a block act on its own

A clip says **how** a model moves. It cannot say **when**, and for a block that
is most of the question. A geyser is not a model with a steam clip: it is a
model that sits quiet until there is water over lava beneath it, then charges
for a while, rumbles as it nears full, blows, and settles.

So `behaviour` is two things and nothing else:

- **`requires`** — offsets in whole blocks and what has to be at each. All of
  them, or none of it runs.
- **`stages`** — an ordered cycle. Each stage lasts a number of seconds, loops
  one of the model's own clips while it does, and may throw off particles, a
  sound or a shake. The cycle repeats while the requirements hold.

"Near full charge it rumbles" needs no special case — rumble is the stage before
the burst, and how long the charge runs is the charge stage's own duration.

The plugin checks the world and runs the clock. Vellum is the authoring half:
the shape, the rules, and a clock good enough to watch the thing work. The
Behaviour tab runs the cycle in the viewport; **View in the real world** runs it
on the field with its particles and its shake. `geyser_block.vellum` is the
worked example.

A behaviour on a mob is a warning rather than an error: a mob is animated by
what it is doing, not by the blocks around it, so nothing would read it.

### Config — what makes it a mob rather than a shape

A `.vellum` says what something looks like and how it moves. None of that
makes it a mob: 420 health, an armour value, a faction, a boss bar and a skill
on a timer is a boss, and every one of those lives in a
[MythicMobs](https://mythiccraft.io) config rather than in any geometry.
Modelling here and writing the config elsewhere is how the two drift apart —
the model says `geyser_block`, the config says `geyserblock`, and nothing
tells you.

So the config is authored beside the model, in a **Config** tab, and written
out of it. The YAML sits live in the middle of the editor while you fill the
form in, keyed by the model's own name, and leaves as a `.yml` or on the
clipboard.

**One description drives everything.** A field is declared once, in `SCHEMA`
(`src/lib/mythic.ts`), and the form, the rules and the YAML all read that same
declaration — which is why a key cannot appear in the editor and be missing
from the export, or be spelled two ways. Adding a field is adding a line to
the schema.

A mob covers identity and faction, stats, the options switches, the boss bar,
AI goal and target selectors, skills with triggers and chances, equipment,
drops, damage modifiers, level modifiers and kill messages. An item covers
material, display and lore, custom model data, amount, the options switches,
durability, enchantments, per-slot attributes, use skills and drop options.
Where MythicMobs offers a vocabulary — entity types, selectors, bar styles,
enchantments — the field carries it as *suggestions* rather than a closed
list, because a server with other plugins on it has more of them than we
could know.

Only what differs from MythicMobs' own default is written. A config of forty
defaults is forty lines of noise in every diff, and the plugin reads an absent
key as the default anyway.

The rules catch what a server would refuse before the server does: a mob with
no base entity, health that kills it on spawn, a boss bar over 30 health, goal
selectors that do not start with `clear` (and so add to the vanilla set rather
than replacing it), an equipment slot that is not one, a drop chance written
as 25 when MythicMobs reads 0 to 1, an enchantment with no level, an attribute
with no slot, a trigger that does not begin with `~`. An item with no custom
model data is a warning, because that number is the only thing tying a config
back to the model in the same file.

`voidling.vellum` ships as the worked example: a 420-health boss with a purple
segmented bar, fog, a threat table, three skills and a level curve.

### What the shape buys

| | `.bbmodel` | `.vellum` |
| --- | --- | --- |
| The tree | duplicated across `groups` + `outliner` | said **once**, as a `parent` id on each bone |
| `face.texture` | an array index, so reordering re-skins the model | a texture **id** |
| Animation | animators with mixed-channel keyframes | `clips` → `tracks` (one per bone-channel) → `keys` |
| Per keyframe | bezier scaffolding written even for linear keys | `time`, `value`, `interp` |
| Voidling on disk | 251 KB | **38 KB** |

Deliberately **not** in the file: no rig (regenerated on save), no pack models or
textures, no display transforms, no editor state, and none of Blockbench's
`meta` — carrying that would leave the document with two version numbers that can
disagree. The project **kind** (item / mob / block) lives in the project path
rather than the file, which is why block-format rules key off the project and not
a string inside the model.

### The codec API

```ts
import { readVellum, writeVellum, isVellum, VellumFormatError } from './lib/vellum'

const model = readVellum(text)      // throws VellumFormatError, by name
const bytes = writeVellum(model)    // always stamps CURRENT_VERSION
isVellum(text)                      // cheap sniff: does it start with {"vellum"
```

`src/lib/bbmodel.ts` keeps `parseBBModel` / `serializeBBModel` for the import and
interop paths, plus `validateModel(model, kind)` — the rules the editor refuses to
write past, including the Java block volume and its single-axis ±22.5°/±45°
rotation limit.

> The Studio's HTTP surface (`/api/mob/project`, the upload/apply pipeline, leases,
> identity) belongs to the plugin, not to this editor, and is not implemented
> here. This app reads and writes files.

## Support: ticketing and messaging

`#/settings/support` is a working ticket system, not a form. It runs against an
in-browser mock transport (`src/lib/api.ts` over the store in `src/lib/support.ts`),
so you can open a ticket, reply, and watch the thread answer back.

- **Tickets** - filter by status, full-text search over subjects, tags and message
  bodies, priority stripe and SLA countdown, status and priority editable from the
  thread header (each change appends a system message to the thread).
- **Messaging engine** - optimistic send (the bubble appears immediately as
  *sending*, then *sent* -> *delivered* -> *read*), delivery ticks, agent typing
  indicator, unread badges cleared on read, attachments, and retry on failure.
  Thread updates arrive over an event stream rather than by refetching.
- **New ticket** - subject, category, priority (urgent gated to paid tiers) and a
  description that becomes message #1.

### API

Base URL `/api/v1`, bearer token, JSON in and out. Every endpoint is declared in
`endpoints` in `src/lib/api.ts` — the in-app reference renders from that array, so
the docs cannot drift from what the client calls. Each control is also badged with
the endpoint it hits.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/tickets` | List. Filters: `status`, `priority`, `category`, `q`, `cursor`, `limit`. |
| `POST` | `/tickets` | Open a ticket; the description becomes its first message. |
| `GET` | `/tickets/{ticketId}` | Retrieve one, with current SLA state. |
| `PATCH` | `/tickets/{ticketId}` | Status, priority, assignee, tags. |
| `DELETE` | `/tickets/{ticketId}` | Archive (soft delete; messages retained). |
| `GET` | `/tickets/{ticketId}/messages` | Thread, oldest first, cursor paged. |
| `POST` | `/tickets/{ticketId}/messages` | Reply. Takes a `clientId` for idempotent retries. |
| `PATCH` | `/tickets/{ticketId}/messages/{messageId}` | Edit within 15 minutes. |
| `DELETE` | `/tickets/{ticketId}/messages/{messageId}` | Retract, leaving a tombstone. |
| `POST` | `/tickets/{ticketId}/read` | Mark read; clears the unread badge. |
| `GET` | `/tickets/{ticketId}/events` | SSE: `message.created`, `message.updated`, `ticket.updated`, `agent.typing`. |
| `POST` | `/tickets/{ticketId}/typing` | Composing signal, debounced to 3s. |
| `POST` | `/uploads` | `multipart/form-data`, max 25 MB, returns an attachment id. |
| `GET` | `/attachments/{attachmentId}` | 302 to a signed URL valid 5 minutes. |
| `GET` | `/support/categories` | Categories for the ticket form. |
| `GET` | `/support/agents` | Assignable agents on this plan. |
| `GET` | `/support/sla` | First-response target and queue position. |

Webhooks — `ticket.created`, `ticket.updated`, `ticket.resolved`, `message.created`
— are signed with `X-Vellum-Signature` (HMAC-SHA256 over the raw body), retried with
backoff for 24h until a 2xx, and deduplicated on the event id.

To point this at a real server, replace the bodies of the `api` methods with `fetch`
calls; the request and response shapes in `src/lib/support.ts` are already what the
endpoints above are expected to exchange.

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

## The stage

**View in the real world** used to be a world — a sky, a square sun, clouds,
stars and a grass field. It was the wrong idea. A modeller looking at a model
does not want a landscape competing with it, and a green field is a colour
cast over everything they are trying to judge.

So the stage is black and the floor is near enough black to disappear. What
survives is what was doing work rather than decoration:

- **The floor still travels.** A walk that covers no ground is the one thing
  the timeline cannot show you, so the model stands still and the ground moves
  under it at the speed the legs are asking for. A leg swinging `a` degrees
  about a pivot `r` from the foot sweeps a chord of `2r sin(a)`, and that chord
  is the ground a stride covers. An attack does not travel; an idle rocking a
  degree or two is not walking. Both fall out of the derivation.
- **One line per block**, dim. A floor that vanishes entirely takes the
  treadmill with it — a walking mob would look like a walking mob standing
  still — and the line doubles as the ruler it had to be anyway.
- **The two-block figure**, because nothing else in the game tells you how big
  something is. It is rigged and walks at the same speed, solving the same
  equation for its own leg length.

There is no day/night any more, because there is no sky to change. Black is
the dark theme: a glow reads as a glow without one.

## What works, and what does not

The editor edits. Geometry, textures, rigs, clips, behaviours, configs and the
file itself are all real: cubes and bones are added, resized, reparented and deleted;
paint lands on the sheet through the UV rectangle it belongs to; clips are keyed,
retimed and interpolated on a catmull-rom spline; and a model saves to and opens
from a real `.vellum` through the same codec the samples ship in. Undo and redo
cover all of it, and leaving a dirty editor asks first.

New models are made from the library shelf — **New model**, beside the tabs and
outside the pill — which picks a kind, then what it is for, and hands the editor
a URL it can rebuild from. A reload does not lose it.

The dashboard is fed rather than faked: it renders what a plugin has reported
through the documented API and the built-in sample until one does. Everything a
paid tier would unlock shows its layout with the controls inert, and says so.

Not wired, by design: anything that would need a server of our own. The plugin
API is documented and the transport is mocked; no request leaves the page unless
a plugin has been linked.
