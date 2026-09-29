# Audit: taking the machine voice out of Vellum

The working record for the audit described in `AUDIT-BRIEF.md`. Started
2026-09-29.

- **Severity.** S1 says something untrue or describes code that is gone. S2
  is text a user reads. S3 is a comment. S4 is a name.
- **Status.** Fixed, open, waiting (on the operator), or kept (looked at and
  left alone, with the reason).
- **Scanner.** `cd vellum && node scripts/slop-scan.mjs`. `--md` prints the
  tables below, `--json` everything, and `--rule=`, `--kind=` and `--file=`
  filter the hit list. Every hit is a candidate for a person to judge.

## Since the brief was written

The brief was written at `5f44fc1`. Since then the Dash was rebuilt as a
dark, Blockbench-style room, Projects, Settings and Support moved to the
same dark studio, Pip took over every loading state, and the home page and
server list were added. Every item below was checked against the current
code, so line numbers differ from the brief's.

## Scanner totals

### Before the audit (`a29ac32`)

| Rule | Comments | Copy | Docs | Total |
|---|---:|---:|---:|---:|
| "X, not Y" and "rather than" | 214 | 18 | 121 | 353 |
| "the one" and "the only" | 54 | 2 | 22 | 78 |
| one-line morals ("A is a B.") | 1 | 0 | 0 | 1 |
| history ("used to", "no longer") | 51 | 1 | 17 | 69 |
| shouting (4+ capitalised words) | 20 | 0 | 4 | 24 |
| stock phrases | 56 | 3 | 34 | 93 |
| "which is why" and "which is the point" | 35 | 2 | 14 | 51 |
| numbered framing ("Two notes") | 12 | 1 | 17 | 30 |
| unmeasured counts | 3 | 0 | 4 | 7 |
| dash asides | 273 | 49 | 150 | 472 |
| marketing words | 0 | 1 | 1 | 2 |
| emoji | 0 | 0 | 0 | 0 |
| semicolons in UI text | 0 | 6 | 0 | 6 |
| **All rules** | **719** | **83** | **384** | **1186** |

Comment lines: 3402 across 95 source files, against 24135 code lines (0.14
per code line). Banner comments: 234. Comment blocks of 8 lines or more: 90.
Longest block: 41 lines at `vellum/src/lib/config.ts:1`.

| File | Comment lines | Code lines | Ratio | Banners | Longest block | Hits |
|---|---:|---:|---:|---:|---:|---:|
| `src/pages/Editor.tsx` | 307 | 3078 | 0.10 | 16 | 12 | 92 |
| `src/lib/config.ts` | 241 | 378 | 0.64 | 10 | 41 | 69 |
| `src/lib/vellum.ts` | 188 | 529 | 0.36 | 5 | 29 | 52 |
| `src/lib/world.ts` | 179 | 455 | 0.39 | 8 | 35 | 44 |
| `src/lib/model.ts` | 125 | 366 | 0.34 | 5 | 18 | 27 |
| `src/pages/Editor.css` | 116 | 1501 | 0.08 | 25 | 8 | 26 |
| `src/lib/mcmodel.ts` | 109 | 231 | 0.47 | 4 | 27 | 20 |
| `src/lib/dash.ts` | 106 | 521 | 0.20 | 7 | 20 | 24 |
| `src/lib/dash-api.ts` | 97 | 613 | 0.16 | 5 | 34 | 28 |
| `src/lib/hitregions.ts` | 87 | 171 | 0.51 | 2 | 35 | 21 |
| `src/components/ModelView.tsx` | 83 | 519 | 0.16 | 0 | 11 | 14 |
| `src/lib/pack.ts` | 81 | 137 | 0.59 | 2 | 28 | 21 |
| `src/styles/tokens.css` | 81 | 115 | 0.70 | 9 | 26 | 28 |
| `src/lib/new-model.ts` | 72 | 440 | 0.16 | 5 | 11 | 15 |
| `src/components/WorldScene.tsx` | 66 | 303 | 0.22 | 1 | 21 | 20 |
| `src/lib/auto-rig.ts` | 66 | 463 | 0.14 | 5 | 19 | 15 |
| `src/lib/mob-schema.ts` | 65 | 172 | 0.38 | 5 | 21 | 16 |
| `src/lib/behaviour.ts` | 58 | 186 | 0.31 | 7 | 27 | 8 |
| `src/pages/Projects.tsx` | 54 | 441 | 0.12 | 0 | 9 | 19 |
| `src/lib/texture.ts` | 50 | 207 | 0.24 | 4 | 11 | 10 |

