# Feeding the Dashboard

Every number on Vellum's Dash describes a Minecraft realm that Vellum
does not run — the server's identity, the pack it is serving, who is
still on an old copy, what the team touched last. None of that is
knowable from inside a browser tab, so all of it is fed in.

This is the contract for feeding it.

- **Base**: `/api/v1`
- **Schema version**: 1 — `GET /api/v1/dash/schema` returns this document's
  machine-readable half, so a plugin can check at startup rather than guess.
- **Every field is optional unless marked required.** An omitted field keeps
  its current value; you never have to send state you do not know.
- **Corrections come back**, they are not applied silently. See
  [What Vellum corrects](#what-vellum-corrects).

---

## The three ways in

A published Vellum is a static page. It cannot listen on a port, so
"endpoint" means one of three things depending on where your plugin sits.
All three land in the same validator — none of them can feed a card the
others would refuse.

### 1. Vellum polls you — the one a server plugin uses

Serve `GET {base}/dash/snapshot` and point Vellum at it in **Plugin feed**
on the Dash. Vellum reads it on an interval and applies whatever it finds.

```http
GET /api/v1/dash/snapshot
Authorization: Bearer <token>
```

```json
{
  "server":  { "name": "Aurelian Keep", "host": "play.example.gg", "ip": "10.42.6.118",
                "status": "Connected", "online": true,
                "breakdown": [{ "label": "Assets", "count": 41 }, { "label": "Rigs", "count": 6 }] },
  "pack":    { "archive": "aurelian_v12.zip", "bytes": 43834572, "hash": "sha1:9f2c04e1",
                "pushedAt": "2026-09-12T14:02:00Z", "version": "12" },
  "players": { "correct": 31, "wrong": 2 },
  "subscription": { "type": "Studio", "cloud": "eu-west-2", "seats": "4 of 5" },
  "files": [{ "name": "keep_warden.vellum", "where": "/aurelian/mobs",
              "touchedAt": 1789000000, "by": "kite", "sync": "outdated", "staleClients": 3 }]
}
```

Two things your HTTP server must do:

- **CORS.** The page's origin has to be allowed, or the browser refuses the
  response before Vellum sees it: `Access-Control-Allow-Origin: <the Vellum
  origin>` and `Access-Control-Allow-Headers: Authorization`.
- **Answer `OPTIONS`.** The `Authorization` header makes it a preflighted
  request.

If you also serve `GET {base}/dash/events` as `text/event-stream`, Vellum
uses that instead and the cards move the moment you push a build rather
than up to a minute later. Each event's `data` is a snapshot body — the
same shape as above, with only the keys that changed. Vellum falls back
to polling on its own if the stream is absent or drops.

> `EventSource` cannot set headers, so the bearer travels as
> `?token=…` on the stream URL. It will appear in your access logs.
> Issue the stream a separate, short-lived token if that matters to you.

### 2. Push into the page — `window.Vellum.dash`

If your code shares the document — a launcher's web view, a companion
script, or you in devtools — every endpoint is a method:

```js
Vellum.dash.pack({ archive: 'aurelian_v12.zip', bytes: 43834572, hash: 'sha1:9f2c04e1' })
Vellum.dash.report({ player: 'kite', packHash: 'sha1:9f2c04e1' })
Vellum.dash.heartbeat({ agent: 'VellumBridge 1.4.0', everySeconds: 30 })
```

Each returns `{ ok, problems: string[] }` synchronously. This is the
fastest way to check a payload before you write the plugin.

### 3. Push from an embedding page — `postMessage`

```js
vellumFrame.contentWindow.postMessage(
  { vellum: 1, id: 'abc', op: 'dash.pack', body: { archive: 'x.zip', bytes: 1024, hash: 'sha1:abc' } },
  'https://your-vellum-origin',
)
```

`op` is the endpoint name with `/` replaced by `.`: `dash.snapshot`,
`dash.server`, `dash.subscription`, `dash.pack`, `dash.players`,
`dash.report`, `dash.files`, `dash.clearFiles`, `dash.heartbeat`,
`dash.schema`, `dash.read`. Vellum replies to `event.source` with
`{ vellum: 1, id, result }`.

**The origin allowlist has no wildcard and is not optional.** Out of the
box only the page's own origin is accepted; a dashboard that takes
numbers from any frame that can reach it is not a dashboard.

---

## Endpoints

### Feed

| | |
|---|---|
| `POST /dash/snapshot` | Replace every card in one call. Send what you know, omit the rest. The cheapest thing to do on a timer. |
| `GET /dash/snapshot` | Read it back. **This is the one you implement** if you want Vellum to poll you. |
| `POST /dash/heartbeat` | `{ agent, everySeconds }`. Say you are alive and name yourself. |
| `GET /dash/events` | SSE. Optional, but the difference between live and eventually. |
| `GET /dash/schema` | This contract as JSON: `{ version, base, endpoints }`. |

**Heartbeats are how the Dash stays honest.** Miss two and every fed card
is marked *stale*; miss six and it reads *no feed*. A dashboard that keeps
showing yesterday's numbers as though they were current is worse than one
that admits it lost the plugin.

### Realm

`PATCH /dash/server` — the Server card.

| field | type | note |
|---|---|---|
| `name` | string | Display name, ≤ 64 chars |
| `host` | string | What players connect to |
| `ip` | string | Resolved address, v4 or v6 |
| `status` | string | Free text: `Connected`, `Restarting`, `Degraded`… |
| `online` | boolean | Drives the status dot |
| `breakdown` | `{label,count}[]` | Up to 12 rows |
| `total` | integer | Total files synced. **Omit it and Vellum sums the breakdown.** |

`PATCH /dash/subscription` — the Realm power card: `type`, `cloud`, `seats`
(all free text; `seats` is a label like `"4 of 5"`, not a number).

### Pack

`PATCH /dash/pack` — send this when you finish building a pack, not on a timer.

| field | type | note |
|---|---|---|
| `archive` | string | **required** — file name as served |
| `bytes` | integer | **required** — size on the wire; Vellum formats it |
| `hash` | string | **required** — the SHA-1 you hand the client |
| `pushedAt` | string \| integer | ISO 8601, epoch ms, or epoch seconds. Defaults to now |
| `version` | string \| null | Your own build label |

`hash` is load-bearing: it is what player reports are compared against.
**Pushing a new hash re-counts adoption immediately**, so the card cannot
claim everyone is up to date the instant you publish a build nobody has
downloaded yet.

### Players

Two ways, pick one.

`PUT /dash/players` — you did the counting: `{ correct, wrong, sampledAt? }`.

`POST /dash/players/report` — **one client, one hash**, which is all a join
event knows. Vellum keeps the roster and does the counting.

```java
@EventHandler
public void onPackStatus(PlayerResourcePackStatusEvent e) {
    if (e.getStatus() == Status.SUCCESSFULLY_LOADED) {
        vellum.report(e.getPlayer().getName(), currentPackHash);
    }
}

@EventHandler
public void onQuit(PlayerQuitEvent e) {
    vellum.report(e.getPlayer().getName(), null, /* left */ true);
}
```

Send `{ "player": "...", "left": true }` on quit or the roster keeps
counting players who went home.

### Files

`POST /dash/files` — append one row, or an array of them. Newest first,
capped at 50; older rows fall off.

| field | type | note |
|---|---|---|
| `name` | string | **required** — a row without one is dropped |
| `where` | string | Directory, as you want it displayed |
| `touchedAt` | string \| integer | Defaults to now |
| `by` | string | Who touched it |
| `sync` | `in-sync` \| `outdated` \| `unknown` | Defaults to `unknown` |
| `staleClients` | integer | How many connected clients hold an old copy |

`DELETE /dash/files` clears the table, for a plugin that rebuilds the list
each cycle.

### Cloud

The workspace a paid account is allocated. Vellum shows exactly what you
send here in **Settings ▸ Cloud** and invents nothing when you send
nothing.

`PATCH /cloud/workspace` — send what changed.

| field | type | note |
|---|---|---|
| `id` | string | Workspace id, as your side names it |
| `region` | string | Where the database lives |
| `status` | `synced` \| `syncing` \| `paused` \| `error` | What the sync is doing right now |
| `usedBytes` | integer | Storage in use |
| `quotaBytes` | integer | What the plan allows |
| `syncedAt` | string \| integer | When the last sync completed |
| `members` | Member[] | REPLACES the roster, up to 40 |

`PUT /cloud/members` — just the roster, for a plugin that tracks who is
connected without touching the rest of the workspace.

| field | type | note |
|---|---|---|
| `members[].name` | string | **required** — one without a name is dropped |
| `members[].id` | string | Your own id for them; generated if absent |
| `members[].role` | `owner` \| `editor` \| `viewer` | Defaults to `viewer` |
| `members[].seenAt` | string \| integer | Last seen. Defaults to now |
| `members[].holding` | integer | Files they currently have open |

The shared-file list in that panel is the same one `POST /dash/files`
feeds — there is one list of files, not two.

### Console

Two calls that are not about cards. The first is fed to Vellum like any
other; the second is the one call Vellum makes **to you**.

`PUT /console/changelog` — replace the release notes shown in
**Settings ▸ About ▸ Changelog**. This is how the Master Console tells a
studio what changed without anybody visiting a website. Newest 30 kept,
sorted by date.

| field | type | note |
|---|---|---|
| `releases` | Release[] | **required** — REPLACES the list |
| `releases[].version` | string | **required** — an entry without one is dropped |
| `releases[].channel` | `studio` \| `plugin` | Which half the note is about. Defaults to `studio` |
| `releases[].at` | string \| integer | Release date. Defaults to now |
| `releases[].title` | string | One line, 96 characters. Defaults to the version |
| `releases[].notes` | string[] | Up to 12 lines, 200 characters each |

`GET /plugin/version` — **served by the plugin**, called by the studio.
Settings ▸ About ▸ Versions asks for it so that a version gap between the
two halves reads as a version gap rather than as a bug:

```json
{ "plugin": "0.2a", "studioMin": "0.8.0", "api": 1 }
```

`plugin` is required; without it the studio reports "no answer" rather
than guessing. `studioMin` is the oldest studio you will talk to — leave
it out and the studio only checks its own minimum, which is plugin
`0.2a`. Version strings are dotted numbers with an optional trailing
letter, so `0.2a` is newer than `0.2` and older than `0.2b`.

---

## What Vellum corrects

Every write returns `problems: string[]`. It is **not** an error list — the
write succeeded. It is the list of things Vellum had to change to be able
to render your data, and a plugin author should read it in development:

```json
{ "ok": true, "problems": [
  "ignored unknown field(s): nonsense",
  "breakdown: kept the first 12 of 20 rows",
  "breakdown[3].count: -5 is outside 0..1000000000 - clamped",
  "name: truncated to 64 characters",
  "ip: expected a string, got number - kept the previous value"
]}
```

The same list appears in the **Ingest log** on the Dash, so you can see
what your plugin is sending without instrumenting your plugin.

The rules, so none of this surprises you:

- **A wrong type never overwrites a good value.** It is reported and the
  previous value is kept.
- **Numbers are clamped, not rejected**; strings are truncated, not rejected.
  One bad field does not lose the whole write.
- **Control characters are stripped** — a tab in a table cell is a mess and a
  `\u0007` is not a status.
- **Unknown fields are ignored and named.** If you think you are sending
  something and the card does not move, this is where you will find out.
- **Timestamps accept ISO 8601, epoch millis or epoch seconds**, because
  every plugin language reaches for a different one. A value under 10^11 is
  read as seconds.

Limits: name 64, host 120, ip 45, status 32, archive 96, hash 80, file name
120, path 160, author 48, breakdown 12 rows, files 50 rows, counts 0…10⁹.

---

## A minimal Paper plugin

```java
public final class VellumBridge extends JavaPlugin {
    private final HttpClient http = HttpClient.newHttpClient();
    private final String base  = getConfig().getString("vellum.base");   // http://host:8123/api/v1
    private final String token = getConfig().getString("vellum.token");

    @Override public void onEnable() {
        // heartbeat + a full snapshot every 30s
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::push, 0L, 20L * 30);
        Bukkit.getPluginManager().registerEvents(new PackListener(this), this);
    }

    private void push() {
        post("/dash/heartbeat", Map.of("agent", "VellumBridge " + getDescription().getVersion(),
                                       "everySeconds", 30));
        post("/dash/snapshot", Map.of(
            "server", Map.of("name",   Bukkit.getServer().getName(),
                             "host",   Bukkit.getIp().isEmpty() ? "localhost" : Bukkit.getIp(),
                             "status", "Connected",
                             "online", true),
            "subscription", Map.of("seats", Bukkit.getOnlinePlayers().size() + " of " + Bukkit.getMaxPlayers())
        ));
    }

    void post(String path, Object body) {
        var req = HttpRequest.newBuilder(URI.create(base + path))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)))
            .build();
        http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
            .thenAccept(r -> {
                // problems[] is where you find out you are sending the wrong shape
                if (r.statusCode() >= 300) getLogger().warning(path + " -> " + r.body());
            });
    }
}
```

Note what this plugin does **not** do: it never counts players itself, and
it never formats a byte count or a timestamp. It reports facts it already
has, and the Dash does the rest.

---

## Trying it without a plugin

The Dash's **Plugin feed** card has a *Simulate a plugin* switch. It drives
the real endpoints through the real validator and the real log — it is not
a mock — so you can watch the cards move, then open the console and push
your own payload through `window.Vellum.dash` before writing any Java.

Until a card is fed it shows the built-in sample and says **sample** in its
header. Each card goes live on its own: a plugin that only knows about the
pack does not have to invent a player count.
