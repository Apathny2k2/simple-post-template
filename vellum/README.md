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
It also carries over the boot screen inside `#root` and any plain inline
`<script>` from `index.html`, with non-ASCII in the markup written as entities.

Two details it handles, both of which bite otherwise: non-ASCII is escaped to
`\uXXXX` so the page is correct even where a host serves it without a charset
declaration, and any absolute reference left un-inlined fails the build rather
than shipping a page that silently 404s its own assets.

## Screens

| Route | Sheet | What it is |
| --- | --- | --- |
| `#/` | - | The home page, vellumdev.com: what Vellum is, the plans, and the way into the Studio. |
| `#/servers` | - | "What server would you like to enter?" The servers you own and your seats on other teams. |
| `#/dash` | sheet 3 | Dash. Fed by a plugin through the documented API; the built-in sample until one reports. |
| `#/projects` | sheet 2 | First scene. Pick a shelf: Items or Mobs. |
| `#/projects/:scene/:shelf` | sheet 2 | The shared library panel. `< Back`, shelf tabs, **New model**, card grid, `< 1 2 3 >`. Cards are grouped by what each model is for. |
| `#/settings/:section` | sheet 1 | Search + section list, free sections above the `Manage` divider. |
| `#/editor/:sampleId` | - | The editor. Opens `.vellum`, imports `.bbmodel`, saves `.vellum`. |
| `#/editor/new/:kind/:subtype/:name` | - | The same editor, on a model built from the URL. This is where **New model** lands. |

## Before the Studio: the home page and the server list

`#/` is the public page (`src/pages/Home.tsx`) and has its own header; the
Studio's top bar starts at the Dash. It shows what Vellum does, the three steps
to a first model in game, and the plans. The plans list seats, one for Free,
three for Pro and five for Studio Engineer, and leave paid prices off: those are
not settled, so the paid plans say they open soon. Its sections rise in as they
scroll into view, once, and under reduced motion they are simply there. The
footer carries the notice Mojang asks of anything built for Minecraft.

**Open the Studio** leads to `#/servers` (`src/pages/Servers.tsx`), which asks
which server to enter. Rows read like the game's own multiplayer list: an icon,
the name, the message of the day, the address, players and signal bars. The
servers you own come first, then your seats on other teams, each saying whose
team it is and what your seat lets you do. A server that is offline shows when
it was last seen and cannot be entered. With only one server to go to, the list
steps aside and goes straight in, replacing itself in history so Back does not
bounce through it.

The servers are a sample in `src/lib/servers.ts`, shaped like the answer the
account service should give. The one you enter is kept per browser, shown in
the Studio's top bar next to the logo, and a click on it goes back to the list.
Until a plugin reports its own name and address, the Dash's sample wears the
entered server's.

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
{"vellum":{"format":"model","version":7},"name":"voidling","kind":"mobs","subtype":"hostile","resolution":{…},"bones":[…],"cubes":[…],"textures":[…],"clips":[…],"behaviour":{…},"config":{…}}
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

### Box UV — the origin, not just the rectangles

Every cube writes all six face rects in full, so UV *positions* survive a round
trip on their own. What v5 did not carry was the origin a box unwrap was
generated from, nor whether it was mirrored — so a reader that regenerates the
unwrap rather than trusting the rects got a box-UV cube with nothing to
regenerate from. The plugin does regenerate, and found it.

Version 6 adds three optional keys: `uv_offset` and `mirror_uv` on a cube, and
`mirror_uv` on a bone. All three are absent unless set, and a v5 document
upgrades without gaining any of them — absent means *nobody said*, and
inventing `[0, 0]` would claim the unwrap starts at the corner of the sheet,
which is a different lie from saying nothing.

`uv_offset` is written whenever it is known, not only when `box_uv` is set.
Gating it on the flag would drop the offset on exactly the cube the field
exists for: one that arrived from a reader that had it, on a model the editor
then marked hand-UV.

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
on a timer is a boss, and not one of those is geometry. Modelling here and
writing the stats elsewhere is how the two drift apart — the model says
`geyser_block`, the config says `geyserblock`, and nothing tells you.

**This behaviour is ours to implement, not a third party's to read.** Vellum
replicates it in-house; there is no external plugin on the other end. That is
not a naming detail — it decides who owns every default and every range in the
schema. Nothing in it can be justified with *"that is what their docs say"*:
if a drop chance reads 0 to 1, it is because our runtime reads 0 to 1, and the
plugin half has to implement it.

