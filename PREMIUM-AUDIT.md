# Premium audit

Six auditors looked at Vellum on 2026-10-01 with four questions in mind:
what does premium feel like for this product, does it feel premium, is it
usable, and does it justify its price. This file merges their six reports
into one list, ordered by what to fix first.

- **Build.** `vellum/dist/vellum.html`, Studio 0.9.0, at `5c397db` (artifact
  v47).
- **Method.** Headless Chromium at 1920x1080, 1440x900, 820x1180 and 390x844
  (the last two as touch), with and without reduced motion, at 200% and 400%
  zoom, and at 4x CPU throttle for timings. Contrast was measured on
  rendered pixels, with axe-core as a second opinion. Each auditor took one
  area and worked from scripts, screenshots and measurements. Those stayed
  in the session's scratchpad. Every finding here names a route, an element
  or a `file:line`, so it can be checked against the code.
- **Read-only.** The audit changed nothing in the app.
- **Areas.** FC first contact (home, sign-in, server list, the entrance); DA
  the Dash; ED the editor; LS library, Settings and Support; QA craft,
  consistency and accessibility on every page; PV value and pricing. Each
  finding below has its own ID and lists, in brackets, the auditors' IDs it
  merges.
- **Severity.** Blocker: stops a real task, or the sale. Major: a paying
  user meets it in the first week, or it makes the product look unsure of
  itself. Minor: friction or finish. Polish: detail.

## The short answers

### What premium means for Vellum

The buyer is a server owner, or a small team, paying monthly for a tool they
open most days. The six auditors' definitions agree on this bar:

1. **It does the hard thing the free tools can't, and says so.** Blockbench
   gives modelling away. The paid line is running content on a live server:
   validated pushes without a restart, who is on which pack build, rollback,
   safe team access.
2. **It never looks unsure of itself.** Cards agree with each other and with
   the server list. Every control works or says why it can't. Nothing is
   invented, and sample data never looks connected.
3. **My work is safe and goes where I expect.** What I edit is what ships.
   My models are in my library. Save overwrites in place, autosave recovers,
   undo covers everything, and a typed value is kept exactly.
4. **Direct and fast.** The selected cube is unmistakable and moves by
   handles on the canvas. Nothing blocks for more than about 100 ms, and an
   idle page does no work.
5. **One product, resolved at every size.** One type scale, one set of
   components, one word per status, and the same brightness from the Dash
   into the editor. Nothing scrolls sideways from 390 to 1920 px or at 200%
   zoom.
6. **Keyboard-complete and readable.** Every core task works without a
   mouse. Text is at least 4.5:1, measured on pixels. Saves, errors and page
   changes are announced.
7. **Terms in numbers.** Each plan states its price, what is charged for,
   its limits and its support time, from one source every page reads. The
   upgrade appears where Free runs out, and it works.
8. **Delight that costs no time.** Pip and the entrance delight once and
   then step aside: skippable, never over the page's text, never adding
   seconds to a task.

### Does it feel premium? Mean 5.2 of 10

In a screenshot, yes. At 1440 and 1920 the dark pages look expensive: real
3D models on tinted stages, tabular numerals, three inks per surface,
careful glass, and a clean console on all 72 route-and-size loads. In use it
reads as a prototype in four places. The system frays up close: 22 font
sizes, about 20 corner radii, four styles of selected tab. The Dash spends a
quarter of a CPU core while nothing happens. Opening a model throws the
screen from near-black to light grey. And six editor tools light up and do
nothing.

### Is it usable? Mean 4.5 of 10

The happy path works without help on a desktop: sign in, enter a server, run
the demo, apply, paint, write config, export a valid pack. Real work
doesn't. There is no plugin to get, no way to link a server or create an
account, the library never shows your own models, edits never reach the
exported pack, and shaping and animating are done by typing numbers. Three
pages scroll sideways on a phone, and the editor's outliner can't be used
from the keyboard.

### Does it justify its price? Mean 2.8 of 10

Not as presented. There is no price and nothing to buy or sign up for. Pro
and Studio Engineer are the same four points at two seat counts. The home
page's Free tier covers a solo owner's whole job. The demo shows team
features working on Free. And the paid screens (Billing, Teams, Cloud) are
the least finished in the app, with a dead Upgrade button. The value to sell
is real and already visible on the Dash: Apply swaps only a validated set
and explains a refusal, adoption is counted per pack build, pre-flight
checks name the cube, and config is written beside the model. As far as the
auditors know, no free tool does these.

## Verdicts

| Area | Auditor | Premium | Usable | Price | In a line |
|---|---|---:|---:|---:|---|
| Home, sign-in, server list, entrance | FC | 6 | 6 | 3 | A premium first screen over a template page; the welcome title lands on the Dash's text |
| The Dash | DA | 5 | 4 | 3 | Real craft that reads as a showcase: the status contradicts itself, there is no history, no server can be linked |
| The editor | ED | 4 | 4 | 3 | The game-aware parts are excellent; the modelling core is weaker than free Blockbench |
| Library, Settings, Support | LS | 5 | 4 | 2 | Support is help-desk grade; the library can't hold your work and the paid sections are placeholders |
| Craft and accessibility | QA | 6 | 6 | 4 | A clean console and reduced motion honoured; 22 type sizes, a mouse-only outliner, never idle |
| Value and pricing | PV | 5 | 3 | 2 | The paid line isn't drawn, and as written Free gives the paid value away |
| **Mean** | | **5.2** | **4.5** | **2.8** | |

PV scored usability for buying and getting started.

## Keep: already premium

- The home hero, "Build the mobs your server runs", with "without a restart"
  as the line to lead with, and the turntable that lights each model on its
  own tinted stage.