## Phase 1: untrue and stale statements

| ID | Sev | Where | Was | Now | Status |
|---|---|---|---|---|---|
| F1 | S1 | `styles/tokens.css`, `vellum/README.md` "The material" | `navy` kept because "~40 call sites" use it | Measured 7 call sites using 4 of 15 steps. Comment says the name is left from the navy palette; README says only four steps are used | Fixed |
| F2 | S1 | `styles/tokens.css`, README | "~20 call sites" paint `--sheen` | Measured 6. Counts removed | Fixed |
| F3 | S1 | `styles/tokens.css` | "~70 call sites" use `--shadow` and `--shadow-sm` | Measured 7 and 0 (18 for every `--shadow*`). Count removed | Fixed |
| F4 | S1 | `lib/world.ts` header | Sky light, night and a field | Black stage, moving floor, two-block figure, fixed face shading | Fixed |
| F5 | S1 | `lib/world.ts` | `STAGE_LIGHT = 1` under two doc comments, one about sky light | Constant removed (it multiplied by 1), plus a doc comment left on a removed `night` option and an "island" the camera no longer looks at | Fixed |
| F6 | S1 | `lib/hitregions.ts` | Cites the deleted plugin's `RigBaker` and `HitRegions` as current | Says the rule came from the original plugin and hasn't been checked against the rewrite. A warning users see named "the baker"; now it names the plugin | Fixed |
| F7 | S1 | README format example | `"version":6` | `7`, matching `CURRENT_VERSION` | Fixed |
| F8 | S1 | README screens table | "Mobs & Anim." | "Mobs" | Fixed |
| F9 | S1 | `lib/config.ts` Flags blurb, item Model help | "read straight off the server's catalogue", "the other plugin's idea" | "Nine values. Leave one blank to use the base mob's value." and "A resource key such as vellum:runic_blade. Not a custom-model-data number." | Fixed |
| F10 | S1 | `components/ErrorBoundary.css` | `var()` fallbacks in the old navy theme | Fallbacks removed. The tokens are always in the bundle | Fixed |
| F11 | S1 | `pages/Editor.tsx` paint palette | Old UI colours, default brush `#cd594e` | Twelve block colours with names (Coal, Stone, Snow, Dirt, Oak, Sand, Grass, Water, Diamond, Amethyst, Redstone, Gold). Default brush is Stone | Fixed |
| F12 | S1 | `pages/Editor.css`, `pages/Editor.tsx` gizmo | Two X/Y/Z colour sets | `--axis-x/y/z` on paper (5.3 to 6.5:1 as text), used by the number fields and the gizmo. The dark surface already overrides them | Fixed |
| F13 | S1 | `pages/Editor.css` | `#fff1ec` for text on the accent | `var(--accent-ink)`. The `#fff2ee` in Support went with the Support rebuild | Fixed |
| P1-1 | S1 | `styles/tokens.css` header | "One scheme: paper and ink", and "every hover that moved an element has been cut back to colour" | Says these are the paper tokens and `studio.css` re-points them for the dark pages. Every comment in the file shortened | Fixed |
| P1-2 | S1 | README "The material", "The stage" | "the whole app lives on a single warm-grey field", "the rest of the app is paper" | Two surfaces: paper for the editor, dark elsewhere | Fixed |
| P1-3 | S1 | README "Into the game" | Mobs left out of the pack because "the plugin's own `RigBaker`" bakes them | Says a pack can't hold a custom entity model, so the plugin draws mobs | Fixed |
| P1-4 | S1 | `lib/world.ts` atlas and terrain | "nine ground slabs share the one patch of grass", "a grid gets drawn across the grass" | Grass is gone. Now "identical faces share one region" and "the floor" | Fixed |
| P1-5 | S1 | `components/WorldScene.tsx` | Placement blurb "Standing on the grass" and a header about the removed sky | "Standing on the floor". Header rewritten | Fixed |
| P1-6 | S1 | `lib/config.ts` header | "The keys in SCHEMA are the ones the plugin's loader actually reads" | Says the keys came from the original plugin and haven't been checked against the rewrite | Fixed |

