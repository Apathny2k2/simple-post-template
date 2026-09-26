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

## 0. THE RELAY IS DEAD, AND SO IS THE PLUGIN IT SPOKE TO

**Do not go looking for the relay.** An earlier version of this file
opened by telling you to read it first. That is now wrong.

The plugin half of this project was another Claude session working in a
separate repository. **That repository was deleted and restarted from
scratch**, with the Studio as the primary objective and the plugin
rewritten as a wrapper that supports it in game. The relay artifact
still exists and its last entry is still `0049`, but nothing is on the
other end.

The hourly Routine that polled it (`trig_014mhCnhJUMZDq9YTcgPt7vR`) has
been deleted. Nothing is scheduled any more.

**The consequence that costs real money if you miss it:** a large part
of this codebase was written against facts read out of that now-deleted
source. Those facts are not wrong so much as *unowned* — there is no
longer anything they describe. §2 lists them. Treat every one as a
decision to be made rather than a constraint to be obeyed, and check
against the new plugin before trusting any of it.

**The architecture inverted.** Previously the plugin was the source of
truth and the Studio read its served declarations — which is why
`lib/mob-schema.ts` fetches a catalogue instead of holding one, why
`keyConfirmed` refuses to guess a collection key, and why unknown wire
types are named and left undrawn rather than approximated. That
discipline was correct when the plugin owned the format. **If the
Studio owns it now, several of those guards are asking permission from
something that no longer exists.** Confirm the ownership question with
the operator before building on either assumption; it was put to him
and had not been answered when this was written.

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

## 2. NO LONGER ANSWERABLE — these are yours to decide

These were open questions to the plugin session. **Nobody is going to
answer them.** Each is now a design decision.

1. **Hit regions.** `lib/hitregions.ts` derives hittability from rules
   reverse-engineered out of the old `RigBaker` and `HitRegions`: a
   region is *a hidden cube in a bone that draws nothing else*, and one
   such bone silently strips target status from every drawn bone on the
   mob. The "Where it can be hit" panel exists **solely** to warn about
   that footgun — hiding a cube for an unrelated reason flips the whole
   rig. **That constraint came from code that no longer exists. If the
   Studio owns the format, delete the constraint rather than defending
   it:** put an explicit region flag on the bone in `.vellum`, and both
   the trap and the warning go away. Keep the mode readout; it is still
   worth showing. This is the highest-value cleanup on the list.
2. **The collection keys and file layout.** `MOB_KEY = 'entities'`,
   `ITEM_KEY = 'items'`, `config-version: 1`,
   `mobs/<id>/mob.yml`, `items/<id>/item.yml`, one directory per thing,
   discovery walking directories only. All of it described the old
   plugin. `keyConfirmed('blocks')` is still false and blocks are still
   excluded from the pack export, **waiting on an answer that is not
   coming.** Decide it.
3. **The served schemas.** `GET /api/mob/schema` and the never-built
   `GET /api/item/schema`. `lib/mob-schema.ts` is 275 lines of reader
   for a catalogue nothing serves. It still degrades correctly to the
   built-in schema when no plugin is linked, so it is not broken — but
   it is a mechanism without a counterpart.

## 3. NOT DONE

- **The item form is five identity keys.** `ITEM_SECTIONS` in
  `src/lib/config.ts` holds `display-name`, `model`, `lore`,
  `max-stack-size` and `durability` — nothing about what an item *does*.
  `tool`, `food`, `effects`, `armor`, `weapon` and `consumable` cannot
  be authored at all. This is the biggest functional gap in the app.
  It was parked waiting on a served `/api/item/schema`; **that endpoint
  was never built and its codebase is gone**, so the shape is now the
  Studio's to define. Design it here and let the plugin read it.
- **The three probe items.** Copies are in `probes/` in the handoff
  zip (also on the dead relay in `0044`). They were written against the
  old plugin's `food:`/`consumable:` vocabulary, so treat the KEYS as
  obsolete and the TEST DESIGN as the part worth keeping. All three are `base: PAPER` deliberately — PAPER is
  inert, so probe 1 eating proves the food→consumable implication
  rather than proving bread is edible. Probes 2 and 3 are identical
  apart from the `food:` block, so a difference isolates the food
  value. `food:` takes `nutrition`, `saturation`, `always-edible` —
  and an unknown key there is an **error that blocks the whole content
  swap**, so omit what you do not know.
- **The `person()` gate — historical, on a jar that no longer has
  source.** A write to the live box answered `unauthorized`, not 404.
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

## 4. THE LIVE SERVER — running a jar built from deleted source

Everything in this section describes the state before the plugin was
restarted. The box may still be up, but nothing on it is built from
code that still exists. Re-verify before trusting any of it.


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
- **The Studio is the primary objective now**, with the plugin a
  wrapper that supports it in game — the reverse of how this project
  ran until the rewrite. Only the app is this repo's job, but the app
  no longer has to ask permission for its own formats.
- Do not break the seam: the reconnect effect stays on the Dashboard
  page, the localStorage key stays `vellum.dash.link`, and
  `lib/endpoint.ts`, `dashEndpoints` and `window.Vellum` are
  load-bearing, not documentation.
- MythicMobs is replicated in-house. It is **not** a dependency and its
  vocabulary is not ours — that was settled and the config schema was
  rewritten in canonical keys. Note the keys in `lib/config.ts` are
  canonical to a plugin that no longer exists; the *principle* stands,
  the *spellings* are now open.