- Apply's three verdicts in plain words: a swap, a refusal with the server's
  report, and an error ("The server is still running the content it had
  before.").
- The adoption ring (one slice per player, an honest "0 of 12" right after a
  push, a calm "Nobody online") and Pack builds with players per build.
- The plugin write path: every write validated and clamped, and the plugin
  told what was corrected.
- Validation that knows the game and the plugin: it names the cube, the
  reason and the exported angle, and knows the 16-unit item slot.
- The Config tab: one schema, live YAML with the plugin's path, blank means
  inherit.
- "View in the real world", the Behaviour editor, auto-animation that says
  what it read, starter models per kind, and new cubes placed in free UV
  room.
- A current pack export: item definitions for 1.21.4 and later, default
  display transforms, and a list of what it left out and why.
- Named undo, a stroke as one step, the unsaved-changes guard, and refusals
  that say what to do ("grip is locked. Unlock it in the outliner first.").
- The Support thread: grouped messages, delivery ticks, optimistic send with
  retry, search into message text, list and thread as two screens on a
  phone.
- The New model, Export and World dialogs, the best-crafted screens in the
  app.
- Honest copy where it exists: "Price at launch", "No card needed", `sample`
  badges, the sample sign-in note, Cloud's operator-access statement.
- The engineering basics: a clean console on all 72 loads; first paint in
  250–360 ms from one 1.1 MB file; reduced motion fully honoured, with no
  animation or frame loop on any route; a skip link and a 2 px focus ring
  everywhere; menus and dialogs that trap and return focus; no sideways
  scroll at 1920, 1440 and 820 or at 200% zoom; 0 axe violations on the
  Dash.
- The entrance itself: Pip in the server's colour, the Dash opening out of
  the swirl, Skip shown at once with focus on it.

## Findings

Grouped by theme, most important first within each theme. Each fix is the
auditors' recommendation. Where a fix is a product decision, it says so.

### A. Trust breakers

Each is small to fix, and each makes the real parts look fake.

**A1 · Major · Settings moves typed values into other sections' fields.**
Type a display name in Profile and switch to Account: it is now in Account's
Email field, and Profile's handle shows up as the password. The uncontrolled
`defaultValue` inputs in `Body` (`Settings.tsx:562-690`) sit at the same
places in the tree, so React reuses them from section to section. Profile
has no Save, so typing is lost on a switch, and Account says it is read-only
while accepting typing. Fix: `<Body key={section.id}>` or controlled inputs;
`readOnly` where the copy says read-only; a Save with a dirty state for
Profile, or make it read-only. [QA-1, LS-3]

**A2 · Major · A personal Gmail address ships in the bundle, and Studio
pages open signed out.** With nobody signed in, Account's Email falls back
to a hard-coded personal address (`Settings.tsx:572`). It is in
`dist/vellum.html`, so it is in the published artifact. Only `#/servers`
requires sign-in (`Servers.tsx:93-95`), so `#/settings/account` shows the
address to anyone. The handle, the bio, the owner in Teams and Cloud, and
the Support requester are hard-coded too. Fix: fall back to
`g.alex@example.com`; guard `#/dash`, `#/projects`, `#/settings/*` and
`#/editor/*` the way `#/servers` is; take identity from the session. [QA-3,
LS-5]

**A3 · Major · Dead controls, including the button that sells.** Billing's
**Upgrade** and **Compare tiers** have no handler (`Settings.tsx:663-664`),
and the Dash's Plan card leads there. Directory's four **Change** buttons do
nothing (`:629`), and its "Vellum only reads files inside these folders"
isn't true of a browser app. Five switches (Keep me signed in, Send crash
reports, Beta channel, Reload on external change, Index subfolders) save to
`vellum.prefs`, which nothing reads, and "Send crash reports" is on while
nothing is sent. Fix: the home page already shows "not yet" well, with a
disabled **Opens soon**. Give every inert control that treatment with a
reason, or a working route. Drop Directory and Watchers from the web Studio,
or wire them up. [QA-2, PV-3, LS-2, LS-4]

**A4 · Major · The app contradicts itself.** All measured: a green
"Connected" on the Dash while Settings › Plugin says "No reports yet · Last
report Never"; Teams' "1 of 1 used on the free tier" above three people;
Cloud's "1 member" beside files by five people, and its "0 B of 5.0 GB"
while Billing says storage is N/A; "Build none" beside a build hash; a toast
"Everyone's on the new pack · 1 of 1 players" over a ring reading 3 of 4;
About's "Studio 0.9.0" against "vellum 0.6.0" in the editor's status bar
(`Editor.tsx:3455`); "Vellum PvP 20/120 players" on the list against 3 on
its Dash; "Viewer seat on Copperline, 3 of 3 seats filled" against "Free ·
Seats 1 of 1"; Apply's "2 mobs · 9 items · 3 blocks" against Server files' 9
mobs; the demo's error naming `play.demo.vellum.gg` while the hero shows
`eu-west-2.vellum.gg`. Fix: plan, seats and members in one store that Home,
the Dash, Billing, Teams and Cloud all read; the version from
`STUDIO_VERSION`; the demo seeded from the server entered (players, plan,
seats, role, host); a file's pack state derived from the builds; toasts that
wait for the data they describe. [QA-14, DA-5, FC10, PV-4, PV-14, LS-2]

**A5 · Major · The plan on the Dash is whatever the server's plugin says it
is.** `PATCH /dash/subscription` (`lib/dash.ts:532-538`) accepts
`{type: 'Studio Engineer', seats: '5 of 5'}`, and the tile shows it while
Billing says Free. The Java example in `docs/plugin-api.md:320` writes
online and maximum players into `seats`, which renders as "Studio Engineer ·
37 of 120". Fix: entitlements come from the account; drop `subscription`
from the plugin API or make it read-only; fix the example. [PV-5, DA-8]

**A6 · Major · The owner's own clicks pose as plugin reports.** The card
menu's **Clear history** runs through the plugin's write path
(`dash.clearFiles('ui')` into `dashStore.accept`, `dash-api.ts:477-481`). In
the sample state the chip turns green "Live" and "Run a demo server"
disappears; a minute later Settings › Plugin says the plugin "has missed a
check-in or two", with no plugin anywhere. With a real plugin it would
refresh "last seen" and hide a dead one. **Unlink the plugin** is offered
with nothing linked, and during the demo it leaves "Connected · Live ·
sample". **Copy as JSON** gives no feedback. Fix: writes with `via: 'ui'`
never touch `lastSeen`, `fed` or the plugin log; Undo or a confirmation on
Clear; Unlink only when something is linked; a "Copied" toast. [DA-7]

**A7 · Minor · Invented values and untrue claims.** "Last changed 04/02/26"
on a sample password; every library card stamped "09/19/26 03:18"
(`data.ts:179`); all three changelog releases dated 09/19/26 00:00. The
changelog's "Reachable without a mouse" and "Text meets AA contrast on every
page" (`Settings.tsx:219-224`) are both untrue today (D6, I2). About's "Link
a plugin on the Dash" (`version.ts:71`) and `docs/plugin-api.md:26`'s "point
Vellum at it in **Plugin feed**" name controls that don't exist. Fix: real
dates or none; correct the claims; point the copy at the link flow once it
exists (C3). [LS-4, PV-14, QA-6, QA-9, DA-4]

### B. The paid story

This theme answers the price question. The auditors agree the value is real.
It isn't drawn, priced or shown.

**B1 · Blocker · Free and paid are undefined, and as written Free gives the
paid value away.** Home's Free is "The Studio and the plugin · Your own
servers · Push packs and apply files" (`Home.tsx:50-75`), so a solo owner
never needs to pay. About calls the free tier standalone, with a plugin for
"paid features" (`version.ts:71`). The README says "The free tier has no
plugin and no other way to get a pack at all" (`README.md:744`). The export
dialog says its zip is "for servers with no Vellum plugin". Fix (a product
decision): draw the line at running a live server, and keep it in one plan
source that Home, Billing, About, Export and the README read. The auditors
suggest Free = the Studio, export, the plugin on one server, manual Apply,
the last 3 builds; Pro = a hosted pack, one-click rollback, 90 days of
history, more servers, roles; the top tier = networks, with staging,
approvals, an audit log and a support target. [PV-1, FC6, DA-8]

**B2 · Major · Pro and Studio Engineer are one product at two seat counts,
under three names.** `Home.tsx:64` and `:72` share four points: both start
"Everything in Free", both offer "Extra seats when you need them". The top
tier is "Studio Engineer" on Home, "Studio" in `docs/plugin-api.md:42` and
"the team tier" in a sample ticket (`support.ts:270`). "Studio" is also the
app's name, and "Engineer" reads as a job title beside the app's roles
(Owner, Editor, Viewer). A Viewer takes up a paid seat. Fix: tiers that
differ by what you can do; the top card says "Everything in Pro"; a new name
for the top tier; free viewers. [PV-2, FC6]

