# Vellum

A Minecraft model studio in the browser, built from pencil sketches. React +
Vite + TypeScript, no UI framework, no component library, no WebGL.

```bash
pnpm install
pnpm dev             # http://localhost:5173
pnpm build           # dist/
pnpm build:single    # dist/vellum.html - one self-contained file
```

`build:single` folds the build into one HTML file. Every stylesheet and module
chunk is inlined, and the woff2 fonts and the favicon are embedded as data URIs.
Nothing is fetched at runtime, so you can open the file by double-click, attach
it to an email or put it on any static host. Pass `--fragment` for the page
content without the `<html>/<head>/<body>` wrapper, for hosts that supply their
own document skeleton. Pass `--out <path>` to write somewhere other than
`dist/`. The boot screen inside `#root` and any plain inline `<script>` from
`index.html` come along too, with non-ASCII in the markup written as entities.

Non-ASCII in the scripts is escaped to `\uXXXX`, so the page stays correct where
a host serves it without a charset declaration. An absolute reference left
un-inlined fails the build, so a page that 404s its own assets never ships.

## Screens

| Route | Sheet | What it is |
| --- | --- | --- |
| `#/` | - | The home page, vellumdev.com: what Vellum is, the plans, and the way into the Studio. |
| `#/login` | - | The sample sign-in. |
| `#/servers` | - | "What server would you like to enter?" The servers you own and your seats on other teams. Needs someone signed in. |
| `#/dash` | sheet 3 | Dash. Fed by a plugin through the documented API; the built-in sample until one reports. |
| `#/projects` | sheet 2 | First scene. Pick a shelf: Items or Mobs. |
| `#/projects/:scene/:shelf` | sheet 2 | The shared library panel. `< Back`, shelf tabs, **New model**, card grid, `< 1 2 3 >`. Cards are grouped by what each model is for. |
| `#/projects/:scene/:shelf/new` | sheet 2 | The same panel with the **New model** dialog open. |
| `#/settings/:section` | sheet 1 | Search + section list, free sections above the `Manage` divider. |
| `#/editor/:sampleId` | - | The editor. Opens and saves `.vellum`. |
| `#/editor/new/:kind/:subtype/:name` | - | The same editor, on a model built from the URL. This is where **New model** lands. |

## Before the Studio: the home page and the server list

`#/` is the public page (`src/pages/Home.tsx`) and has its own header; the
Studio's top bar starts at the Dash. It shows what Vellum does, the three steps
to a first model in game, and the plans. The plans list seats, one for Free,
three for Pro and five for Studio Engineer, and leave paid prices off: those are
not settled, so the paid plans say they open soon. The footer carries the notice
Mojang asks of anything built for Minecraft.

**Sign in**, and **Open the Studio** for a visitor, lead to `#/login`
(`src/pages/SignIn.tsx`). It is a sample: the demo account is filled in, any
email and password work, and nothing leaves the page. The name and email are
kept in `localStorage` (`src/lib/session.ts`); the password is never kept. The
account chip in each header shows the name and has **Sign out**. Signing in
replaces the form in history, so Back from the Studio goes home.

Then `#/servers` (`src/pages/Servers.tsx`) asks which server to enter. Rows
read like the game's own multiplayer list: an icon, the name, the message of
the day, the address, players and signal bars. The servers you own come first,
then your seats on other teams, each saying whose team it is and what your seat
lets you do. A server that is offline shows when it was last seen and cannot be
entered. With only one server to go to, the list steps aside and goes straight
in, replacing itself in history so Back does not bounce through it.

### Entering a server

Entering a server plays a scene over the server list (`src/components/Arrival.tsx`,
`src/lib/pip/arrive.ts`), drawn after a sketch from the operator. There is no
backdrop: only the scene is drawn, and the list shows through. A ground line
runs out across the middle of the screen, along a gap between two rows of the
list rather than through one. Pip, in a light tint of the server's colour and
with a dark rim so he reads over any page, walks along it towards a round
purple swirl that grows on the line in front of him: three arms turning round
a white-hot middle, with sparks pulled round and in. When he reaches it he is
pulled in, turning and shrinking towards its middle.

Then the Studio opens out of the swirl. The router's view transition reveals
the Dash in a circle that grows from the swirl's middle (`openStudio` in
`src/lib/arrival.ts` sets the point, `Arrival.css` has the animation), while
the swirl swells a little and shuts with a flash. The Dash takes a moment to
draw, and the page cannot paint while it does, so the swirl waits: it stays
open until the Dash is on screen and shuts while the circle grows. Skip, a
click or Escape ends the scene early. Unlike Pip's other scenes this one is in
colour, so it has its own RGBA buffer, and each frame depends only on the time
and on when the Dash was drawn, which lets a test draw any moment.

