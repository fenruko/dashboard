# Rift Audio

A compact, static music workspace for Rift's dashboard and Discord bot. It runs directly on GitHub Pages—no framework runtime, build step, analytics SDK, or icon package is required.

## Run locally

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `http://localhost:4173`. The UI has a complete local demo state by design, so visual development is fast even without bot credentials.

## What is included

- Responsive dark audio workspace with **For you**, **Popular**, **History**, and **Recommended** discovery tabs.
- Queue editing with native drag-to-reorder, add/remove/clear actions, shuffle, repeat, seek, volume, keyboard shortcuts, and a draggable pop-out player.
- Ten instant local search suggestions on every character, with debounced bot/iTunes metadata enrichment and album art when metadata supplies it.
- A niche-based **Signal Mix** radio tuner.
- Word-highlighted lyrics UI that supports enhanced LRC and explicitly falls back to line timing when that is all the source can provide.
- A consent-first server chooser / voice detection flow.
- Two-way playlist vault UI: bot-side playlists are read from the existing API; new web playlists save locally and synchronize through the documented playlist sync route when it is deployed.
- **Browser Listen (Beta)** using a real `HTMLAudioElement` and the Media Session API. This lets an authorized stream or public preview participate in browser/OS media controls without joining a Discord voice channel.
- Theme, density, reduced-motion, visualizer, API URL, and floating-player position preferences stored locally.

## Connect Rift Bot

Open **Settings** in the player and save the dashboard API base (for example, `https://your-api.example.com/api`). Rift Audio reuses the existing dashboard token if it is present in `localStorage` under `rift_dashboard_token` or `rift_token`.

The exact existing and proposed API contract—including safe stream boundaries and playlist revision semantics—is in [MUSIC_API.md](./MUSIC_API.md).

## Keyboard controls

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl K` | Open search |
| `Space` | Play/pause when not typing |
| `Q` | Open queue |
| `L` | Open lyrics |
| `Esc` | Close a dialog |

The root `404.html` retains the GitHub Pages redirect handoff, so direct `/g/:guildId/music` links restore the selected guild route after a refresh.
