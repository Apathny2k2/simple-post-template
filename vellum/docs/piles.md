# Ground piles: the plugin's half

A player right-clicks the top of a block with a diamond, and a flat diamond
lies there. More clicks with diamonds pile more on, up to a limit. Breaking
the pile drops the diamonds. The same goes for emeralds, iron ingots, raw
gold, redstone and anything else a **pile set** lists.

Vellum makes the models and the config. The plugin does everything that
happens in the world. This document is the contract between them.

- **Minecraft**: Java Edition 1.21.4 or later. Stages are shown through the
  `minecraft:item_model` component and the pack's `items/` definitions, both
  1.21.4.
- **Vellum writes**: a resource pack (models and item definitions) and a
  config file per pile set.
- **The plugin owns**: placing, adding, breaking, dropping, saving and
  showing piles.

---

## What Vellum writes

### The pack

For a pile set named `gems`, with namespace `vellum`, and a material named
`emerald` holding up to 8:

```
assets/vellum/models/item/pile/gems/emerald_1.json   … emerald_8.json
assets/vellum/items/pile/gems/emerald_1.json         … emerald_8.json
```

Each `items/` file is a plain 1.21.4 item definition pointing at its model:

```json
{ "model": { "type": "minecraft:model", "model": "vellum:item/pile/gems/emerald_3" } }
```

So the **stage id** `vellum:pile/gems/emerald_3` is what you put in an item's
`minecraft:item_model` component to show that stage.

A stage model is a Java block model in the usual 0 to 16 space: the pieces
lie on its floor (`y = 0`) and stand at most a few pixels tall, kept inside
the 16 by 16 footprint. A vanilla texture (`minecraft:item/emerald`) is
only named in the model, so it changes with the player's texture pack. A custom
texture is written into the pack beside the model.

### The config

One file per set, at `piles/<set>.yml` in the configs zip:

```yaml
# Ground piles for the "gems" set, written by Vellum. The plugin reads this; see docs/piles.md.
piles:
  gems:
    max: 8
    when-full: new-pile
    sound:
      place: "minecraft:block.amethyst_block.place"
      break: "minecraft:block.amethyst_block.break"
    materials:
      diamond:
        match: ["minecraft:diamond"]
        stages:
          - "vellum:pile/gems/diamond_1"
          - "vellum:pile/gems/diamond_2"
          # … one per count, in order
      emerald:
        match: ["minecraft:emerald"]
        stages: [ … ]
      amethyst_shard:
        match: ["minecraft:amethyst_shard"]
        max: 4
        stages: [ … four of them … ]
```