Then the server's name shows in the middle of the screen for three seconds,
the way the game shows a title, with its message of the day under it
(`src/lib/title.ts`). The letters are Vellum's own 5x7 set, drawn bold with a
stepped edge three pixels deep and a dark outline, after the way the game's
logo is built. The colours are generated per server: the icon's hue, a second
hue a random distance from it, and a grain, all seeded by the server's id, so
a server keeps its title and no two look alike. The page underneath dims and
stays usable. With reduced motion there is no walk: the Dash opens at once and
the title shows without moving.

A server entered this way is live: the demo server runs for it under the
server's own name and address, on every page, until **Stop demo** is pressed on
the Dash or you sign out (`useDemoServer` in `src/pages/dash/demo.ts`).

The servers are a sample in `src/lib/servers.ts`, shaped like the answer the
account service should give. The one you enter is kept per browser, shown in
the Studio's top bar next to the logo, and a click on it goes back to the list.
Until a plugin reports its own name and address, the Dash's sample wears the
entered server's.

## The `.vellum` format

Every model Vellum opens or writes is a `.vellum`, implemented in
`src/lib/vellum.ts`. Vellum does not read `.bbmodel`. The first samples were
migrated from Blockbench files, and those sources have been removed.
`voidling.vellum` and `resonator_block.vellum` are still the migrated files. The
other six samples are built by `scripts/make-samples.mjs`.
`docs/archive/blockbench/` keeps the research notes.

A `.vellum` is UTF-8 JSON on one line, with a Vellum-owned schema. The
extension is ours.

```
{"vellum":{"format":"model","version":7},"name":"voidling","kind":"mobs","subtype":"hostile","resolution":{…},"bones":[…],"cubes":[…],"textures":[…],"clips":[…],"behaviour":{…},"config":{…}}
```

The format follows these rules:

1. **No magic number.** Identity is the *first JSON key*, so a well-formed file
   begins byte-for-byte with `HEADER_PREFIX`.
2. **Key order is fixed.** Keys are written in schema order, and faces and
   keyframes are sorted, so the same model always writes the same bytes.
3. **Absent, never null.** An optional key with no value is left out of the
   file.
4. **Upgrading is the reader's job,** in memory, on every read. The writer always
   stamps `CURRENT_VERSION`, whatever version it was handed.

The reader refuses these files up front, before it reads a cube, with a
`VellumFormatError` that says what is wrong:

- a file from a **newer Vellum**, because this version cannot know what the
  newer one meant by it;
- a **foreign file**: no `vellum` header, or a `format` that is not `model`.

### Box UV

Every cube writes all six face rects in full, so UV *positions* survive a round
trip on their own. A reader that regenerates a box unwrap also needs the origin
the unwrap was generated from, and whether it was mirrored. Version 5 stored
neither, and the original plugin regenerated the unwrap. So version 6 adds three optional keys:
`uv_offset` and `mirror_uv` on a cube, and `mirror_uv` on a bone.

All three are absent unless set, and a v5 document upgrades without gaining any
of them. Absent means *nobody said*. Writing `[0, 0]` would claim that the
unwrap starts at the corner of the sheet, which nobody said.

`uv_offset` is written whenever it is known, even when `box_uv` is off. Tying it
to the flag would drop the offset on the cube it exists for: one that came from
a reader that had it, on a model the editor then marked hand-UV.

### What a model says it is

`kind` and `subtype` answer different questions.

**`kind`** is what the model *is*: `items`, `mobs` or `blocks`. It picks the
validation rules. A block is checked against the -16..32 range and the fixed
rotation angles. An item is checked against the 16-unit slot it is rendered in.

**`subtype`** is what it is *for*, within its kind. An item is a weapon, a tool,
a consumable or misc. A mob is hostile, neutral or docile. Changing it leaves the
geometry alone, though a new consumable starts from a flask. The subtype
changes which rules apply (a consumable needs a use clip, and a
hostile mob with no attack clip attacks on its idle), where the card is filed on
the shelf, and how the world view places the model.

Before version 3, `consumables` was a fourth `kind`. Version 3 made it an item
subtype, since holding a potion is the same act as holding a sword. The reader
upgrades an old document in memory: `kind: "consumables"` becomes
`kind: "items", subtype: "consumable"`.

A subtype the kind does not offer is dropped on read. Every reader already
handles a missing subtype, and nothing downstream could act on a wrong one.

### Behaviours

