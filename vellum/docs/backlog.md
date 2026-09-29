# Next, after the hardening tiers

Everything here is **app-side only**. The plugin implements its own half, so
nothing below reaches past the studio. Every item is done.

## 1. Animated sample items — **done**

Four animated models ship with the editor:

- two swords: `runic_blade` and `emberfang`
- one potion: `tide_flask`
- one food: `honeyed_loaf`

Consumables are an item subtype, since version 3 of the `.vellum` format.
Before that, `consumables` was a project kind. A consumable has its own starter,
a flask that already has its use clip, and its own group on the Items shelf. A
validation rule asks for the use clip, because a consumable that animates
nothing is an ordinary item.

`scripts/make-samples.mjs` builds all four.

## 2. Display ▸ "View in real world" — **done**

The Display tab previews a model on a tilted grid, with nothing to judge scale
against. **View in the real world** adds a scene view:

- The model on a black stage at its real size, so nothing competes with it
  (see *The stage* in `vellum/README.md`).
- The model's animations play there, and locomotion loops: a mob with a walk
  cycle walks continuously, because the ground travels under it at the speed
  its legs ask for.
- **Mobs**: a player-sized figure, two blocks tall, stands beside the model, so
  an attack can be judged against a real target and a real height. It is on by
  default for mobs, and the **Player** chip turns it off.
- **Item models**: held in the air.
- **Blocks with animations**: they play on their own, and **Pause the scene**
  freezes the pose so you can move the camera around it.
- **Tools, weapons, consumables**: dropped on the floor at 0.45 scale.

## 3. Smart auto-animation — **done**

An engine reads a model's structure (bone names, hierarchy, symmetry, limb
lengths) and generates plausible animation. **Mobs only.** It offers four
presets: idle, walk, attack and hurt. `src/lib/auto-rig.ts` reads bone names
first and falls back to shape, and the panel reports what it decided, so you
can see a wrong guess.

## 4. Settings ▸ Cloud (paid) — **done**

A cloud panel for the paid tiers. Vellum gives each paid account a database. It
syncs with the plugin, so a team sees the same files as a shared workspace, with
an identity for each member. The account owner oversees all the databases and
keeps access to them.

The panel is fed through `PATCH /cloud/workspace` and `PUT /cloud/members`, the
same API the dashboard cards use, and it says who can read a hosted workspace.

## 5. Settings sidebar — **done**

The divider above the paid sections is **Manage**, renamed from **Paid Tiers**.

## 6. About — **done**

- Version: **0.9.0** (asked for as "approaching v8/v9")
- Plugin version: **v0.2a**, with a call to the plugin that checks the plugin
  and the studio are on compatible versions.
- Renderer: **Built in house**
- Author: **TakkyPvp / VeracityPvp**
- Changelogs are pushed into each user's studio from the **Master Console** (a
  separate system, for later).
