# Continue here

The state of the project for whoever picks it up next. Rewritten on
2026-09-29, at the end of the wording audit, and updated on 2026-09-30.

**Branch** `claude/blockbench-react-editor-lk38qe` · **PR** #3 (draft) ·
**Artifact** v45, `https://claude.ai/artifact/BZpDzWLJ4z6soEAmVMcVwN`

Read `CLAUDE.md` first. It has the working rules: typecheck with `tsc -b`,
republish the artifact after every push, how the sample models are made,
and how to test in a browser. `vellum/README.md` is the design record, and
`AUDIT.md` records the audit.

## 1. Where things stand

The app is a model studio for Minecraft servers, in `vellum/`:

- `#/` is the home page. **Sign in** leads to `#/login`, a sample sign-in
  (`src/lib/session.ts`): any email and password work, only the email is
  kept, in `localStorage`, and nothing leaves the page. `#/servers` lists
  the servers you have access to and needs someone signed in. The servers
  are samples in `src/lib/servers.ts`.
- Entering a server opens its Dash at once and plays the arrival over it
  (`src/components/Arrival.tsx`), with no backdrop: Pip, in the server's
  colour, walks into a purple portal that grows in front of him and shuts
  behind him (`src/lib/pip/arrive.ts`). Then the server's name shows in the
  middle in blocky letters with a stepped edge, coloured from the server's
  id (`src/lib/title.ts`). The Dash runs the demo feed under that server's
  name until someone presses Stop demo.
- `#/dash`, `#/projects` and `#/settings/*` are dark, in the style of
  Blockbench (`src/styles/studio.css`).
- `#/editor/*` uses Minecraft's inventory greys (`src/styles/tokens.css`).
- Pip, the line-art miner, is every loading state. He mines while work
  runs, fishes while a person writes back, and is the boot screen.
- Support is a working ticket system against an in-browser mock
  (`src/lib/api.ts`, `src/lib/support.ts`).

The wording audit in `AUDIT-BRIEF.md` ran phases 0 to 7 on 2026-09-29.
Comments were cut to about half, class names are full words, tokens are
named by role, and the UI copy and docs were rewritten plainly. Phase 8,
the plugin, was skipped at the operator's word. Checking comments against
code turned up 17 bugs, all in the studio, and they were fixed the same
day (`AUDIT.md`, "Bugs found by the audit").

## 2. The plugin was rewritten

The plugin used to be another session's work, in a separate repository.
That repository was deleted and the plugin restarted as a wrapper around
the Studio, which is now the main product. Don't look for the relay
artifact the two sessions used: nothing is on the other end, and the
Routine that polled it was deleted.

Parts of this app were built against facts read out of the old plugin.
They still work, but nothing checks them against the new one. When the
plugin owned the format, the app was right to defer to it:
`lib/mob-schema.ts` fetches a catalogue instead of holding one,
`keyConfirmed` refuses to guess a collection key, and unknown field types
are named and left undrawn. If the Studio owns the format now, those
guards ask permission from something that no longer exists. The operator
was asked who owns the format, and there is no answer in this repository
yet. Until there is, treat the items below as decisions to make:

1. **Hit regions.** `src/lib/hitregions.ts` follows the old plugin's rule:
   a bone that draws nothing but holds a hidden cube is a hit region, and
   one such bone takes target status away from every drawn bone on the
   mob. The "Where it can be hit" panel is there to warn about that. If
   the Studio owns the format, an explicit region flag on the bone in
   `.vellum` would remove both the trap and the warning. Keep the mode
   readout either way. This is the most useful cleanup on the list.
2. **Config layout.** `MOB_KEY = 'entities'`, `ITEM_KEY = 'items'`,
   `config-version: 1`, `mobs/<id>/mob.yml`, `items/<id>/item.yml`, one
   directory per thing. All of it described the old plugin.
   `keyConfirmed('blocks')` is false, so block configs stay out of the
   export until someone decides the key.
3. **The served schemas.** `lib/mob-schema.ts` reads `GET /api/mob/schema`
   from a linked plugin and falls back to the built-in schema when none
   answers. Nothing serves it now, and `GET /api/item/schema` was never
   built.

## 3. Not done

- **Items only have identity fields.** `ITEM_SECTIONS` in
  `src/lib/config.ts` covers `display-name`, `model`, `lore`,
  `max-stack-size` and `durability`. Nothing about what an item does
  (tool, food, effects, armour, weapon, consumable) can be written yet.
  It waited on an item schema from the plugin that was never built, so
  the shape is now the Studio's to design. This is the largest gap in the
  app.
