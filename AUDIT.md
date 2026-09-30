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

### After the audit

| Rule | Comments | Copy | Docs | Total |
|---|---:|---:|---:|---:|
| "X, not Y" and "rather than" | 0 | 2 | 10 | 12 |
| "the one" and "the only" | 0 | 0 | 6 | 6 |
| one-line morals ("A is a B.") | 0 | 0 | 0 | 0 |
| history ("used to", "no longer") | 0 | 0 | 3 | 3 |
| shouting (4+ capitalised words) | 0 | 0 | 0 | 0 |
| stock phrases | 0 | 0 | 1 | 1 |
| "which is why" and "which is the point" | 0 | 0 | 2 | 2 |
| numbered framing ("Two notes") | 0 | 0 | 5 | 5 |
| unmeasured counts | 0 | 0 | 0 | 0 |
| dash asides | 4 | 4 | 11 | 19 |
| marketing words | 0 | 1 | 0 | 1 |
| emoji | 0 | 0 | 0 | 0 |
| semicolons in UI text | 0 | 0 | 0 | 0 |
| **All rules** | **4** | **7** | **38** | **49** |

Comment lines: 1581 across 96 source files, against 23962 code lines (0.07
per code line), down from 3402. Blocks of 8 lines or more: 7, down from 90.
The 4 comment hits are false positives (minus signs, and an oxlint
directive). The 7 copy hits are six sample support replies written to read
like a person typing and one "Unlock" meaning a locked cube. Most doc hits
left are in `ZOOM-FIX.md`, a work order for a fix that hasn't been made, and
`CLAUDE.md`.

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
| P2-8 | Other humour candidates | Nine spots named, seven approved on 2026-09-30. A line added after the plain text: Support with nothing open ("Mushroom-island quiet.") and with no tickets ("The creepers are behaving."), a shelf search with no results ("Checked every chest."), the Dash's sample-data note ("Creative mode, for now.") and its empty file list ("A freshly generated world."), the empty timeline ("It's a statue for now.") and the check panel with nothing to fix ("Every cube in bounds."). The offline server row and the empty plugin feed stay plain: the owner may be looking at a real outage | Fixed |

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

## Phase 4: comments

Every source file was read against the brief's rules, in six groups at
once. A comment stays if it says why, gives a number's source, or warns
about a trap the code can't show. Each group was checked with
`node scripts/same-code.mjs` (only comments changed) and the scanner.

| Group | Files | Comment lines before | After |
|---|---:|---:|---:|
| Editor page and its panels | 10 | 547 | 299 |
| `config.ts`, `vellum.ts` | 2 | 398 | 126 |
| Model, world and export libraries | 5 | 530 | 238 |
| Editing libraries (animation, history, texture...) | 13 | 526 | 218 |
| Dash, Support, Pip and the small libraries | 19 | 565 | 341 |
| Pages, components and styles | 47 | 686 | 359 |
| **All** | **96** | **3252** | **1581** |

Kept at length on purpose: the `.vellum` format rules (`vellum.ts:1`), the
`/api/reload` response table (`reload.ts:1`), the plugin-author notes in
`dash-api.ts`, Pip's mood tables (`pip/fish.ts:1`, `pip/mine.ts:1`), the
Minecraft rules the quips quote, the zip layout, why history updaters must
be pure, and a handful of editor effects whose order matters.

Scanner comment hits: 719 before the audit, 4 now, and those 4 are false
positives (minus signs in `ModelView.tsx` and `model.ts`, and an oxlint
directive in `dash.ts`). Comment lines: 3402 before the audit, 3252 at the
start of this phase, 1581 now (0.07 per code line). Blocks of 8 lines or
more: 90 before, 7 now. The longest is Pip's 14-line fishing table.

`same-code.mjs` counted edits to `/** doc comments */` as code, because the
parser hands them over as nodes. Fixed in this commit.

### Comments that said something the code doesn't do (S1, fixed)

Reading every comment against its code found 81 that were wrong. They
were rewritten to match the code; the code was not changed.