Scanner after phase 1: 1100 candidates (was 1186), 3251 comment lines (was 3402), 221 banners (was 234).

## Phase 2: loading states and humour

Pip, drawn after the brief, already covers the loaders the brief listed: the
ticket list's "Loading…" is gone, the typing dots became Pip fishing, and
sending a ticket or a bug report runs Pip. What was left:

| ID | Where | Change | Status |
|---|---|---|---|
| P2-1 | `components/Pip.tsx`, `lib/pip/quips.ts` | A line under Pip while he works, changed each time he breaks a block or something nibbles, starting at a random line. Twelve mining lines built on the app's real rules and six fishing lines. One fixed line under reduced motion | Fixed |
| P2-2 | `components/Pip.tsx` and its four hosts | Pip was hidden from screen readers with nothing said in his place. A `label` now makes him a status: "Applying the files on the server", "Building the pack", "Sending your ticket", "Sending the report". The drawing and the quip stay hidden. The Support thread already says "Maya is writing" | Fixed |
| P2-3 | `index.html`, `scripts/make-boot.mjs`, `scripts/bundle-single-file.mjs` | Boot screen: Pip swinging at a block with "Mining the loading block.", drawn from the mining scene's own code into a 12-frame sprite (2.9 KB) used as a mask, so he takes the text colour. Fades in after 150ms. The bundler now keeps `#root`'s contents and plain inline scripts | Fixed |
| P2-4 | `index.html` | A dark page painted light until React set the surface. A small script sets it before the first paint | Fixed |
| P2-5 | `App.tsx` 404 | "No such page" / "Nothing is routed at" → "This chunk never generated" / "There's no page at". Buttons say "Go to the Dash" and "Go to Projects" | Fixed |
| P2-6 | `components/ErrorBoundary.tsx` | "Vellum stopped rendering" and two long paragraphs → "Vellum tripped over a block", "Something went wrong while drawing this page. Files you've saved are safe." The note keeps the fact that reloading loses unsaved work | Fixed |
| P2-7 | `pages/Settings.tsx` | The busy label "Checking" → "Checking…", like the other busy buttons | Fixed |
| P2-8 | Other humour candidates | Empty states (no tickets, an empty shelf), the Dash's "Sample data" note, the server list's offline row. Not changed; the brief asks to list them and ask | Waiting |

Checked in a browser: the label is set, the quip changes after the first
block breaks (at 1.3s on a demo reload), reduced motion keeps one line, the
404 renders, and with the CPU slowed 8x the boot screen shows until React
takes over, on the right surface from the first frame. No page errors.

Scanner after phase 2: 1097 candidates, 3258 comment lines.

## Phase 3: UI copy

About 150 strings across 40 files, rewritten by the rules in the brief: short
sentences, "you", digits, sentence case, no "X, not Y", no dash asides, no
semicolons, and every fact kept. Three agents took an area each; every change
was read back before it went in.

### Editor, config and export

