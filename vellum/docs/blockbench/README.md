# Blockbench reference

Two probes built assets against Blockbench's `.bbmodel` format and wrote up the
tools that produce each part of it. Their findings are what `src/lib/bbmodel.ts`
and `src/components/BBModelView.tsx` implement.

| File | What it covers |
| --- | --- |
| [`alien-sword-notes.md`](alien-sword-notes.md) | Add Cube, the transform gizmos, the Pivot tool, the Outliner, per-face UV vs Box UV, the UV editor, the texture and paint tools, the Element panel, the format selector. Plus the format traps an implementer hits. |
| [`voidling-and-resonator-notes.md`](voidling-and-resonator-notes.md) | The same ground for rigging, then **Animate mode** in depth — the timeline, channels, keyframes, interpolation modes, how a bone animator binds to a group — and what `java_block` enforces that `free` does not. |
| [`validate.mjs`](validate.mjs) | Standalone structural checker: `node validate.mjs model.bbmodel` |

The models themselves live in [`../src/models/`](../src/models) and load as
samples in the editor; their standalone PNGs are in [`textures/`](textures).

## Important caveat

**None of this was verified against Blockbench itself.** `blockbench.net` and
`web.blockbench.net` are blocked by this environment's egress policy (the proxy
answers 403 to CONNECT), so the probes authored from the format specification and
prior knowledge rather than by round-tripping through the real application. The
files are internally consistent, validate clean, and render correctly in two
independent renderers — but "Blockbench opens these without complaint" is
**unconfirmed**. Each notes file ends with an explicit list of what its author
could not verify; read those before treating any detail as settled.

## What this repo changed as a result

Four bugs in the format layer came straight out of those notes:

1. **UV space is the texture's `uv_width`/`uv_height`, not the PNG's pixel size.**
   Blockbench will paint a 64×64 model on a 512×512 sheet. Dividing UVs by the
   image width breaks every high-resolution texture.
2. **A reversed UV coordinate is how a face gets mirrored.** Normalising the
   rectangle to min/max on load silently throws the mirroring away, so the flip
   is re-applied to the plane instead.
3. **An untextured face is `null`, but some versions write `-1`,** which passes a
   `typeof === 'number'` check and then indexes out of bounds.
4. **Keyframe `data_points` may hold numeric strings (Molang),** so a bare
   `Number()` can yield `NaN` and poison a transform.
