/* Last.fm: the listening identity of the signed-in user, as seen by the bot.
 *
 * Every panel loads independently so one flaky Last.fm API call can't blank
 * the page. The collage generator is rendered by the bot (Pillow) and fetched
 * as a blob because the image endpoint requires the bearer token. */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  card,
  callout,
  checkboxControl,
  emptyState,
  errorState,
  field,
  grid,
  iconButton,
  pageHeader,
  segmentedControl,
  selectInput,
  skeleton,
  spinner,
  toast,
  userChip,
} from "../ui/components.js";
import { barChart, donut, horizontalBars } from "../ui/charts.js";
import { asList } from "../data/endpoints.js";
import {
  fmtCompact,
  fmtDate,
  fmtInt,
  fmtRelative,
  plural,
  toCsv,
  downloadText,
  truncate,
} from "../core/format.js";

const PERIODS = [
  { value: "7day", label: "7 days" },
  { value: "1month", label: "1 month" },
  { value: "3month", label: "3 months" },
  { value: "6month", label: "6 months" },
  { value: "12month", label: "1 year" },
  { value: "overall", label: "All time" },
];

const CHART_TYPES = [
  { value: "albums", label: "Top albums" },
  { value: "artists", label: "Top artists" },
];
const CHART_SIZES = [
  { value: "3", label: "3 × 3" },
  { value: "4", label: "4 × 4" },
  { value: "5", label: "5 × 5" },
];