- **The probe items.** Three test items from the old handoff zip
  (`probes/`) used the old plugin's `food:` and `consumable:` keys, so
  the keys are obsolete. The test design is worth keeping: all three are
  `base: PAPER`, which does nothing on its own, so eating probe 1 proves
  the food key worked; probes 2 and 3 differ only in their `food:` block.
- **Zoom at the cursor misses off-centre.** `ZOOM-FIX.md` diagnoses it
  and proposes two fixes. Measured on 2026-09-29: 2 px off at the
  viewport centre, 97 px off at 300 px from it.
- **The styling layer.** Tokens are named by role now, but there is no set
  of shared primitives between the tokens and the page CSS. Ask the
  operator what "styling framework" should mean before building one.
- **The `person()` gate on the live box.** A write answered
  `unauthorized`. The operator asked for Studio gating to be switched off
  for testing, behind a switch that announces itself at boot, and prefers
  `/vellum studio link` working first. That is theirs to do on the server.
- **No tests are committed.** The Playwright suites used in this session
  lived in its scratchpad. `scripts/contrast-audit.mjs` is the only
  browser check in the repository.

## 4. The live server

Unverified since the plugin was restarted: nothing on it is built from
code that still exists. Don't touch it: no ssh, no deploys, no requests
to the Studio or plugin API. The operator does that.

```
54.90.206.53:25566             the game (not 25565)
http://54.90.206.53:8018/app   the Studio
http://54.90.206.53:8018/      the old vanilla editor
http://54.90.206.53:8017       the pack host
```

Open `/app`, not the bare host, which serves a different application.
Sessions here could not reach the host at all (the sandbox blocks it),
and that says nothing about whether the server is up.

## 5. Traps

- Two true facts can join into a false conclusion. `hitbox` was refused by
  the schema and there was also a hit-region gap, so they looked like one
  problem; `hitbox` was a retired key nothing read. Strings missing from
  the live page looked like a stale deploy; it was the old app at another
  route.
- A mob's config file is `mobs/<id>/mob.yml`, but its key is `entities`.
  Don't infer collection keys from directory names.
- The old plugin found configs by walking directories, so a flat
  `mobs/<id>.yml` raised no error. Nothing read it.
- `model:` in a config must name an asset the pack carries, not a vanilla
  item id. `model: "minecraft:bread"` is refused.
- `tsc --noEmit` checks nothing here. Use `tsc -b`.
- After a hot update Vite serves a module at a `?t=` URL, so a test's
  `import('/src/lib/x.ts')` gets a second copy. Hard-reload first.
- Write `backdrop-filter` without a hand-written `-webkit-` line after it,
  or the minifier drops the standard one and Chrome draws no blur.
- A box that scrolls sideways clips menus that drop out of it. The
  editor's menu bar doesn't scroll for that reason.
- The home page's font set never reports ready in headless Chromium, so
  Playwright screenshots of `#/` can stall. `contrast-audit.mjs` skips a
  stalled shot.
- Check what the user sees, not only what a function returns. The
  hit-region readout was correct and invisible, inside a panel that stays
  closed when a model has no other problems.
- Test on something inert, so a pass can't come from the wrong cause.

## 6. Tools in the repository

- `vellum/scripts/slop-scan.mjs` counts wording that reads as
  machine-written in comments, on-screen text and docs.
- `vellum/scripts/same-code.mjs` checks that files changed only in their
  comments since a git revision.
- `vellum/scripts/contrast-audit.mjs` measures text contrast on every
  page. Set `BASE=file:///…/dist/vellum.html` to check the bundle.
- `vellum/scripts/make-samples.mjs` and `make-boot.mjs` rebuild the sample
  models and the boot screen from the app's own code.

## 7. Standing instructions

- Republish the artifact after every push (see `CLAUDE.md`).
- The Studio is the main product, and the plugin supports it in game.
  This repository is the app's; the app can decide its own formats.
- Keep the seam the plugin uses: the reconnect effect stays on the Dash,
  the localStorage key stays `vellum.dash.link`, and `lib/endpoint.ts`,
  `dashEndpoints` and `window.Vellum` stay as they are.
- MythicMobs is not a dependency and its names aren't used. The keys in
  `lib/config.ts` came from the old plugin, so the principle holds but the
  spellings are open.