| Where | Was | Now |
|---|---|---|
| `lib/config.ts` identity blurb | What it is built on, what renders, and what a player sees above it. | The base mob, the model and the name shown above it. |
| `lib/config.ts` base help | The vanilla mob this one is built on - its hitbox, sounds and swimming come from here. A Brain-driven base is refused by the server, because it would ignore every goal below. | The vanilla mob it's built on. Hitbox, sounds and swimming come from here. The server refuses Brain-based mobs because they ignore goals. |
| `lib/config.ts` model help | A resource key, not a number. This is what the rig is baked under. | A resource key such as vellum:voidling. Not a number. The plugin saves the rig under this key. |
| `lib/config.ts` health help | Half a heart to 1024. The default is 20, and writing 20 writes nothing. | 0.5 to 1024. Default 20, so 20 isn't written to the file. (0.5 health is a quarter heart, so "half a heart" was wrong too) |
| `lib/config.ts` speed and scale help | …which is why this is not a slider - there is no default to slide away from. / Blank leaves it to the base entity. | 0 to 2. Leave blank to use the base mob's speed. / …Leave blank to use the base mob's scale. |
| `lib/config.ts` AI | The eight goals the runtime implements… / Priority runs 1 to 32, lower first. 0 is excluded on purpose, so no config can outrank a mob's ability to swim… | The 8 goals the plugin supports, in priority order. / Priority is 1 to 32, lowest first. Swimming always comes first. Every goal except vellum:target_nearest can play a clip. |
| `lib/config.ts` animations, item identity | Only two states are live… / What it is called, what it renders as, and how it stacks. | Only idle and walk are set here. Other clips play through a goal. / Its name, model, lore, stack size and durability. |
| `lib/config.ts` 10 validation messages | `…; the runtime accepts {lo} to {hi}`, `"{g}" is not a goal - the runtime implements…`, `A priority of 0 is excluded on purpose…`, `…is the one goal that carries no animation - the clip here is ignored`, `…it will decide how to fight and never decide whom`, `…this is a resource key like vellum:{id}, not a custom-model-data number` | `…The plugin accepts {lo} to {hi}`, `"{g}" isn't a goal. Use one of…`, `Priority 0 isn't allowed, so swimming always comes first. 1 is the highest`, `vellum:target_nearest can't play a clip, so the clip here is ignored`, `…so it won't pick a target`, `"{model}" looks like a custom-model-data number. Use a resource key such as vellum:{id}` |
| `lib/mob-schema.ts` | …left out rather than guessed at / {n} values read straight off the server's catalogue. / {n} live states… | …isn't one this form can show, so it was left out / {n} values from the linked plugin. / {n} states are set here. Other clips play through a goal. |
| `lib/behaviour.ts` | A behaviour on a mob: a mob is animated by what it is doing, not by the blocks around it… / …one block cannot be two things | A behaviour on a mob won't be read. Mobs animate based on what they're doing, and nearby blocks don't affect them. / …A block there can't match both |
| `lib/mcmodel.ts`, `lib/pack.ts`, `lib/model.ts` export and validation messages (12) | dash asides and "an element rotates on exactly one" | Split into sentences: "…turns on 2 or more axes, but an element can only turn on 1 axis", "…has no textured faces, so it exports invisible". Also fixes "1 clip stay" |
| `lib/hitregions.ts` readouts | …they win outright / Every drawn bone has stopped being a target. / …for free. | …they take priority over drawn bones / Drawn bones can't be hit. / Regions follow the animation automatically. |
| `lib/vellum.ts` load errors | …this editor reads "{F}" documents. / …written by a newer Vellum…, which cannot know what it means. | This editor opens "{F}" documents. / This model was saved by a newer Vellum (version {v}). This editor reads up to version {c}, so it can't open it. |
| `lib/samples.ts`, `NewModelDialog.tsx`, `WorldScene.tsx` | Four bones, three clips, two blocks… | Digits: 4 bones, 3 clips, 2 blocks |
| `lib/download.ts`, `lib/texture.ts` | Saved as {file} — this viewer does not allow a .vellum extension / This browser gave us no 2D context… | Saved as {file}, because this viewer blocks the .vellum extension / This browser has no 2D canvas, so painting is unavailable. |
| `pages/Editor.tsx` menus and tools | Add Cube, Quad View, Toggle Grid, Report a Bug, Pivot Tool, Paint Bucket… | Sentence case: Add cube, Quad view, Toggle grid, Report a bug, Pivot tool, Paint bucket |
| `pages/Editor.tsx` | Swap the UV horizontally - a reversed rectangle is how a face mirrors | Mirror the texture on this face by swapping its UV horizontally |
| `pages/Editor.tsx` auto-animate | …This is a {kind} project. (read "a item project") / From their shape alone - nothing is named in a way it recognises. / These are a starting pose set, not a finished animation… / This model has no animations yet. An animation is… | …This project makes {kind} models. / From their shape alone, because no bone names were recognised. / A starting point. Every key is editable on the timeline. / No animations yet. |
| `pages/Editor.tsx` | {file} has changes that have not been saved, and undo does not reach back across a model change. | {file} has unsaved changes. Undo can't bring them back once you leave this model. |
| `pages/Editor.tsx` hit-region warning | A bone becomes a marked region by drawing nothing while holding a hidden cube — so hiding a cube for any reason at all can do this. | A bone that draws nothing but holds a hidden cube becomes a marked region. Hiding a cube for any reason can do this. |
| `pages/Editor.tsx` validation | Nothing the writer would refuse. / "1 errors" | No problems. / "1 error" |
| `pages/editor/BehaviourPanel.tsx` | A clip says how this moves. A behaviour says when: … | A behaviour decides when clips play: which blocks must be nearby, and the cycle that repeats once they are. |
| `pages/editor/ConfigPanel.tsx` | What this is, rather than what it looks like. Written as YAML… so the two cannot drift apart. | Settings for what this is in game. Written as YAML under the model's own name, so the two stay in sync. |
| `pages/editor/DisplayPanel.tsx` | Display transforms belong to the resource pack, not the model, so these are a preview… — copy them… | These are a preview. Display transforms live in the resource pack, so they aren't saved in the .vellum. Copy them into your pack's item JSON. |
| `pages/editor/ExportPackDialog.tsx` pack format | …a newer one declares higher — get it wrong and the pack will not load, with nothing said about why. | 84 is Minecraft 26.1.2. Newer versions use higher numbers. It must match your server. If it's wrong, the pack won't load and Minecraft won't say why. |
| `pages/editor/ExportPackDialog.tsx` notes | …two pipelines that can disagree would be worse than one. / …a 16-unit item renders as a speck… / …rather than riding in the pack. | This pack is for servers with no Vellum plugin. With the plugin linked, use the pack it builds and serves from the same models. Don't use both. / …would look tiny in the hand and the inventory. / …so they download separately from the pack. |
| `pages/editor/NewModelDialog.tsx` | …already carries its use clip — the clip the rules ask for. / The rules ask for an attack clip. / A block is one thing, so there is nothing further to say about it here. | Starts as a flask with a use clip. Consumables need one. / Give it an attack clip. / Blocks have no subtypes. |
| `pages/editor/ScenePanel.tsx` | …— it will not fit through a door / "{clip}" does not travel — it plays in place, which is right for an idle… and a moonwalk for a walk. / No display slots: those pose an item… | …too tall to fit through a door / "{clip}" plays in place. That's right for an idle or an attack, but a walk will look like a moonwalk. / Mobs don't use display slots. Those pose items in a hand, the inventory or an item frame. A mob stands in the world at the size above. |
| `components/WorldScene.tsx` | Paused — drag to look around the pose / Walking — the ground moves, so the cycle never ends | Paused. Drag to look around the pose. / Walking. The ground moves, so the cycle never ends. |