A clip says **how** a model moves. It cannot say **when**, and for a block that
is most of the question. A geyser sits quiet until there is water over lava
beneath it. Then it charges for a while, rumbles as it nears full, blows, and
settles. A steam clip on its own cannot describe that.

A `behaviour` holds `requires` and `stages`, and nothing else:

- **`requires`**: offsets in whole blocks, and the block that has to be at
  each. If any of them is missing, none of the behaviour runs.
- **`stages`**: an ordered cycle. Each stage lasts a number of seconds and
  loops one of the model's own clips while it runs. It may also give off
  particles, a sound or a shake. The cycle repeats while the requirements hold.

"Near full charge it rumbles" needs no special case. The rumble is the stage
before the burst, and the charge lasts as long as the charge stage does.

In game, the plugin checks the world and runs the clock. Vellum is the
authoring half: the shape, the rules, and a clock good enough to watch it work.
The Behaviour tab runs the cycle in the viewport. **View in the real world**
runs it on the stage, with its particles and its shake. `geyser_block.vellum`
is the worked example.

A behaviour on a mob raises a warning. Nothing would read it: a mob is animated
by what it is doing, and the blocks around it play no part.

### Config

A `.vellum` says what something looks like and how it moves. None of that makes
it a mob. 420 health, a base entity, a name plate and a list of AI goals make a
boss, and none of those is geometry. If you model here and write the stats
somewhere else, the two drift apart: the model says `voidling`, the config says
`void_ling`, and nothing tells you.

**Vellum's own plugin reads the config.** No third-party plugin sits on the
other end, so Vellum owns every default and every range in the schema, and none
of them rests on someone else's docs. If a drop chance reads 0 to 1, that is
because our runtime reads 0 to 1, and the plugin half has to implement it.

**The vocabulary is ours too.** The config does not borrow MythicMobs'
spelling. Only our own runtime reads it, so a borrowed spelling would buy
familiarity at the cost of a permanent translation layer, and it would suggest a
compatibility Vellum does not have.

The config has no `BossBar` or `~onTimer` skill lines. They named features the
runtime does not have, and a form should not write a key that nothing applies.
The form covers what the runtime implements: three identity keys, nine flags,
the goal list with its eight goals, and two animation states.

You write the config beside the model, in the **Config** tab. While you fill in
the form, the YAML shows live in the middle of the editor, keyed by the model's
own name. You can save it as a `.yml` or copy it to the clipboard.

**Each field is declared once**, in `SCHEMA` (`src/lib/config.ts`). The form,
the rules and the YAML all read that declaration, so a key cannot appear in the
editor and be missing from the export, or be spelled one way in the form and
another in the file. To add a field, add a line to the schema.

A mob config covers identity (`base`, `display-name`, `model`), the nine flags
(`health` 0.5–1024, `movement-speed`, `scale` and six switches), the AI goals
with their priorities and clips, and the two live animation states (`idle` and
`walk`). An item config covers `display-name`, `model`, `lore`,
`max-stack-size` and `durability`.

A goal is written as one line with its parts separated by spaces
(`melee_attack 2 animation.voidling.strike`), so a clip name can't hold a
space. The form turns a typed space into `_`, in clip names and in goal
cells alike.

**Defaults.** The schema states a default only where the runtime applies one:
`health` is 20, and `movement-speed` has *none*. An unset speed must stay unset,
or a bat-based mob and a golem-based mob stop keeping their own base speeds.
Any field whose default is unknown can be left empty. Those numbers are text
fields where blank means inherit, and the switches are tri-state (blank, `true`
or `false`). A checkbox cannot express "unset", and treating unset as `false`
would write `false` over a server default of `true`.

Entity types are offered as *suggestions*, and you can type one that is not on
the list. A server with other plugins on it has more of them than Vellum could
know.

Only values that differ from the default are written. The runtime reads an
absent key as the default anyway, and a config of forty defaults would be forty
lines of noise in every diff.

The rules catch what a server would refuse, before the server sees it:

