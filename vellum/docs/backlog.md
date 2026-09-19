# Next, after the hardening tiers

Captured mid-session so it survives. Everything here is **app-side only** —
the plugin implements its own half, so nothing below needs to reach past
the studio.

## 1. Animated sample items — **done**
Four new models shipped with the editor, all animated:
- two swords — `runic_blade`, `emberfang`
- one potion — `tide_flask`
- one food — `honeyed_loaf`

**consumables** is a project kind: its own starter, its own shelf, and a
validation rule that asks for the use clip, because a consumable that
animates nothing is an ordinary item.

Built by `scripts/make-samples.mjs` rather than by hand.

## 2. Display ▸ "View in real world"
The Display tab previews a model on a tilted grid with nothing to judge
scale against. Add a scene view:

- Render a Minecraft-style landscape in 3D and place the model in it.
- Play the model's animations in that scene.
- **Mobs**: option to spawn a temporary player entity beside the model, so an
  attack animation can be judged against a real target and a real height.
- **Item models**: placed in the air, same scenery.
- **Blocks with animations**: auto-play them, with a **pause the scene** control
  so the camera can be moved around a frozen pose.
- **Tools, weapons, consumables**: rendered as a dropped item on the landscape,
  not held.

## 3. Smart auto-animation — **done**
An engine that reads a model's structure — bone names, hierarchy, symmetry,
limb lengths — and generates plausible animation. **Mobs only.** Offer 3–4
presets (idle, walk, attack, and one more).

Four: idle, walk, attack, hurt. `src/lib/auto-rig.ts` reads names first
and falls back to shape, and the panel reports what it decided so a wrong
guess is visible.

## 4. Settings ▸ Cloud (paid)
A cloud interface for paid tiers. Vellum allocates each paid account a
database; it syncs with the plugin so a team sees the same files as a shared
workspace with per-member identities. The account owner oversees all
databases and retains access.

## 5. Settings sidebar — **done**
Rename the **Paid Tiers** divider to **Manage**.

## 6. About — **done**
- Version: approaching **v8/v9**
- Plugin version: **v0.2a**, with a verifier call that checks the plugin and
  the studio are on compatible versions
- Renderer: **Built in house**
- Author: **TakkyPvp / VeracityPvp**
- Changelogs are pushed into each user's studio from the **Master Console**
  (a separate system, tackled later)
