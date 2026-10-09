# Zoom at the cursor is wrong off-axis — instructions to fix

**Symptom, in the operator's words:** "It zooms straight to the center of
the model, not to where we had fixed it."

**This is not a regression.** No commit since `c4256a8` ("zoom where the
cursor is") has touched the projection — `git log -S "zoomAnchor"` and
`-S "scene3d__probe"` both return that one commit, and `a999fea` (the
world/ground work) changed no perspective, origin, stage or probe rule.
The original fix is *exact at the perspective origin* and degrades with
distance from it. It was almost certainly verified by zooming near the
middle, which is the one place it works.

Everything below was measured at `6e69b9f`, not reasoned about.

---

## 1. Reproduce it

`vellum/` · `pnpm dev` · open `#/editor/voidling`. Put the cursor well
off-centre in the viewport and wheel-zoom in.

The measurement that matters: take `.scene3d__probe`'s rect before and
after one wheel step, and solve for the fixed point the zoom *actually*
used.

```js
// o1 = C + k(o0 - C)  =>  C = (o1 - k*o0) / (1 - k)
const k  = after.width / before.width
const Cx = (o1.x - k * o0.x) / (1 - k)
const Cy = (o1.y - k * o0.y) / (1 - k)
// C should equal the cursor. It does not.
```

**One wheel step, cursor placed N px from the perspective origin:**

| distance from perspective origin | miss |
|---|---|
| 0 px | **1 px** |
| 75 px | 9 px |
| 180 px | 35 px |
| 375 px | **169 px** |

**Eight consecutive steps with the cursor held at one off-axis point**
(stage centre `(750, 558)`, cursor `(450, 408)`):

| step | measured k | fixed point | miss |
|---|---|---|---|
| 1 | 1.313 | (541, 463) | 106 px |
| 2 | 1.329 | (572, 482) | 143 px |
| 3 | 1.347 | (613, 507) | 191 px |
| 4 | 1.367 | (666, 540) | 253 px |
| 5 | 1.389 | (734, 583) | 334 px |
| 6 | 1.415 | (823, 638) | 438 px |
| 7 | 1.445 | (936, 710) | 572 px |
| 8 | 1.481 | (1083, 804) | 746 px |

Two things to read out of that table. The miss **compounds**, and at
step 5 the fixed point passes within 29 px of the stage centre — which
is exactly what "it zooms to the centre of the model" looks like from
the outside. And `k` is **not constant** even though every wheel step
requests the same multiplier, which is the tell for the root cause.

---

## 2. Why it fails

`src/components/ModelView.tsx:377-418`. The correction solves

```
o1 = C + k(o0 - C)
```

which **assumes the zoom acts on screen as a 2D similarity** — one
uniform scale `k` about one fixed point `C` — and it measures both from
a single hidden probe sitting at the stage origin.

The actual visual transform is (`Model3D.css`):

```css
.scene3d        { perspective: 900px; perspective-origin: 50% 46%; }
.scene3d__stage { transform: translate(--pan-x, --pan-y) translateZ(--zoom)
                             rotateX(--pitch) rotateY(--yaw)
                             scale3d(--zoom-scale, …); }
```

**A 3D uniform scale under a perspective projection is not a 2D
similarity.** On-screen magnification carries the perspective divisor,
so it depends on each point's **depth**. The probe is at one depth; the
geometry under the cursor is at another. A single `(k, C)` pair is a
local linearisation valid only near the probe — which is why the miss is
1 px at the origin and 169 px at 375 px out.

The compounding in the second table is the same error feeding itself:
each correction pans the stage, which moves the probe further from the
perspective origin, so the next step is measured somewhere more wrong.

The code's own comment says "the on-screen magnification is not the
scale factor and the fixed point is not the container's centre" — that
diagnosis was right. The conclusion drawn from it, that measuring one
probe recovers the true `(k, C)`, is what does not hold, because there
is no single true `(k, C)` to recover.

---

## 3. Two fixes. Pick on whether the dolly feel is load-bearing.

### Option A — keep the 3D dolly, anchor on real geometry *(smaller change)*

Stop measuring at the origin and measure **what is under the cursor**.

1. On wheel, before changing the factor: `const el =
   document.elementFromPoint(x, y)`. Walk up to the nearest element
   inside `.scene3d__stage`. Record its `getBoundingClientRect()` and
   the cursor's **fractional** position within that rect
   (`fx = (x - r.x) / r.width`, same for `fy`).
2. In the existing `useLayoutEffect`, read the same element's rect
   again. The point that was under the cursor is now at
   `(r2.x + fx * r2.width, r2.y + fy * r2.height)`.
3. Pan by the difference: `pan += cursor - thatPoint`. No `k`, no `C`,
   no similarity assumption — you are tracking a real point on real
   geometry through whatever transform actually happened.

**Fall back to the current origin-probe path when `elementFromPoint`
returns `.scene3d` itself** (empty space — the cursor is over nothing,
so nothing visibly slips and the old behaviour is good enough). Note
`.scene3d__stage` has `pointer-events: none`, so hit-testing lands on
faces or on `.scene3d`; confirm which before relying on it.

Keeps the "fly into the scene" feel exactly as it is.

### Option B — flat 2D zoom outside the perspective *(exact by construction)*

Wrap the perspective container and zoom the **wrapper** in plain 2D:

```
.scene3d__clip   { position:absolute; inset:0; overflow:hidden; }   /* new */
  .scene3d__zoom { transform: translate(panX,panY) scale(f);
                   transform-origin: 0 0; }                          /* new */
    .scene3d     { perspective: 900px; … }        /* unchanged, no overflow */
```

A 2D scale is depth-independent, so cursor-anchored zoom is closed form
and needs no measurement at all:

```js
pan = { x: cx - k * (cx - pan.x), y: cy - k * (cy - pan.y) }   // k = f1 / f0
```

This **deletes** the probe, `zoomAnchor`, and the whole
`useLayoutEffect` — about 40 lines, plus `.scene3d__probe` in
`Model3D.css`.

**The trade-off is visual and it is the operator's call, not yours.**
Today zoom is a *dolly*: you move into the scene and foreshortening
changes as you go. Flat scaling is a *digital zoom* — the picture gets
bigger and perspective stops changing. Many model editors work this way
and it is unambiguously more predictable, but it is a different feel.
**Show it to the operator before committing to it.** Also check text and
edge crispness at high zoom: `.scene3d__stage` sets
`will-change: transform`, which can pin a rasterised layer.

**Recommendation:** try A first. It is contained, it preserves the look,
and if it comes out clean nobody has to have the aesthetic argument. Go
to B if A cannot be made exact, or if the operator would rather have
predictable zoom than a dolly.

---

## 4. Write the test that would have caught this

The existing check almost certainly zoomed near the centre, where the
current code is correct to 1 px. **Any replacement must assert off-axis.**

```
for each offset in [0, 75, 180, 375] px from the perspective origin:
    one wheel step with the cursor there
    solve for the fixed point from the probe rects
    assert |fixed - cursor| < 4px
then: eight consecutive steps at one off-axis point
    assert the miss does NOT grow between steps
```

That second assertion is the important one — a single-step test can pass
on a correction that is merely *small* while still compounding to 746 px
over a normal scroll gesture.

Two traps that cost time while diagnosing this:

- **`document.elementFromPoint` returns `.scene3d` over empty space.** A
  test that reads "same element still under the cursor, drifted 0.0 px"
  may be comparing the stage container with itself and measuring
  nothing. Assert on the probe rect, or on a named cube.
- **Place the cursor inside the viewport, not over a panel.** The right
  column starts around x=1210 at 1500 px wide; a wheel event at x=1350
  goes to the outliner and returns `k = 1.000`, which looks like a
  clamped zoom and is really a missed target.

Hard-reload before `import()`ing app modules in a Playwright probe —
after an HMR update Vite serves the changed module at a `?t=` URL and
you get a second instance that disagrees with the page.

---

## 5. Also worth ruling out in 60 seconds

Confirm which build is being looked at. `http://54.90.206.53:8018/`
serves the **legacy vanilla editor** — a different application that has
its own zoom. The Studio is at **`/app`**. Opening the bare host and
reading it as the Studio has already caused one wrong diagnosis in this
project. The defect above is real and reproduces at `6e69b9f`, but if
the operator is also on the wrong URL, fixing the code will not change
what they see.