- a mob with no base entity;
- health outside 0.5–1024;
- a speed outside 0–2, or one that is not a number;
- a goal that is not one of the eight;
- a priority of 0 or above 32 (0 is not allowed, so that no config can outrank a
  mob's ability to swim);
- a clip on `vellum:target_nearest`, the goal that cannot play one;
- goals with no `vellum:target_nearest`, so nothing picks a target;
- an item `model` written as a number. The model is a resource key such as
  `vellum:runic_blade`, and a custom-model-data number names nothing.

On the server an unrecognised key counts as an **error**, and content is swapped in only when the whole report is
free of errors. One report covers every kind, so a single bad mob holds back
every item, block and furniture piece on that server.

`voidling.vellum` ships as the worked example: a 420-health `WITHER_SKELETON`
that does not despawn, with four goals in priority order, a strike clip on its
melee goal, and idle and walk bound to its own animations.

### Where the file goes

**Each mob or item gets its own directory, and the directory name *is* the
id.**

```
plugins/Vellum/mobs/<id>/mob.yml
plugins/Vellum/items/<id>/item.yml
```

The original plugin's loader looked for *directories*, then opened one fixed
file name inside each. Nothing listed `.yml` files in a kind directory, so a
flat `mobs/<id>.yml` did not fail with an error. No reader ever visited it: it
was copied to disk, never opened, and never reported.

A content file's root took **exactly two keys**: `config-version: 1` and that
kind's collection key. Any other root key was an error. A mob's collection key
is **`entities`**, even though its directory is `mobs/`.

The original plugin confirmed `entities` for mobs and `items` for items, so both
export. Blocks have no confirmed key and no config form, so a block has no
Config tab and is left out of the config export. A root key the parser refuses
would hold back everything else on the server. None of this has been checked
against the rewritten plugin yet.

### What the shape buys

| | `.bbmodel` | `.vellum` |
| --- | --- | --- |
| The tree | duplicated across `groups` + `outliner` | said **once**, as a `parent` id on each bone |
| `face.texture` | an array index, so reordering re-skins the model | a texture **id** |
| Animation | animators with mixed-channel keyframes | `clips` → `tracks` (one per bone-channel) → `keys` |
| Per keyframe | bezier scaffolding written even for linear keys | `time`, `value`, `interp` |
| Voidling on disk | 251 KB | **39 KB** |

The file holds no rig (`readRig` works one out from the bone names when it is
needed), no pack models or textures, no display transforms, no editor state, and
none of Blockbench's `meta`. Carrying `meta` would give the document two version
numbers that can disagree. The file does carry the model's `kind`. Blockbench
marks a block model with a format (`java_block`); a `.vellum` has no such
field, so the block rules key off `kind`.

### The codec API

```ts
import { readVellum, writeVellum, isVellum, VellumFormatError } from './lib/vellum'

const model = readVellum(text)      // throws VellumFormatError, by name
const bytes = writeVellum(model)    // always stamps CURRENT_VERSION
isVellum(text)                      // cheap sniff: does it start with {"vellum"
```

`validateModel(model, kind)` in `src/lib/model.ts` holds the editor's rules,
including the Java block volume and its single-axis ±22.5°/±45° rotation limit.
Its errors and warnings show in the Validation panel. They do not block a save.

> The Studio's HTTP surface (`/api/mob/project`, the upload/apply pipeline, leases,
> identity) belongs to the plugin and is not implemented here. This app reads and
> writes files.

## Support: ticketing and messaging

`#/settings/support` is a working ticket system. It runs against an in-browser
mock transport (`src/lib/api.ts` over the store in `src/lib/support.ts`), so you
can open a ticket, reply, and watch the thread answer back. The page says so
under its title.

It holds what someone filing a ticket needs:

- **The list**: Open (open and pending) and Closed (resolved and closed) tabs
  with their counts, and a search that also reaches message text. A row is two
  lines: the subject, then the status, the priority when it is high or urgent,
  who has it and when it last moved. Unread replies show as a count.
- **A thread**: the subject, a line with the status, id and assignee, and one
  action (Mark resolved, or Reopen). Messages are grouped by author, with the
  time under the last message of each run. System events are a small centred
  line. The reply box grows with its text, Enter sends, and the clip opens a
  real file picker (the mock keeps the name and size). You have to reopen a
  closed ticket to reply.
- **Messaging engine**: optimistic send (the bubble appears at once as
  *sending*, then *sent*, *delivered* and *read*), unread counts cleared while
  a thread is open, and retry on failure. Updates arrive over the event stream,
  so nothing refetches. Whoever answers an unassigned ticket takes it.
- **New ticket**: one text box. Its first line, up to the first full stop, is
  the subject, and the header and the list's draft row show it as you type.
  Chips say what it is about, and Blocking my work files it as high priority.
  Closing the form keeps the draft. The form is `src/components/TicketForm.tsx`,
  and Report a bug uses the same form with a chip for the session log.
- **On a phone** the list and the thread take turns, with a back arrow.
- **Pip** mines while a new ticket is on its way and goes through the portal
  before the thread opens. While someone on the team is writing, he fishes where
  their reply will appear, and the reply shows once he has landed a letter (see
  *Waiting has Pip* below).

### API

Base URL `/api/v1`, bearer token, JSON in and out. Every endpoint is declared in
`endpoints` in `src/lib/api.ts`, the same file as the client, and each client
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

