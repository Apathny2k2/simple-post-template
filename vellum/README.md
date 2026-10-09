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

Every model Vellum saves is a `.vellum`, implemented in `src/lib/vellum.ts`.
It also opens Blockbench projects and Java models, converting them on the way
in (see Importing and exporting below), and saves those as `.vellum` too. The
first samples were migrated from Blockbench files, and those sources have been
removed.
`voidling.vellum` and `resonator_block.vellum` are still the migrated files. The
other six samples are built by `scripts/make-samples.mjs`.
`docs/archive/blockbench/` keeps the research notes.

A `.vellum` is UTF-8 JSON on one line, with a Vellum-owned schema. The
extension is ours.

```
{"vellum":{"format":"model","version":8},"name":"voidling","kind":"mobs","subtype":"hostile","resolution":{…},"bones":[…],"cubes":[…],"textures":[…],"clips":[…],"nulls":[…],"behaviour":{…},"config":{…}}
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

### Version 8: null objects, events and ping-pong

v8 adds what Blockbench animators expect from a file. Every addition is
optional, so a v7 file reads as a v8 file with none of them, and the upgrade
changes nothing.

- **`nulls`**, after `clips`: Blockbench's null objects. Each has an `id`, a
  `name`, the `parent` bone it moves with, and an absolute `position`, like a
  pivot. A null with `ik_target` is the point an IK chain reaches for:
  `ik_target` names the bone at the end of the chain and `ik_chain` how many
  bones above it bend (2 when absent). A clip can key a null's position with a
  `position` track whose `bone` is the null's id.
- **`events`** on a clip, sorted by time: `{time, kind, effect, locator?}`, where
  `kind` is `sound`, `particle` or `script`, `effect` is the sound or particle
  id (or the script), and `locator` is the null it plays at. An event of a kind
  this reader doesn't know is dropped.
- **`pingpong`**, a fourth `loop` value: the clip plays to its end and back. A
  reader that meets a loop value it doesn't know plays it as `loop`.

### Version 9: meshes

v9 adds **`meshes`**, after `nulls`: Blockbench's free-form elements. It is
optional, so a v8 file reads as a v9 file with no meshes and the upgrade
changes nothing. A model with no meshes writes no `meshes` key.

Each mesh has an `id`, a `name`, the `parent` bone it moves with (as a null
object does), an `origin` that is also its pivot, and a `rotation` (written
only when not zero). `vertices` maps a vertex key to its offset from the
origin. `faces` maps a face key to `{vertices, uv, texture?}`: three or more
vertex keys, a UV in UV units for each, and the texture's id. Vertex and face
keys are written sorted, so a mesh always writes the same bytes. A face that
names a vertex the mesh lacks drops it, and a face left with fewer than three
is dropped.

### Version 10: what a Blockbench project holds besides

v10 adds **`blockbench`**, after `config`: the keys of an imported
Blockbench project that Vellum has no field for, so saving back to a
`.bbmodel` loses nothing. It holds `meta` and `project` (the project's own
keys, such as `display`), then `elements`, `groups`, `textures` and
`animations`, each a map from id to that object's other keys, and
`other_elements`, whole elements Vellum can't show. Entries for things the
model no longer has are dropped on save. It is optional, so a v9 file reads
as a v10 file with none, and a model that never came from Blockbench writes
no `blockbench` key.

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
  top bar doesn't scroll; on a narrow screen the file name gives way instead.

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
every route, and `src/styles/studio.css` re-points the tokens under that
selector. The top bar, cards, menus, fields and dialogs go dark. The editor is
dark too, in its own palette (see below). The accent is blue there
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

## The editor's layout

The editor follows the Studio design. `src/pages/EditorStudio.css` holds the
whole skin, scoped to `.editor-root--studio`, and re-points the shared tokens
there, so the panels underneath need no changes of their own.

- **Top bar.** Back, the model's name with a dot when it has unsaved changes,
  then the modes in a pill in the middle (Model, Paint, Animate, Config, Scene).
  On the right: undo, redo, a count of problems that opens the Validation
  panel, the File menu and Save. File holds every menu the old menu bar had,
  each under its own heading.
- **Columns.** In Model, Paint and Animate the outliner (or the paint tools, or
  the clips) is on the left and the inspector on the right. The root carries
  `data-swap` for those modes, and the two columns trade grid columns in CSS
  so the markup keeps one order.
- **Viewport.** View tabs top left (Perspective, Front, Side, Top), shading and
  the snap, space and grid controls top right, the tools in a dock at the
  bottom centre with their keys printed on them.
- **Status bar.** The model's counts on the left, the selection in the middle,
  whether it is saved on the right.

Colours: backgrounds `#15191D`, `#12161A`, `#101316`; lines `#23292F` and
`#2A3036`; ink `#EEE9DF`, `#A8A398`, `#8C887F`. Sage `#A7C4A0` marks the
selection, amber `#D8B67A` unsaved changes and problems, and Save is cream
`#F4F0E8`. The type is Archivo, falling back to Inter when it cannot load.