**B3 · Major · Nothing can be bought or asked for.** No price, trial or
waitlist. The featured Pro card's one button is a disabled "Opens soon", and
Home says "not yet" five times. Inside the Studio, "Pro" and "Studio
Engineer" never appear. Fix: "Get notified" with a short form (email,
servers, team size, current tools, price questions) that doubles as the
price test; Billing and Teams say "Paid plans open soon"; feature Free while
paid is closed. [PV-3, FC6, LS-2]

**B4 · Major · The demo shows paid features working on Free.** The Plan tile
says "Free · Cloud N/A · Seats 1 of 1" beside Recent files saved by kite,
g.alex and juno; Teams lists a team "on the free tier"; Cloud shows a
workspace with files shared by five people. Fix: one consistent state. Label
the demo "Pro trial · 14 days left", or stay on Free and show the line where
it bites ("kite and juno saved files here. Give them seats with Pro.").
[PV-4, LS-2, DA-8]

**B5 · Major · The paid screens are the least finished in the app.** Billing
is three rows (Free, N/A, -) though its blurb promises "Plan, payment method
and invoice history". Teams has no invite, remove or role controls though
its blurb promises "Seats, roles and shared scene access". Cloud's storage
bar has a forced 1.5% fill at "0 B" (`Settings.tsx:439`). None says it's a
preview or which plan opens it: a lock icon hidden from screen readers, with
no tooltip, is the whole hint, and Support carries the same lock while it
works on Free. Teams and Cloud name g.alex as owner whoever signs in, and
ignore the server you entered. Fix: Billing compares the plans from the same
data as Home; Teams and Cloud carry a "Part of Pro. Preview with sample
data" banner, with controls disabled and the reason given; a "Pro" pill that
explains itself in place of the locks. [LS-2, LS-15, QA-2, PV-13]

**B6 · Major · The assurances a monthly payer checks are missing.** The
footer is the wordmark and Mojang's notice. Nowhere on the site: price
terms, trial, refunds, cancellation, uptime, status, security, roadmap,
terms, privacy, contact or docs. Nor supported versions (packs target 1.21.4
and later; the sample servers say Paper 1.21.4 and Purpur 1.21.1; export
defaults to pack format 84, "Minecraft 26.1.2"), Java or Bedrock,
ModelEngine and MythicMobs, migration, how a bad push is stopped, or who
owns the models. Support time shows once, inside a new ticket ("within 8
hours on the free tier"). Cloud honestly says "Vellum's operator also has
admin access to every workspace it hosts", with no limit stated, which
argues against the hosted feature. Fix: a "Works with" strip and a
compatibility table; a "Safe pushes" block (Apply validates, swaps, and
refuses with a report); a short FAQ; a footer with Docs, Plugin API,
Changelog, Status, Support, Privacy and Terms; support targets per plan; an
operator-access policy that is limited and logged, stated only if true.
[PV-10, FC7, LS-10]

**B7 · Major · What beats the free tools is barely on the home page.**
"Ship" gets one sentence. Validated Apply, adoption per build, pre-flight
checks that name the cube, config beside the model, behaviours and the
real-world stage never appear. Below the hero the page is icon cards, text
steps and placeholder plans, and one of the eight models in the reel is a
mob, under a headline about mobs. The Dash, the most persuasive screen,
needs a sign-in. Fix: four real captures (the editor, an auto-built walk,
the adoption ring, a model in "View in the real world"); "Try the live demo"
with no sign-in; lead the reel with animated mobs. [PV-11, FC8]

**B8 · Minor · Support gives paid plans nothing, and the samples advertise
failures.** No faster target or Urgent option on a paid plan. Each ticket's
`slaMinutes` and the queue position from the SLA endpoint are never shown.
The first sample ticket on screen is a hosted pack serving a stale cache
header, and another is "Upgraded to the team tier but seats still read 1 of
1" (`support.ts:145`, `:270`): both paid promises, shown failing. Fix:
"Priority support" with a first-reply time on the paid cards; "First reply
due in 1 h 14 m" on each ticket; sample tickets that show the value,
labelled as samples. [LS-10, PV-13]

### C. The loop a paying user needs

This theme answers the usability question. The demo runs; real work never
comes back.

**C1 · Blocker · Edits never reach the resource pack.** Set `honeyed_loaf`'s
Size Y to 12, save, and export from the shelf:
`models/item/honeyed_loaf.json` still has the old size. The export is built
from `sampleById(...).model` (`Projects.tsx:388-396`), and the editor's File
menu has no Export. Fix: Export pack, and Push to server when linked, in the
editor's File menu, built from the open model. Until then, label the shelf
button "Export the sample pack". [ED-1]

**C2 · Blocker · The library can't hold your work.** Shelves list exactly
the bundled samples (`data.ts:169-190`). A new mob saved as
`frost_warden.vellum` downloads, and the Mobs shelf still reads "1 file".
There is no Import, drag-and-drop, Rename, Duplicate, Delete, Move or sort.
The Tidewrack and Emberfall scenes can't be reached from the UI; by URL they
show `Nothing on this shelf matches “”`, while Cloud lists files under them.
Fix: keep models in the browser (IndexedDB or OPFS), so every new or opened
`.vellum` lands on its shelf with its real time and author; Import, Rename,
Duplicate, Delete and Move; a Recent row; the bundled models under
"Samples". [LS-1, PV-8]

**C3 · Major (a Blocker at launch) · No way to start: no plugin, no link, no
sign-up.** "Get the plugin" scrolls to Plans (`Home.tsx:140`) while step 1
says "Install the plugin". Nothing links a server: `connect()` only
reconnects a saved link (`Dashboard.tsx:64-69`). "Start free" ends at "Sign
in to Vellum. Use the account your servers are linked to", with no way to
create an account or reset a password. For an owner with nothing linked, the
Dash's main button is "Run a demo server". Fix: a plugin page (download,
supported versions, install steps, checksum); "Connect your server" in the
Dash's empty state and in Settings › Plugin, with a one-time code for
`/vellum link <code>` and a Test connection button; a create-account card
behind "Start free"; in the demo, call the entry "Try the demo". [PV-6, FC1,
FC5, DA-4]

**C4 · Major · Nothing comes in.** File › Open refuses a `.bbmodel`
("model.bbmodel is not a .vellum - Vellum opens the models it writes.",
`Editor.tsx:3067`). There is no PNG import, replace or new texture, and no
drag-and-drop; UV and painting use `model.textures[0]` only. No ModelEngine
or MythicMobs config comes in either. Fix: a one-way `.bbmodel` importer
(groups, cubes, box and per-face UV, animations) with a report of what
didn't translate; PNG import; files dropped on the editor; config import
later. [ED-5, PV-8]