Webhooks (`ticket.created`, `ticket.updated`, `ticket.resolved`,
`message.created`) are signed with `X-Vellum-Signature` (HMAC-SHA256 over the
raw body), retried with backoff for 24h until a 2xx, and deduplicated on the
event id.

To point this at a real server, replace the bodies of the `api` methods with
`fetch` calls. The request and response shapes in `src/lib/support.ts` already
match what the endpoints above are expected to exchange.

## The material

Two surfaces and no theme toggle. The editor uses Minecraft's inventory greys,
set in `src/styles/tokens.css`. Every other page is a dark room, set in
`src/styles/studio.css` and described further down.

Tokens are named by what they do: `--border`, `--sunken`, `--accent-text`,
`--focus-ring`, `--viewport-bg`. A rule asks for a role, and each surface picks
the colour.

**The editor is inventory grey.** Panels are the inventory's `#c6c6c6`, the
viewport behind the model is its slot grey `#8b8b8b`, and the page under the
panels is a shade darker. Borders are dark lines at 40%, with a faint lit line
along a panel's top edge, the way the game draws its inventory. Blue
(`#264690`) marks what is active or selected: the current tool and mode, the
selected row, focus. Errors stay red (`--danger`) and warnings amber
(`--warn`). The UV sheet sits on near-black, because pale texels disappear on
grey, and the YAML listing is solid grey, since you read it line by line. The
editor was white paper with a red accent before the audit
(`docs/archive/SPEC-light-theme.md`); the operator picked the greys (`AUDIT.md`,
phase 6).

**Glass.** Panels are a translucent tint over a 14px `backdrop-filter` blur, so
the shape behind a panel stays readable. The editor's panels are 86% opaque, so
text stays crisp over the model.

**Depth.** `--shadow` is next to nothing, so borders separate panels. Menus use
`--shadow-lg` and dialogs `--shadow-pop`. Radii stay at 8px or under in the
editor, and `--r-control` is 4px.

**The ground is ruled.** `body::before` is a flat field with a fine 64px grid,
the texture of an app built on 16 units to the block, and `body::after` lays a
faint grain over it.

**Two kinds of "on".** Something merely switched on (a mode tab, a view
toggle, a filter) is a filled neutral segment: `--sunken-strong` behind
`--ink`, on a `--border-strong` line. The accent is kept for what you have
selected (the outliner row, the texture, the open ticket), as an
`--accent-soft` fill with a 2px accent line down its left edge, and for the
active tool and the one primary button per screen, which are solid `--accent`.

**Motion.** In the editor, one curve, `cubic-bezier(0.2, 0, 0, 1)`, at 90, 140
and 220ms, with no overshoot. Entrances fade. The dark pages add springs.

**Contrast is measured.** `scripts/contrast-audit.mjs` walks every page and
reports text under 4.5:1, measured against the translucent panel as it
renders. It reads 0 on all seven pages. Set `BASE=file:///…/dist/vellum.html`
to check the built file instead of a dev server.

Things to know about `backdrop-filter` and overflow:

- An ancestor with `backdrop-filter` becomes the *backdrop root* for its
  descendants, so a popover inside the menu bar or the library panel samples
  nothing and a thin tint renders see-through. Menus are nearly opaque for that
  reason.
- `height: 100%` collapses to zero when the parent's height comes from
  `min-height` or flex sizing rather than a definite height, so `.scene3d`
  fills its parent by `inset` instead.
- Write `backdrop-filter` on its own. The build minifies CSS with Lightning
  CSS, which adds `-webkit-backdrop-filter` for Safari by itself. When the
  source also carries a prefixed line after the standard one, the minifier
  keeps only the prefixed line, which Chrome and Firefox ignore.
- A bar that scrolls sideways clips the menus that drop from it. The editor's
  menu bar doesn't scroll; on a narrow screen the file name gives way instead.

**Type.** Inter and JetBrains Mono, self-hosted as `woff2` under `public/fonts`
with latin + latin-ext subsets and `unicode-range` splits. No request leaves
the origin.

**Layout.** The layout is fluid throughout: `clamp()` gutters, `auto-fit` /
`auto-fill` grids, and `dvh` in the editor. In the editor the viewport runs
full-bleed and the two tool columns float over it as glass rails, so you see the
model through them. The rails are drag-resizable, and below 900px the whole
editor stacks.

**The card.** Settings builds its sections from one container,
`src/components/Card.tsx`. Its dashed, flush and muted variants are not used
by any page yet.