**The vocabulary is ours too.** An earlier pass here borrowed MythicMobs'
spelling on the theory that operators would recognise it. That is settled the
other way now: for a config only our own runtime reads, a borrowed spelling
buys familiarity and costs a permanent translation layer, and it implies a
compatibility we do not have.

So `BossBar` and `~onTimer` skill lines are gone — not renamed, *gone*. They
named features with no counterpart, and a form that writes a key nothing
applies is worse than a form that omits it. What replaces them is what the
runtime actually implements: six structural keys, nine flags, eight goals.

So the config is authored beside the model, in a **Config** tab, and written
out of it. The YAML sits live in the middle of the editor while you fill the
form in, keyed by the model's own name, and leaves as a `.yml` or on the
clipboard.

**One description drives everything.** A field is declared once, in `SCHEMA`
(`src/lib/config.ts`), and the form, the rules and the YAML all read that same
declaration — which is why a key cannot appear in the editor and be missing
from the export, or be spelled two ways. Adding a field is adding a line to
the schema.

A mob covers identity (`base`, `display-name`, `model`), the nine flags
(`health` 0.5–1024, `movement-speed`, `scale`, and six switches), the AI goals
with their priorities and clips, and the two live animation states. An item
covers `display-name`, `model`, `lore`, `max-stack-size` and `durability`.

**A default is only real if something applies it**, so only two are claimed:
`health` is 20, and `movement-speed` deliberately has *none* — unset must stay
unset, or a bat-based mob and a golem-based mob stop keeping their own base
speeds. Everything whose default is unknown can say nothing at all: those
numbers are text fields where blank means inherit, and the switches are
tri-state rather than checkboxes. A checkbox cannot express "unset", and
guessing that unset means `false` would write `false` over a server default of
`true`.
Where a field offers a vocabulary — entity types, selectors, bar styles,
enchantments — it carries it as *suggestions* rather than a closed list,
because a server with other plugins on it has more of them than we could know.

Only what differs from the default is written. A config of forty defaults is
forty lines of noise in every diff, and the runtime reads an absent key as the
default anyway.