**C5 · Major · The demo never closes the loop it sells.** Home's step 3 says
"Saving writes to the server"; with the demo running, Ctrl+S downloads a
file and the Dash doesn't change. Apply is unrelated to any edit and
succeeds one time in three by design (a swap, a refusal, an HTTP 500), and
each press takes 6.5–7.2 s. Pack builds has no rollback. Fix: while the demo
runs, Save reaches the demo server ("g.alex saved voidling.vellum · not
applied"); Apply succeeds by default, with the refusal and the error behind
"Show me a refusal"; the new build lands in Pack builds; older builds get a
"Roll back" tagged Pro. [PV-7, DA-9]

**C6 · Major · Every save is a fresh download, and nothing protects work in
progress.** Each Ctrl+S downloads a new copy, even with nothing changed
(`lib/download.ts:21-28`). In "Leave the editor?", Ctrl+S, which the dialog
suggests, saves, but the dialog stays open saying the model "has unsaved
changes", offering "Keep editing" and a primary "Discard and leave". No
autosave or recovery: a reload brings back the sample. Hypothesis:
cancelling the browser's save dialog still clears the unsaved marker. Fix:
the File System Access API (pick a file once, then overwrite it); "Save and
leave"; local autosave with a recovery prompt. [ED-10]

**C7 · Major · Display transforms are lost on reload and never exported.**
The Display tab says they "aren't saved in the .vellum. Copy them into your
pack's item JSON"; export writes the game's defaults; editing a slot doesn't
mark the file unsaved; the GUI slot is drawn in perspective with no slot
frame. Fix: keep display transforms in the `.vellum` and export them; an
orthographic GUI preview inside a slot frame. [ED-11]

**C8 · Major · The runtime does less than the plugins the buyer already
owns.** A "Weapon" item sets identity only (display name, model, lore, stack
size, durability): no damage, attack speed, food or effects. `CONTINUE.md`
calls this "the largest gap in the app". Mobs have 3 identity keys, 9 flags,
8 AI goals and 2 animation states, and no skills. Fix (a product decision):
position Vellum alongside those plugins, with export to their formats, or
put item behaviour and mob skills on a dated roadmap and price the launch to
match. [PV-9]

### D. The editor

A Blockbench user reads the editor as a prototype within a minute, while the
parts no free tool has are the best in the app.

**D1 · Blocker · The transform tools do nothing.** Move, Resize, Rotate,
Pivot, Vertex snap and Knife light up, and a drag across the selected cube
orbits the camera; only the status bar's word changes ("selected: guard ·
knife"). `tool` reaches the toolbar and never `ModelView`
(`Editor.tsx:3078-3083`). There are no handles, no pivot marker and no bone
highlight. Fix: move, scale, rotate and pivot handles on the canvas, with
snapping and auto-keying in Animate. Until then, remove the tools, starting
with Vertex snap and Knife. [ED-2]

**D2 · Major · A textured cube shows no sign of being selected.** A pixel
diff of nothing selected against a cube selected: 0 pixels change on
`honeyed_loaf`'s loaf, `alien_sword`'s guard and `geyser_block`'s basin. The
outline is painted under `.model-face__skin` (`ModelView.css:52-56`). Fix:
draw the selection above the skin, as an outline box; a pivot dot; highlight
every cube under a selected bone. [ED-3]

**D3 · Major · Snap rounds typed values, and it's on by default.**
`NumField` emits `Math.round(v)` while snap is on (`Editor.tsx:562`): 2.5
typed becomes 3, and one ArrowUp on the voidling's Pivot Y of 12.5 gives 14.
The samples are full of half units, so the first nudge corrupts them. Fix:
snap drags and scrubs only; nudge by the step from the current value; show
the increment beside the magnet. [ED-4]

**D4 · Major · Animating is numbers only, and the key editor starts
off-screen.** At 1440x900 the Keyframe panel starts at y=1028, below the
visible rail. Clicking a key changes only its fill. K adds a key without
selecting it. The timeline shows 5 of 19 channels and uses 384 of 1,418 px
for a 3.2 s clip. There is no posing on the canvas, graph editor, multi-key
selection, or copy and paste of keys. Fix: select a new key; show the
selected key's values in the timeline bar, or pin the panel in Animate; fit
the clip to the track; pose with the rotate handle and auto-key. [ED-6]

**D5 · Major · UVs are numbers only, and resizing stretches textures
silently.** Resizing `geyser_block`'s throat from 8×1×8 to 16×4×8 leaves its
north UV at `34,41 → 42,42`, a 2×4 stretch, while Validation says "No
problems" (`lib/model.ts:197`). The UV sheet is a fixed 276 px for 64 texels
with no zoom, and on small cubes the face labels pile up ("UD ENWS"). Fix:
UV rectangles you drag and resize, with zoom and a pixel grid; a box-UV mode
that re-unwraps on resize (reusing `uv-pack.ts`); a warning when texel
density isn't 1:1. [ED-7]

**D6 · Major · The outliner fights you, and the keyboard can't reach it.**
Clicking a bone selects and collapses it (`Editor.tsx:1251`; selecting
`torso` hid 19 parts), and Add cube then puts the new cube inside the
collapsed bone, out of sight. One selection at a time; no copy and paste.
None of the 36 tree items can take focus (no `tabindex`, `aria-expanded` or
`aria-level`); renaming is double-click only and reparenting drag only; 88
of the editor's 178 tab stops are row toggles. Keyframes select only on
`pointerdown`. A drag doesn't scroll the list, a stray drop makes the part a
root, and dragging highlights text across the page. Fix: collapse from the
chevron only, and reveal new parts; Shift and Ctrl multi-select; a
roving-tabindex tree (arrows, F2, Delete, Ctrl+C and Ctrl+V); the row
toggles out of the tab order, on H and L; Enter and arrow nudges on
keyframes; `user-select: none` on the rows. [ED-8, QA-6]

**D7 · Major · Hiding a cube can change where a mob can be hit in game.**
Hiding the voidling's `jaw` switched "Where it can be hit" from "16 bones"
to "1 marked", leaving 15 bones that can't be hit, and the hide is saved
(`lib/vellum.ts:189`). The panel warns about it. Fix: a view-only hide that
isn't saved, and an explicit hit-region flag on the bone. `CONTINUE.md`
already lists that flag as the most useful cleanup. [ED-9]

**D8 · Major · Wire and Quad are broken.** Wire still draws textures: the
rule at `Editor.css:1050` clears `.model-face`, and the texture is on
`.model-face__skin`. In Quad the side rails cover two of the four cells, and
all four views are in perspective. Fix: hide the skin and draw edges in
Wire; lay the cells out between the rails; orthographic Front, Top and
Right. [ED-12]

**D9 · Major · The keyboard is thin and hidden.** V, M, R, S, B, E, P, 1–3,
F, ? and F1 do nothing. Help holds "Report a bug" and "About Vellum", and
the mode buttons have no tooltips. Ctrl+D duplicates the clip in Animate
while Edit says "Duplicate Ctrl D". Delete does nothing in Paint, Config and
Display. "New model… Ctrl N" uses a key Chrome keeps for itself
(hypothesis). Fix: a key for every tool, numbers for modes, Esc to deselect,
F to frame; shortcuts in tooltips and on a `?` sheet; New model on Alt+N.
[ED-13, QA-17]

**D10 · Major (a product decision) · Opening a model flips the product from
dark to light.** Mean screen luminance goes from 0.020 on a shelf to 0.352
in the editor, 17 times the light, several times a day and often in a dim
room. The accent changes (`#2a6ad8` to `#264690`), radii go from 10–28 px to
0–4 px, and even the top bar, which every page shares, changes colour. The
inventory greys were the operator's pick (`AUDIT.md`, phase 6), so this is a
question. The options: a dark inventory variant (panels near `#3a3b40`, the
viewport near `#2a2b30`) as the default with the light greys as an option,
or at least a dark top bar on the editor route. [QA-8]

**D11 · Minor · Validation is shown but can't be acted on.** A negative size
reads `"guard": to[0] is behind from[0]`. The panel stays shut when an error
appears mid-session (`defaultOpen` is read once, `Editor.tsx:3284`), "1
error" in the status bar can't be clicked, and warnings are drawn in the
danger red. Config takes Health 5000 without a word, and clearing Health
writes `health: 0`. Fix: plain messages ("Size X is negative"); clicking an
issue selects its cube or field; the panel opens on a new error; blank means
unset. [ED-14]

**D12 · Minor · The colour picker.** Dragging along the hue bar registers
only the press (`.color-hue` handles only `onPointerDown`,
`Editor.tsx:1058-1066`). The colour area and hue bar can't be reached from
the keyboard. There are no recent colours and no alpha. Fix: pointer capture
and move; slider roles with arrow keys; recents. [ED-15]

**D13 · Minor · Chrome and density.** Three bars stack above the viewport
(top bar 52 px, menu bar 36, toolbar 47), with two logos and two ways back;
at 200% zoom on 1280x720 the sticky top bar takes 29% of the height. The
Colour panel tops the right rail in every mode, which squeezes the Outliner
to 3 rows in Animate. At 820 px (touch) the editor is a 3,565 px stacked
page with the timeline at y=4,056; on a phone, undo and the tools scroll off
the right edge. 100 of 174 controls are under 24 px. Mouse hints
("right-drag orbit") show on touch screens. Fix: fold Dash, Projects and
Settings into the menu bar; the Colour panel in Paint only; a top bar that
stops sticking below 500 px of height; panels in a drawer on a tablet and an
overflow menu on a phone. [ED-16, QA-16, QA-12]

**D14 · Polish · The editor's face shading isn't the game's.**
`ModelView.css:43-48` uses up 1.14, down 0.62, north 0.78, south 1.0, east
0.9 and west 0.84. The game, and this repository's `CLAUDE.md`, use top 1.0,
north and south 0.8, east and west 0.6, bottom 0.5, so east faces look about
half again as bright as in game. Fix: the game's values, or a "game shading"
toggle. [ED-18]

**D15 · Polish · Copy and edges.** The viewport chip reads `mobs` like a
debug label; "TRANSLA…" is cut off in Display; the world chip mixes "2.34
blocks tall" with "8 units tall"; a new clip is named `animation.4` and an
auto-built one `auto_walk`, while the samples use `animation.voidling.walk`;
"Built auto_walk." is styled as a warning; the Behaviour tab on a sword says
"as soon as the block is placed". A 64-character name overruns its outliner
and texture rows, and `#/editor/not_a_model` silently opens Alien Sword.
Fix: as listed; `min-width: 0` and an ellipsis with a tooltip for long
names; a not-found state. [ED-19, QA-15]

### E. The Dash

Real craft that reads as a showcase. An owner opens it to learn in five
seconds whether anything needs them.

**E1 · Major · The status line contradicts itself, and old numbers look
live.** The dot follows the last reported `server.online` and ignores
whether the plugin still reports (`hero.tsx:60`). With the plugin silent: a
green, pulsing "Online" beside a red "No reports for 37s", "42 players
online" at full weight, and the ring "Counted just now", which covers
anything under 45 s (`dash.ts:687`). Restarting: a red "Restarting" beside a
green "Live". Offline: a green "Live" chip and 184 players. The sample
state: a pulsing "Connected" beside "Sample data". The status is 13 px text
and a 9 px dot under an 89 px name. Fix: one state from the server and the
feed together (Online, Restarting, Offline, Unknown), grey when stale or
sample; "updated 4s ago"; stale cards dimmed and stamped "as of 14:02"; a
20–24 px status band. [DA-1]

**E2 · Major · The hero is a showcase, and what needs attention is below the
fold.** At 1440x900 the hero takes 500 of 900 px, and on a phone the whole
first screen. The turntable shows the same 8 samples on every server, the
name's gradient re-tints to the model showing every 7 s, all three hero
stats repeat cards below, and the turntable holds 10 of the 15 tab stops
under the top bar. Problems sit lower down in 11–12 px chips, and the ring
names nobody though the store keeps a roster (`dash.ts:352`). Fix: a 200–240
px header with the status band from E1, the current build and its adoption,
and a Needs attention list with actions (players on an old pack, by name and
reason; a refused apply; a silent plugin; files saved and not applied). The
turntable moves to Projects, or shows this server's latest model. [DA-2]

**E3 · Major · No history.** Toasts leave after 4.2 s and Plugin activity
keeps 90 s. An Apply verdict is gone after a reload and leaves no "last
applied". Recent files lists saves only, with repeats, and nothing links a
save to the build that shipped it. Fix: an Activity log of saves, builds,
applies with their results, restarts and plugin errors, with who and when,
kept for 7 days, with a "since you last looked" marker; "Last applied 2h ago
by g.alex" beside Apply; Roll back on Pack builds. [DA-3]

**E4 · Major · Valid plugin data pushes the page sideways.** The Server
files row is a flex row that doesn't wrap (`Dashboard.css:753-761`), and the
API allows 12 kinds (`dash.ts:137`). Six kinds overflow a phone and eight
overflow 1440, where the page grows to 2,034 px wide. At 80 files to a cube,
17 particles and 44 sounds draw the same single cube. Fix: a sorted list or
horizontal bars (icon, label, exact count) that wrap inside the card. [DA-6]

**E5 · Major (price) · Roles are invisible.** A Viewer on Copperline gets an
enabled Apply, Unlink, Clear history and Stop demo, and nothing on the Dash
says who you are on this server. Fix: "You: Viewer on Copperline's team" in
the header; actions disabled with the reason ("Viewer seat: an Editor can
apply"); the plan from the account, with its seat holders. [DA-8, FC10]

**E6 · Minor · Apply holds back its verdict and stops short of the next
step.** Click to verdict takes 6.6–7.2 s for a 3.2 s answer; about 3.5 s of
it is Pip's ending. The HTTP 500 ends on a raw `POST … → 500` without saying
what is running now, and the refusal lists files as plain text. Fix: show
the verdict on arrival, with Pip finishing beside it; on an error, say
whether anything changed and offer Retry; link each refused file to the
editor; put Apply in a "Pending changes" section that counts files saved and
not applied. [DA-9]

**E7 · Minor · Settings › Plugin shows that something was sent, not what.**
It shows 90 s of unlabelled diamonds whose only detail is a tooltip on a
moving 10 px mark. The API's corrections (for example
`bytes: "lots" is not a finite number. Kept the previous value.`) are never
shown. With nothing linked it still says "Checks in every 30 seconds". The
offline warning is accent blue with an amber icon while the Dash's chip is
red. Fix: keep the lanes as a summary, and add a 24-hour log (time, what was
sent, the result, any corrections), the plugin and API versions, and Link,
Test and Unlink. [DA-10]

**E8 · Minor · Toasts are frequent and alarming, then gone.** 32 toasts in
155 s, six in the first 30. A planned restart shows as a red "Server went
offline" at 25.7 s; "The plugin sent a bad request · PUT /dash/players"
names an endpoint and nothing else; on a phone toasts cover Apply. Fix:
toast only what needs attention; a neutral "Restarting… back in 3 s"; toasts
that link to the Activity log; the demo's restarts starting after its first
minute; toasts at the top on phones. [DA-12, FC11]

**E9 · Minor · Empty space and a duplicate card.** The Plan card stretches
to its row (about 150 px empty, and 2,514 px tall beside 50 file rows).
Resource pack repeats the top row of Pack builds. Server files leaves 90–200
px above its stacks. The grid's gutters fall at a different x in each row,
and Recent files has no paging. Fix: Resource pack folded into a Pack builds
header, with the pack format and a copy-URL action; Plan on one line;
`align-items: start`; one 12-column grid; 8 rows and "Show all". [DA-14,
QA-12]

**E10 · Polish · Formatting.** US dates (`09/12/26 14:02`) on an `eu-west-2`
server read as 9 December. "Build none"; "Live" names both the feed chip and
the served build; "On an old one" counts players with no pack; "+40.0 KB";
"1 MOBS". A 9 px mono `sample` badge is all that marks a card as sample
data. Fix: one `Intl.DateTimeFormat` in the viewer's locale; one word per
idea; a sample marker people can read. [DA-15]

### F. Speed and idle work

**F1 · Major · The Dash and the home page are never idle.** Over 5 s with
nothing happening, Home takes 29% of the main thread and the Dash 25%; at 4x
CPU throttle, 81–82%, with 10–15 long tasks. The turntable sets React state
every frame (`useClock`, `showcase.tsx:129`), `ModelView` rewrites inherited
custom properties on the scene root every frame (`ModelView.tsx:509-523`),
and nine CSS loops run on the idle sample Dash. Every number counts up from
0 on each visit, so at 350 ms the ring reads 59% over a real 65%. The editor
at rest, and every page under reduced motion, use nothing. Fix: turn the
stage through a ref, with no render; stop writing inherited properties per
frame, or register them with `inherits: false`; stop decorative loops after
a few turns or 30 s without input, and while the tab is hidden; show numbers
at their value and animate only a change. [QA-4, DA-11]

**F2 · Major · Opening a shelf freezes the page.** Each card renders a live
CSS 3D model, twice: 2,174 DOM nodes, 1,126 of them transformed, and 7
endless spins. Opening Items costs 873 ms of main thread, with long tasks of
365 and 280 ms, and 4.3 s at 4x throttle; one card's menu costs 457 ms at
4x. Fix: snapshot each model once to an image, and mount the live model on
hover or focus; no idle spins. [QA-5, LS-8]

**F3 · Minor · Big rigs get heavy in the editor.** A 200-cube rig is 7,281
DOM nodes. In software rendering one orbit drag gave 15 long tasks of 52–108
ms, and one paint stroke a task of 282 ms. Every pointer move re-renders the
model tree (`BoneNode`, `CubeBox` and `Face` aren't memoized), and every
paint frame re-encodes the PNG and rewrites every face's background. Fix:
the camera through a ref or CSS variables; a memoized model subtree; one
object URL per stroke frame. [ED-17]

### G. First contact and the entrance

**G1 · Major · The welcome title lands on the Dash's own text.** For 3 s the
message of the day prints over the hero's copy and the reel's label, and the
pixel "VELLUM PVP" sits under the hero's 90 px "Vellum PvP", so the name
shows twice. On a phone the message runs across Stop demo, and the same
happens under reduced motion (`Arrival.css:70-76`, `Arrival.tsx:160-171`).
Fix: a clean surface behind the title (a scrim of 0.9 or more), or hide the
hero's name until the title leaves and let the pixel title settle into it.
One name on screen at a time. [FC2]

**G2 · Major · Real server names come out with "?" in them.** The title's
letter set (`title.ts:60-105`) turns anything else into "?" (`:124`): "Café
Craft" becomes "CAF? CRAFT", "[EU] Hollowmere | Skyblock" becomes "?EU?
HOLLOWMERE ? SKYBLOCK", "mc_lobby_01" becomes "MC?LOBBY?01", and a Cyrillic
name is all "?". Names over about 26 characters overflow a phone, because
the scale never drops below 2 (`Arrival.tsx:142`). Fix: add
`[ ] ( ) | _ / # @ * ~`; fold accented Latin to its base letters; draw
anything still missing in the UI font with the same stepped shadow; allow
scale 1, or a second line. [FC3]

**G3 · Major · With one server, "Choose another server" plays the entrance
back into the same Dash.** The top-bar button and the account menu's "Choose
a server" go to the list, and with one server online the list goes straight
in (`Servers.tsx:97-102`): the walk, the Dash and the title, 6.5 s. The
list, and an offline server you own, can never be read. Fix: go straight in
only right after sign-in; show the list when someone asks for it; with one
server, make the top-bar button a label with "Link another server". [FC4]

**G4 · Minor · Each entrance costs about 6 s, and Skip saves half of it.**
Click to a clear Dash takes 6.3 s at 1440x900 (the Dash drawn at 2.4 s, the
title from 3.3 to 6.3 s), on every entry. After Skip the title still runs 3
s, and Escape during the title does nothing. Fix: the full walk on a
server's first entry of the day, then a short reveal and a 1.2 s title;
Skip, Escape and a click dismiss the title too; a "Play the entrance"
setting. [FC9]

**G5 · Minor · The first 30 seconds don't point at the job.** There is no
onboarding. The visible actions are Stop demo and a blue "Apply on the
server"; building is behind the Projects tab or a small "Open in the editor
→". "Creative mode, for now." (`hero.tsx:123`) means nothing to a newcomer.
Fix: a first-visit "Get started" card (open a sample, make a mob, push it);
"New model" as the hero's main action. [FC11, FC13]

**G6 · Minor · The server list has no empty state, no link action, and a
dead end for offline servers.** The offline row is a disabled button reading
only "Last seen 09/27/26 16:40", and Tab skips it. Seat rows name the role
without saying what it allows. At 1920 each row is 1,608 px wide. Fix: "Link
a server" at the top and in the empty state; an offline server you own opens
in an offline mode or says what is wrong; say what each seat allows; cap the
list near 960 px; relative times. [FC12]

**G7 · Polish · Edges.** The hero stage clips its glow and floor with hard
edges. The swirl opens mid-screen whichever row was clicked. At 1920 the
wordmark and Sign in sit 340 px outside the content column. The account menu
uppercases the email. The tab title on Home is just "Vellum", and there is
no link-preview image. [FC13]

### H. Library, Settings and Support

**H1 · Major · Clicking a card does nothing.** The preview and the name
don't open the model. The way in is the faint 32 px ⋯ and then "Open in the
editor" (`Projects.tsx:139-202`), while hover lifts and spins the card as if
it would open. Fix: make the card a link to `#/editor/<id>` (click, Enter,
middle-click), with ⋯ for the rest. [LS-6]

**H2 · Major · The library forgets where you were.** Filter, scroll, open a
model and come back: the filter is empty and the scroll is at the top.
Switching shelves clears it too. One of the sample support tickets describes
the same flaw. Fix: shelf, page and query in the URL; restore the scroll;
highlight the card you came back from. [LS-7]

**H3 · Major · It won't scale past a few dozen models.** The pager renders
every page number in a row that doesn't wrap: at 200 models on a phone,
pages 1–3 and Previous fall off the left edge, out of reach
(`Projects.tsx:205-235`, `Projects.css:315-322`). Groups are built per page
("Weapons 12", then "Weapons 8"). Search matches names only, so "weapon"
finds nothing under Weapons, and there is no sort and no search across
shelves. Fix: a windowed pager that wraps; groups across the whole result;
search by name, subtype, kind, author and tag; sort and Recent. [LS-8]

**H4 · Minor · Support threads behave oddly.** A reply on a resolved ticket
is accepted and nobody answers. Tickets vanish on reload though the page
says they "stay in your browser", and ids restart, so TCK-1044 was given out
twice. Pip holds a new thread back 4 s after Send. Files can't be attached
when opening a ticket or reporting a bug, and there are no links to docs,
status or a community. Fix: reopen on reply, with a system line; keep the
mock's tickets in `localStorage`; open the thread at once and let Pip finish
to one side; attachments with previews on the new-ticket and bug forms.
[LS-11, LS-10]

**H5 · Minor · Report a bug records the wrong context.** From the editor's
Help › Report a bug, the log says `route: #/settings/report-a-bug`, with no
Studio or plugin version (`Settings.tsx:117-124`). Fix: record the previous
route and model id, the versions and recent errors. [LS-12]

**H6 · Minor · Export pack miscounts and hides what it drops.** The shelf
says "7 files" and the dialog "14 models", counting item definitions as
models (`ExportPackDialog.tsx:54`). Six of the seven models have clips, and
the "rest pose only" note doesn't show because the dialog lists only
warnings. The notes split into columns (`.editor-hint` is a flex row,
`Editor.css:996-1003`), and `composer__hint` has no CSS. On Mobs, Export
pack is enabled and shows "0 models". Fix: count `models/` only; "6 of 7
models animate. A pack holds the still pose; with the plugin they play in
game"; `display: block` for prose hints; "Export configs" on Mobs. [LS-13,
PV-12, ED-19]

**H7 · Minor · Names and places don't line up.** "Projects" opens a page
titled "First scene", whose library is "Aurelian Keep", under the server
"Vellum PvP". The library is the same for every server and role, and a
Viewer gets New model and Export pack. Scene, shelf, library, files, assets
and model name the same things. `#/settings/notifications` silently shows
Account. Tiles, cards and settings entries are buttons where links belong.
Fix: tie the library to the server; hide create and export from viewers; one
set of nouns; real links. [LS-14]

**H8 · Minor · Settings search misses obvious words.** "password", "crash",
"upgrade", "email" and "sign out" find nothing, because it searches titles
and blurbs only, and Enter does nothing. Fix: search the field labels too;
Enter opens the first match. [LS-15]

**H9 · Minor · New model ignores where you started.** From the Mobs shelf it
opens on Item › Misc (`NewModelDialog.tsx:60`), and it doesn't warn about a
name that is taken. [LS-16]

### I. System, phone and accessibility

**I1 · Major · On a phone, pages scroll sideways or bury the content.** At
390x844: sign-in is 481 px wide, because its glow
(`.sign-in__card::before { inset: -40% -30% }`) overflows; Settings ›
Directory is 407 px and Cloud 572 px, because `.list-row` never wraps and
its column has no `minmax(0, 1fr)`; a 32-character account name pushes the
server switcher out of the top bar and scrolls `#/servers` sideways.
Settings stacks its 520 px section list above the content, so tapping
Billing changes only the title (the panel starts at y=795 of 844). Both Dash
tables hide their status columns behind a scroller with no cue, partly
because `.builds__table { min-width: 520px }` (`Dashboard.css:1048`) loses
to `.table { min-width: 660px }`, declared later (`:1093`). Fix:
`overflow: clip` on `.sign-in`; `minmax(0, 1fr)` and wrapping list rows; a
maximum width and an ellipsis on `.topbar__who`; the Settings list and
section as two screens, or a chip row, below 860 px; two-line table rows
below 560 px; the rule order fixed. [QA-7, LS-9, DA-13]

**I2 · Minor · Contrast gaps the repository's audit can't see.** Measured on
pixels: editor text faded with `opacity` at 3.6–3.9:1 (panel counts, texture
details, axis labels), "keyed" at 2.8:1 and YAML line numbers at 2.1:1; two
placeholders in the browser's `#757575` (3.75:1) while the rest use
`#949bab`; ".vellum" on the cards at 4.2:1 and 11 px; on the dark pages,
input borders at 1.4:1 and secondary-button borders at 1.15–1.25:1; outliner
toggles at 40% opacity, whose focus ring fades with them to 1.8:1.
`scripts/contrast-audit.mjs` skips text with a gradient or image behind it,
which covers every dark card, and ignores opacity below 1, so it reports 0.
Fix: an `--ink-subtle` token that passes 4.5:1 in place of opacity fades;
`::placeholder { color: var(--ink-faint) }`; borders at 3:1 (about
`rgba(255,255,255,.3)`); `.tree__toggle:focus-visible { opacity: 1 }`; an
audit that samples pixels. [QA-9, ED-19, LS-17]

**I3 · Minor · No type scale.** 22 font sizes are in use, from 8 to 89 px,
with 12, 13 and 14 and both 16 and 17 present; 60 distinct styles; 26% of
text runs under 12 px, and 40 runs at 8–10 px, the Dash's `sample` badge
among them. Card titles are set five ways; page titles at 76, 56 and 24 px;
the Dash's 89 px title is an h2. Fix: one scale with an 11 px floor (11, 12,
13, 14, 16, 20, 28, 56 and a display size); 12 px body text in the editor;
one style per role; the Dash's title as its h1. [QA-10]