**The renderer is CSS 3D.** `src/components/ModelView.tsx` draws a `.vellum` in
the editor, on the stage, on the Dash and on the library cards. Each cube is six
transformed `div`s inside a `preserve-3d` scene, textured from the model's
sheets and posed by its clips. `src/components/Model3D.tsx` is a simpler version
for plain coloured boxes (the Projects tiles, and cards with no model behind
them): flat three-tone shading, a CSS grid floor, drag-to-orbit, and a
keyframed spin. There is no mesh, no camera and no raster pipeline.

**Every other page is a dark room.** The Dash, Projects and Settings take after
Blockbench: grey-blue panels, one bright blue, the axis colours, and the
studio's own models turning on a disc at the top of the Dash. There is no
second copy of the styles. `App` sets `data-surface="dark"` on `<html>` for
every route but the editor, and `src/styles/studio.css` re-points the tokens
under that selector. The top bar, cards, menus, fields and dialogs go dark, and
turn back to the editor's grey when you open a model. The accent is blue there
too, in brighter steps: `--accent-mark` `#5aa2ff` for lines and marks,
`--accent-text` `#a9ccff` for text. Errors and warnings use `--danger` and
`--warn` on both surfaces. The dark pages are livelier. Panels are rounded and
lit under the pointer, a title's letters lean as the pointer passes over them,
and on the Dash the turntable, the adoption ring and the file stacks move. Text
never fades or slides into view: a page's words are there as it opens. Under
reduced motion every loop stops.

White text on Blockbench's `#3e90ff` measures 3.2:1, so filled buttons use a
deeper `#2a6ad8` and the bright blue is kept for light and lines. The contrast
audit reads every page in the state it ships in.

The turntable turns on a JavaScript clock, and the axis gizmo in its corner
reads the same yaw, so the two cannot drift apart. `ModelView` takes a `yaw`
prop for this. The clock stops while the hero is scrolled out of view. The
viewer clips to its own box, so the model's box runs from the top of the stage
to well past its bottom, with its middle on the disc; a stage-sized box moved
down to the disc cut the top off tall models.

The adoption ring has one slice per player and re-slices in place when someone
joins or leaves. Slices that spun in and paths that morphed between counts
jumped about while the demo changed the count every few seconds. Under each
file stack is a pixel icon for its kind (`src/pages/dash/kinds.tsx`), picked
from what the plugin's label mentions: a wireframe cube for models, a bone for
rigs, a mob's face, a palette for textures, a chest for assets, and a page for
anything it does not recognise.

**Pack builds** lists the newest packs the server has sent
(`src/pages/dash/builds.tsx`): when each went out, its size and how much it
grew, and how many players had it. The store keeps them (`builds` in
`src/lib/dash.ts`). A pack with a new hash starts a build with no count until
the next census, the newest build carries the live count, and an older one
keeps the count it had when the next went out. The plugin's first pack replaces
the sample's history.

What the plugin sends, write by write, is in **Settings › Plugin**, with
whether it is reporting, what is reporting, and how often it checks in. The
chip beside the server's address at the top of the Dash (Live, Quiet for 20s,
Sample data) links there.

**Pages swap at once.** `useRoute` wraps each route change in a view transition
and flushes the update inside its callback, but the page itself neither fades
nor slides. The nav's active marker slides from one link to the next, because
the marker is its own element with its own `view-transition-name`, and entering
a server uses the same transition to open the Dash out of Pip's swirl.

**Waiting has Pip.** `src/components/Pip.tsx` is the studio's loading scene,
drawn in one colour after the offline dinosaur game: a horizon line, a couple
of clouds, and a small miner in a hard hat called Pip, Vellum's mascot. He is on
screen only while something runs. While work runs he mines the block in front of
him, and when a block breaks the next one rises out of the ground a few steps
on. When the answer comes he lands the swing he is on, then:

- on success a portal rises ahead and he fades into it, leaving a check mark;
- on a refusal (the request worked, the content did not pass) a wall rises, he
  walks into it and sits down under a rain cloud;
- on an error the ground opens into lava and he walks in; his pickaxe lands on
  the far bank.

To wait on a person, `scene="fish"` puts him on a bank with his legs over the
edge and a rod in his hands. The float rides the water, and now and then
something nibbles and tugs it under. When the answer comes, something bites: a
mark pops over his head, he strikes, and a letter comes up out of the water to
hang over his hat, which takes a second or two. If it fails, the line snaps and
he slumps under a rain cloud.

The result is held back until the ending has played. Then the scene goes and the
message takes its place. Pip appears in these places:

- **Apply on the server**, in the Dash's Players card. While the demo server
  runs, it answers Apply too, swapping, refusing and failing in turn.
