# Feeding the Dashboard

Every number on Vellum's Dash describes a server Vellum doesn't run: its
name, the pack it serves, who still has an old copy, what the team touched
last. A browser tab can't know any of that, so your plugin sends it. This is
the contract for sending it.

- **Base**: `/api/v1`
- **Schema version**: 1. `GET /api/v1/dash/schema` returns the
  machine-readable part of this document, so a plugin can check it at startup.
- **Every field is optional unless marked required.** A field you leave out
  keeps its current value, so you never have to send what you don't know.
- **Vellum tells you what it corrected.** See
  [What Vellum corrects](#what-vellum-corrects).

---

## Ways in

A published Vellum is a static page. It can't listen on a port, so an
"endpoint" is one of three things, depending on where your plugin runs. All
three go through the same validator.

### 1. Vellum polls you (for a server plugin)

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

Your HTTP server must:

- **Allow the page's origin (CORS)**, or the browser refuses the response
  before Vellum sees it: `Access-Control-Allow-Origin: <the Vellum origin>`
  and `Access-Control-Allow-Headers: Authorization`.
- **Answer `OPTIONS`.** The `Authorization` header makes it a preflighted
  request.

If you also serve `GET {base}/dash/events` as `text/event-stream`, Vellum
uses it and the cards update as soon as you push a build, instead of on the
next poll. Each event's `data` is one section, `{ "section": "pack", "body":
{ … } }`, or a snapshot body holding only the keys that changed. Vellum takes
both. If the stream is missing or drops, Vellum goes back to polling.

> `EventSource` can't set headers, so the bearer token goes in the stream URL
> as `?token=…`, where it shows up in your access logs. Give the stream its
> own short-lived token if that matters to you.

### 2. Push into the page — `window.Vellum.dash`

If your code runs in the same page (a launcher's web view, a companion
script, or you in devtools), every endpoint is a method:

```js
Vellum.dash.pack({ archive: 'aurelian_v12.zip', bytes: 43834572, hash: 'sha1:9f2c04e1' })
Vellum.dash.report({ player: 'kite', packHash: 'sha1:9f2c04e1' })
Vellum.dash.heartbeat({ agent: 'VellumBridge 1.4.0', everySeconds: 30 })
```

Each returns `{ ok, problems: string[] }` straight away. It's the quickest
way to check a payload before you write the plugin.

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

**Only listed origins are accepted, and there is no wildcard.** By default
the list holds the page's own origin.

---

## Endpoints

### Feed

| | |
|---|---|
| `POST /dash/snapshot` | Update every card in one call. Send what you know and leave out the rest. The cheapest way to report on a timer. |
| `GET /dash/snapshot` | Read it back. **Implement this one** if you want Vellum to poll you. |
| `POST /dash/heartbeat` | `{ agent, everySeconds }`. Say the plugin is alive and give its name. |
| `GET /dash/events` | SSE. Optional. Cards update as soon as you send, without waiting for a poll. |
| `GET /dash/schema` | This contract as JSON: `{ version, base, endpoints }`. |

**Heartbeats.** Up to twice your `everySeconds` without one, the Dash shows
your data as live. Up to six times, it shows it as *stale*. After that it
shows the feed as *offline*.

### Realm

`PATCH /dash/server` updates the Server card.

| field | type | note |
|---|---|---|
| `name` | string | Display name, ≤ 64 chars |
| `host` | string | What players connect to |
| `ip` | string | Resolved address, v4 or v6 |
| `status` | string | Free text: `Connected`, `Restarting`, `Degraded`… |
| `online` | boolean | Drives the status dot |
| `breakdown` | `{label,count}[]` | Up to 12 rows |
| `total` | integer | Total files synced. **Omit it and Vellum sums the breakdown.** |

`PATCH /dash/subscription` updates the Plan card: `type`, `cloud` and `seats`,
all free text. `seats` is a label such as `"4 of 5"`.

### Pack

`PATCH /dash/pack`: send this when you finish building a pack. Don't send it on
a timer.

| field | type | note |
|---|---|---|
| `archive` | string | **required**. The file name as served |
| `bytes` | integer | **required**. Size in bytes; Vellum formats it |
| `hash` | string | **required**. The SHA-1 you send to clients |
| `pushedAt` | string \| integer | ISO 8601, epoch ms or epoch seconds. Defaults to now when the hash changes; a repeat of the same pack keeps its date |
| `version` | string \| null | Your own build label |

Player reports are compared against `hash`. **A new hash re-counts the
players straight away**, so the card doesn't show everyone as up to date the
moment you publish a build nobody has downloaded yet.

### Players

Two ways, pick one.

`PUT /dash/players`: you did the counting. `{ correct, wrong, sampledAt? }`.

`POST /dash/players/report`: report **one client and its pack hash**, which is
all a join event knows. Vellum keeps the roster and does the counting.

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

Send `{ "player": "...", "left": true }` when a player quits, or the roster
keeps counting them.

### Files

`POST /dash/files` adds one row, or an array of them. The table shows the
newest first and keeps 50. Older rows are dropped.

| field | type | note |
|---|---|---|
| `name` | string | **required**. A row without one is dropped |
| `where` | string | Directory, as you want it displayed |
| `touchedAt` | string \| integer | Defaults to now |
| `by` | string | Who touched it |
| `sync` | `in-sync` \| `outdated` \| `unknown` | Defaults to `unknown` |
| `staleClients` | integer | How many connected clients hold an old copy |

`DELETE /dash/files` clears the table, for a plugin that rebuilds the list
each cycle.

### Cloud

The workspace a paid account gets. **Settings ▸ Cloud** shows exactly what
you send here, and shows nothing until you send something.

`PATCH /cloud/workspace`: send only what changed.

| field | type | note |
|---|---|---|
| `id` | string | Workspace id, as you name it |
| `region` | string | Where the database lives |
| `status` | `synced` \| `syncing` \| `paused` \| `error` | What the sync is doing right now |
| `usedBytes` | integer | Storage in use |
| `quotaBytes` | integer | What the plan allows |
| `syncedAt` | string \| integer | When the last sync completed |
| `members` | Member[] | REPLACES the roster. Up to 40 |

`PUT /cloud/members`: just the roster, for a plugin that tracks who is
connected without touching the rest of the workspace.

| field | type | note |
|---|---|---|
| `members[].name` | string | **required**. A member without a name is dropped |
| `members[].id` | string | Your own id for them; generated if absent |
| `members[].role` | `owner` \| `editor` \| `viewer` | Defaults to `viewer` |
| `members[].seenAt` | string \| integer | Last seen. Defaults to now |
| `members[].holding` | integer | Files they currently have open |

The shared files in that panel are the list `POST /dash/files` feeds.

### Console

Two calls that aren't about cards. You send the changelog to Vellum like any
other call. `GET /plugin/version` is the call Vellum makes **to your plugin**.

`PUT /console/changelog` replaces the release notes shown in
**Settings ▸ About ▸ Changelog**. The Master Console sends them through the
plugin, so users see what changed without visiting a website. Vellum keeps
the newest 30, sorted by date.

| field | type | note |
|---|---|---|
| `releases` | Release[] | **required**. REPLACES the list |
| `releases[].version` | string | **required**. An entry without one is dropped |
| `releases[].channel` | `studio` \| `plugin` | Whether the note is about the studio or the plugin. Defaults to `studio` |
| `releases[].at` | string \| integer | Release date. Defaults to now |
| `releases[].title` | string | One line, up to 96 characters. Defaults to the version |
| `releases[].notes` | string[] | Up to 12 lines, 200 characters each |

`GET /plugin/version`: **your plugin serves this**, and the studio calls it.
Settings ▸ About ▸ Versions uses it to check the plugin and studio versions
work together:

```json
{ "plugin": "0.2a", "studioMin": "0.8.0", "api": 1 }
```

`plugin` is required. Without it the studio shows "No answer". `studioMin` is
the oldest studio your plugin works with. Leave it out and the studio only
checks its own minimum, which is plugin `0.2a`. Versions are dotted numbers
with an optional trailing letter, so `0.2a` is newer than `0.2` and older than
`0.2b`.

---

## What Vellum corrects

Every write returns `problems: string[]`. The write still succeeded:
`problems` lists what Vellum changed so it could show your data. Read it while
you develop.

```json
{ "ok": true, "problems": [
  "ignored unknown field(s): nonsense",
  "breakdown: kept the first 12 of 20 rows",
  "breakdown[3].count: -5 is outside 0..1000000000. Clamped to the nearest limit.",
  "name: truncated to 64 characters",
  "ip: expected a string, got number. Kept the previous value."
]}
```

The same list shows in the **Ingest log** on the Dash, so you can see what
your plugin sends without adding logging to it.

The rules:

- **A wrong type never overwrites a good value.** It is reported, and the
  previous value is kept.
- **A blank string doesn't clear a field.** It is reported, and the previous
  value (or the field's default) is used.
- **Numbers are clamped and strings are truncated.** One bad field doesn't
  lose the whole write.
- **Control characters are stripped.**
- **Unknown fields are ignored and named.** If a card doesn't move when you
  think you're sending something, look here.
- **Timestamps can be ISO 8601, epoch milliseconds or epoch seconds.** A value
  under 10^11 is read as seconds.

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

This plugin doesn't count players or format bytes and timestamps. It reports
what it already knows, and the Dash does the rest.

---

## Trying it without a plugin

**Run a demo server** on the Dash starts a pretend server that feeds the page
through these endpoints, the same validator and the same log. Players join,
someone saves a file, a new pack goes out and players pick it up one by one,
then the server restarts. While it runs, **Apply on the server** in the Players
card answers as well, so the three reload outcomes can be seen: the first press
swaps, the second is refused with a validation report, the third fails.
**Stop demo** puts the sample back. You can also push your own payloads from the
console through `window.Vellum.dash` before writing any Java.

Until a card is fed, it shows the built-in sample and says **sample** in its
header. Each card goes live on its own, so a plugin that only knows about the
pack doesn't have to invent a player count.