**I4 · Minor · Components drift into several families.** About 20 radius
values, so the top bar puts a 10 px server chip beside a 4 px account chip.
Four styles of selected tab, one identical to the primary button beside it.
The same file is "outdated" in Cloud and "⚠ old on 7 clients" on the Dash.
Hover lifts of 1, 2, 3 and 4 px, a slide and a scale, and the Dash's cards,
which can't be clicked, lift like buttons. 71 of 619 spacing declarations
use the `--sp-*` tokens. Paired fields come out 40 and 51 px tall because
`.field` stretches (`Settings.css:103`). Fix: radii of 4, 8, 12 and 20 px
and a pill; one segmented control, one badge, one status vocabulary; one 2
px lift, for clickable things only; `.field { align-content: start }`; a
lint rule for spacing tokens. [QA-11, QA-12]

**I5 · Minor · Focus and announcement gaps.** Export pack and View in the
real world leave focus behind the scrim when they open. Under reduced
motion, entering a server leaves focus on `<body>`. Route changes, the
editor's "Saved" and file errors are visual only. The lock icons are
`aria-hidden`. The library's tabs are `role=tab` with no arrow keys or tab
panels. Support's thread and the Dash's table scrollers can't take focus.
Fix: focus the dialog's heading or first field; focus `main` after every
arrival; a polite live region for page titles, saves and errors; text for
the locks; plain links for the library tabs; `tabindex=0` on the scrollers.
[QA-13, QA-7]