- **Report a bug**, in Settings.
- **Export pack**, where a cancelled save is the wall and a failed one is lava.
- **Support**, where he mines while a new ticket is sent and goes through the
  portal before its thread opens. He fishes in the thread while someone on the
  team is writing, and their reply appears once he has landed the letter.

Pip is drawn by hand in `src/lib/pip/`: `figure.ts` is Pip himself, `mine.ts`
and `fish.ts` are the two scenes, and `scene.ts` holds what they share. One
canvas pixel is one art pixel, scaled up by a whole number so pixels stay
square, in the text colour of wherever he sits. His limbs swing by
nearest-neighbour rotation so they never blur. The art is our own. Under
reduced motion there is no ending to wait for and the result shows at once. A
result is never held back more than six seconds.

While he works, a short line from `src/lib/pip/quips.ts` sits under him
("Snapping to the nearest 22.5 degrees."). It changes each time he breaks a
block or something nibbles. The mining lines are real rules in the app, so keep
them true. Under reduced motion one line stays put. The drawing and the line are
hidden from screen readers. Where nothing beside him says what is happening, his
`label` does, as a status: "Sending the report", "Building the pack".

The boot screen is Pip too. `scripts/make-boot.mjs` draws one swing at a block
with the mining scene's own code and writes it into `index.html` as a sprite,
inside `#root`, so React's first render replaces it. It fades in after 150ms,
so a quick load never shows it. A small script before it marks every page but
the editor as dark, so a dark page doesn't flash light while the app loads.

## The stage

**View in the real world** shows the model on a black stage, and the floor is
near enough black to disappear. A modeller looking at a model does not want a
landscape competing with it, and a green field would cast its colour over
everything they are trying to judge.

The stage has:

- **A floor that travels.** The timeline cannot show you whether a walk covers
  ground. So the model stands still and the ground moves under it at the speed
  the legs ask for. A leg swinging `a` degrees about a pivot `r` from the foot
  sweeps a chord of `2r sin(a)`, and that chord is the ground a stride covers.
  Only a looping clip travels, so an attack stays put. An idle that rocks the
  legs a degree or two does not count as walking.
- **One dim line per block.** With no visible floor you could not see the ground
  move, and a walking mob would look like it was walking on the spot. The lines
  also work as a ruler.
- **A figure two blocks tall**, because nothing else tells you how big something
  is. It is rigged and walks at the same speed, solving the same equation for
  its own leg length.

There is no day or night, because there is no sky. The stage is black inside
the grey editor too: you judge a texture against a neutral dark field, and pale
texels disappear on grey. The dialog around the stage uses the editor's grey
panels, and only the stage between the two bars is black.

## Into the game

What this section says about the plugin comes from the original plugin. None of
it has been checked against the rewritten one.

A `.vellum` is not a Minecraft file. The editor has a bone tree, arbitrary
rotations and a sheet of any size, and a Minecraft model file has none of those.
`src/lib/mcmodel.ts` converts one into the other. The more useful half of it is
the check that says what cannot be converted, and why.

### What the model format will not let you say

These limits come from Minecraft's model format:

- **There is no hierarchy.** Elements are flat in model space. The file has no
  bones.
- **An element rotates once**, on one axis about one origin, by one of exactly
  five angles: `-45, -22.5, 0, 22.5, 45`.
- **There is no inflate.** A cube inflated by 0.25 has to be grown in its
  coordinates when it is written.
- **Coordinates live in `-16..32`**, and that is after the inflate above.

So a model can be fine in Vellum and impossible to express in Minecraft. Vellum
says which cube and why *before* the pack is built, because the game would
reject the pack with no useful message. `checkTranslation(model, kind, target)`
walks the model and reports:

- `chainOf()` collects the non-zero rotations along a cube's bone chain. Two
  pivots, or two axes, is an **error** that names the bone. Flattening them
  without a word would move geometry somewhere the modeller did not put it.
- An angle that is not one of the five is a **warning** that names the nearest
  legal angle. The export uses that angle.
- An element outside `-16..32` after inflate is an **error** that names the
  axis.

**A single bone rotation with no cube rotation under it is fine.** An element
has exactly one pivot, so that rotation becomes the element's own:
`{"origin": [...], "axis": "y", "angle": 22.5}`. Anything the editor can draw
that the format can hold translates.

### Two destinations

Some geometry a pack cannot hold is fine on a server running the plugin.

On a linked server, a **group rotation never goes in the model file.** The
plugin applies it at runtime as the bone's *rest rotation*, on the display that
carries that bone. Cube rotations stay in the model exactly as authored.
Out-of-range geometry works the same way: the plugin divides an over-reaching
bone down, records the divisor on it, and multiplies it back into that
display's scale.