| Where | Said | Does |
|---|---|---|
| `lib/api.ts:1`, `lib/support.ts:1` | a reference panel renders `endpoints`; "point `transport` at fetch" | nothing outside `api.ts` reads `endpoints`, and there is no `transport` |
| `lib/endpoint.ts:1`, `lib/dash-api.ts:1` | reference panels render these specs | only `dash.schema()` uses `dashEndpoints` |
| `lib/endpoint.ts:20` | `usedBy` is shown as a badge | nothing reads `usedBy` |
| `lib/api.ts:236` | the canned replies move delivery states | the timers in `sendMessage` do |
| `lib/api.ts:333` | the form disables the urgent option | neither ticket form offers urgent |
| `lib/api.ts:480` | the caller debounces `sendTyping` | it is called on every change (B9) |
| `lib/a11y.ts:70` | `arrowNav` returns a handler | it takes the key event and returns true or false |
| `lib/dash.ts:1` | nothing is thrown away silently | see B10 |
| `lib/dash.ts:131` | 45 characters fits an IPv6 literal with a scope id | 45 is the longest IPv6 address without one |
| `lib/dash.ts:611` | live until a heartbeat is missed | live for two intervals, stale up to six |
| `lib/dash-api.ts:391` | the first report of a build must carry archive, bytes and hash | the first pack report since the page loaded or the store was reset |
| `lib/version.ts:57` | every failure becomes a report, never a throw | see B8 |
| `lib/support.ts:32` | the `event` field renders a centred rule | rendering keys on `author.role`; nothing reads `event` |
| `lib/pip/mine.ts:10` | an outcome never cuts a swing short | the follow-through is dropped once the block breaks |
| `lib/vellum.ts:13` | four properties "are asserted by the round-trip test" | no such test was ever committed |
| `lib/vellum.ts:6`, `:18` | the JSON keeps `git diff` useful | a model is written on one line; the order makes the same model write the same bytes |
| `lib/vellum.ts:27` | the rig is regenerated on save | nothing does; `readRig` works it out from bone names |
| `lib/vellum.ts:196` | `config` is a flat map of the schema's keys | it is the nested body from `bodyOf`, keyed by field path |
| `lib/vellum.ts:388` | every upgrade step only re-stamps the version | v2 to v3 changes the kind; v6 to v7 renames config keys |
| `lib/vellum.ts:398` | validation reports a malformed behaviour offset | it is replaced with `[0,-1,0]`; a non-array list throws (B7) |
| `lib/vellum.ts:429` | a number where the form wants a list is dropped | any finite number is kept |
| `lib/config.ts:77` | example path `Options.MovementSpeed` | a MythicMobs path no field uses; now `animations.idle` |
| `lib/config.ts:365` | splitting on whitespace is safe for clip names | clip names are free text (B4) |
| `lib/config.ts:391` | a tri-state flag is stored as `''`, `'true'` or `'false'` | the `.vellum` holds the boolean (B1) |
| `lib/data.ts:1` | the samples are prepended to fixture cards | `assetsFor` returns only the samples |
| `lib/data.ts:168` | "the three models" | there are eight |
| `lib/data.ts:199` | the fixture list backs the Dash's recent files | the Dash reads `dashStore.snapshot.files` |
| `lib/data.ts:150`, `lib/model.ts:20` | a `.vellum` carries no format string | every header has `vellum.format` |
| `lib/model.ts:310` | the kind is the project's, not the file's | the file carries `kind`, and opening a file uses it |
| `lib/model.ts:310` | the rules the editor refuses to write past | the editor only shows them; saving is not blocked |
| `lib/model.ts:314` | the document is the fallback for kind and subtype | only for subtype |
| `lib/model.ts:23` | a subtype changes no geometry | a new consumable starts from a flask |
| `lib/model.ts:82`, `:97` | `mirrorUv` mirrors the unwrap | nothing applies it; it only round-trips |
| `lib/model.ts:5`, `lib/mcmodel.ts:7`, `:240` | UVs are in texture pixels | UV units (`uvWidth`, `uvHeight`) |
| `lib/mcmodel.ts:26` | `where` is the cube or bone | always a cube |
| `lib/mcmodel.ts:75` | a bone's rotation never reaches the file | a single bone turn is written as the element's rotation |
| `lib/mcmodel.ts:269` | a model here already passed the pack check | the function runs the check; `pack.ts` drops models with errors |
| `lib/hitregions.ts:170` | `isRegionBone` finds a bone this module made | any bone whose own cubes are all hidden |
| `lib/world.ts:85`, `:225` | a void face costs one texel | each gets a 4x4 region |
| `lib/world.ts:117` | `emissive` is for a flame | those tiles are gone and nothing passes it |
| `lib/world.ts:460` | a dropped item is a quarter size | 0.45 |
| `lib/world.ts:532` | a model with no clip still turns slowly | only dropped and floating items spin |
| `lib/world.ts:540` | one block per cycle | `travel.blocks`, which can be more |
| `lib/world.ts:289` | the `- 26` turns the figure toward the camera | it turns it away (B14) |
| `lib/pack.ts:158` | `saysSomething` catches the empty stub | it doesn't (B12) |
| `lib/auto-rig.ts:21` | `why` is for the panel to show | nothing reads it |
| `lib/auto-rig.ts:330`, `:432` | an odd leg joins the thinner phase; the front foot braces | legs alternate by index |
| `lib/auto-rig.ts:30`, `:178` | the tail chain is outermost first | root end first |
| `lib/new-model.ts:10` | `NewModelKind` exists for the dialog | nothing outside the file uses it |
| `lib/new-model.ts:141` | the flask is rigged on two bones | three, all animated |
| `lib/new-model.ts:312` | `deleteCube` removes the keys that drove it | it touches no clips |
| `lib/new-model.ts:432` | `updateBone` takes pivot and rotation | any field but `id` and `children` |
| `lib/uv-pack.ts:98` | `makeRoom` grows up to `limit` times | `limit` + 1 (B11) |
| `lib/mob-schema.ts:1` | duration, clip and key are never drawn | they are drawn as text fields |
| `lib/mob-schema.ts:96` | a checkbox only when the server states a default | decided by `inherits` |
| `lib/history.ts:23` | same-label commits fold | only with `coalesce` |
| `lib/history.ts:85` | a second `begin` never pushes an entry | it does once the burst was amended |
| `lib/texture.ts:72` | min < max | min can equal max |
| `pages/Editor.tsx:2368` | Animate mode opens playing; any edit stops it | playback stops only on leaving Animate, and nothing starts it |
| `pages/Editor.tsx:1554` | a key drag is bracketed | every move commits with `coalesce` |
| `pages/Editor.tsx:557` | `onCommit` makes a drag one undo step | the coalesced commits do |
| `pages/Editor.tsx:1964` | "once" drops back to the rest pose | the playhead goes to 0, the clip's first frame |
| `pages/Editor.tsx:2415` | `writeTexture` is batched to a frame | it writes at once; `commitTexture` batches |
| `pages/Editor.tsx:1897` | ticks become tenths when the clip is short | spacing follows the zoom |
| `pages/Editor.css:1095` | `.uv--paint` stops faces taking clicks | it sets a cursor; the panel sets pointer events inline |
| `pages/Editor.css:1145` | `.ed-field` uses the grid of `.nf-row` | 52px and 6px against 66px and 5px |
| `editor/DisplayPanel.tsx:38` | `slotJson` converts to 1/16 and drops vanilla values | no conversion; drops parts equal to the identity |
| `editor/ConfigPanel.tsx:224` | durations are a type the form can't draw | they are text fields |
| `editor/ScenePanel.tsx:8` | a player is two blocks tall | the hitbox is 1.8; 2 is the space a player needs |
| `components/Card.tsx:20`, `Card.css:1` | every page is built from Card | only Settings uses it, and no variant is passed |
| `components/WorldScene.tsx:52` | a 512px sheet and a night input | 1024px, no night option |
| `components/Model3D.tsx:61`, `:66` | `orbit` is the editor's; `spin` is the library cards' | nothing passes `orbit`; the Projects tiles spin too |
| `components/ModelView.tsx:315` | every drag but a left drag on a face orbits | middle and shift drags pan |
| `components/ServerIcon.tsx:5` | until a server sends its own icon | no code for that |
| `pages/Servers.tsx:16` | bars as the game's server list draws them | the game draws 5 bars at 150/300/600/1000 ms; this draws 4 at 80/150/300 |
| `pages/Support.tsx:603` | `GET /tickets/{id}/events` | `api.streamAll`, for every ticket |
| `pages/Projects.tsx:440` | pick a project, then a shelf | the page uses the first project and offers shelves |
| `pages/Dashboard.tsx:68` | a Studio served by the plugin depends on this | that was the deleted plugin's host script |
| `pages/Settings.tsx:86` | a switch holds for the session when storage is blocked | it is component state and resets on remount |
| `pages/Settings.css:355` | the "How Vellum ships" list on About | no page renders it; the rules went in phase 5 |
| `styles/controls.css:1` | buttons and key/value rows | also the dialogs |