## The viewport tools

The editor is meant to feel familiar to anyone who has used Blockbench or
Blender. The tools, their keys and the gizmo colours follow Blockbench, and the
camera keys follow Blender, which Blockbench copies.

| Tool | Key | What the gizmo does |
| --- | --- | --- |
| Move | V | Arrows move along one axis, squares along two, the centre in the view plane |
| Resize | S | A handle at each end of each axis grows or shrinks that side of the cube |
| Rotate | R | Rings turn about the axes the cube's own X, Y and Z angles turn it about |
| Pivot | P | Moves the point a cube or bone turns about, without moving it |
| Vertex snap | X | Click a corner of the selection, then the corner it should meet |

Grid snap is the Snap menu at the top right of the viewport (1 unit down to 1/16). Shift snaps to a quarter of
it and Ctrl turns snapping off. Rotation snaps to 2.5° (Shift 0.5°), and to
22.5° for blocks, since Minecraft accepts no other angle on a block. **Global** and **Local**
(T) switch the move and pivot arrows between the world axes and the selection's
own.

Selection works as in Blockbench. A click selects one node, Ctrl-click toggles
one and Shift-click adds. In the outliner Shift-click selects a range, and
Ctrl-drag or B then drag in the viewport draws a selection box. The last
node picked is the primary one, which the panels and the gizmo follow.

| Key | Action |
| --- | --- |
| Ctrl C, Ctrl X, Ctrl V | Copy, cut, paste. Bones come with everything under them |
| Ctrl D | Duplicate the selection |
| Ctrl G | Group the selection into a new bone |
| Ctrl A | Select every cube |
| F2 | Rename |
| H, Alt H | Hide the selection, show everything |
| Numpad 1, 3, 7 | Front, right, top. With Ctrl: back, left, bottom |
| Numpad 5 | Perspective or orthographic |
| F, Numpad . | Focus on the selection |
| Home | Frame the whole model |
| Esc | Clear the selection (in Animate, the keys first) |

**Blender keys.** Edit ▸ Keys switches to Blender's keys, and the choice is
kept per browser. G grabs, X deletes, A selects everything and Alt A
nothing, Shift D duplicates, Shift A adds a cube, and I sets a key in
Animate. R, S, H, B, Space, the numpad views and Ctrl Z are the same in
both.

**Grab.** G with Blender's keys, Shift G with Blockbench's (whose G shows
and hides the grid), or Transform ▸ Grab. The selection follows the pointer
in the plane of the screen until a click or Enter puts it down; Esc or a
right click puts it back, leaving no undo step. X, Y or Z holds it to that
world axis, drawn across the view; Shift with one holds it to the plane
across that axis; the same key again lets go. Digits typed while it is held
move it exactly that far along the axis (X if none was picked). It snaps to
the grid step as the gizmo does, Shift for a quarter step, Ctrl for none,
and works on whatever the Move gizmo would move: cubes, bones, null
objects, a mesh's picked faces, vertices or edges, and a pose in Animate.
On picked edges a second G turns it into an edge slide, left and right
along the rails.

