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

## Waiting on the operator

- **Plugin repository (Phase 8).** Only `Apathny2k2/simple-post-template`
  is visible to this session. The plugin needs its `owner/repo` and the
  Claude GitHub App installed on it.
