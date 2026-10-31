# Rift dashboard

A static, no-build dashboard for the **Rift** Discord bot. It talks directly to
the bot's Quart API (`web_server.py`) and its websockets — there is no separate
backend and no placeholder data in production.

- **Live settings** — all 28 `GUILD_SETTINGS_SECTIONS` are editable against the
  same database the bot reads. Strict setters (verification, starboard,
  logging, modmail) carry every required field so a one-field edit cannot wipe
  the rest; read-only mirrors (giveaways, reaction roles, auto-responders) are
  labelled and never POST.
- **Moderation** — log explorer with filters/pagination, bans, member search,
  role list, full user dossiers, warnings/notes and every action the bot
  supports (ban/unban/kick/warn/delwarn/clearwarns/timeout/untimeout/note/nick/
  forcenick/role add/remove), each with confirmation for destructive actions.
- **Music** — player state, queue, seek/volume/loop/shuffle/autoplay, catalog
  search, 30s history, top tracks, lyrics, playlists and audio repairs.
- **Analytics** — 14-day joins/leaves/messages/voice charts and CSV export.
- **Last.fm** — profile, now playing, top artists/tracks, weekly artists,
  genre mix, listening heatmap and a generated chart image.
- **Stocks** — play-money market, portfolio, buy/sell with validation, events,
  news and leaderboards.
- **Voice calls** — bridge two servers, share/join codes, live participant and
  duration view with websocket updates.
- **Verification activity** — fingerprint matches and ban-evasion flags.
- **Public flows** — ban appeals (OTP → evidence → thread), browser
  verification, and bug reports with screenshots.
- **Operations** — diagnostics (API latency, breaker, sockets, cache), command
  palette (`⌘K`), keyboard shortcuts, themes, density, reduced motion,
  auto-refresh preferences, offline/session-expired handling and toasts. The
  API host is never exposed on Diagnostics. Developer tools (Diagnostics and
  connection checks) are opt-in for every account; only allow-listed developers
  (fenruko by default) can change the host itself.

## Run it

```bash
npm install
npm run dev        # http://localhost:4173 — demo API + websockets included
npm run serve      # static only, no demo API
npm run demo       # standalone demo API on :8788
```

`npm run dev` generates `/config.js` with `apiBase: "<origin>/api"` and
`demo: true`, so the demo login works with no Discord app. Production config
lives in the repo-root `config.js` and can point at any bot host:

```js
window.RIFT_CONFIG = {
  apiBase: "https://your-bot.example.com/api",
  apiBaseFallbacks: ["https://backup.example.com/api"],
  demo: false,
  developerUserIds: [], // extra Discord IDs allowed to use Account → Developer tools
  discordClientId: "1329184069426348052",
};
```

The UI is plain ES modules under `assets/app/`; there is no bundler and no build
step. `index.html` loads `/config.js` then `assets/app/main.js`. Fonts and the
Rift mark are self-hosted (`assets/fonts`, `assets/riftlogo.jpg`); no CDN is
required at runtime.

## Tests

```bash
npm test           # 87 unit + integration + jsdom page tests
npm run test:e2e   # starts both servers and checks HTTP, CORS, settings writes, websockets
```

The suite is deliberately adversarial:

- `tests/unit` — formatting, routing, store semantics, and the settings schema
  (all 28 sections, strict/keys/merge payloads, validation, socials).
- `tests/integration` — every endpoint helper is executed against the in-memory
  bot; flows cover appeals (OTP → upload → submit → thread), voice calls,
  playlists, trades, moderation actions, verification, bug reports, 401/404/409
  paths, retries and cache dedupe.
- `tests/integration/contract.test.mjs` — matches every request the dashboard
  makes against `tests/fixtures/bot-routes.json`, extracted from
  `web_server.py`. Invented or renamed routes fail CI.
- `tests/dom/pages.test.mjs` — mounts every page in jsdom against the demo API,
  saves settings, looks up a user, pauses music, runs a stock trade, starts a
  call, completes a ban appeal, submits a bug report and verifies both
  verification outcomes.
- `tests/e2e/smoke.mjs` — boots `tools/dev-server.mjs` and
  `tools/demo-server.mjs` and validates the static shell, SPA fallbacks,
  traversal guard, CORS, auth enforcement, persistence and `/ws` + `/ws/vc`.

## API contract

Auth is Discord OAuth implicit grant (`identify guilds`), stored as
`rift_dashboard_token`. Admin access is owner, `MANAGE_GUILD` or
`ADMINISTRATOR`; the bot re-checks permissions on every guild-scoped request.
Live data comes from `/ws` (`stats`, `music_state`) and `/ws/vc`
(`call_state`, `get_state`), with polling fallbacks when sockets are blocked.

Every path the dashboard calls is listed in `assets/app/data/endpoints.js`.
When the bot adds a route, add a fixture entry and a contract-test invocation.

## Deployment

The site is static and deployable to GitHub Pages, Cloudflare Pages or any
static host. Deep links work via `index.html` SPA fallback; on GitHub Pages
`404.html` stashes the intended path in `sessionStorage` and the inline script
in `index.html` restores it before the router starts. Configure the bot host in
`config.js`; the OAuth redirect URI must match the deployed origin.

## Security notes

- Text is written with `textContent`; raw HTML is only used for the explicit
  `html` prop.
- External links use `rel="noreferrer"`; API responses are treated as data.
- Destructive moderation actions require confirmation; unsaved settings block
  navigation with a before-leave guard and a `beforeunload` prompt.
- Uploads are validated client-side for type/size and re-validated by the bot.
- The static server refuses encoded path traversal outside the repository.