Left alone: text the plugin sends through `GET /api/mob/schema` (flag help, priority help, retired-state notes) is shown as sent. Wording that code matches on stays ("Save cancelled", "Could not save", "Saved", "root collection key"). Labels with a bold name and a dash (`<strong>{id}</strong> — {detail}`) keep the dash as a separator.

### Settings, Support, reload and version

| Where | Was | Now |
|---|---|---|
| `pages/Settings.tsx` nav | Report A Bug | Report a bug |
| `pages/Settings.tsx` About blurb | Build, licences and what changed recently. | Build, versions and what changed recently. (About lists no licences) |
| `pages/Settings.tsx` Support blurb | …stay in your browser and a mock answers them. | …stay in your browser and get sample replies. |
| `pages/Settings.tsx` release notes | Dialogs trap focus and hand it back; menus and the model-kind picker take the arrow keys. | Dialogs keep focus inside and return it when they close. Menus and the model-kind picker work with the arrow keys. |
| `pages/Settings.tsx` release notes | Every number field is named and steps on the arrows. | Every number field has a screen reader label and steps with the arrow keys. |
| `pages/Settings.tsx` release notes | Text clears AA contrast on every route, and the viewport fits the model it is given. | Text meets AA contrast on every page. The viewport fits each model you open. |
| `pages/Settings.tsx` release notes | The outliner became an outliner | Outliner, timeline and locking |
| `pages/Settings.tsx` release notes | Bones have an inspector; rows rename in place and drag to reparent. | Bones have an inspector. Rows rename in place and drag to a new parent. |
| `pages/Settings.tsx` release notes | Locking refuses edits, paint and delete instead of doing nothing quietly. | Locking now blocks edits, paint and delete. Before, it did nothing. |
| `pages/Settings.tsx` release notes | The dashboard opened to a feed / Twelve ingest endpoints, a window bridge and a postMessage door. | A data feed for the Dash / 12 ingest endpoints, a window bridge and postMessage support. |
| `pages/Settings.tsx` version check | Standalone | No plugin linked |
| `pages/Settings.tsx` version check | Shipped inside plugin {v}; still talks to {min} and newer. | Ships inside plugin {v}. Works with plugin {min} and newer. |
| `pages/Settings.tsx` version check | no answer / Plugin wants studio / did not say | No answer / Minimum studio / Not reported |
| `pages/Settings.tsx` version check | Studio and plugin ship together, so they should never disagree. When they do… This asks the linked plugin what it is and compares. | Checks the linked plugin's version against this studio. A mismatch usually means the server runs an older build. |
| `pages/Settings.tsx` changelog | What this build knows about itself. The Master Console replaces this when it pushes. | Notes that ship with this build. The Master Console replaces them when it pushes a changelog. |
| `pages/Settings.tsx` roles | Opens files; cannot save over them. | Opens files. Cannot save over them. |
| `pages/Settings.tsx` cloud | Nothing is syncing - no plugin has reported. | Nothing is syncing. No plugin has reported. |
| `pages/Settings.tsx` cloud | {n} identities on this workspace. | {n} members on this workspace. |
| `pages/Settings.tsx` cloud | The same list the plugin syncs, so a team opens the same files from the same place. | The files the plugin syncs. Everyone on your team opens them from the same place. |
| `pages/Settings.tsx` cloud notice | The workspace database is allocated and administered by Vellum… retains administrative access… - for support… which is what Vellum opens by default. | Vellum sets up and runs the workspace database. The account owner listed above controls your team's access to it. Vellum's operator also has admin access to every workspace it hosts, for support, migration and abuse handling. Keep files you don't want stored this way in a local project. Vellum opens local projects by default. |
| `pages/Settings.tsx` account | Used to sync scenes between machines. / Last rotated 04/02/26. | Lets you sync scenes between machines. / Last changed 04/02/26. |
| `pages/Settings.tsx` directory | Vellum only reads inside these roots. / Walk nested directories when building the library. | Vellum only reads files inside these folders. / Include nested folders when building the library. |
| `pages/Settings.tsx` billing | Free tier - no card on file. | Free tier. No card on file. |
| `lib/version.ts` | Running standalone, which is the whole of the Free tier. Link a plugin on the dashboard to open the paid half and to check versions. | Standalone (Free tier). Link a plugin on the Dash to check versions and use paid features. |
| `lib/version.ts` | Could not reach {url}/plugin/version — {error}. | Could not reach {url}/plugin/version ({error}). |
| `lib/version.ts` | …The server is running an older build than the one this studio shipped inside - update the plugin there. | …The server's plugin is older than the build this studio shipped in. Update the plugin on the server. |
| `lib/version.ts` | The plugin wants studio {min} or newer, and this one is {v}. | The plugin needs studio {min} or newer. This studio is {v}. |
| `lib/version.ts` | The plugin is {v}, ahead of the {built} this studio was built against, and still compatible. | The plugin is {v}, newer than the {built} this studio was built for. They're still compatible. |
| `lib/reload.ts` | The reload is still running — check the server console. / Could not reach the server — {error} | The reload is still running. Check the server console. / Could not reach the server ({error}) |
| `components/ReloadControl.tsx` | Nothing was swapped — the content did not pass validation. | Nothing was swapped. The content failed validation. |
| `components/ReloadControl.tsx` | …so this blocks the whole set rather than just the file below. | The server is still running the content it had before. One bad file holds back every mob, item, block and furniture piece until you fix it. |
| `components/ReloadControl.tsx` | The server declined without saying why. That is a gap on its side, not a step you missed — check the server console. | The server declined without saying why. That's a gap on the server's side. You didn't miss a step. Check the server console. |
| `components/ReloadControl.tsx` | The server gave no verdict. | The server did not confirm the reload. |
| `lib/support.ts` system event | Waiting on triage - no agent assigned | Waiting on triage · no agent assigned |
| `lib/api.ts` | Archive a ticket. Soft delete - messages are retained for audit. | Archive a ticket. This is a soft delete. Messages are kept for audit. |
| `lib/api.ts` | Ticket opened · urgent is a paid tier, so this was filed as high | Ticket opened · urgent needs a paid tier, so this was filed as high |

