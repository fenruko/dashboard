# Rift Dashboard — Independent Build

This repo is now **fully independent**. No more manual uploads to `dashboard-src`.

### How it works
- Source lives in `src/` (Vite + React + Tailwind + Framer Motion)
- Push any file change to `master` (or `arena/*`) 
- GitHub Actions (`.github/workflows/deploy.yml`) automatically builds `dist/` and deploys to **GitHub Pages**
- Custom domain `dash.rift.cool` via `public/CNAME`
- SPA routing handled by `public/404.html` redirect trick + `_redirects`

### Local dev
```bash
npm install
npm run dev
```

### Env
Create `.env`:
```
VITE_API_BASE=https://your-api.example.com/api
VITE_DISCORD_CLIENT_ID=...
```

If no API is configured, dashboard renders with beautiful mock analytics so UI can be developed offline.

### Features
- High-tier animations (Framer Motion, GPU-accelerated transforms)
- Dynamic graphs: Area, Bar, Donut, Sparkline, Heatmap, Radial — all custom SVG, no heavy chart libs
- Analytics on every aspect: members, messages, commands, moderation, music, economy, voice, verification, leveling, invites, etc.
- Optimized: lazy routes, ResizeObserver, memoization, requestAnimationFrame, minimal re-renders
- Controls for all bot modules: moderation actions, music player, stocks trading, voice bridge, verification, settings (leveling, welcome, logging, etc.)

### Structure
```
src/
  components/
    ui/ (Card, Button, Input, etc)
    charts/ (AreaChart, BarChart, Donut, etc)
    layout/ (Sidebar, Topbar, Background)
  pages/ (Overview, Analytics, Moderation, Music, LastFM, Stocks, VoiceCall, Verification, Settings, General)
  lib/ (api, store)
  styles/
```

### Deployment
The workflow uses `actions/deploy-pages`. Ensure GitHub Pages is set to **GitHub Actions** source in repo settings.

No motto — as requested.