**I6 · Polish · Leftovers.** `theme-color` is `#f4f4f3` on a `#0e1014` app
(`index.html:8`). The favicon is gold on navy while the mark in the app is
blue. Dates show as `mm/dd/yy`, as en-GB "01 Oct" and as relative ages. The
latin-ext font subsets, about 129 KB of the 1.13 MB file, never load for
English text. Fix: `#0e1014`; a recoloured favicon; one date format in the
viewer's locale; latin-ext dropped from the single-file build. [QA-17, FC13]

## What to do, in order

Ordered by how much each change raises perceived value per hour of work.
Sizes are rough: S is under half a day, M one to three days, L a week or
more.

### 1. Now: remove the trust breakers (about two days)

| # | Change | Findings | Size |
|---|---|---|---|
| 1 | Remove the personal address from the bundle; guard every Studio route behind sign-in | A2 | S |
| 2 | Key the Settings body by section; `readOnly` where read-only; Save on Profile, or make it read-only | A1 | S |
| 3 | Disable every inert control with a reason, the way Home's "Opens soon" does; drop Directory, Watchers and the switches that save to nothing | A3 | S |
| 4 | Snap only drags; draw the selection above the texture | D3, D2 | S |
| 5 | Keep the owner's clicks out of the plugin's last-seen; Unlink only when linked | A6 | S |
| 6 | Phone overflow: the sign-in glow, list rows, the top bar's name, the table rule order | I1 | S |
| 7 | The title's letters: punctuation, accents and a font fallback | G2 | S |
| 8 | One version constant, real dates, a true changelog | A4, A7 | S |
| 9 | One status from server and feed; one store for plan, seats and members; the demo seeded from the server entered | E1, A4, A5 | M |

