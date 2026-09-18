# Vellum

A 3D model editor UI, built from the pencil sketches. React + Vite + TypeScript,
no UI framework, no component library, no WebGL.

```bash
pnpm install
pnpm dev             # http://localhost:5173
pnpm build           # dist/
pnpm build:single    # dist/vellum.html - one self-contained file
```

`build:single` folds the build into a single HTML file: every stylesheet and
module chunk inlined, the woff2 faces embedded as data URIs, the favicon along
with them. Nothing is fetched at runtime, so the result opens by double-click,
attaches to an email, or drops onto any static host. Pass `--fragment` for page
content without the `<html>/<head>/<body>` wrapper, for hosts that supply their
own document skeleton, and `--out <path>` to write somewhere other than `dist/`.

Two details it handles, both of which bite otherwise: non-ASCII is escaped to
`\uXXXX` so the page is correct even where a host serves it without a charset
declaration, and any absolute reference left un-inlined fails the build rather
than shipping a page that silently 404s its own assets.

## Screens

| Route | Sheet | What it is |
| --- | --- | --- |
| `#/` | sheet 3 | Dash. **Static and stale on purpose** - fixed figures, inert controls, placeholder copy. |
| `#/projects` | sheet 2 | First scene. Pick a shelf: Items, or Mobs & Anim. |
| `#/projects/:scene/:kind` | sheet 2 | The shared library panel. `< Back`, category tabs, card grid, `< 1 2 3 >`. |
| `#/settings/:section` | sheet 1 | Search + section list, free sections above the `Paid tiers` divider. |
| `#/editor/:assetId` | - | The Blockbench-shaped editor, reached from a card's `...` → Open in Editor. |

## Support: ticketing and messaging

`#/settings/support` is a working ticket system, not a form. It runs against an
in-browser mock transport (`src/lib/api.ts` over the store in `src/lib/support.ts`),
so you can open a ticket, reply, and watch the thread answer back.

- **Tickets** - filter by status, full-text search over subjects, tags and message
  bodies, priority stripe and SLA countdown, status and priority editable from the
  thread header (each change appends a system message to the thread).
- **Messaging engine** - optimistic send (the bubble appears immediately as
  *sending*, then *sent* -> *delivered* -> *read*), delivery ticks, agent typing
  indicator, unread badges cleared on read, attachments, and retry on failure.
  Thread updates arrive over an event stream rather than by refetching.
- **New ticket** - subject, category, priority (urgent gated to paid tiers) and a
  description that becomes message #1.

### API