### UI text found wrong on the way (S2, fixed)

| Where | Said | Does | Now |
|---|---|---|---|
| `editor/DisplayPanel.tsx`, Copy all tooltip | "Every slot that differs from vanilla" | copies every slot with a transform set; nothing is compared with vanilla | "Every slot with a transform set" |

## Phase 5: class names

Class names are full words now. The brief's map was followed where the
names still existed (`.tl__*`, the ticket list, had already become `.sl__*`;
`.power` was already `.plan`), and the same rule was applied to every other
abbreviation, one-letter element and metaphor.

| Was | Now |
|---|---|
| `.sl`, `.sl__*` (ticket list) | `.tickets`, `.tickets__*`; `__prio` is `__priority` |
| `.th`, `.th__*` | `.thread`, `.thread__*`; `__act`, `__actlabel` are `__action`, `__action-label` |
| `.bub`, `.bub__*` | `.message`, `.message__*`; `__atts` is `__attachments` |
| `.cmp__*` | `.composer__*` |
| `.att`, `.att__*` | `.attachment`, `.attachment__*` |
| `.nt`, `.nt__*` | `.new-ticket`, `.new-ticket__*` |
| `.tf`, `.tf__*` | `.ticket-form`, `.ticket-form__*` |
| `.ev` | `.system-line` |
| `.sup` | `.support` |
| `.pk`, `.pk__*`, `.pk-run` | `.export`, `.export__*`, `.export-run`; `__out*` is `__output*` |
| `.rl`, `.rl__*` | `.reload`, `.reload__*`; `__out` `__outcome`, `__msg` `__message`, `__n` `__count`, `__blast` `__impact`, `__bare` `__no-report` |
| `.bhv-*` | `.behaviour-*`; `-fx` `-effect`, `-req` `-requirement`, `-sec` `-section`, `-x` `-remove`, `__seg` `__segment`, `__secs` `__seconds`, `__amt` `__amount` |
| `.cfg-*` | `.config-*`; `-sec` `-section`, `-probs` `-problems`, `-num` `-number`, `-x` `-remove`, `__n` `__count` |
| `.ed-*` | `.editor-*`; `-col` `-column`, `-sep` `-separator`, `__btn` `__button`, `__sel` `__selection`, `__bad` `__problems`, `__vbtn` `__shading`, `--tl` `--top-left` and so on |
| `.tl-*` (timeline) | `.timeline-*`; `__ch` `__channel`, `__btn` `__button` |
| `.nf`, `.nf-row`, `.nf-grid` | `.num-field`, `.num-field-row`, `.num-field-grid` |
| `.yml__*` | `.yaml__*`; `__k` `__key`, `__v` `__value`, `__c` `__comment`, `__d` `__punctuation`, `__n` `__count`, `__no` `__line-number` |
| `.dlg__*` | `.dialog__*` |
| `.kv__row`, `__k`, `__v` | `.pairs__row`, `__key`, `__value` |
| `.rel__*` | `.release__*`; `__v` `__version`, `__t` `__title`, `__ch` `__channel`, `__at` `__date` |
| `.dir-list`, `.dir-row__path`, `.mem__role`, `.mem__seen` | `.list-rows`, `.list-row__name`, `.list-row__role`, `.list-row__when` |
| `.srv`, `.srv-icon`, `.srv-bars` | `.server`, `.server-icon`, `.signal-bars` |
| `.gate`, `.gate-head` | `.server-picker`, `.server-picker-head` |
| `.gateway`, `.gateway__tile`, `.gateway__*`, `.scene-chip__n` | `.shelves`, `.shelf-tile`, `.shelf-tile__*`, `.shelf-tile__count` |
| `.src-mark` | `.sample-badge` |
| `.bbroot`, `.bbgroup`, `.bbpivot`, `.bbbox`, `.bbface` | `.model-root`, `.model-group`, `.model-pivot`, `.model-cube`, `.model-face` |
| `.tex-row`, `.tex-thumb` | `.texture-row`, `.texture-thumb` |
| `.newmodel__*` | `.new-model__*` |
| `.lit` | `.pointer-glow` |
| `.iso`, `.iso--glyph` | `.cube-icon`, `.cube-icon--small` |
| `.vh`, `.vh--focusable` | `.visually-hidden`, `.visually-hidden--focusable` |
| `.kinetic__ch`, `.home-step__n`, `.toggle-row__t`, `__d`, `.panel__chev`, `.world__fx`, `.hero__rec`, `.cell-name__in` | `__letter`, `__number`, `__title`, `__description`, `__chevron`, `__effects`, `__live`, `__inner` |
| ids `sup-rows`, `sup-subject`, `newmodel-sub`, `cfg-<field>` | `support-rows`, `support-subject`, `new-model-sub`, `config-<field>` |