### 2. Next: quiet, fast and one system (about two weeks)

| # | Change | Findings | Size |
|---|---|---|---|
| 10 | No per-frame React state; idle loops stop; numbers start at their value | F1 | M |
| 11 | Snapshot thumbnails on the shelves, live on hover | F2 | M |
| 12 | Cards that open on click; the library's place kept in the URL | H1, H2 | S |
| 13 | A type scale with an 11 px floor, five radii, one segmented control, one badge, one status vocabulary | I3, I4 | L |
| 14 | A contrast token in place of opacity fades; 3:1 borders; an audit that samples pixels | I2 | M |
| 15 | A keyboard outliner; focus moved into dialogs; a live region | D6, I5 | M |
| 16 | The entrance: a clean surface for the title, a short version after the first entry, no loop for one server | G1, G3, G4 | M |
| 17 | Settings as two screens on a phone; stacked table rows | I1 | S |
| 18 | The editor's theme: a dark inventory default, or a dark top bar (a product decision) | D10 | M |

### 3. Then: the loop a paying user needs (several weeks)

| # | Change | Findings | Size |
|---|---|---|---|
| 19 | Export and Push from the editor, built from the open model; display transforms saved and exported | C1, C7 | M |
| 20 | A library that keeps your work, with Import, Rename, Duplicate and Delete | C2 | L |
| 21 | Save in place, autosave and recovery | C6 | M |
| 22 | Move, scale, rotate and pivot handles, auto-keying in Animate; the tools that don't work yet hidden until they do | D1, D4 | L |
| 23 | `.bbmodel` and PNG import | C4 | L |
| 24 | A demo that closes the loop: Save reaches it, Apply succeeds by default, Roll back | C5 | M |
| 25 | An operations header, Needs attention and an Activity log | E1, E2, E3 | L |
| 26 | A plugin page, Connect your server, create an account (needs the plugin and a backend) | C3 | L |