**Mirror editing.** The mirror button beside Global (Blockbench's mirror
modelling, Blender's X mirror) makes an edit on one side follow on the
other. A cube moved, resized or turned, by the gizmo, a grab or the
inspector, carries its mirror image across the centre line (x = 8 for
blocks and items, x = 0 for mobs) with it: the cube whose box and pivot
were the mirror of its own before the edit gets them again after it, its
turn about Y and Z reversed (`followMirrorCubes`). On a mesh, moving,
turning or scaling picked vertices moves each one's mirror image across
the mesh's own x = 0, and a vertex on that plane stays on it
(`followMirrorVertices`). A partner that was picked too moves as the edit
moved it. Edits that make or remove faces don't mirror.

**History.** The History panel lists every undo step, oldest first. A click
jumps back or forward to that point; undone steps stay listed in italics
until a new edit drops them.

**Transform** has Flip X, Y and Z, which mirror the selection about its own
middle, and Mirror across the centre line, which mirrors it across x = 8 for
blocks and items and x = 0 for mobs. The axis widget at the top right of the
viewport looks along an axis when clicked.

### Animating

Animate mode follows Blockbench. Pick a bone (or click one of its cubes) and
pose it with **Move** (V), **Rotate** (R) or **Scale** (S): each drag keys that
channel at the playhead, on top of what the clip already says there, and keeps
the key's easing. **K** keys the bone's rotation as it stands.

**Molang.** Any axis of a key can be a Molang expression instead of a
number: **Molang…** under the key's values opens a field per axis, and an
empty field goes back to the number. The key then plays the expression,
run at each moment with the playhead as `q.anim_time` and `q.life_time`,
and it eases into the next key the way a number would, as Bedrock plays
it. `lib/molang.ts` reads numbers, `+ - * / %`, comparisons, `&& || !`,
`?:` and `??`, brackets, and several statements with `v.name = ...` and
`return`. `math.` has Bedrock's functions, with trig in degrees, and
`math.random` gives the same numbers each time a frame plays. Queries
Vellum can't know (ground speed, health) take the values of a walking mob
in good health, and any other reads 0, as an unset one does in game. An
expression that can't be read says why under the fields and plays the
axis's number. Keys keep their Molang in the `.vellum` (v11, as `expr`), and
through Blockbench and Bedrock, signed for their axes the way the numbers
are.

**Controllers.** Bedrock's animation controllers, in the Controllers panel
(`lib/controllers.ts`, `pages/editor/Controllers.tsx`). A controller has
states; a state plays some clips together, each from when the state began
and at a Molang weight (1 by default). Rotation and position add, and scale
multiplies, as Bedrock layers them. Every frame the state's transitions are
checked in order, each a target state and a Molang condition, and the
first that holds moves it on, cross-fading over the new state's **Blend**
seconds. A state's **on entry** Molang runs as it starts, and the variables
it sets are seen by the conditions after it. **Play** runs the controller in
the viewport, the state it's in lit, with checkboxes and a health field
standing in for the mob: moving (which also sets `q.ground_speed`), on the
ground, sneaking, in water. Controllers are kept in the `.vellum` (v12), in a
`.bbmodel` under its `vellum` key, and in the Bedrock zip.

The timeline has two views. The **dope sheet** has a row per bone and channel.
Click a key to select it, Ctrl-click to toggle one and Shift-click to add one.
Drag across empty track to box-select, and drag any selected key to move them
all as one undo step. Ctrl A selects every key, Ctrl C and Ctrl V copy and
paste them at the playhead (onto the picked bone when they came from one), and
Del deletes them. The **graph** view draws the bone's channel as one curve per
axis. Drag a key up or down to change its value and sideways to retime it
(Shift keeps the time). A bezier key shows its two handles, which drag too. The
timeline's top edge drags to make it taller.

Easing is per key, for the segment that follows it: linear, smooth
(Catmull-Rom), bezier or step. Bezier keys play through their handles, which
are offsets in seconds and value from the key, as Blockbench stores them. A key
with no handles gets flat ones a third of the way along, so it eases in and out.

**Onion skin** draws the pose at the keyframe before the playhead in blue and at
the next keyframe in orange. **Ping-pong** plays a clip to its end and back.

**Effects** is the row at the top of the dope sheet, with ♪ sound, ✦ particle
and {} script buttons that add an effect at the playhead. Select one to set its
id, the null object it plays at and its time. While a clip plays, each effect
shows in the viewport for a moment as the playhead passes it.

**Null objects** (Edit, Add null object) are points that ride on a bone. On its
own a null is a locator that effects can play at. Pick a bone under "IK: the
bone that reaches for it" and the null becomes an IK target: the bones above
that bone bend so it reaches the null, in Edit and during playback. A null's
position can be keyed in Animate like a bone's. The solver is cyclic coordinate
descent in `lib/kinematics.ts`, and it writes the bend into the pose as
rotation offsets, the way keyed rotations are applied.

### Meshes

A mesh is Blockbench's free-form element: vertices and faces of any shape,
next to the cubes. **+ More** in the outliner adds one (cube, plane, pyramid,
cylinder, cone or sphere), on the selected bone, with each face's UVs laid
flat and packed into free room on the sheet. A mesh is listed under its bone
in the outliner. It names that bone, as a null object does, so moving it to
another bone only changes the name.

With a mesh selected, the dock shows four selection modes, as Blockbench's
toolbar does:

| Mode | Key | The gizmo, and what else works |
| --- | --- | --- |
| Object | 1 | Moves, turns and re-pivots the whole mesh. **Subdivide** splits every face |
| Face | 2 | Click faces to pick them (Shift adds). E extrudes by 1, I insets, Shift F flips, **Subdivide** splits the picked faces, Del deletes |
| Vertex | 3 | Click the dots (Shift adds), or B and drag a box. M merges them at their middle, F makes a face through them, Del deletes |
| Edge | 4 | Click the lines (Shift adds, Alt picks the whole loop), or B and drag a box round both ends. Ctrl R loop cuts through a single picked edge, Ctrl B bevels, **Dissolve** joins the faces either side, F makes a face between two edges, **Slide** moves them along the faces beside them, Del deletes the faces along them |

In Face, Vertex and Edge mode the gizmo works on the pick: V moves it, R
turns it about its middle (15° steps, Shift for 1°, Ctrl free) and S scales
it along the mesh's own axes. Ctrl A picks every face, vertex or edge, and
Esc picks none. K starts the **knife** in any mode: click points on edges
and inside faces, in order across the faces to cut, and Enter cuts (Esc
stops). Bevel and inset
go as far as the width field in the Mesh panel says.

**Loop cut** works as Blender's and Blockbench's: from the picked edge it walks
across each quad to the opposite edge and on into the next quad, both ways,
until it meets a face that isn't a quad or comes back round. Each quad on that
ring splits in two through the middles of its two ring edges, and the new
ring stays picked so the gizmo can slide it. **Subdivide** gives each face one
quad per corner, through its edge middles and its own middle. Both keep the
surface closed: a face next to a split one that wasn't split itself takes the
new middle vertex on the edge they share (`stitch` in `lib/mesh.ts`). New
UVs are the averages of the old ones, so the texture stays where it was.

The other edits follow the same rules: none leaves a hole, and new corners
take UVs the same way along the face's own UVs, so the texture stays put.

- **Knife** (`knifeCut`): a click on an edge becomes a vertex on it (or the
  corner it sits on), and the faces beside that edge take it too. A click
  inside a face becomes a vertex in it, its UV read back through the face's
  own UV map. Each run of clicks that starts and ends on one face's outline,
  with any number of inside clicks between, splits that face along the run.
  A face's outline can't hold a line that stops inside it, so a run with a
  loose end is carried on from that end to the nearest corner of the face
  it can reach in a straight line without crossing the outline or the cut.
  The cut stays where it was drawn and the face splits along it and that
  one extra edge; a line drawn wholly inside a face gets one at each end.
- **Bevel** (Ctrl B, in Edge or Vertex mode; `bevel`): all picked edges at
  once. Each face corner at a bevelled vertex moves in: between two
  bevelled edges to where the two edges, each moved the bevel width into
  the face, cross (a mitred corner); beside one bevelled edge it slides
  along the face's other edge, to the point the face across that edge uses
  too, so they stay joined. A corner with no bevelled edge of its own, the
  third face at a cube's corner or any corner of a bevelled vertex, is cut
  off between its two slid points. Each edge becomes a strip **Segments**
  faces across (N in the panel, up to 16), bowed toward the old edge; two
  strips meeting at a vertex share their curve, and a cut corner that a
  curve ends on follows it. Any gap left at a vertex is filled with one
  face. A bevelled vertex is cut off by a face. The strip borrows its
  texture from the edge's first face, along the edge.
- **Edge slide** (`slideEdges`): each end moves along the rail beside it
  (`slideRails` keeps one side the same all along a loop). The slider runs
  from -100% to 100%; each drag or key press is one undo step.
- **Loop select** (`edgeLoop`): Alt+click goes on through each vertex where
  four edges meet, along the edge that shares no face with the last.
- **Fill** (`fillFace`): the points are ordered round their middle and the
  face is turned to run against a face it shares an edge with, or else away
  from the mesh's middle. Its UVs are packed into free room.
- **Dissolve** (`dissolveEdges`) and **inset** (`insetFaces`), as Blender's.
- **Merge by distance** (`mergeByDistance`): vertices closer than the
  Distance field (0.1 by default) become one at their middle, the picked
  ones in Vertex mode or every one in Object mode.
- **Separate** (P, in Face mode; `separateFaces`): the picked faces leave
  for a mesh of their own in the same place, with copies of the corners
  they shared, and the new mesh is picked.
- **Join** (Ctrl J; `joinMeshes`): the other meshes picked in the outliner
  come into the mesh shown in the panel. Each point goes from its own mesh's
  frame through the world into the target's, so nothing moves on screen,
  even across bones. Merge by distance then closes any seams.
- **Convert to mesh** (the vertex button on a cube's inspector, or Edit ▸
  Convert cube to mesh; `cubeToMesh`): eight shared corners about the
  cube's pivot with its turn and inflate, each face keeping its texture and
  its UVs with the face's quarter turn applied.

**Faces a flat map can't texture.** A face drawn as one div maps its
texture by one affine map, which is exact only when its UVs are the same
shape as its outline and the face is flat. Any other face (a quad with a
corner pulled out of its plane, or UVs dragged into a trapezoid) is drawn
as triangles, each with its own map, as a GPU draws it (`facePieces`). A
quad splits along its shorter diagonal. The triangles overlap by half a
pixel so no hairline shows between them. Only a partly see-through pixel
would show where it is drawn twice, so a texture with any (`lib/alpha.ts`
reads each image once) gets no overlap. The Mesh panel has the
same edits as buttons, the middle of the pick as fields, and the texture for
the picked faces (or all of them). Extruding keeps the picked faces picked,
so a drag on the gizmo pulls them straight out.

**Drawing them.** The viewport is CSS 3D, so each face is a div laid on the
face's plane by `matrix3d` and cut to its outline with `clip-path`. Its
texture is mapped by the affine map from the face's UVs to its flat outline
(`uvToFlat` in `lib/mesh.ts`), so a quad shows exactly when its UVs are a
parallelogram, which primitives' and most Blockbench faces' are. Shading
blends the per-direction brightness cubes get, by the face's normal.

**Order of a face's corners.** A quad's vertices can be stored in any order.
An order whose edges cross encloses less area, so `faceOrder` takes the
order with most area, turned to face the way the first three vertices do.
Everything that draws or exports a face uses it.

Painting works on meshes as on cubes: in 3D, through the same UV map run
backwards, and on the sheet, where a selected mesh's faces are outlined and a
press inside one picks it. glTF and OBJ export meshes with the cubes. Java
block and item models are boxes only, so a pack leaves meshes out and the
Validation panel says so.

**Their UVs.** With a mesh selected the UV panel shows its faces as
polygons on the sheet. The pick is Face mode's: a click on the sheet picks
there and in the viewport. Dragging a face moves every picked face, and
dragging one of the dots at a picked face's corners moves that corner of that
face only, since each face keeps its own UVs. Whole texels by default, Shift
for halves, Ctrl for free. **Unwrap** (`unwrapJoined`) unfolds the picked
faces (or all of them) flat at one texel per unit, faces that share an edge
kept together: each is laid beside the face it was reached from by turning
it about their shared edge, so a cube comes out as a cross. A face that
would land on part of its island starts an island of its own. Each island
is packed into room the rest of the sheet leaves free. **Each face apart**
lays every face out on its own instead; **Turn** and **Mirror X / Y** work about the middle of the
pick's UV bounds. Each drag or button is one undo step.

### Painting

Paint mode puts the texture sheet in the middle, as the Studio design does.
A press on the sheet picks the face under it, and with **Keep strokes inside
the face** on, a stroke stays in that face. **Paint on: Model** brings the 3D
viewport back for painting straight onto the cubes.

- **Brush sizes** count UV texels, so a 1 px brush covers a whole texel on a
  texture drawn at twice the sheet's size.
- **Strength** below 100% lays the colour over what is there. Each pixel is
  blended once per stroke, so overlapping stamps don't pile up.
- **Mirror painting** puts a brush or eraser stroke on the cube mirrored
  across X as well, with east and west swapped, as Blockbench does.
- **On this model** in the Colour panel offers the colours the texture uses
  most. The status bar reads out the texel under the pointer and its colour.

**Layers.** The Layers panel in Paint splits a texture into layers, top
first as paint programs list them (`lib/layers.ts`). **+ Layer** on a texture
that has none makes its image the Base layer with a clear one on top. A
click on a layer's name paints on it; the eye hides it; the number is how
strongly it shows. Up, Down, Merge down (the upper painted onto the lower,
each at its own strength, so it looks the same), Flatten and Delete are
beside them, each one undo step. The texture's own image stays the layers
flattened, bottom first, hidden ones left out, so the viewport, the UV
sheet and every export see the finished picture and know nothing of
layers; a stroke re-flattens on each frame from the other layers'
already-decoded canvases. A texture down to one layer, or flattened, is a
single image again. Layers are kept in the `.vellum` (v13) and, under its
`vellum` key, in a `.bbmodel`, whose Blockbench texture is the flattened
image.

### Editing UVs and textures

The UV panel is Blockbench's UV editor. It shows the selected cube's six
faces on the sheet, with the other cubes' faces dashed so free room shows.
Drag a face to move it. Drag a handle on the active face to resize it. Moves
snap to whole texels, Shift to half texels, and Ctrl moves freely. Each drag is
one undo step. Ctrl + wheel or the +/− buttons zoom the sheet. A warning names
any cube whose faces overlap the selection's, because painting one would paint
both.

**Box UV** is the switch above the sheet. With it on, the faces are a box
unwrap that starts at `uvOffset`:

- they follow the cube when it is resized;
- dragging any face moves the whole unwrap;
- Mirror swaps east and west and reads every face right to left, as
  Blockbench's Mirror UV does.

With it off, each face is edited on its own. Turning it on keeps the stored
start while the faces still sit where it put them. Otherwise it unwraps from
the faces' top left. The code is in `lib/uv-edit.ts`.

**Move pixels with the face**, under the sheet, makes a face dragged to a
new place take its pixels with it, in the same undo step.

**Re-unwrap** lays the selected cubes out again as a box at their size. A cube
stays where its unwrap starts when it still fits and overlaps nothing.
Otherwise it moves to the first free spot, and the sheet doubles when there is
none. Pixels do not move with it, so a cube that moved needs painting again.

**Textures.** **+ New** makes a transparent texture the size of the sheet.
**Import**, or a PNG dropped on the panel, adds an image. The first texture a
model gets also goes on every face that had none. The panel's row buttons put
a texture on every face of the selected cubes, or delete it. A deleted
texture's faces take the first texture left. Each face picks its texture from
the select above the sheet, and **Texture to all faces** copies it to the rest
of the cube.

An imported PNG keeps its own size and is stretched over the sheet, so a 128px
image on a 64-unit sheet is a texture at twice the detail. Painting converts UV
units to that texture's pixels (`pixelScale`), so the brush lands on the same
spot whatever the image's size.

### How the gizmo finds the screen

The viewport is CSS 3D (see The material), so there is no camera matrix to
project with. `ModelView` places four invisible probes in the scene, at the
gizmo and one unit along each world axis, and reads where the browser drew
them. That gives a 2×3 matrix from world units to screen pixels near the
gizmo, and every drag is solved back through it. The probes go through the
same transforms as the model, so the gizmo stays on the model under any
camera, zoom, pose or orthographic view.

`lib/kinematics.ts` builds each bone's and cube's world matrix from the same
transform strings `ModelView` renders, so the two cannot drift apart. A drag
gives a world-space amount; kinematics turns it into the parent frame the
`.vellum` coordinates are stored in. The file format does not change: a moved
cube is still absolute `from`, `to` and `origin`, and a moved bone carries
everything under it. Each rotation ring is measured:
it is the world axis that one Euler component turns the node about, found by a small
step through the real transform.

## Importing and exporting

File ▸ Open takes a `.vellum`, a Blockbench project or a Java model.
`src/lib/importers.ts` turns a Java file into an ordinary model;
`src/lib/bbmodel.ts` reads and writes Blockbench projects.

- **Blockbench `.bbmodel`**, both ways. Groups become bones (from the
  Blockbench 4 outliner, where they nest, or Blockbench 5's, which lists
  them apart by uuid). Cubes keep their UVs, turns, inflate and box UV;
  meshes and null objects come in as Vellum's own, a null's IK source
  becoming its chain length. Embedded textures come along. Animations keep
  their keys, easing and bezier handles; an older file's animator, named by
  its group's name, still finds its bone. Sound, particle and timeline keys
  become clip events. Blockbench's own ids are kept.
  Blockbench keeps keyframes the way Bedrock reads them: it plays a
  rotation key as (-x, -y, z) and a position key as (-x, y, z) on top of
  the bone, while Vellum adds keys straight onto it. Keys cross over with
  those signs both ways (`keySigns`), so a clip turns the same way in both.
  Checked against a real project: in an animated mob's bite the jaw's key
  drops the jaw's tip and opens the mouth, and its roar lifts the head, as
  they were animated.

  Nothing is dropped. What Vellum has no field for (display settings, a
  face's cullface and tint, element and group colours, a texture's render
  mode and id, an animation's blend weight, a key's `uniform` scale,
  linked handles and plugin fields such as `easing`, the project's other
  keys, and whole elements Vellum can't show, such as texture meshes) is
  kept in `model.blockbench` by id (a key's by clip, bone, channel and
  time, since a `.vellum` gives keys new ids each time it is read), saved in the `.vellum` (v10), and written back
  into a `.bbmodel`. A key holding the value the exporter writes anyway is
  not kept, so a model made in Vellum carries none. Molang in a key is kept and played (see Molang, under Animating), and a cube outside every group goes under a new `root` bone; the status bar says so.

  **Save** writes either format: the arrow beside it chooses `.vellum` or
  `.bbmodel`, and the choice sticks for Save and Ctrl S. A `.bbmodel` that
  was opened saves back as one. The export is a Blockbench 4.10 project,
  which Blockbench 4 and 5 open. What only Vellum says (the model's kind,
  subtype, behaviour and config, a ping-pong loop, the order of a clip's
  tracks) goes under a `vellum` key, and an id that isn't a uuid goes out as
  one made from it, with a map back. So the two files of one model open as
  the same model: `bbmodel.test.mjs` saves every sample as a `.bbmodel`,
  opens it, and checks the `.vellum` it writes is byte for byte the same.
- **Bedrock geometry and animations** (`src/lib/bedrock.ts`), both ways.
  File ▸ Export ▸ Bedrock writes a zip laid out as a resource pack's
  folders: `models/entity/<name>.geo.json` (format 1.12.0),
  `animations/<name>.animation.json` (1.8.0),
  `animation_controllers/<name>.animation_controllers.json` (1.10.0), the
  textures, and `entity/<name>.entity.json`, the client entity file that
  names the geometry, the texture, every animation and controller by the
  short names controllers use, and sets the controllers to run. Bedrock's X
  runs the other way, so pivots and points go over as (-x, y, z), turns as
  (-x, -y, z), and a cube's Bedrock `origin` is its corner on the model's
  `to` side in x. Up and down faces cross over end for end, as Blockbench
  writes them, because Bedrock draws them turned half round. Box UV cubes
  write their offset, null objects become locators on their bone. In a
  clip, linear keys are plain arrays, catmull-rom keys carry `lerp_mode`,
  a step holds by giving the next key a `pre`, and a bezier segment, which
  Bedrock can't say, is baked into linear keys at the clip's snapping rate.
  A ping-pong clip is written out there and back as a loop twice as long.
  A mesh goes in as its bone's `poly_mesh`: positions in rest space with X
  flipped, every poly a quad (a triangle repeats its last corner, as
  Blockbench writes them; a face of five or more corners is cut into
  triangles), UVs 0..1 counted up from the bottom. Meshes at the model root
  get a bone named `meshes`. Bedrock animates bones only, so a null object
  that a clip keys goes out as a bone holding one locator of its own name at
  its pivot, and that shape reads back as the null.

  File ▸ Open takes a `.geo.json` (the 1.12 form or the older one keyed by
  `geometry.` names) as a new model with a blank texture named after it,
  and an `.animation.json` as clips added to the open model, matched to its
  bones by name, and an `.animation_controllers.json` as controllers, their
  animations matched to its clips by short name. Keys may be arrays, one value for all three axes, or
  `{pre, post, lerp_mode}`; a `pre` equal to the key before makes that key
  hold. Molang values are kept and played, and bones the model lacks are named in the status bar.
- **Java block or item JSON.** Elements become cubes under one `root` bone.
  The sheet is 16 by 16, as Java UVs are. A model names its textures by path
  and carries no images, so they open blank and named after the path. Importing a PNG of
  the same name on the Textures panel fills one in. A model that only names
  a parent is refused, since it has no elements of its own.

File ▸ Export writes three more formats (`src/lib/exporters.ts`). All of them use
the rig maths the viewport and gizmos use.

- **glTF**, one self-contained `.gltf`. There is a node per bone and the
  cubes are meshes on their bones. Textures are embedded with
  nearest-neighbour sampling, and there is a material per texture. Each clip
  becomes an animation, sampled at its snapping rate, so every easing and IK
  comes out as it plays here. Blender imports it with the rig and an action
  per clip. 16 units make a metre.
- **OBJ**, the rest pose in a zip with its `.mtl` and the textures as PNGs.
- **Java model JSON**, through the same converter the resource pack uses.
  Anything Java JSON cannot express is listed in the Validation panel.

## Tests

```
pnpm test
```

The suite is in `tests/`. It runs on Node's built-in test runner, with the
`playwright` library driving Chromium, so it needs no packages beyond the ones
already installed. Each file starts its own Vite dev server on a free port, so
nothing else has to be running. Tests that check the maths load the app's
own modules in the page (`import('/src/lib/vellum.ts')`), so they exercise the
code the editor runs.

| File | What it holds to |
| --- | --- |
| `codec.test.mjs` | Every sample round-trips byte for byte; version 8's nulls, events and ping-pong survive; v7 opens, v9 is refused; box UV and per-face textures are kept |
| `kinematics.test.mjs` | Rotation matrices match the browser's CSS transforms; IK brings a two-bone arm to its target |
| `modeling.test.mjs` | The gizmo tools and their keys, resize, snapped rotation, outliner picking, copy/paste/group/delete with undo, box select, the view tabs |
| `animator.test.mjs` | Posing keys at the playhead; key select, box select and drag; effects, onion skin, graph, playback, IK |
| `uv.test.mjs` | `lib/uv-edit.ts`, then UV drags and handles, box UV, importing, per-face textures, painting a 2x texture, re-unwrap |
| `layout.test.mjs` | Every mode of a mob, an item and a block opens without errors and with no control covered; the Studio layout; the other pages load |
| `interchange.test.mjs` | A Blockbench project with groups, loose cubes, a mesh, Molang, bezier keys, effects and an IK null comes in whole; Java JSON comes in and round-trips; glTF has a node per bone, an animation per clip and no inward triangles; the OBJ zip; opening both through the editor |
| `paint.test.mjs` | The paint sheet, face picking, keeping strokes inside a face, painting on the model, the palette |
| `mesh.test.mjs` | Every primitive faces outward; extrude, merge, flip and delete keep a mesh whole; the v9 round trip; adding, picking, extruding, moving and merging in the editor; a Blockbench mesh imported and exported to glTF facing outward; painting a mesh face; loop cut and subdivide leave the surface closed; Edge mode, box-picking vertices and dragging mesh UVs on the sheet |
| `mesh-tools.test.mjs` | Knife (including cuts that stop inside a face), bevel, edge slide, loop select, fill, dissolve, inset, turning and scaling keep a cube closed and facing out; faces a flat map can't fit split into triangles; the knife, bevel, inset, gizmo turn and scale, and slide in the editor; a dragged UV corner drawn as two triangles |
| `bbmodel.test.mjs` | Every sample saved as a `.bbmodel` opens as the same model; a Blockbench project (4 and 5 outliners) keeps its display, cullfaces, colours, render modes, texture ids, blend weights, keyframe fields and unknown elements through a `.vellum` and back; ids that aren't uuids and ping-pong clips survive; Save's format menu, and a `.bbmodel` saving back as one |
| `bedrock.test.mjs` | Every sample out to Bedrock geometry and animations and back keeps its bones, cubes, UVs and motion; a hand-written Bedrock file with `pre`/`post`, catmull-rom, Molang, single values, locators and effects; meshes as poly meshes and keyed nulls as bones, both ways; the export zip and adding animations from File ▸ Open |
| `molang.test.mjs` | The evaluator's operators, math in degrees, queries, variables and statements; Molang keys playing, and kept through the `.vellum`, Blockbench and Bedrock; typing Molang on a key in Animate |
| `controllers.test.mjs` | A controller moving between states, adding clips at weights, running entry scripts and cross-fading; controllers kept through the `.vellum`, the `.bbmodel` and Bedrock's files, with the entity file; making, playing and switching one in Animate |
| `layers.test.mjs` | Layers flattened bottom first at their opacity, hidden ones left out, and merged down as they looked; kept through the `.vellum` and the `.bbmodel`; adding a layer, painting on it alone, hiding it and flattening in Paint |
| `modes.test.mjs` | A display slot takes and resets a transform; the real-world view opens and closes; a behaviour cycle runs and takes a stage |
| `bundle.test.mjs` | `dist/vellum.html` opens and keeps its unprefixed `backdrop-filter`; skipped until `pnpm build:single` has run |

Chromium is taken from `/opt/pw-browsers/chromium` when it is there,
otherwise from Playwright's own install. Set `CHROMIUM` to use another. A test
fails on any page error or console error, except failed requests to the
outside (the Archivo font), which a sandbox without network cannot make.

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