Keyframes: the four identical opacity fades (`rise-in`, `fade-in`, `rail-in`,
`panel-open`) are one `fade-in` in `base.css`. `bub-in`, `sl-fresh`, `rl-in`,
`dlg-in`, `studio-dlg`, `fx-rise` and `rec` follow their classes, and `rec`
is `blink`.

Deleted, because no code can produce them: `.ships*` (the old "How Vellum
ships" list on About), a second `.visually-hidden` identical to `.vh`,
`.glass--thin`, `.glass--thick`, `.card__placeholder`, `.stale-tag`,
`.tier-note`, `.scene3d__axis`, `.scene-row` and `.scene-chip`. Card's
`--dashed`, `--flush` and `--muted` stay: no page passes a variant, but the
prop still accepts them.

**Checks.** A snapshot of every computed style on 17 views (home, servers,
Dash, Projects, a shelf, six Settings pages, 404, and the editor in all five
modes), taken on the built file before and after, is identical: 0 differing
entries out of about 7,500 elements. The class names the code uses without
a CSS rule are the same set before and after, renamed. No old name is left
in the CSS, the TSX or the comments. Typecheck, lint and every browser test
pass.

## Phase 6: colour and tokens

The operator picked **B, inventory grey**, for the editor from four renders
(today's paper, A stone and redstone, B inventory grey, C cutting mat). The
dark pages keep the Blockbench room the operator asked for earlier.

**The editor's palette.** Panels `#c6c6c6`, viewport `#8b8b8b` (the slot
grey), page `#b9b9b9`, ink `#1f1f1f` / `#373737` / `#404040`, accent `#264690`
blue, ok `#17572f`, warn `#6b4a12`, danger `#8a1c14`, UV sheet `#262626`, YAML
listing `#d6d6d6`. Glass stays: panels are 86% over a 14px blur.

**Tokens by role.**

| Was | Now |
|---|---|
| `--glass-rim`, `--line` | `--border` |
| `--glass-rim-lit`, `--line-strong` | `--border-strong` |
| `--line-dashed` | `--border-dashed` |
| `--glass-rim-wax` | `--border-accent` |
| `--glow-wax` | `--focus-ring` |
| `--wax-500` | `--accent` (the same value) |
| `--wax-400` | `--accent-mark` (lines, dots, focus; brighter on the dark surface) |
| `--wax-300`, `--wax-200` | by meaning, one use at a time: `--accent-mark` or `--accent-text` where they meant selected or active, `--danger` where they meant wrong (menu delete, validation errors, the crash message, config problems), `--warn` where they meant a warning (hints, the export warning, outdated sync, the YAML note) |
| `--highlight` | `--accent-hover` |
| `--flame-400` | `--warn` |
| `--bg-sunken`, `--well` | `--sunken` |
| `--well-deep` | `--sunken-strong` |
| `--chrome`, `--chrome-status` / `--chrome-strong` / `--chrome-soft` | `--bar-bg` / `--bar-bg-strong` / `--bar-bg-soft` |
| `--stage-wash` | `--viewport-bg` |
| `--uv-field` | `--uv-bg` |
| `--bevel`, `--bevel-soft` | `--inner-highlight`, `--inner-highlight-soft` |
| `--r-pill` | `--r-control` |
| `--navy-*` | gone. The 4 steps in use became `--viewport-bg`, `--ink-faint` and two fixed colours on the hue picker's knob |
| `--bb-blue`, `--bb-blue-hi`, `--bb-violet`, `--bb-teal`, `--bb-amber`, `--bb-green`, `--bb-red` | `--blue`, `--blue-bright`, `--violet`, `--teal`, `--amber`, `--green`, `--red` |

Deleted, unused or always `none`: `--sheen`, `--sheen-strong`, `--shadow-sm`,
`--highlight-soft`, `--glow-wax-strong`, `--wax-600` to `--wax-950`, eleven
`--navy-*` steps, `--surface`, `--surface-2`, `--surface-raised`,
`--ink-invert`, `--bb-pink`. The six rules that only painted `--sheen` went
with it. Every `var(--x)` left in the code names a token that exists, apart
from per-element values set inline (`--i`, `--mx` and so on).

**Checks.** A snapshot of every computed colour on 12 dark routes, taken
before and after, is identical apart from one switch knob that moved from
`#94949a` to `#949bab`. `contrast-audit.mjs` reads 0 on all seven pages; it
first flagged the viewport's zoom control (3.49:1 over the grey viewport),
which now sits on a solid panel, and the UV face labels, which now use a pale
tint of the accent on the dark sheet.

**Found on the way.** The editor's File, Edit, Animation, View and Help menus
had been cut off below their first item since commit `612c294`, which made the
menu bar scroll sideways for narrow screens; a scrolling box clips what drops
out of it. The bar no longer scrolls, the file name shrinks instead on a
narrow screen, and every menu opens in full on desktop and at 390px.

`contrast-audit.mjs` also takes `BASE=` now, so it can check the built file,
and skips a screenshot that stalls: the home page's font set never reports
ready in headless Chromium, which hung the script.

## Phase 7: docs

- **`vellum/README.md`.** "The material" was rewritten in phase 6 to match
  what shipped. The rest of the README, the root `README.md` and
  `docs/backlog.md` were rewritten plainly in this phase (README hits 92 to
  4, all in wording kept on purpose; root README 1 to 0; backlog 7 to 0),
  and every fact was checked against the code. Fixed on the way: all the
  samples were said to come from Blockbench (two do); the boss example
  listed features the config no longer has; the name-drift example was a
  block, which has no config; blocks were said to have a Config tab; the
  config zip paths were flat; `kind` was said to live outside the file;
  the editor was said to refuse to save past validation errors;
  `Model3D.tsx` was called the renderer (it is `ModelView.tsx`); an
  off-angle warning was said to have a one-click fix; the pretty-printed
  sizes were wrong (the Alien Sword is 16.6 KB and 10.3 KB, not 16 and
  8.8); the stage was described on white paper; a `.vellum` was said to
  keep `git diff` useful (it is one line); the rig was said to be
  regenerated on save; every page was said to be built from Card (only
  Settings is); dropped items were said to be a quarter size (0.45); the
  About version was "approaching v8/v9" (0.9.0). What the README says about
  the plugin now says it describes the original plugin, and the
  `#/projects/:scene/:shelf/new` route is in the screens table.
- **`CONTINUE.md`.** Rewritten in full at the operator's word: where things
  stand, the plugin decisions that are still open, what's not done
  (including the bugs this audit found), the live server, the traps, and
  the standing instructions.
- **Finished docs.** `SPEC-light-theme.md` and the Blockbench research
  notes moved to `vellum/docs/archive/` (`ce34c97`). `ZOOM-FIX.md` stays:
  its fix never landed (`git log -S zoomAnchor` finds only the first
  implementation and the diagnosis), and today the zoom misses by 2 px at
  the centre and 97 px at 300 px out.
- **`vellum/docs/plugin-api.md`.** Rewritten plainly and brought in line
  with the contract the code serves (`65a1364`): the event stream, the Plan
  card, the pack date and the problem messages. It documents the Studio's
  own contract, which any plugin implements, so it doesn't depend on the
  old plugin. Whether the new plugin implements it was phase 8, which is
  out of scope.

## Bugs found by the audit

Found while checking comments against code, and fixed after the audit at
the operator's word. None was in the plugin. Each fix was reproduced first
where it could be, then checked (scripts and browser runs in the session;
the computed styles of the 17 snapshot views are unchanged).

| # | Where | Bug | Now |
|---|---|---|---|
| B1 | `lib/config.ts` | `coerce` tested a tri-state switch with `v === 'true'`, but a reopened `.vellum` holds the boolean. Set a mob's gravity to true, save, reopen: the YAML said `gravity: false`, and the next save kept it. A served schema's own copy of the options wasn't recognised at all | Both `true` and `'true'` read as true, and the switch is recognised by its options. True and false survive two saves and reopens |
| B2 | `lib/texture.ts` | The bucket fill never ended when the new colour was within the tolerance (8) of the one it replaced: a painted pixel still matched and was pushed again. Filling 100,100,100 with 104,100,100 on 16x16 ran three minutes and reached 9 GB | Each pixel is visited once. The same fill takes 0.3 ms and covers the same region as any other colour |
| B3 | `lib/config.ts` | The upgrade from before v7 turned a blank switch into `false`, written to the YAML | A blank switch stays unset |
| B4 | `lib/config.ts`, `editor/ConfigPanel.tsx`, `pages/Editor.tsx`, `lib/model.ts` | A goal is written as one space-separated line, so a clip name with a space lost everything after it | Typed spaces become `_` in clip names and goal cells ("melee attack" becomes `melee_attack`). An idle or walk clip with a space is an error, and an old clip name with a space is a warning |
| B5 | `lib/new-model.ts` | Dropping a cube anywhere but on a bone took it out of the bone tree | The cube stays where it was, and no undo step is added |
| B6 | `lib/new-model.ts` | Deleting a bone kept the tracks of the bones under it, which then failed validation | Their tracks go too. Deleting the Voidling's torso removes 34 tracks on 10 bones |
| B7 | `lib/vellum.ts` | A `.vellum` whose `requires`, `stages` or `effects` wasn't a list threw a TypeError on open | Anything that isn't a list of objects reads as empty, and the model opens |
| B8 | `lib/version.ts` | A 200 whose body was JSON `null` threw outside the try | It reads as an answer that names no version |
| B9 | `pages/Support.tsx` | The composer sent a typing signal on every keystroke; the contract says 3s | One signal per ticket every 3s at most |
| B10 | `lib/dash.ts`, `lib/dash-api.ts` | A blank string kept the old value with no note; a heartbeat ignored a non-string `agent` and a non-number `everySeconds` silently | Each is reported in `problems`. `docs/plugin-api.md` says so |
| B11 | `lib/uv-pack.ts` | When a box fit nowhere, the sheet grew once more after the last search and came back oversized | It stops after the last search, and a total miss returns the model unchanged |
| B12 | `lib/pack.ts` | A model with nothing configured got a stub file in the configs zip, because the stub has `config-version: 1` | The config body decides, and such a model is left out |
| B13 | `lib/pack.ts`, `lib/mcmodel.ts` | Two models with different textures of the same name got one file, so the second wore the first one's texture | A clashing texture is written under the model's name, the model file points at it, and the report notes it. An identical image is still shared |
| B14 | `lib/world.ts` | The comment said the `- 26` turned the stage's figure toward the camera; it turns it away | Measured in the browser, the code is right: the floor carries a walk away from the camera, and a figure turned toward it walks backwards. The comment now says so |
| B15 | `lib/pack.ts` | The configs export skipped blocks before its collection-key check, so that check could never fire | Kinds without a config form are skipped first; a form added before its key is confirmed will be held back and say so |
| B16 | `components/ModelView.*`, `lib/world.ts` | The stage shaded its own cubes twice: Minecraft's shading is painted into their sheet, and the viewport dimmed each face again | The stage's sheet is marked as shaded, and the viewport adds nothing to its faces. The model keeps the editor's shading |
| B17 | `editor/ConfigPanel.tsx` | Found while checking B4: "Add goal" did nothing, because an empty row became an empty line and was dropped, and clearing a cell shifted the cells after it left | The form keeps rows as typed and reads the file again only when it changes from outside, such as on undo |

Unused exports seen on the way: `assets`, `outliner`, `editorTextures`,
`animations`, `keyframeRows` in `lib/data.ts`; `endpoints`,
`webhookEvents`, `endpointLabel`, `findEndpoint` outside `lib/api.ts`;
`usedBy` in `lib/endpoint.ts`; the `event` field in `lib/support.ts`.

## Scope

The operator took the plugin out of the audit: phase 8 is not run, and this
audit covers the studio only.

## Waiting on the operator

Nothing. The humour spots (P2-8) were answered on 2026-09-30.