| Key | Meaning |
|---|---|
| `max` | The most pieces a pile of this set holds, 1 to 8. |
| `when-full` | `new-pile` or `refuse`. See [Full piles](#full-piles). |
| `sound.place`, `sound.break` | Sound ids. Absent means the defaults below. |
| `materials.<name>.match` | What the material takes: item ids (`minecraft:emerald`) and item tags (`#c:gems`). |
| `materials.<name>.max` | This material's own limit, never above the set's. Absent means the set's `max`. |
| `materials.<name>.stages` | Stage ids, one per count: entry *k* (from 1) is the pile holding *k* pieces. Its length is the material's limit. |

Several set files can be loaded at once (gems, ingots, raw, dusts). Vellum
refuses an id that two materials of one set both claim. Across sets, the
plugin should do the same at load (see [Matching](#matching)).

---

## Matching

When a player right-clicks with an item, find the material it belongs to:

1. **Custom items first.** If the item has a `minecraft:item_model`
   component, compare that id with every `match` entry that is not a tag. A
   custom gem made in Vellum is matched by its own model id.
2. **Then the item's id** (`minecraft:diamond`) against every non-tag entry.
3. **Then tags.** An entry starting with `#` matches when the item is in that
   item tag.

The first hit wins. Build the lookup once at load: id to material, tag to
material. Warn in the console about any id claimed by two materials (across
all sets), and keep the first.

---

## In the world

### Placing

A right-click on the **top face** of a block, holding an item that matches a
material:

- **Where it's allowed:** the block clicked is solid on top (full top
  face), the space above it is air or replaceable (grass, snow layer), and
  that block top has no pile on it yet.
- **When it happens:** a sneaking right-click always places. A plain
  right-click places only when the clicked block has no use of its own
  (chests, crafting tables, doors, beds and the like keep their vanilla
  behaviour).
- **Permission:** check the player may build there (fire a cancellable
  placement check, or ask the server's protection plugins). If refused, do
  nothing.
- **Effect:** take one item from the hand (not in creative), make a pile of
  count 1, play the place sound, and cancel the vanilla interaction.

### Adding

A right-click **on a pile** (its hitbox, below), holding an item of the
**same material**: take one item, add 1 to the count, show the next stage,
play the place sound. An item of another material is treated as a click on
a full pile (below).

### Full piles

When the pile is at its material's limit, or the item is another material:

- `refuse`: nothing happens, and the item stays in the hand.
- `new-pile`: the item starts a new pile on the nearest free block top, among
  the 8 around this one at the same height, following the placing rules. If
  none is free, nothing happens.

### Breaking

A left-click (attack) on the pile's hitbox:

- Remove the pile, play the break sound, and drop its items: **count** items,
  each a copy of the **stack it was placed with** (keep the first stack's
  components, so a renamed or custom item comes back as itself).
- In creative, nothing drops, as with a vanilla block.
- Check the player may break there, as for placing.

Also break the pile (and drop its items) when:

- the block under it is broken, replaced or moved (pistons);
- an explosion reaches it;
- water or lava flows into its space;
- the chunk loads and the block under it is not solid on top.

### Showing a pile

Two entities per pile, both persistent:

- **An item display** shows the stage. Spawn it at the block-top centre
  plus half a block up, `(x + 0.5, y + 1.5, z + 0.5)` for the block at
  `(x, y, z)`, with display context `NONE`, so the model's floor (its
  `y = 0`) sits on the block top. Its item is any plain item (paper) with
  `minecraft:item_model` set to the stage id. No billboard. For variety,
  give each new pile a random yaw in steps of 90°.
- **An interaction entity** is the hitbox. Put it at `(x + 0.5, y + 1, z + 0.5)`,
  `0.75` wide and `0.25` tall, with `response` on so clicks register.

Light: let the display take the light at its position (the default).

### Saving

Store on the interaction entity, in its persistent data container under
your plugin's namespace:

| Key | Value |
|---|---|
| `set` | the set name (`gems`) |
| `material` | the material name (`emerald`) |
| `count` | 1 to the material's limit |
| `stack` | the first stack placed, serialised with its components |
| `display` | the item display's UUID |

On a config reload, a pile whose set or material has gone keeps its last
stage and still drops its stored stack when broken. A pile whose count is
now above its material's limit keeps its count and refuses more.

### Sounds

When a set gives none:

- place: `minecraft:entity.item_frame.add_item`
- break: `minecraft:entity.item_frame.remove_item`

Play them at the pile, from the block category.

---

## What Vellum checks before it writes

So the plugin can rely on these:

- The piece is at most **8 pixels across** and **3 pixels tall**, its cubes
  are not turned, and each stage fits the 16 by 16 footprint.
- A pile holds **1 to 8** pieces. Stages turn their pieces only about Y, in
  steps Java models allow (0, ±22.5, ±45 degrees).
- Every material has a name, at least one item id or tag, and a texture (a
  vanilla path or one of the set's own). No id is claimed twice in one set.

---

## A quick test list

1. Sneak-right-click a stone block with a diamond: one flat diamond, one
   diamond gone.
2. Right-click it 7 more times: 8 diamonds, stage 8.
3. Once more: a new pile next to it (`new-pile`), or nothing (`refuse`).
4. Right-click the diamond pile with an emerald: a new emerald pile next to it.
5. Break the pile: 8 diamonds drop. In creative, nothing drops.
6. Break the stone under a pile: the pile breaks and drops.
7. Rename a diamond in an anvil, pile it, break it: the renamed diamond comes back.
8. Restart the server: piles are still there, with the same counts.
9. Swap in a texture pack that changes the diamond icon: vanilla-textured
   piles change with it.
