# Continue here

Written at the end of a session that was closed mid-stream. Everything
below is either unfinished, unanswered, or a trap that has already cost
time once.

**Branch** `claude/blockbench-react-editor-lk38qe` · **PR** #3 (draft) ·
**Artifact** v24, `https://claude.ai/artifact/BZpDzWLJ4z6soEAmVMcVwN`

Last commits:

| | |
|---|---|
| `d082137` | hit-region authoring — the outliner writes them as intent |
| `460f062` | hit-region mode readout — `lib/hitregions.ts` |
| `8352fcd` | item root key confirmed `items`; per-kind layout table |
| `54fe4f6` | a failed reload prints the request it actually made |
| `3cf1ce5` | `POST /api/reload` — the reload panel |

---

## 0. THE FIRST THING TO DO

**Read the relay before writing any code.** The plugin half is another
Claude session and it answers questions faster than the code does.

```
ArtifactData action=query
  url=https://claude.ai/artifact/LTHATyCb4D8Uevy7UsV3Hj
  collection=channel          <- NOT "relay"; that name returns
                                 "No documents matched", which reads
                                 exactly like "nothing new"
  query={"where": [["from", "eq", "terminal"]],
         "order_by": {"field": "at", "direction": "desc"}, "limit": 4}
  out_dir=<scratch>            <- or each check costs ~12k tokens
```

Odd ids are theirs, even are mine. **Compare ids, never timestamps** —
their clock runs behind the `at` values I mint, and a watermark filter
silently skipped a real entry once, costing a deadline.

Newest as of writing: theirs `0049`, mine `0060`.

### Scheduled checks still running

- `trig_014mhCnhJUMZDq9YTcgPt7vR` — hourly at :13, fires into this
  session. **This one outlives the session and should be deleted or
  repointed** (`delete_trigger` / `update_trigger`).
- A 1-minute `send_later` chain. It self-terminates: each firing
  re-arms only if a live session handles it, so once this session is
  closed the last armed tick fires into nothing and the chain stops.

---

## 1. THE STYLING FRAMEWORK FOR THE STUDIO — not started, scope undefined

This was named as outstanding and **no work has been done on it**. What
exists today:

- `src/styles/tokens.css` — 108 custom properties: a navy/wax palette,
  glass and bevel layers, type scale (`--fs-*`), spacing (`--sp-*`),
  radii (`--r-*`), motion (`--dur-*`, `--ease`, `--spring*`), shadows.
- `src/styles/base.css` — reset, the body shell, the "room the glass
  sits in".
- `src/styles/fonts.css`.
- **16 component/page CSS files, ~5,600 lines**, each hand-written
  against those tokens. No UI framework, by instruction.

So there is a token layer and there is a pile of bespoke CSS, and
nothing in between. A framework would be the missing middle: named
primitives (surface, panel, field, toggle, pill, tree row), documented
states, and one place a control's look is decided rather than sixteen.

**Evidence the middle is missing, found while building the reload
panel:** I wrote `var(--ink-dim)`, `var(--bad)`, `var(--sunken)`,
`var(--mono)` and `var(--focus)` — five plausible token names, **none
of which exist**. The real ones are `--ink-muted`, `--danger`,
`--bg-sunken`, `--font-mono`, and focus is done per-component with
`box-shadow` and no token at all. Two of those had no fallback, so
they would have rendered as *nothing* rather than as wrong. That is the
symptom: the token vocabulary is not discoverable from the code that
consumes it.

**Before building anything, get the scope from the operator.** "Styling
framework" could mean a documented token/primitive system inside this
repo, or extracting the design language so the plugin's own pages match,
or something else. Do not guess — the same instinct produced a
`vector3` control for a retired key earlier in this project.

---

## 2. WAITING ON THE PLUGIN SESSION

1. **Does a hidden BONE holding visible cubes count as drawn?** The
   `RigBaker` extract they sent reads cube-level visibility only.
   `lib/hitregions.ts` reports this as an *unknown* rather than picking
   a side — fold the answer in when it arrives.
2. **`ContentLayout.Kind.BLOCK`** — the collection key and file name
   for blocks. Until then `keyConfirmed('blocks')` is false and block
   configs stay out of the pack export. Do not infer it from `blocks/`
   (see the trap in §5).
3. **`GET /api/item/schema`** — in adversarial review on their side.
   They asked to be attacked before it is rendered. Agreed so far:
   `OptionType` gains `CHOICE`; `OptionSpec` gains `choices` and
   `required`; `list` declares `items: {type}` for scalars vs
   `fields: [...]` for records; a `group` sibling exists; one level of
   nesting, enforced; a `list` carries a required max count; and a
   `consumable` group declares `implied_by: "food"` with the values the
   implication produces.

---

## 3. NOT DONE