### 4. Decide what is paid, before any price is shown

- Draw Free and paid at running a live server, in one plan source every page
  reads (B1).
- Give the top tier its own reason and a new name (B2).
- Open a priced waitlist; it is also the price test (B3).
- Make the demo agree with the plan it shows, and the paid screens honest
  previews (B4, B5).
- Add the assurances: compatibility, safe pushes, a FAQ, a footer, support
  targets, the operator-access policy (B6).
- Show what beats the free tools on the home page, with a demo that needs no
  sign-in (B7).
- Decide on item behaviour and mob skills, or position Vellum alongside the
  plugins (C8).

## The price question

From the value and pricing report. The numbers are hypotheses to test;
nobody checked competitors' prices.

- **Positioning.** "Live content operations for Minecraft servers". Today
  the page reads as "Blockbench in a browser". The buyer runs a Paper or
  Purpur server with custom content and one to four modellers or config
  writers, shipping weekly. The top tier is for networks with staging, and
  for freelance studios. The job: get new mobs, items and blocks onto a live
  server often, without breaking it or restarting it, and let the team
  contribute without SFTP or console access.
- **Today:** not sellable. At most a founding pre-sale.
- **At launch,** with the plugin, a hosted pack, Apply and rollback working:
  Pro at $8–15 a month per team (3 editors, $3–5 for each extra), the top
  tier at $25–45 (5 editors, about 5 servers).
- **Later,** with `.bbmodel` import, item behaviour, mob skills, staging and
  an uptime commitment: Pro at $15–25, the top tier at $60–150.
- **How to test:** a priced waitlist in three variants, the Van Westendorp
  price questions in its form, interviews with 10–15 server owners, and a
  paid pilot with 3–5 servers.

**Looks better than it does.** Billing, Teams and Cloud look finished and
are inert and contradictory. The Dash looks like a live console with no way
to link a real server. Projects looks like a team library and holds only
samples. The editor's tools look like Blockbench's and don't act on the
canvas. Weapon config can't set damage.

**Does better than it looks.** Apply that validates and explains a refusal
in plain words; adoption per build; pre-flight checks that name the cube; a
current item-definition export; auto-animation that explains itself; the
real-world stage; block behaviours; a plugin API that reports its
corrections. The home page shows none of these.

## Notes for this repository

- `scripts/contrast-audit.mjs` reports 0 while pages fail AA: it skips text
  over a gradient or image and ignores opacity below 1 (I2).
- Wrong today: `README.md:744` (the free tier has no plugin) against Home's
  plans (B1); `docs/plugin-api.md:26` (a "Plugin feed" panel that doesn't
  exist) and `:320` (player counts in `seats`) (A5, A7); the changelog in
  `Settings.tsx:213-250` (A7).
- `README.md:47` said the home page's sections rise in as they scroll into
  view. That went in `5c397db`, and the line was corrected with this audit.
- The editor's theme (D10), the paid line (B1) and the runtime's scope (C8)
  are the operator's decisions. The findings give the options.
- The evidence (scripts, screenshots, measurements) stayed in the session's
  scratchpad and isn't committed.
