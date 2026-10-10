# Rift Audio integration contract

Rift Audio is deliberately usable as a local, fast player UI before a user signs in. When a dashboard API base is saved in **Settings**, it uses the existing Rift dashboard token (`rift_dashboard_token` or `rift_token`) and progressively enables bot synchronization.

The static client never assumes that it can inspect Discord voice presence from the browser. That information must come from the bot after the authenticated user asks for it.

## Existing endpoints used directly

These are the dashboard endpoints already present in the supplied API map / previous dashboard client. The player treats all of them as optional and keeps local state if one is unavailable.

| Method | Path | Use in Rift Audio |
| --- | --- | --- |
| `GET` | `/music/state/:guildId` | Current item, elapsed position, queue, bot playback state, and optional voice channel. Polled lightly every nine seconds. |
| `POST` | `/music/control` | Sends `play`, `pause`, `resume`, `queue`, `remove`, `move`, `clear`, `shuffle`, `repeat`, `connect`, and playlist intents. |
| `GET` | `/music/history/:guildId` | Populates the **History** tab. |
| `GET` | `/playlists/:guildId` | Loads bot-side playlists into the Playlist vault. |
| `POST` | `/playlists/:guildId/play` | Kept compatible for a server-side playlist play action. |
| `GET` | `/vc/status?guild_id=:guildId` | Secure, consent-driven voice-presence detection. |

Every bot request carries `Authorization: Bearer <dashboard token>` when one exists. The UI sends a `guild_id` in the control payload so a backend can reject cross-guild changes server-side.

## Small API additions for the advanced player

The dashboard can fully render without these routes. Implementing them enables live server search, actual lyric timing, two-way playlist writes, and the Browser Listen beta.

### Fast music search

```http
GET /music/search?q=afterimage&limit=10&guild_id=123
Authorization: Bearer <token>
```

```json
{
  "results": [
    {
      "id": "ytsearch:abc",
      "title": "Afterimage",
      "artist": "Nyla Reed",
      "album": "Cobalt Hours",
      "duration": 221000,
      "artwork": "https://…/cover.jpg",
      "uri": "https://…"
    }
  ]
}
```

`duration` may be seconds, milliseconds, or an `m:ss` string; the client normalizes all three. The UI immediately returns ten local suggestions on every character, so this endpoint enhances results rather than making search feel blocked by network latency. If the endpoint is unavailable, the client also attempts the already-used iTunes metadata lookup for public artwork and previews.

### Lyrics

```http
GET /music/lyrics?track_id=ytsearch%3Aabc&title=Afterimage&artist=Nyla%20Reed
Authorization: Bearer <token>
```

```json
{
  "source": "LRCLIB",
  "word_timed": true,
  "enhanced_lrc": "[00:04.20]<00:04.20>The <00:04.56>streetlights <00:05.22>fold"
}
```

- `enhanced_lrc` is preferred because it contains explicit per-word timestamps.
- A normal LRC string in `synced_lyrics` / `syncedLyrics` / `lyrics` is accepted as a **line-timed** fallback.
- The UI intentionally labels line timing as line timing. It does not claim word accuracy when the lyric source cannot provide it.
- The backend can use LRCLIB for the initial search described in the provided map. LRCLIB commonly provides timed lines; word-level timing requires an enhanced-LRC-capable source or an internal timing pass.

### Two-way playlist reconciliation

```http
PUT /playlists/:guildId/sync
Authorization: Bearer <token>
Idempotency-Key: <uuid>
```

```json
{
  "revision": 42,
  "origin": "dashboard",
  "playlist": {
    "id": "late-frames",
    "name": "Late Frames",
    "tracks": ["ytsearch:abc", "ytsearch:def"]
  }
}
```

Recommended server response:

```json
{
  "revision": 43,
  "playlist": { "id": "late-frames", "name": "Late Frames", "tracks": ["ytsearch:abc", "ytsearch:def"] },
  "updated_at": "2026-10-10T07:00:00Z"
}
```

Use a monotonically increasing `revision`, last-write metadata, and an idempotency key. That makes a playlist created on the website visible to the bot and a playlist created/edited by the bot visible to the website without duplicate tracks on retry. The current client already reads bot-side playlists and preserves a local draft if this endpoint is not yet deployed.

### Browser Listen — Beta

```http
GET /music/stream?guild_id=123&track_id=ytsearch%3Aabc
Authorization: Bearer <token>
```

```json
{
  "stream_url": "https://authorized-stream.example/…",
  "expires_at": "2026-10-10T07:20:00Z",
  "preview": false
}
```

The client only starts this mode after an explicit user click. It feeds the returned authorized URL to an `HTMLAudioElement`, then registers media metadata and controls through `navigator.mediaSession`. That is what makes the browser/OS media-control surface appear.

Important implementation boundaries:

- Do **not** proxy Discord voice packets into the browser. Browser Listen is an independent, authorized audio stream path, not a voice-channel relay.
- Do **not** scrape, download, or redistribute protected tracks. When no authorized stream URL exists, Rift Audio may use an iTunes `previewUrl` if it is available, or it simply reports that no browser stream is available.
- Set appropriate CORS headers for the audio URL if it is served from a different origin.

## Suggested `/music/control` payload

```json
{
  "guild_id": "123",
  "action": "queue",
  "track": {
    "id": "ytsearch:abc",
    "title": "Afterimage",
    "artist": "Nyla Reed",
    "album": "Cobalt Hours",
    "duration": 221
  }
}
```

For queue reordering, use `{ "action": "move", "from": 4, "to": 1 }`. For safe voice movement, use `{ "action": "connect", "target_guild_id": "123", "channel_id": "456" }` and validate both IDs against the authenticated member and bot permissions on the backend.

## Performance behavior

- Initial UI has no framework or chart dependency and has no remote request in local mode.
- Queue reordering is native drag-and-drop; only the changed queue is persisted.
- Playback progress, the visualizer, and word highlighting update in place. The full dashboard is not re-rendered on every tick.
- Search delivers at most ten results and debounces remote metadata requests by 240 ms.
- Remote state polling happens every nine seconds only after an API base has been configured. A WebSocket/SSE event can replace that poll later without changing the visual client contract.