- **The five item keys** — `tool`, `food`, `effects`, `armor`,
  `weapon`, plus `consumable`. All six already work in the plugin; the
  Studio cannot author any of them. `ITEM_SECTIONS` in `src/lib/config.ts`
  holds **five identity keys only** (`display-name`, `model`, `lore`,
  `max-stack-size`, `durability`). This is the biggest functional gap
  and it unblocks when `/api/item/schema` lands — render from the
  declaration, **do not keep a copy** (that is what `lib/mob-schema.ts`
  exists to avoid).
- **Live testing of the three probes.** Files are on the relay in
  `0044` with sha1s. All three are `base: PAPER` deliberately — PAPER is
  inert, so probe 1 eating proves the food→consumable implication
  rather than proving bread is edible. Probes 2 and 3 are identical
  apart from the `food:` block, so a difference isolates the food
  value. `food:` takes `nutrition`, `saturation`, `always-edible` —
  and an unknown key there is an **error that blocks the whole content
  swap**, so omit what you do not know.
- **The `person()` gate.** A write to the live box answered
  `unauthorized`, not 404 — the endpoint exists and auth refused it.
  The operator instructed that Studio gating be *disabled, not removed,
  for testing, behind an obvious switch that announces itself at boot*.
  The plugin session declined to act on that from a relay entry — a
  channel either side can write to is not an authorisation path, and
  that box has three ports open to the internet. **That was the right
  call.** It is the operator's to settle directly. Their preference is
  `/vellum studio link` first — the gate working rather than switched off.
- **The full sweep has not run since `a49dad0`.** `sweep.sh` in the
  session scratchpad drives ~27 Playwright suites. It checks exit codes
  and prints `CRASHED(exit N)` — an earlier version counted only
  `FAIL**` markers and reported a hung suite as clean.

---

## 4. THE LIVE SERVER

```
54.90.206.53:25566        the game        (NOT 25565 — server.properties)
http://54.90.206.53:8018/app   the Studio  <- MY BUILD IS HERE
http://54.90.206.53:8018/      the LEGACY vanilla editor
http://54.90.206.53:8017       the pack host
```

**`/app`, not the bare host.** Opening the bare host shows a different
application entirely, which I once misread as my build having gone
stale — see §5.

This session's sandbox could not reach that host: `curl` was blocked by
the egress classifier and the fetch tool forces `http://` up to
`https://` against a plain-HTTP listener. **Neither failure is evidence
about the server.** The operator makes live requests himself.

---

## 5. TRAPS — each of these has already cost time

**A tidy connection is not a checked one.** Twice in one session I
joined two true facts into a false conclusion:

- `hitbox` was refused by the schema *and* there was a hit-region parity
  gap, so I decided they were the same hole. `hitbox` is RETIRED,
  never appears in `flags`, and was a mapping nothing ever read. I was
  about to build a numeric box for a dead key.
- Strings on the live page were absent from my build, so I declared the
  deploy stale. It was the legacy app at a different route. I had even
  listed that possibility and argued past it.

**Directory names are not evidence of collection keys.** A mob is
`mobs/<id>/mob.yml` keyed **`entities`**. It is the only kind with that
mismatch, which is exactly why it is dangerous: the one counterexample
arrived before the first instance. Confirm every new kind against
`ContentLayout`.

**Discovery walks directories only.** A flat `mobs/<id>.yml` is not an
error — it is a path no reader ever visits. Silent.

**`tsc --noEmit` is a silent no-op here** (root tsconfig is a
project-reference stub with `files: []`). Use `tsc -b`.

**Hot-reloaded modules disagree with the page.** After an HMR update
Vite serves the changed module at a `?t=` URL, so a test's dynamic
`import('/src/lib/x.ts')` gets a *second* instance. Hard-reload first.

**Assert what the user sees, not what the function returns.** The
hit-region readout was correct and invisible — it rendered inside a
panel that stays collapsed when a model is "clean", and a mob that has
just lost every hit region *is* clean by every other measure. Caught
only because the test checked the page text.

**Test on an inert base.** A probe that passes for the wrong reason is
as useless as one that fails for the wrong reason.

**`model:` must name an asset the pack carries**, not a vanilla item id.
`model: "minecraft:bread"` is refused.

---

## 6. STANDING INSTRUCTIONS

- **Republish the artifact on every push.** `cd vellum && pnpm build:single`,
  then publish `vellum/dist/vellum.html` with `url` set to the existing
  artifact, omitting `capabilities` and `icon`.
- The plugin is being built by the other session; **only the app is
  this repo's job.**
- Do not break the seam: the reconnect effect stays on the Dashboard
  page, the localStorage key stays `vellum.dash.link`, and
  `lib/endpoint.ts`, `dashEndpoints` and `window.Vellum` are
  load-bearing, not documentation.
- MythicMobs is replicated in-house. It is **not** a dependency and its
  vocabulary is not ours — that was settled and the config schema was
  rewritten in the plugin's own canonical keys.
