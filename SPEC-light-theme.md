# Spec — make the light scheme the only scheme

**Decision:** Vellum's midnight-navy scheme is replaced by the white one.
Light is not an alternative theme; it becomes the app's appearance, and
the dark values are removed rather than kept behind a toggle.

**Status:** the light scheme already exists, works on every screen, and
is opt-in at `data-theme="light"`. This spec is about removing the
"opt-in" part and the dead half. Nothing here is exploratory — §6 lists
what is already done.

---

## 1. Why, in numbers rather than taste

A contrast audit walks every visible text run on five screens and
compares it with the backdrop it actually sits on
(`vellum/scripts/contrast-audit.mjs`).

| | Dash | Projects | Settings | Support | Editor | **total** |
|---|---|---|---|---|---|---|
| **navy (shipping today)** | 3 | 0 | 0 | 5 | 0 | **8** |
| **white (this spec)** | 0 | 0 | 0 | 0 | 0 | **0** |

Eight text runs below AA in the scheme we ship now; none in its
replacement. That is not because white is inherently kinder — it is
because the light scheme was built against the measurement and the dark
one accreted over months. The same audit is the acceptance gate in §5,
so the new scheme cannot drift back.

**Do not read this table as "dark is broken".** Eight failures across
five screens is a small number and every one is fixable. It is offered
as evidence that replacing is not a regression, not as an argument that
the old scheme was bad.

## 2. What "replace" means, file by file

1. **`styles/tokens.css` takes the light values directly.** The 143
   lines of `styles/theme-light.css` move into the `:root` block,
   overwriting their navy counterparts. `color-scheme: light`.
2. **`styles/theme-light.css` is deleted**, along with its `@import`
   in `base.css`.
3. **The `[data-theme='light']` selector disappears.** Nothing in the
   app reads the attribute today — it exists only so this could be
   previewed — so there is no JS to unwire.
4. **The navy ramp stays.** `--navy-050 … --navy-990` remain defined and
   in use: three of them are backgrounds, and the 3D stage and the UV
   field are still painted from them on purpose (§3).
5. **`--stage-wash-light` and the `[data-stage='light']` block** resolve
   into whichever stage decision §3 lands on, and the other is deleted.

## 3. The three things that must NOT follow the UI into the light

Each of these was checked by looking, not assumed.

- **The UV sheet** (`--uv-field`). A texture is judged against a neutral
  dark field; on white, pale texels disappear into the page. It is
  already tokenised and already stays dark in the light scheme. Keep it.
- **`WorldScene`'s overlays** — three navy literals left deliberately
  unconverted. That component draws a Minecraft scene, and its HUD sits
  over grass and sky rather than over app chrome. It is scene content,
  not UI, and needs its own pass with eyes on it.
- **The 3D viewport — THIS IS THE ONE OPEN DECISION.** Two variants
  exist and both are implemented:
  - *stage lit* (`data-stage="light"`): the whole app is white.
  - *stage dark* (default): white chrome, dark viewport.

  Blender, Blockbench and Figma all keep a dark or mid canvas in their
  light themes, because a model lit for a black void loses its lightest
  faces against a white page. Voidling is dark purple and survives
  either way; a pale model would not. **The operator has seen both and
  preferred the fully-white one.** That is the call — record it here and
  delete the other. It is one token either way.

## 4. Work items

Ordered so each one is independently shippable.

**A. Land the swap** (small). §2, items 1–5. No behaviour change, no
new colour decisions. The audit in §5 must read 0 after it.

**B. Remove the two ramp bridges** (medium, ~70 call sites). The light
scheme currently re-points `--wax-200/300/400` and `--flame-400` inside
its own block. That is a bridge and says so in the file: on navy the
wax ramp runs dark-to-light with prominence rising with the number, and
on white that is backwards, so those tones vanish. Rather than rewrite
~70 call sites during a preview, the ramp itself was re-pointed.

**Once light is the only scheme the bridge is actively misleading** —
`--wax-200` will name a *dark* red. Fix the call sites: anything using a
wax tone as a text or icon colour becomes `--accent`, `--highlight` or
`--danger`; anything using it as a fill keeps a ramp step. Then delete
the override block. **187 colour literals and 182 raw-ramp references
remain outside the token files** — this item is the bulk of them.

**C. Finish tokenising the wells** (small). Nine dark-literal
backgrounds became `--well` / `--well-deep` / `--uv-field`. Three remain
in `WorldScene.css` (see §3) and want a judgement call, not a
find-and-replace.

**D. Decide the stage** (§3) and delete the losing variant.

**E. Re-baseline the samples and any screenshots** in `README.md` and
the PR body, which all show the navy scheme.

## 5. Acceptance

```
cd vellum && pnpm dev
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/contrast-audit.mjs
```

- **Every screen reports 0 text runs under 4.5:1.** Five screens are
  covered today; add one per new route.
- `tsc -b` clean, `pnpm build:single` clean.
- No `var(--…)` used without a fallback that is not defined anywhere.
  There was exactly one — `--ink-soft` in the zoom cluster, which had
  never had a colour of its own and inherited one. It went unnoticed
  for as long as everything behind it was dark.

**Trust the tool only as far as §7 says you can.**

## 6. Already done — do not redo it

- The light scheme itself: `styles/theme-light.css`, 143 lines.
- **Five surfaces that were navy literals now have tokens**, and this is
  worth having whichever scheme wins: the top bar, the menubar, the
  editor toolbar and the status bar (`--chrome`, `--chrome-strong`,
  `--chrome-soft`, `--chrome-status`), plus the viewport wash
  (`--stage-wash`). The first attempt at a light theme left three black
  strips across a white app because each of those was
  `rgba(7, 12, 25, x)` typed in at the call site, and a literal cannot
  be re-themed.
- Nine sunken wells tokenised (`--well`, `--well-deep`, `--uv-field`).
- Four raw-navy *text* colours moved onto semantic tokens.
- `--ink-faint` darkened to `#4a5c8a` after measuring 4.07:1 — the
  panels are white over a tinted ground, not pure white, so a
  swatch-against-`#fff` check overstates the headroom.
- `--flame-400` darkened for light; the Support "pending" pill was
  reading 1.9:1.
- The `--ink-soft` bug above.
- **Verified no dark-scheme regression**: the audit was run against the
  tree before any of this work and returns the identical 8 failures, so
  those are pre-existing and none of the shared call-site edits broke
  the scheme still shipping.

## 7. A caution about the audit tool

It reads `backgroundColor` from computed style. **A gradient or an image
has no `backgroundColor`**, so an early version walked past it to a
distant ancestor and invented a figure — it reported the X/Y/Z axis
chips (white text on a solid colour gradient, plainly legible in any
screenshot) as 1.09:1 failures in light and as passes in dark, purely
because the fallback ancestor differed between themes. It now returns
*unjudgeable* for those and skips them.

The lesson generalises past this tool: **a number that changes with the
theme for an element whose own colours did not change is measuring the
measurer.** Look at the screenshot before believing a failure.