The rules catch what a server would refuse before the server does: a mob with
no base entity, health outside 0.5–1024, a speed outside 0–2 or one that is
not a number at all, a goal that is not one of the eight, a priority of 0
(excluded on purpose, so no config can outrank a mob's ability to swim) or
above 32, a clip hung on `vellum:target_nearest` which is the one goal that
carries none, goals with nothing to target, and an item `model` written as a
number — which is the habit the old vocabulary taught and which now names
nothing.

That last one matters more than it looks. On the server an unrecognised key is
an **error**, not a warning, and content is swapped in only when the whole
report is clean — one report spanning every kind. So a single bad mob holds
back every item, block and furniture piece on that server. Catching it here is
catching it before it becomes everyone's problem.

`voidling.vellum` ships as the worked example: a 420-health `WITHER_SKELETON`
that does not despawn, with four goals in priority order, a strike clip hung
on its melee goal, and idle and walk bound to its own animations.

### Where the file goes

**One directory per thing, and the directory name *is* the id.**

```
plugins/Vellum/mobs/<id>/mob.yml
plugins/Vellum/items/<id>/item.yml
```

This is not pedantry about layout. Discovery walks for *directories* and then
opens one fixed filename inside each; nothing anywhere lists `.yml` files in a
kind directory. So a flat `mobs/<id>.yml` — which is what this wrote until the
plugin side described the loader — is not a wrong path that errors. It is a
path no reader ever visits: copied to disk, never opened, never diagnosed.
Silence is the worst failure mode available, and it is why that one was worth
being told rather than guessed.

Two more that bite. A content file's root takes **exactly two keys**,
`config-version: 1` and that kind's collection key — every other root key is an
error. And a mob's collection key is **`entities`, not `mobs`**: the directory
moved at some point and the key did not.

`entities` is confirmed. `items` is *not* — it is inferred from the directory
name, and the mob case is the proof that inference is unsound. So an item
config is previewed with the caveat written into the file and is held out of
the export until the plugin confirms it, because a root key the parser refuses
is exactly the error that holds back everything else on the server.

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

`#/settings/support` is a working ticket system. It runs against an in-browser
mock transport (`src/lib/api.ts` over the store in `src/lib/support.ts`), so you
can open a ticket, reply, and watch the thread answer back. The page says so
under its title.

It is kept to what someone filing a ticket needs. An earlier version carried a
notice banner, a stats row, a tier chip, filter tabs for all four statuses, tags,
an SLA chip and status and priority selects on every thread, and opened new
tickets in a dialog with four fields. All of that is gone or folded into the
pieces below.

- **The list** - Open (open and pending) and Closed (resolved and closed) tabs
  with their counts, and a search that also reaches message text. A row is two
  lines: the subject, then the status, the priority when it is high or urgent,
  who has it and when it last moved. Unread replies show as a count.
- **A thread** - the subject, a line of status, id and assignee, and one action:
  Mark resolved, or Reopen. Messages are grouped by author, with the time under
  the last of each run; system events are a small centred line. The reply box
  grows with its text, Enter sends, and the clip opens a real file picker (the
  mock keeps the name and size). A closed ticket has to be reopened to reply.
- **Messaging engine** - optimistic send (the bubble appears at once as
  *sending*, then *sent*, *delivered* and *read*), unread counts cleared while a
  thread is open, retry on failure. Updates arrive over the event stream rather
  than by refetching. Whoever answers an unassigned ticket takes it.
- **New ticket** - one text box. Its first line, up to the first full stop, is
  the subject, and the header and the list's draft row show it as you type.
  Chips say what it is about, and Blocking my work files it as high. Closing the
  form keeps the draft. The form is `src/components/TicketForm.tsx`, and Report
  A Bug uses the same one with a chip for the session log.
- **On a phone** the list and the thread take turns, with a back arrow.
- **Pip** mines while a new ticket is on its way and goes through the portal
  before the thread opens. While someone on the team is writing he fishes where
  their reply will appear, and it shows once he has landed a letter (see
  *Waiting has Pip* below).

### API

Base URL `/api/v1`, bearer token, JSON in and out. Every endpoint is declared in
`endpoints` in `src/lib/api.ts`, beside the client method that calls it, and each
method names its endpoint in a comment.

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

Two surfaces and no theme toggle. The editor sits on **paper**, a warm-grey
field defined in `src/styles/tokens.css`. Every other page is a dark room,
described at the end of this section. The paper replaced a midnight navy theme
(see `SPEC-light-theme.md`), which is why its grey ramp is still named `navy`.
Only four of its fifteen steps are used.

Three rules hold the look together, and they are written at the top of
`tokens.css` because every decision below falls out of them:

1. **A line does the work a shadow used to.** `--shadow-sm` resolves to
   `none` and `--shadow` to a single hairline's worth of lift, so panels get
   an edge instead of a bloom. Real depth
   survives only where something genuinely floats: menus, popovers, dialogs.
2. **Nothing is a pill.** Radii top out at 8px and most controls sit at 3-4px.
   `--r-pill` resolves to 4px rather than 999px, so the toggles, chips and tab
   groups that name it come out cut instead of moulded.
3. **Red is structural.** It marks the one thing that is active or the one
   thing that is wrong, and nothing else.

**Liquid glass, thinned.** Every surface above the background is still the same
recipe: a translucent tint, a `backdrop-filter` blur that saturates what it
samples, and a rim. But the blur is 14px rather than 28px - a heavy blur turns
whatever is behind it to fog, which is the opposite of sharp - and the rim is a
crisp dark hairline rather than a lit bevel with a specular sheen over it.
`--sheen` resolves to `none`.
The one panel that is *not* glass is the config listing: it covers the viewport
and you read it line by line, and at 98% the model behind it still ghosted
through as a grey cloud over the code.

**The ground is ruled, not lit.** `body::before` was four radial gradients
drifting on a 34-second loop; glass over a moving wash never settles, and at
any moment it looked like a smear rather than a surface. It is now a flat field
with one fine 64px grid ruled across it - the right texture for an app whose
subject is built on a grid of 16 units to the block - and `body::after` lays a
fainter grain over it.

**Two vocabularies for "on".** A segment that is merely switched on (a mode
tab, a view toggle, a UV face, a filter, a pager page) reads as a filled
neutral segment: `--well-deep` behind `--ink`, on a `--line-strong` hairline.
The accent is spent only on what you have *selected* - the outliner row, the
texture, the open ticket - as one flat `--accent-soft` fill with a 2px accent
rule down its left edge, and on the active tool and the one primary button per
screen, which are solid `--accent`. Before this split, a default editor session
lit eight things in red at once, which is the same as lighting none.

**Short, no overshoot.** One curve, `cubic-bezier(0.2, 0, 0, 1)`, at 90/140/220
ms. The three spring tokens are gone along with their callers: 59 decorative
hover and press transforms were removed outright, because a button that rises
off the page on hover and shrinks when pressed is a toy. Entrances fade rather
than scale. What motion remains does work: the switch knob throws, the panel
chevron swings, the world stage shakes.

**Contrast is measured, not eyeballed**, and measured against the *translucent*
panel rather than `#fff` - a swatch check against white overstates the headroom
by about half a point, because the panel is white over a tinted ground.
`scripts/contrast-audit.mjs` walks every route against a dev server and reports
text runs under 4.5:1; it reads zero on all five.

Three notes on `backdrop-filter`, all of which bit during the build:

- An ancestor with `backdrop-filter` becomes the *backdrop root*, so a popover
  inside the menu bar or the library panel samples nothing and a thin tint
  renders see-through. Menus are therefore near-opaque by design.
- `height: 100%` collapses to zero when the parent's height comes from
  `min-height` or flex sizing rather than a definite height, so `.scene3d`
  fills its parent by `inset` instead.
- Write `backdrop-filter` on its own. The build minifies CSS with Lightning
  CSS, which adds `-webkit-backdrop-filter` for Safari by itself. When the
  source also carries a prefixed line after the standard one, the minifier
  keeps only the prefixed line, which Chrome and Firefox ignore. For a while
  every glass surface in the bundle drew no blur while the dev server, which
  does not minify, still showed it.

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

**The studio is a dark room; the editor stays on paper.** The Dash, Projects and
Settings take after Blockbench: grey-blue panels, one bright blue, the axis
colours, and the studio's own models turning on a disc at the top of the Dash.
There is no second copy of the styles. `App` sets `data-surface="dark"` on
`<html>` for every route but the editor, and `src/styles/studio.css` re-points
the app's tokens under that selector, so the top bar, cards, menus, fields and
dialogs go dark and come back when you open a model. The paper's red accent
becomes blue there, except where red meant something was wrong: destructive
menu items, urgent tickets and failed messages keep a warning colour. The rules
above bend in the dark on purpose: panels are rounded and lit under the pointer,
titles drop in a letter at a time, motion springs, and on the Dash the
turntable, the adoption ring, the file stacks and the plugin timeline all move.
Settings plays its entrance once, when you arrive: moving between its sections
swaps the title and the cards in place, with no cross-fade, because replaying
it on every click got in the way. Under reduced motion every loop stops and
nothing is staggered.

White text on Blockbench's `#3e90ff` measures 3.2:1, so filled buttons use a
deeper `#2a6ad8` and the bright blue is kept for light and lines. The contrast
audit reads every page in the state it ships in.

The turntable turns on a JavaScript clock, and the axis gizmo in its corner
reads the same yaw, so the two cannot drift apart.
`ModelView` takes a `yaw` prop for this. The clock stops while the hero is
scrolled out of view.

**Pages cross-fade.** `useRoute` wraps each route change in a view transition
and flushes the update inside its callback. The page fades up into place, the
top bar holds still, and the nav's active marker slides from one link to the
next, because the marker is its own element with its own
`view-transition-name`. Without the API, or with reduced motion on, the page
simply swaps.

**Waiting has Pip.** `src/components/Pip.tsx` is the studio's loading scene,
drawn in one colour after the offline dinosaur game: a horizon line, a couple
of clouds, and a small miner in a hard hat called Pip, Vellum's mascot. He is
only on screen while something runs. For work that runs he mines the block in
front of him; when a block breaks the next one rises out of the ground a few
steps on. When the answer comes he lands the swing he is on, then:

- on success a portal rises ahead and he fades into it, leaving a check mark;
- on a refusal (the request worked, the content did not pass) a wall rises, he
  walks into it and sits down under a rain cloud;
- on an error the ground opens into lava and he walks in; his pickaxe lands on
  the far bank.

For waiting on a person rather than a job, `scene="fish"` puts him on a bank
with his legs over the edge and a rod in his hands. The float rides the water,
and now and then something nibbles and tugs it under. When the answer comes,
something bites: a mark pops over his head, he strikes, and a letter comes up
out of the water to hang over his hat, which takes a second or two. If it
fails the line snaps and he slumps under a rain cloud.

The result is held back until the ending has played, then the scene goes and
the message takes its place. It is used by Apply on the server, which sits in
the Dash's Players card; by Report a bug in Settings; by the pack builder in
Export pack, where a cancelled save is the wall and a failed one is lava; and
by Support, where he mines while a new ticket is sent and goes through the
portal before its thread opens, and fishes in the thread while someone on the
team is writing, their reply appearing once he has landed the letter. While
the demo server runs it answers Apply too, swapping, refusing and failing in
turn.

It is drawn by hand in `src/lib/pip/`: `figure.ts` is Pip himself, `mine.ts`
and `fish.ts` are the two scenes, and `scene.ts` holds what they share. One
canvas pixel per art pixel, scaled up by a whole number so pixels stay square,
in the text colour of wherever it sits, and limbs that swing by
nearest-neighbour rotation so they never blur. The
art is our own. Under reduced motion there is no ending to wait for and the
result shows at once, and a result is never held back more than six seconds.

While he works a short line sits under him, from `src/lib/pip/quips.ts`
("Snapping to the nearest 22.5 degrees."), and it changes each time he breaks a
block or something nibbles. The mining lines are real rules in the app, so keep
them true. Under reduced motion one line stays put. The drawing and the line are
hidden from screen readers. Where nothing beside him says what is happening,
his `label` does, as a status: "Sending the report", "Building the pack".

The boot screen is Pip too. `scripts/make-boot.mjs` draws one swing at a block
with the mining scene's own code and writes it into `index.html` as a sprite,
inside `#root`, so React's first render replaces it. It fades in after 150ms,
so a quick load never shows it. A small script before it marks every page but
the editor as dark, so a dark page doesn't flash light while the app loads.

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

There is no day/night any more, because there is no sky to change. The stage
stays black even inside the paper editor: a texture is judged
against a neutral dark field, and on white every pale texel disappears into
the page. Its frame does not - the dialog's chrome is light, and only the
stage between the two bars is black.

## Into the game

A `.vellum` is not a Minecraft file and never was. The editor affords a bone
tree, arbitrary rotations and a sheet of any size; a Minecraft model file
affords none of those. `src/lib/mcmodel.ts` is where the two meet, and the
more valuable half of it is not the conversion — it is the refusal.

### What the model format will not let you say

Four constraints, none of them ours:

- **There is no hierarchy.** Elements are flat in model space. A bone is a
  thing the editor has and the file does not.
- **An element rotates once** — one axis, one origin, one of exactly five
  angles: `-45, -22.5, 0, 22.5, 45`.
- **There is no inflate.** A cube grown by 0.25 has to be grown in its
  coordinates before anyone looks at them.
- **Coordinates live in `-16..32`**, and that is after the inflate above.

So a model can be perfectly good here and impossible to express there, and
the honest thing is to say which cube and why *before* the pack is built
rather than let the game reject the pack with no useful message.
`checkTranslation(model, kind, target)` walks the model and reports:

- `chainOf()` collects the non-zero rotations along a cube's bone chain. Two
  pivots, or two axes, is an **error** naming the bone — not a silent flatten
  that moves geometry somewhere the modeller did not put it.
- An angle off the five is a **warning** carrying the nearest legal one, so
  the fix is one click rather than a puzzle.
- An element outside `-16..32` after inflate is an **error**, and it says so
  in the axis that broke.

One case earns its own branch: **a single bone rotation with no cube rotation
under it is fine.** One pivot is exactly what an element affords, so that
rotation becomes the element's own — `{"origin": [...], "axis": "y", "angle":
22.5}` — instead of being reported as an impossibility. Anything the editor
can legally draw that the format can legally hold, translates.

### Two destinations, two verdicts

The same geometry is not equally impossible everywhere, and this took a
correction from the plugin side to get right.

A **group rotation never goes in the model file at all.** The plugin applies
it as the bone's *rest rotation*, at runtime, on the display carrying that
bone; cube rotations stay raw inside the model exactly as authored. Out-of-
range geometry is the same story — an over-reaching bone is divided down and
the divisor recorded on it, multiplied back into that one display's scale.

So arbitrary bone rotation is expressible on a linked server and impossible
in a pack. Reporting it as a flat error was wrong about half the time.
`target` decides:

- **`pack`** — a model file, alone, on a vanilla client. Every refusal
  stands, and `buildPack` skips a model that earns one.
- **`any`** — the editor's own view, which cannot know whether a server is
  linked. A bone-level problem is a warning naming the mechanism that
  handles it, not a fault.

What does not move is the cube-level limit: one axis, one of five angles.
That goes in the file on both paths.

The check runs in the Validation panel beside the model's other rules, so it
is not something you go and ask for.

**Mobs are left out of the pack.** A resource pack can't hold a custom entity
model, so the plugin draws mobs in game. `buildPack()` names each mob it leaves
out.

### The zip

`src/lib/zip.ts` writes a **store-only** archive — method 0, real CRC-32, DOS
timestamps. Not laziness: a pack is mostly PNGs, which are already
compressed, so deflate would buy a few percent and a dependency.

`src/lib/pack.ts` lays out what goes in it:

```
pack.mcmeta
assets/<namespace>/items/<id>.json          <- what points at it
assets/<namespace>/models/<folder>/<id>.json
assets/<namespace>/textures/<folder>/<id>.png
```

The item definition is the file that makes the rest reachable. A model under
`models/` is geometry nothing in the game references; since 1.21.4 an item
whose `minecraft:item_model` component is `<ns>:<id>` renders whatever this
file names. Without it the pack loads without complaint and the item keeps
its vanilla look — the failure hardest to tell from "the pack didn't
install". The pre-1.21.4 `overrides` array on `custom_model_data` is
deliberately not written: the cutoff is sharp and the target is above it.

`pretty()` is not cosmetic either. `JSON.stringify(v, null, 2)` puts every
component of every vector on its own line, which turned the seven samples
into 16 KB of column; keeping number arrays inline reads as coordinates and
costs 8.8 KB instead.

**`pack_format` defaults to 84** — what the plugin's own generator reads out
of 26.1.2's `version.json`, rather than a number from memory. It stays a
field rather than a constant because a newer version declares higher and a
stale constant here would be a confident lie instead of an open question. It
is a single integer per Minecraft version and a wrong one fails the whole
pack to load with nothing said about why.

**This export is for the standalone case.** A server running the Vellum
plugin has the plugin build and serve its own pack, with the hash in the URL
so client caches stay correct; two pipelines that can disagree would be worse
than one. The free tier has no plugin and no other way to get a pack at all,
and that is who this is for. The dialog says so.

Two things ship that a pack cannot hold, and both are deliberate.

**Display transforms.** `.vellum` carries none — the Display tab is a preview
and says so — but a model file with no `display` block and no `parent`
renders at raw model scale, which for a 16-unit item is a speck in the hand
and a speck in the inventory. So the export writes Minecraft's own defaults
rather than nothing, and the dialog says that is what it is doing.

**Configs go in a second zip, not in the pack.** A config is how a mob becomes
a thing in the game, and Minecraft never reads it — the Vellum plugin does.
Folding it into the pack would invite dropping the whole archive in the wrong
place, and Minecraft would say nothing at all about the files it ignored. The
paths inside it — `mobs/<id>.yml`, `items/<id>.yml` — are the ones the Config
tab already names, so the download matches what the panel said it was, and
they are relative because where they land on a server is the plugin's
convention to set rather than ours to assume. A model with nothing configured
is left out rather than shipped as an empty stub.

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

A pack comes out of the same shelf — **Export pack**, beside it — as a real
zip with real model JSON in it, and the editor refuses to build one out of a
model Minecraft could not hold, naming the cube and the reason. Configs come
out beside it as their own archive. That is done end to end; what the plugin
wants for a mob's *geometry* is not ours to invent, so no model file is
emitted for one.

The dashboard is fed rather than faked: it renders what a plugin has reported
through the documented API and the built-in sample until one does. Everything a
paid tier would unlock shows its layout with the controls inert, and says so.

Not wired, by design: anything that would need a server of our own. The plugin
API is documented and the transport is mocked; no request leaves the page unless
a plugin has been linked.