So arbitrary bone rotation works on a linked server and is impossible in a
pack. `target` decides which verdict you get:

- **`pack`**: a model file on its own, on a vanilla client. Every refusal
  stands, and `buildPack` skips a model that has one.
- **`any`**: the editor's own view, which cannot know whether a server is
  linked. A bone-level problem is a warning that names the plugin mechanism
  that handles it.

The cube-level limit is the same on both paths: one axis, one of five angles.
That goes in the file either way.

The check runs in the Validation panel beside the model's other rules, so you
see it without asking for it.

**Mobs are left out of the pack.** A resource pack can't hold a custom entity
model, so the plugin draws mobs in game. `buildPack()` names each mob it leaves
out.

### The zip

`src/lib/zip.ts` writes a **store-only** archive: method 0, real CRC-32, DOS
timestamps. A pack is mostly PNGs, which are already compressed, so deflate
would save a few percent and cost a dependency.

`src/lib/pack.ts` lays out what goes in it:

```
pack.mcmeta
assets/<namespace>/items/<id>.json          <- what points at it
assets/<namespace>/models/<folder>/<id>.json
assets/<namespace>/textures/<folder>/<id>.png
```

The item definition is the file that makes the rest reachable. A model under
`models/` is geometry that nothing in the game references. Since 1.21.4, an item
whose `minecraft:item_model` component is `<ns>:<id>` renders whatever the item
definition names. Without the definition, the pack loads without complaint and
the item keeps its vanilla look. That is the hardest failure to tell apart from
"the pack didn't install". The pre-1.21.4 `overrides` array on
`custom_model_data` is not written: the cutoff is sharp and the target is above
it.

`pretty()` keeps number arrays on one line. `JSON.stringify(v, null, 2)` puts
every component of every vector on its own line, which made the thirteen-cube
Alien Sword 16 KB of column. With number arrays inline, the vectors read as
coordinates and the same file is about 10 KB.

**`pack_format` defaults to 84**, the number the original plugin's generator
read out of 26.1.2's `version.json`. It is a single integer per Minecraft version.
A wrong one stops the whole pack loading, and Minecraft gives no reason. It is a
field you can edit because a newer version declares a higher number, and a
hard-coded one would go stale with no sign that it had.

**This export is for the standalone case.** On a server running the Vellum
plugin, the plugin builds and serves its own pack, with the hash in the URL so
client caches stay correct. A second pipeline there could disagree with the
first. The free tier has no plugin and no other way to get a pack at all, and
this export is for them. The dialog says so.

The export also writes display transforms and configs.

**Display transforms.** A `.vellum` carries none, and the Display tab is a
preview that says so. A model file with no `display` block and no `parent`
renders at raw model scale, which makes a 16-unit item a speck in the hand and a
speck in the inventory. So the export writes Minecraft's own defaults, and the
dialog says it does.

**Configs go in a second zip.** A config is how a mob becomes a thing in the
game. Minecraft never reads it. The Vellum plugin does. The pack goes in
`resourcepacks/` and the configs go in the plugin's folder, so one archive
would put half its files in the wrong place, and Minecraft would say nothing
about the files it ignored. The paths inside the zip (`mobs/<id>/mob.yml`,
`items/<id>/item.yml`) are the ones the Config tab shows, so the download
matches what the panel said. They are relative, because where they land on a
server is the plugin's convention to set. A model with nothing configured is
left out.

## What works, and what does not

In the editor, geometry, textures, rigs, clips, behaviours, configs and the
file itself all work. You can add, resize, reparent and delete cubes and
bones. Paint lands on the sheet through the UV rectangle it belongs to. Clips
are keyed, retimed and interpolated on a catmull-rom spline. A model saves to
and opens from a real `.vellum`, through the same codec the samples ship in.
Undo and redo cover all of it, and leaving an editor with unsaved changes asks
first.

You make a new model from the library shelf with **New model**, which sits
beside the tabs and outside the pill. It asks for a kind, then what the model is
for, and hands the editor a URL it can rebuild the model from, so a reload does
not lose it.

**Export pack**, beside it on the same shelf, builds a real zip with real model
JSON in it. It leaves out any model Minecraft could not hold, and names the cube
and the reason. Configs come out beside the pack as their own archive. All of
this works end to end. The plugin decides what it needs for a mob's *geometry*,
so the export writes no model file for a mob.

The dashboard shows what a plugin has reported through the documented API
(`docs/plugin-api.md`), and the built-in sample until one reports. Every paid
feature shows its layout with the controls inert, and says so.

Vellum does not wire up anything that would need a server of our own. The
plugin API is documented and the transport is mocked. No request leaves the
page unless a plugin has been linked.