Left alone: sample support replies in `lib/support.ts` and `lib/api.ts` read like a person typing, dashes included. `pages/Support.tsx`, `components/TicketForm.tsx` and `components/ErrorBoundary.tsx` were already plain.

### Dash, API contract, home, server list, Projects

| Where | Was | Now |
|---|---|---|
| `index.html` description | Vellum - a 3D model editor for Minecraft resource packs. | Vellum is a model studio in your browser and a plugin on your Minecraft server. Shape, paint and animate mobs, items and blocks, then push them to your players. |
| `lib/dash-api.ts` snapshot | …The cheapest thing a plugin can do on a timer - send what you know, omit the rest. | Update every card in one call. Send what you know and leave out the rest. This is the cheapest way to report on a timer. |
| `lib/dash-api.ts` snapshot read | …This is the endpoint Vellum polls… - implement it and the Dash fills itself. | …Implement this in your plugin. After you link it, Vellum polls this endpoint to fill the Dash. |
| `lib/dash-api.ts` heartbeat | …Without one, cards fed earlier go stale and then offline rather than pretending to be current. | …If Vellum stops hearing from you, the Dash shows your data as stale, then offline. |
| `lib/dash-api.ts` | How often you promise to call. 5-3600, default 30. | How often you will call, in seconds. 5 to 3600, default 30. |
| `lib/dash-api.ts` schema | …Check it at startup rather than guessing which Vellum you are feeding. | …Check it at startup to see which API version and limits this Vellum uses. |
| `lib/dash-api.ts` server | …Every field is optional; omitted fields keep their value. | …Every field is optional. Fields you leave out keep their value. |
| `lib/dash-api.ts` | The realm power card: plan, cloud region and seat usage. | The plan card: plan name, cloud region and seat usage. |
| `lib/dash-api.ts` pack | …Send this when you finish building a pack, not on a timer. | …Send this when you finish building a pack. Don't send it on a timer. |
| `lib/dash-api.ts` pack fields | Size on the wire. Vellum does the formatting. / The SHA-1 you hand the client… | Size in bytes. Vellum formats it for display. / The SHA-1 you send to clients. Player reports are compared against it. |
| `lib/dash-api.ts` players | One client, one pack hash - which is all a join event knows… | Report one client and its pack hash. Vellum keeps the roster and does the counting… |
| `lib/dash-api.ts` files | …Newest first, capped at 50 - older rows fall off. | Add rows to the recent files table. It shows the newest first and keeps 50. Older rows are dropped. |
| `lib/dash-api.ts` cloud | …Send what changed; the panel in Settings ▸ Cloud reads exactly this. | …Send only what changed. Settings ▸ Cloud shows exactly what you send. |
| `lib/dash-api.ts` changelog | …Pushed from the Master Console, through the plugin, so a studio learns… | Replace the release notes shown in About. The Master Console sends them through the plugin, so users see what changed without visiting a website. |
| `lib/dash-api.ts` version | Served BY the plugin, called by the studio: About checks the two halves are compatible rather than letting a version gap look like a bug. | Your plugin serves this and the studio calls it. About uses it to check that the plugin and studio versions are compatible. |
| `lib/dash-api.ts`, `lib/dash.ts` problem messages | `files: expected an array - the table was left alone`, `… - clamped`, `… - kept the previous value` (13 messages) | `files: expected an array. The table was left alone.`, `… Clamped to the nearest limit.`, `… Kept the previous value.` |
| `pages/Dashboard.tsx` | The demo server answers too. Apply a few times to see it swap, refuse and fail. | This works on the demo server too. Apply a few times to see a swap, a refusal and an error. |
| `pages/dash/hero.tsx` | No word for {quiet} / …It talks to this page through the plugin API. | No reports for {quiet} / Demo server running. It sends data through the same API a real plugin uses. |
| `pages/dash/timeline.tsx` | No reports yet. Each one lands here as it arrives. | No reports yet. Reports from the plugin show up here. |
| `pages/Home.tsx` | Paid plans open soon, and their prices go up here when they do. | Paid plans open soon. Their prices will be listed here at launch. |
| `pages/Servers.tsx` | …A server your account links shows up here. | …Servers you link to your account show up here. |
| `pages/Projects.tsx` | That model carries no texture. / Open in Editor / Placeholder card - nothing to open | That model has no texture. / Open in the editor / Placeholder card. Nothing to open. |
| `pages/Projects.tsx` | Choose a scene, then a shelf. | Choose a shelf to open. (the page has no scene picker) |
| `lib/data.ts` | Survival flagship - stone, brass and lantern light. / Item Model, Rigged Entity… | Survival flagship. Stone, brass and lantern light. / Item model, Rigged entity… (sentence case) |