function tileArt(url, label, rank, sub) {
  return h(
    "div",
    { class: "art-tile", title: label },
    url
      ? h("img", { src: url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
      : h("div", { style: "display:grid;place-items:center;height:100%;color:var(--text-mute)" }, icon("disc", { size: 20 })),
    rank ? h("span", { class: "art-tile-rank" }, `#${rank}`) : null,
    h("div", { class: "art-tile-caption" }, h("div", null, truncate(label, 42)), sub ? h("div", { style: "opacity:.72" }, sub) : null)
  );
}

export async function mountPage(ctx) {
  const { root, user, endpoints, toast: notify, signal } = ctx;

  let disposed = false;
  const state = {
    profile: { status: "loading", data: null, error: null },
    now: { status: "loading", data: null, error: null },
    artists: { status: "loading", items: [], error: null },
    tracks: { status: "loading", items: [], error: null },
    genres: { status: "loading", items: [], error: null },
    weekly: { status: "loading", items: [], error: null },
    heatmap: { status: "idle", weeks: [], error: null },
    period: "7day",
    chart: {
      type: "albums",
      size: "3",
      period: "7day",
      labels: true,
      rounded: true,
      gap: 0,
      bg: "#141414",
      status: "idle",
      url: "",
      error: null,
    },
  };

  const page = h("div", { class: "page" });
  const headerActions = h("div", { class: "row" });
  const header = pageHeader({
    eyebrow: "Listening",
    title: "Last.fm",
    description: "Your scrobbles, weekly charts and taste profile — pulled live from Last.fm through the bot. Charts are generated server-side and stay on your account.",
    actions: headerActions,
  });
  const refreshBtn = iconButton({ icon: "refresh", label: "Refresh", onClick: () => loadAll(true) });
  const profileLink = h("a", { class: "btn btn--outline btn--sm", href: "https://www.last.fm", target: "_blank", rel: "noreferrer", hidden: true }, icon("external-link", { size: 14 }), " Open Last.fm");
  mount(headerActions, h("div", { class: "row", style: "gap:6px;align-items:center" }, profileLink, refreshBtn));

  const content = h("div", { class: "stack" });
  mount(page, header, content);
  mount(root, page);

  const profileCard = card({ title: "Profile", className: "lfm-profile" });
  const nowCard = card({ title: "Now playing" });
  const heroRow = h("div", { class: "grid grid--2" });
  mount(heroRow, profileCard, nowCard);

  const topRow = h("div", { class: "grid grid--2" });
  const artistsCard = card({ title: "Top artists", actions: h("div", { id: "artists-count" }) });
  const tracksCard = card({ title: "Top tracks", actions: h("div", { id: "tracks-count" }) });
  mount(topRow, artistsCard, tracksCard);

  const thirdRow = h("div", { class: "grid grid--2" });
  const genresCard = card({ title: "Taste profile", subtitle: "Genres inferred from your top artists' tags." });
  const weeklyCard = card({ title: "This week's artists", subtitle: "Last.fm's weekly artist chart." });
  mount(thirdRow, genresCard, weeklyCard);

  const heatmapCard = card({
    title: "Listening heatmap",
    subtitle: "Weekly scrobble counts over the last year. Last.fm only allows three heatmap refreshes per hour.",
    actions: button({ label: "Load heatmap", icon: "activity", size: "sm", variant: "outline", onClick: () => loadHeatmap(true) }),
  });

  const chartCard = card({
    title: "Collage generator",
    subtitle: "The bot renders a grid image of your top albums or artists. Download it or post it straight into Discord.",
  });

  mount(content, heroRow, topRow, thirdRow, heatmapCard, chartCard);

  /* ----------------------------- profile ----------------------------- */

  function renderProfile() {
    const body = profileCard.querySelector(".card-body");
    clear(body);
    if (state.profile.status === "loading") {
      body.append(h("div", { class: "lfm-hero" }, skeleton({ w: 72, h: 72, radius: 999 }), h("div", { class: "stack-tight", style: "flex:1" }, skeleton({ w: "45%", h: 18 }), skeleton({ w: "65%", h: 12 }))));
      return;
    }
    if (state.profile.status === "unlinked") {
      body.append(
        emptyState({
          icon: "activity",
          title: "No Last.fm account linked",
          message: "Use the bot's Last.fm linking command in Discord, then reload this page. Your scrobbles will appear here.",
          action: button({ label: "Check again", size: "sm", variant: "primary", onClick: () => loadAll(true) }),
        })
      );
      return;
    }
    if (state.profile.status === "error") {
      body.append(errorState({ error: state.profile.error, compact: true, onRetry: () => loadProfile(true) }));
      return;
    }
    const profile = state.profile.data;
    profileLink.hidden = !profile?.url;
    if (profile?.url) profileLink.href = profile.url;
    body.append(
      h(
        "div",
        { class: "lfm-hero" },
        profile.avatar
          ? h("img", { class: "lfm-avatar", src: profile.avatar, alt: "", referrerpolicy: "no-referrer" })
          : h("div", { class: "lfm-avatar", style: "display:grid;place-items:center" }, icon("user", { size: 24 })),
        h(
          "div",
          { class: "stack-tight", style: "flex:1;min-width:0" },
          h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, h("strong", { style: "font-size:17px" }, profile.username || "Last.fm user"), profile.country ? badge({ label: profile.country, tone: "neutral" }) : null),
          profile.real_name ? h("div", { class: "muted" }, profile.real_name) : null,
          h(
            "div",
            { class: "row", style: "gap:12px;flex-wrap:wrap;font-size:12px;margin-top:6px" },
            h("span", null, h("strong", null, fmtCompact(profile.playcount)), " scrobbles"),
            h("span", null, h("strong", null, fmtCompact(profile.artist_count)), " artists"),
            h("span", null, h("strong", null, fmtCompact(profile.track_count)), " tracks"),
            profile.registered ? h("span", { class: "muted" }, `since ${fmtDate(profile.registered * 1000)}`) : null
          )
        )
      )
    );
  }

  /* --------------------------- now playing --------------------------- */

  function renderNowPlaying() {
    const body = nowCard.querySelector(".card-body");
    clear(body);
    if (state.now.status === "loading") {
      body.append(h("div", { class: "mini-player" }, skeleton({ w: 48, h: 48, radius: 9 }), h("div", { class: "stack-tight", style: "flex:1" }, skeleton({ w: "70%", h: 14 }), skeleton({ w: "45%", h: 11 }))));
      return;
    }
    if (state.now.status === "unlinked") {
      body.append(emptyState({ icon: "music", title: "Not linked", compact: true }));
      return;
    }
    if (state.now.status === "error") {
      body.append(errorState({ error: state.now.error, compact: true, onRetry: () => loadNowPlaying(true) }));
      return;
    }
    const data = state.now.data || { now_playing: null, recent: [] };
    const recent = Array.isArray(data.recent) ? data.recent : [];
    const nowPlaying = data.now_playing || (recent[0]?.now_playing ? recent[0] : null);
    if (!nowPlaying && !recent.length) {
      body.append(emptyState({ icon: "music", title: "Nothing scrobbled yet", message: "Play something and it will show up here.", compact: true }));
      return;
    }
    if (nowPlaying) {
      body.append(
        h(
          "div",
          { class: "mini-player", style: "margin-bottom:10px" },
          nowPlaying.image ? h("img", { class: "mini-player-art", src: nowPlaying.image, alt: "", referrerpolicy: "no-referrer" }) : h("div", { class: "mini-player-art mini-player-art--fallback" }, icon("music", { size: 18 })),
          h(
            "div",
            { class: "mini-player-text" },
            h("div", { class: "mini-player-title" }, nowPlaying.name || "Unknown track"),
            h("div", { class: "mini-player-sub" }, `${nowPlaying.artist || "Unknown artist"}${nowPlaying.album ? ` · ${nowPlaying.album}` : ""}`),
            h("div", { class: "row", style: "gap:5px;margin-top:6px" }, badge({ label: "Now playing", tone: "success", dot: true }), nowPlaying.url ? h("a", { class: "btn btn--ghost btn--sm", href: nowPlaying.url, target: "_blank", rel: "noreferrer" }, "Open") : null)
          )
        )
      );
    }
    const rest = recent.filter((item) => item !== nowPlaying && !item.now_playing).slice(0, 4);
    if (rest.length) {
      body.append(
        h(
          "div",
          { class: "stack-tight" },
          h("div", { class: "section-label" }, "Recently played"),
          ...rest.map((track) =>
            h(
              "div",
              { class: "list-row" },
              h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, truncate(track.name || "Unknown", 52)), h("div", { class: "list-row-sub" }, track.artist || "Unknown artist", track.date ? ` · ${fmtRelative(Number(track.date) * 1000)}` : "")),
              track.url ? h("a", { class: "btn btn--ghost btn--sm", href: track.url, target: "_blank", rel: "noreferrer" }, icon("external-link", { size: 13 })) : null
            )
          )
        )
      );
    }
  }

  /* ------------------------------ tops ------------------------------ */

  function renderArtists() {
    const body = artistsCard.querySelector(".card-body");
    const count = artistsCard.querySelector("#artists-count");
    clear(body);
    if (count) {
      clear(count);
      if (state.artists.items.length) count.append(badge({ label: plural(state.artists.items.length, "artist"), tone: "neutral" }));
    }
    if (state.artists.status === "loading") {
      body.append(spinner({ size: 16, label: "Loading top artists" }));
      return;
    }
    if (state.artists.status === "error") {
      body.append(errorState({ error: state.artists.error, compact: true, onRetry: () => loadTopArtists(true) }));
      return;
    }
    if (!state.artists.items.length) {
      body.append(emptyState({ icon: "users", title: "No artists for this period", compact: true }));
      return;
    }
    const max = Math.max(...state.artists.items.map((artist) => artist.playcount || 0), 1);
    body.append(
      h("div", { class: "stack-tight" }, ...state.artists.items.map((artist, index) =>
        h(
          "div",
          { class: "row", style: "gap:9px;padding:5px 0;border-bottom:1px solid var(--line)" },
          h("span", { class: "queue-index" }, `#${index + 1}`),
          artist.image
            ? h("img", { class: "result-art", style: "border-radius:50%", src: artist.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
            : h("div", { class: "result-art", style: "border-radius:50%;display:grid;place-items:center" }, icon("user", { size: 14 })),
          h(
            "div",
            { style: "flex:1;min-width:0" },
            h("div", { class: "row", style: "gap:6px" }, h("div", { class: "result-title" }, artist.name || "Unknown"), artist.url ? h("a", { href: artist.url, target: "_blank", rel: "noreferrer", "aria-label": "Open on Last.fm", style: "color:var(--text-mute)" }, icon("external-link", { size: 12 })) : null),
            h("div", { style: "height:4px;background:var(--bg-elev-3);border-radius:99px;margin-top:5px;overflow:hidden" }, h("div", { style: `height:100%;width:${Math.round(((artist.playcount || 0) / max) * 100)}%;background:var(--accent)` }))
          ),
          h("span", { class: "muted", style: "font-size:11px;font-variant-numeric:tabular-nums" }, fmtCompact(artist.playcount || 0))
        )
      ))
    );
  }

  function renderTracks() {
    const body = tracksCard.querySelector(".card-body");
    const count = tracksCard.querySelector("#tracks-count");
    clear(body);
    if (count) {
      clear(count);
      if (state.tracks.items.length) count.append(badge({ label: plural(state.tracks.items.length, "track"), tone: "neutral" }));
    }
    if (state.tracks.status === "loading") {
      body.append(spinner({ size: 16, label: "Loading top tracks" }));
      return;
    }
    if (state.tracks.status === "error") {
      body.append(errorState({ error: state.tracks.error, compact: true, onRetry: () => loadTopTracks(true) }));
      return;
    }
    if (!state.tracks.items.length) {
      body.append(emptyState({ icon: "music", title: "No tracks for this period", compact: true }));
      return;
    }
    body.append(
      h("div", { class: "stack-tight" }, ...state.tracks.items.map((track, index) =>
        h(
          "div",
          { class: "row", style: "gap:9px;padding:5px 0;border-bottom:1px solid var(--line)" },
          h("span", { class: "queue-index" }, `#${index + 1}`),
          track.image ? h("img", { class: "result-art", src: track.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : h("div", { class: "result-art", style: "display:grid;place-items:center" }, icon("music", { size: 14 })),
          h("div", { style: "flex:1;min-width:0" }, h("div", { class: "result-title", title: track.name }, track.name || "Unknown"), h("div", { class: "result-sub" }, track.artist || "Unknown artist")),
          h("span", { class: "muted", style: "font-size:11px;font-variant-numeric:tabular-nums" }, `${fmtCompact(track.playcount || 0)} plays`)
        )
      ))
    );
  }

  /* ---------------------------- genres/weekly ---------------------------- */

  function renderGenres() {
    const body = genresCard.querySelector(".card-body");
    clear(body);
    if (state.genres.status === "loading") {
      body.append(spinner({ size: 16, label: "Analysing tags" }));
      return;
    }
    if (state.genres.status === "error") {
      body.append(errorState({ error: state.genres.error, compact: true, onRetry: () => loadGenres(true) }));
      return;
    }
    if (!state.genres.items.length) {
      body.append(emptyState({ icon: "pie-chart", title: "Not enough listening data", message: "Genres need a few scrobbled artists to infer.", compact: true }));
      return;
    }
    body.append(
      h(
        "div",
        { class: "row", style: "gap:18px;align-items:center;flex-wrap:wrap" },
        donut({
          segments: state.genres.items.map((genre) => ({ label: genre.name, value: genre.score })),
          centerLabel: "top genre",
          centerValue: state.genres.items[0]?.name || "",
          size: 156,
          thickness: 16,
          label: "Genre mix",
        }),
        h(
          "div",
          { class: "stack-tight", style: "flex:1;min-width:180px" },
          ...state.genres.items.map((genre, index) =>
            h(
              "div",
              { class: "row row--between", style: "font-size:12px;padding:2px 0" },
              h("span", { class: "row", style: "gap:6px" }, h("span", { style: `width:7px;height:7px;border-radius:2px;background:${["#00b8ff", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#22d3ee", "#fb923c", "#60a5fa"][index % 8]}` }), genre.name),
              h("span", { class: "muted" }, `${genre.score}%`)
            )
          )
        )
      )
    );
  }

  function renderWeekly() {
    const body = weeklyCard.querySelector(".card-body");
    clear(body);
    if (state.weekly.status === "loading") {
      body.append(spinner({ size: 16, label: "Loading weekly chart" }));
      return;
    }
    if (state.weekly.status === "error") {
      body.append(errorState({ error: state.weekly.error, compact: true, onRetry: () => loadWeekly(true) }));
      return;
    }
    if (!state.weekly.items.length) {
      body.append(emptyState({ icon: "calendar", title: "No weekly data", compact: true }));
      return;
    }
    body.append(
      horizontalBars({
        items: state.weekly.items.map((artist) => ({ label: artist.name, value: artist.playcount || 0 })),
        label: "Weekly artists",
        valueFormat: (value) => fmtCompact(value),
      })
    );
  }

  /* ----------------------------- heatmap ----------------------------- */

  function renderHeatmap() {
    const body = heatmapCard.querySelector(".card-body");
    clear(body);
    if (state.heatmap.status === "idle") {
      body.append(emptyState({ icon: "calendar", title: "Heatmap not loaded", message: "It takes a few seconds because Last.fm is queried once per week (up to 52 calls). You can load it three times per hour.", action: button({ label: "Load heatmap", size: "sm", variant: "primary", onClick: () => loadHeatmap(true) }), compact: true }));
      return;
    }
    if (state.heatmap.status === "loading") {
      body.append(h("div", { class: "stack-tight" }, spinner({ size: 16, label: "Collecting weekly charts" }), skeleton({ h: 90 })));
      return;
    }
    if (state.heatmap.status === "error") {
      const rateLimited = state.heatmap.error?.status === 429;
      body.append(
        rateLimited
          ? callout({ tone: "warning", title: "Slow down", children: "The heatmap can only be rebuilt three times per hour. Try again in a while — the API is protecting Last.fm's rate limits." })
          : errorState({ error: state.heatmap.error, compact: true, onRetry: () => loadHeatmap(true) })
      );
      return;
    }
    const weeks = state.heatmap.weeks;
    if (!weeks.length) {
      body.append(emptyState({ icon: "calendar", title: "No weekly history", compact: true }));
      return;
    }
    const total = weeks.reduce((sum, week) => sum + (week.count || 0), 0);
    const best = weeks.reduce((top, week) => ((week.count || 0) > (top.count || 0) ? week : top), weeks[0]);
    body.append(
      h(
        "div",
        { class: "stack-tight" },
        h(
          "div",
          { class: "row", style: "gap:18px;flex-wrap:wrap" },
          h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Scrobbles in range"), h("strong", { style: "font-size:18px" }, fmtInt(total))),
          h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Weekly average"), h("strong", { style: "font-size:18px" }, fmtInt(Math.round(total / weeks.length)))),
          h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Best week"), h("strong", { style: "font-size:18px" }, fmtInt(best?.count || 0)), h("span", { class: "muted", style: "font-size:11px" }, best?.from ? ` · ${fmtDate(best.from * 1000)}` : ""))
        ),
        barChart({
          values: weeks.map((week) => week.count || 0),
          labels: weeks.map((week) => (week.from ? new Date(week.from * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "")),
          label: "Weekly scrobbles",
          height: 130,
          format: (value) => fmtCompact(value),
        })
      )
    );
  }

  /* --------------------------- chart builder --------------------------- */

  const chartPreview = h("div", { class: "stack-tight" });
  const chartForm = h("div", { class: "field-grid", style: "margin-bottom:12px" });

  function revokeChart() {
    if (state.chart.url) URL.revokeObjectURL(state.chart.url);
    state.chart.url = "";
  }

  async function buildChart() {
    const cfg = state.chart;
    revokeChart();
    cfg.status = "loading";
    cfg.error = null;
    renderChartCard();
    try {
      const blob = await endpoints.lastfmChartBlob(user.id, {
        type: cfg.type,
        size: Number(cfg.size) || 3,
        period: cfg.period,
        labels: cfg.labels,
        gap: Number(cfg.gap) || 0,
        rounded: cfg.rounded,
        bg: cfg.bg,
      });
      if (disposed) return;
      cfg.url = URL.createObjectURL(blob);
      cfg.status = "ready";
    } catch (error) {
      if (disposed) return;
      cfg.status = "error";
      cfg.error = error;
    }
    renderChartCard();
  }

  function buildChartForm() {
    clear(chartForm);
    const cfg = state.chart;
    chartForm.append(
      field({ label: "Chart type", children: selectInput({ value: cfg.type, options: CHART_TYPES, onChange: (value) => { cfg.type = value; specChanged(); } }) }),
      field({ label: "Grid size", children: selectInput({ value: cfg.size, options: CHART_SIZES, onChange: (value) => { cfg.size = value; specChanged(); } }) }),
      field({ label: "Period", children: selectInput({ value: cfg.period, options: PERIODS, onChange: (value) => { cfg.period = value; specChanged(); } }) }),
      field({ label: "Background", children: h("input", { class: "input color-input", type: "color", value: cfg.bg, oninput: (event) => { cfg.bg = event.target.value; specChanged(); } }) }),
      field({ label: "Gap (px)", children: h("input", { class: "input", type: "number", min: "0", max: "20", value: String(cfg.gap), oninput: (event) => { cfg.gap = event.target.value; specChanged(); } }) }),
      field({ label: "Labels", children: checkboxControl({ checked: cfg.labels, label: "Show album / artist labels", onChange: (checked) => { cfg.labels = checked; specChanged(); } }) }),
      field({ label: "Rounded", children: checkboxControl({ checked: cfg.rounded, label: "Rounded corners", onChange: (checked) => { cfg.rounded = checked; specChanged(); } }) })
    );
  }

  let chartDebounce = null;
  function specChanged() {
    clearTimeout(chartDebounce);
    chartDebounce = setTimeout(() => {
      if (state.profile.status === "ready") buildChart();
    }, 500);
  }

  function renderChartCard(keepForm = false) {
    const body = chartCard.querySelector(".card-body");
    clear(body);
    if (state.profile.status === "unlinked") {
      body.append(emptyState({ icon: "image", title: "Link Last.fm first", compact: true }));
      return;
    }
    if (!keepForm) buildChartForm();
    body.append(chartForm, chartPreview);
    clear(chartPreview);
    const cfg = state.chart;
    if (cfg.status === "loading") {
      chartPreview.append(h("div", { style: "padding:24px;display:grid;place-items:center" }, spinner({ size: 22, label: "Rendering collage" })));
      return;
    }
    if (cfg.status === "error") {
      chartPreview.append(
        callout({
          tone: cfg.error?.status === 404 ? "info" : "danger",
          title: cfg.error?.status === 404 ? "No data for that period" : "Couldn't render the collage",
          children: h("div", { class: "stack-tight" }, h("p", null, cfg.error?.message || "The image endpoint failed."), button({ label: "Try again", size: "sm", onClick: () => buildChart() })),
        })
      );
      return;
    }
    if (!cfg.url) {
      chartPreview.append(h("p", { class: "muted", style: "font-size:11.5px" }, "Choose a layout and the collage is generated automatically."));
      return;
    }
    chartPreview.append(
      h(
        "div",
        { class: "stack-tight" },
        h("img", { src: cfg.url, alt: `Collage of top ${cfg.type}`, style: "max-width:100%;border-radius:var(--radius);border:1px solid var(--line)" }),
        h(
          "div",
          { class: "row" },
          h("a", { class: "btn btn--primary btn--sm", href: cfg.url, download: `rift-lastfm-${cfg.type}-${cfg.period}.png` }, icon("download", { size: 14 }), " Download"),
          button({ label: "Regenerate", size: "sm", variant: "outline", icon: "refresh", onClick: () => buildChart() })
        )
      )
    );
  }

  /* ------------------------------- loads ------------------------------- */

  function settleUnlinked(error) {
    return error?.status === 404;
  }

  async function loadProfile(force = false) {
    if (!force && state.profile.status === "ready") return;
    state.profile.status = "loading";
    renderProfile();
    try {
      state.profile = { status: "ready", data: await endpoints.lastfmProfile(user.id), error: null };
    } catch (error) {
      state.profile = settleUnlinked(error)
        ? { status: "unlinked", data: null, error: null }
        : { status: "error", data: null, error };
    }
    renderProfile();
    renderChartCard();
  }

  async function loadNowPlaying(force = false) {
    if (!force && state.now.status === "ready") return;
    state.now.status = "loading";
    renderNowPlaying();
    try {
      state.now = { status: "ready", data: await endpoints.lastfmNowPlaying(user.id), error: null };
    } catch (error) {
      state.now = settleUnlinked(error) ? { status: "unlinked", data: null, error: null } : { status: "error", data: null, error };
    }
    renderNowPlaying();
  }

  async function loadTopArtists(force = false) {
    if (!force && state.artists.status === "ready") return;
    state.artists.status = "loading";
    renderArtists();
    try {
      const payload = await endpoints.lastfmTopArtists(user.id, state.period);
      state.artists = { status: "ready", items: asList(payload, ["artists"]), error: null };
    } catch (error) {
      state.artists = settleUnlinked(error) ? { status: "ready", items: [], error: null } : { status: "error", items: [], error };
    }
    renderArtists();
  }

  async function loadTopTracks(force = false) {
    if (!force && state.tracks.status === "ready") return;
    state.tracks.status = "loading";
    renderTracks();
    try {
      const payload = await endpoints.lastfmTopTracks(user.id, state.period);
      state.tracks = { status: "ready", items: asList(payload, ["tracks"]), error: null };
    } catch (error) {
      state.tracks = settleUnlinked(error) ? { status: "ready", items: [], error: null } : { status: "error", items: [], error };
    }
    renderTracks();
  }

  async function loadGenres(force = false) {
    if (!force && state.genres.status === "ready") return;
    state.genres.status = "loading";
    renderGenres();
    try {
      const payload = await endpoints.lastfmGenres(user.id, state.period === "7day" ? "6month" : state.period);
      state.genres = { status: "ready", items: asList(payload, ["genres"]), error: null };
    } catch (error) {
      state.genres = settleUnlinked(error) ? { status: "ready", items: [], error: null } : { status: "error", items: [], error };
    }
    renderGenres();
  }

  async function loadWeekly(force = false) {
    if (!force && state.weekly.status === "ready") return;
    state.weekly.status = "loading";
    renderWeekly();
    try {
      const payload = await endpoints.lastfmWeeklyArtists(user.id);
      state.weekly = { status: "ready", items: asList(payload, ["artists"]), error: null };
    } catch (error) {
      state.weekly = settleUnlinked(error) ? { status: "ready", items: [], error: null } : { status: "error", items: [], error };
    }
    renderWeekly();
  }

  async function loadHeatmap(force = false) {
    if (!force && state.heatmap.status === "ready") return;
    if (!force && state.heatmap.status === "loading") return;
    state.heatmap.status = "loading";
    renderHeatmap();
    try {
      const payload = await endpoints.lastfmHeatmap(user.id);
      state.heatmap = { status: "ready", weeks: asList(payload, ["weeks"]), error: null };
    } catch (error) {
      state.heatmap = { status: "error", weeks: [], error };
    }
    renderHeatmap();
  }

  async function loadAll(force = false) {
    if (force) {
      for (const key of ["profile", "now", "artists", "tracks", "genres", "weekly"]) {
        state[key].status = "loading";
      }
    }
    renderProfile();
    renderNowPlaying();
    renderArtists();
    renderTracks();
    renderGenres();
    renderWeekly();
    await Promise.allSettled([
      loadProfile(force),
      loadNowPlaying(force),
      loadTopArtists(force),
      loadTopTracks(force),
      loadGenres(force),
      loadWeekly(force),
    ]);
    if (state.profile.status === "ready" && !state.chart.url) buildChart();
  }

  /* ------------------------------- wiring ------------------------------- */

  const periodControl = h("div");
  const periodRow = h("div", { class: "row", style: "gap:10px;flex-wrap:wrap;align-items:center" }, h("span", { class: "muted", style: "font-size:11.5px" }, "Time range"), periodControl);
  content.insertBefore(periodRow, topRow);
  periodControl.append(
    segmentedControl({
      options: PERIODS.map((period) => ({ value: period.value, label: period.label })),
      value: state.period,
      size: "sm",
      onChange: (value) => {
        state.period = value;
        loadTopArtists(true);
        loadTopTracks(true);
        loadGenres(true);
      },
    })
  );

  renderProfile();
  renderNowPlaying();
  renderArtists();
  renderTracks();
  renderGenres();
  renderWeekly();
  renderHeatmap();
  renderChartCard();

  if (!user?.id) {
    clear(content);
    content.append(callout({ tone: "warning", title: "Sign in required", children: "Last.fm data is tied to your Discord account." }));
    return () => {};
  }

  await loadAll();

  return () => {
    disposed = true;
    clearTimeout(chartDebounce);
    revokeChart();
  };
}