Base URL `/api/v1`, bearer token, JSON in and out. Every endpoint is declared in
`endpoints` in `src/lib/api.ts` — the in-app reference renders from that array, so
the docs cannot drift from what the client calls. Each control is also badged with
the endpoint it hits.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/tickets` | List. Filters: `status`, `priority`, `category`, `q`, `cursor`, `limit`. |
| `POST` | `/tickets` | Open a ticket; the description becomes its first message. |
| `GET` | `/tickets/{ticketId}` | Retrieve one, with current SLA state. |
| `PATCH` | `/tickets/{ticketId}` | Status, priority, assignee, tags. |
| `DELETE` | `/tickets/{ticketId}` | Archive (soft delete; messages retained). |
| `GET` | `/tickets/{ticketId}/messages` | Thread, oldest first, cursor paged. |
| `POST` | `/tickets/{ticketId}/messages` | Reply. Takes a `clientId` for idempotent retries. |
| `PATCH` | `/tickets/{ticketId}/messages/{messageId}` | Edit within 15 minutes. |
| `DELETE` | `/tickets/{ticketId}/messages/{messageId}` | Retract, leaving a tombstone. |
| `POST` | `/tickets/{ticketId}/read` | Mark read; clears the unread badge. |
| `GET` | `/tickets/{ticketId}/events` | SSE: `message.created`, `message.updated`, `ticket.updated`, `agent.typing`. |
| `POST` | `/tickets/{ticketId}/typing` | Composing signal, debounced to 3s. |
| `POST` | `/uploads` | `multipart/form-data`, max 25 MB, returns an attachment id. |
| `GET` | `/attachments/{attachmentId}` | 302 to a signed URL valid 5 minutes. |
| `GET` | `/support/categories` | Categories for the ticket form. |
| `GET` | `/support/agents` | Assignable agents on this plan. |
| `GET` | `/support/sla` | First-response target and queue position. |

Webhooks — `ticket.created`, `ticket.updated`, `ticket.resolved`, `message.created`
— are signed with `X-Vellum-Signature` (HMAC-SHA256 over the raw body), retried with
backoff for 24h until a 2xx, and deduplicated on the event id.

To point this at a real server, replace the bodies of the `api` methods with `fetch`
calls; the request and response shapes in `src/lib/support.ts` are already what the
endpoints above are expected to exchange.

## The material

One surface: **midnight velvet navy**. There is no light theme and no theme
toggle - the whole app lives on a single deep navy field, defined once in
`src/styles/tokens.css`.

**Liquid glass.** Every surface above the background is the same three-part
recipe: a translucent tint, a `backdrop-filter` blur that saturates what it
samples, and a rim lit along the top edge with a specular sheen laid over it
(`.glass` in `base.css`, repeated inline where a component needs its own
geometry). Glass over a flat fill reads as a grey box, so `body::before`
carries a slow-drifting field of navy and wax light for the blurs to pick up,
and `body::after` lays a fine grain over it for the velvet.

**Candle wax red** carries every affordance. Buttons, the active nav lozenge,
selected outliner rows, tool toggles, switches, focus rings and the dashed
reserved regions are all outlined in wax (`--wax-400`), lit with a matching
glow. It is the only saturated colour in the app, so anything you can press is
the thing that glows.

**Bouncy.** Motion runs on overshooting springs rather than ease curves:
`--spring` for most transitions, `--spring-lg` where the overshoot should
read. Buttons and tools compress on press and spring back, the nav lozenge and
pagination pips pop into place, library cards bounce to 1.2x on hover, menus
scale in from their anchor corner, panel chevrons swing, and the settings
switch knob stretches as it throws.

Two notes on `backdrop-filter`, both of which bit during the build:

- An ancestor with `backdrop-filter` becomes the *backdrop root*, so a popover
  inside the menu bar or the library panel samples nothing and a thin tint
  renders see-through. Menus are therefore near-opaque by design.
- `height: 100%` collapses to zero when the parent's height comes from
  `min-height` or flex sizing rather than a definite height, so `.scene3d`
  fills its parent by `inset` instead.

**Type.** Inter and JetBrains Mono, self-hosted as `woff2` under `public/fonts`
with latin + latin-ext subsets and `unicode-range` splits. No request leaves
the origin.

**Layout.** Fluid throughout - `clamp()` gutters, `auto-fit` / `auto-fill`
grids, and `dvh` in the editor. In the editor the viewport runs full-bleed and
the two tool columns float over it as glass rails, so what you see through them
is the model itself; the rails are drag-resizable, and below 900px the whole
thing stacks.

**The card.** `src/components/Card.tsx` is the one section container, as the
sketch asks. Solid where a region is filled, dashed where it is reserved.

**The renderer is a stand-in, not an engine.** `src/components/Model3D.tsx`
builds each box out of six transformed `div`s inside a `preserve-3d` scene:
flat three-tone shading, a CSS grid floor, drag-to-orbit, and a keyframed spin
for the library cards. There is no mesh, no camera and no raster pipeline - it
is there so the viewport reads as a viewport.

## What works, and what does not

Interactive: routing, shelf selection, library search + pagination, card
hover (spin, 1.2x bounce) and its actions menu, settings search and sections,
and in the editor - menus, mode and tool switching, panel collapse and resize,
outliner selection with per-node hide/lock, the colour picker, UV face
selection, numeric fields (type or drag the axis chip to scrub), quad view,
grid toggle, and timeline playback. Support is fully interactive against the mock
transport described above.

Not wired, by design: the dashboard entirely, plus saving, exporting, real
geometry editing and anything that would need a backend.