### Found on the way (S1, fixed in code)

| ID | Where | Problem | Now |
|---|---|---|---|
| P3-1 | `lib/dash.ts` `readPack` | The contract says `pushedAt` "defaults to now", but a pack report without it kept the old date, so a first report showed the sample's 2026-09-12 | A new hash defaults to now; a repeat of the same pack keeps its date. The contract says so |
| P3-2 | `lib/dash.ts` `readReleases` | "Newest 30 kept", but the code kept the first 30 as sent, then sorted | Sorted first, then the newest 30 kept |
| P3-3 | `lib/dash-api.ts` `/dash/events` | The contract sends `{ section, body }` per event; the client only took snapshot-shaped bodies, so a real event was refused | Takes both shapes |
| P3-4 | `lib/dash-api.ts` `usedBy` | Named tiles that no longer exist: Feed status, Resource pack info, Pack adoption, Realm power | Plugin activity, Resource pack, Players, Plan |
| P3-5 | `pages/Dashboard.tsx`, `pages/Editor.tsx` | "old on 1 clients", "1 errors", "1 warnings" | Singular when it is one |

### Style calls to confirm

- Text that said "runtime" now says "plugin", since the plugin is what runs the config.
- The editor's menus and tools moved from Title Case (Blockbench's style) to sentence case.
- The crash screen keeps its joke title from phase 2. The brief allowed it there because the line under it says saved files are safe.

Scanner after phase 3: copy hits 82 → 7. Six are sample support replies written to read like a person typing, and one is "Unlock" meaning a locked cube.

## Waiting on the operator

- **More humour (P2-8).** Say which of the listed spots may get a line.
- **Plugin repository (Phase 8).** Only `Apathny2k2/simple-post-template`
  is visible to this session. The plugin needs its `owner/repo` and the
  Claude GitHub App installed on it.
