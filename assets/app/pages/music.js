/* Music: live player, queue, search, lyrics, playlists, history, favourites
 * and the audio repair tools. The bot owns playback; this page is a remote.
 *
 * The audio API's state payload has evolved over time, so everything below
 * goes through tolerant readers (`readNumber`, `readTrack`, ...). That way a
 * renamed field degrades to a sensible default instead of throwing. */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  card,
  callout,
  emptyState,
  errorState,
  iconButton,
  pageHeader,
  progressBar,
  skeleton,
  spinner,
  tabs,
  toast,
} from "../ui/components.js";
import { asList } from "../data/endpoints.js";
import {
  clamp,
  fmtClock,
  fmtDuration,
  fmtInt,
  fmtRelative,
  plural,
  truncate,
} from "../core/format.js";

const LOOP_MODES = ["off", "track", "queue"];
const TABS = [
  { id: "queue", label: "Queue" },
  { id: "lyrics", label: "Lyrics" },
  { id: "history", label: "History" },
  { id: "top", label: "Most played" },
];

function readNumber(...values) {
  for (const value of values) {
    const number = typeof value === "string" ? Number(value) : value;
    if (typeof number === "number" && Number.isFinite(number)) return number;
  }
  return null;
}

function readString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readTrack(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = readString(raw.title, raw.name, raw.track, raw.song);
  if (!title) return null;
  return {
    title,
    author: readString(raw.author, raw.artist, raw.uploader, raw.channel, "Unknown artist"),
    uri: readString(raw.uri, raw.url, raw.link),
    artwork: readString(raw.artwork, raw.artwork_url, raw.thumbnail, raw.image, raw.cover),
    duration: readNumber(raw.duration, raw.length, raw.duration_ms),
    isStream: Boolean(raw.is_stream ?? raw.stream ?? raw.live),
    requester: readString(raw.requester, raw.requested_by, raw.user),
  };
}

function toSeconds(value) {
  const number = readNumber(value);
  if (number == null) return 0;
  return number > 24 * 3600 ? number / 1000 : number;
}

function normalizeState(raw) {
  const payload = raw && typeof raw === "object" ? raw : {};
  const currentRaw =
    payload.current ||
    payload.track ||
    payload.now_playing ||
    payload.nowPlaying ||
    (payload.player && payload.player.current) ||
    null;
  const current = readTrack(currentRaw);
  const queueRaw = asList(payload, ["queue", "tracks", "upcoming"]) || [];
  const queue = queueRaw.map(readTrack).filter(Boolean);
  const position = toSeconds(payload.position ?? payload.position_ms ?? currentRaw?.position);
  const duration = current
    ? toSeconds(current.duration ?? payload.duration) || current.duration || 0
    : 0;
  const loopRaw = payload.loop ?? payload.loop_mode ?? payload.repeat;
  const loop =
    typeof loopRaw === "boolean"
      ? loopRaw
        ? "track"
        : "off"
      : LOOP_MODES.includes(String(loopRaw || "").toLowerCase())
        ? String(loopRaw).toLowerCase()
        : "off";
  let volume = readNumber(payload.volume, payload.vol, 100) ?? 100;
  if (volume > 100) volume /= 10;
  return {
    connected: Boolean(payload.connected ?? payload.in_voice ?? payload.playing ?? current),
    playing: Boolean(payload.playing ?? (payload.paused === false && current)),
    paused: Boolean(payload.paused ?? (payload.playing === false && current)),
    channelId: readString(payload.channel_id, payload.channel?.id),
    channelName: readString(payload.channel_name, payload.channel?.name, payload.channel),
    current,
    queue,
    position: clamp(position, 0, duration || Number.MAX_SAFE_INTEGER),
    duration,
    volume: clamp(volume, 0, 100),
    loop,
    shuffle: Boolean(payload.shuffle ?? payload.shuffled),
    autoplay: Boolean(payload.autoplay ?? payload.auto_play),
    filters: Array.isArray(payload.filters) ? payload.filters : payload.filter ? [String(payload.filter)] : [],
    raw: payload,
  };
}

function artNode(track, size = "result-art") {
  if (track?.artwork) {
    return h("img", { class: size, src: track.artwork, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
  }
  return h("div", { class: `${size}${size.includes("player") ? " player-art--fallback" : " result-art"}`, style: "display:grid;place-items:center;color:var(--text-mute)" }, icon("music", { size: 16 }));
}

export async function mountPage(ctx) {
  const { root, guild, guildId, endpoints, user, toast: notify, signal } = ctx;
  const hasGuild = Boolean(guildId);

  let disposed = false;
  let pollTimer = null;
  let searchTimer = null;
  let requestSeq = 0;

  const state = {
    loading: true,
    error: null,
    music: normalizeState({}),
    autoRefresh: true,
    busy: "",
    tab: "queue",
    search: { query: "", results: [], loading: false, error: null },
    lyrics: { status: "idle", lines: [], error: null, key: "" },
    playlists: { loading: true, error: null, items: [], expanded: null, busy: "" },
    history: { loading: true, items: [], error: null },
    top: { loading: true, items: [], error: null },
  };

  const page = h("div", { class: "page" });
  const header = pageHeader({
    eyebrow: "Audio",
    title: "Music",
    description: "Control the bot's player, queue tracks, manage playlists and repair a stuck voice connection. Playback stays in Discord — this is the remote.",
    actions: h("div", { class: "row" }),
  });
  const headerActions = header.querySelector(".page-head-actions") || header;
  let liveBadge = badge({ label: "Connecting…", tone: "neutral", dot: true });
  const refreshBtn = iconButton({ icon: "refresh", label: "Refresh state", onClick: () => loadAll(true) });
  const autoBtn = button({ label: "Auto-refresh on", icon: "activity", variant: "outline", size: "sm", onClick: toggleAutoRefresh });
  mount(headerActions, h("div", { class: "row", style: "gap:6px;align-items:center" }, liveBadge, autoBtn, refreshBtn));

  const content = h("div", { class: "stack" });
  mount(page, header, content);
  mount(root, page);

  if (!hasGuild) {
    content.append(
      callout({
        tone: "warning",
        title: "Pick a server",
        children: "Music controls are scoped to a server. Open a server first, then come back to this page.",
        action: button({ label: "Your servers", size: "sm", onClick: () => ctx.router.navigate("/guilds") }),
      })
    );
    return () => {};
  }

  /* ------------------------------ chrome ------------------------------ */

  const playerCard = card({ title: "Now playing", className: "player-card", actions: h("div", { class: "row", id: "player-badges" }) });
  const seekRow = h("div", { class: "player-seek" });
  const playerHero = h("div", { class: "player-hero" });
  const controlsRow = h("div", { class: "player-controls" });
  const volumeRow = h("div", { class: "player-seek" });
  mount(playerCard.querySelector(".card-body"), playerHero, seekRow, controlsRow, volumeRow);

  const searchInput = h("input", {
    class: "input",
    type: "search",
    placeholder: "Search a song, artist or paste a URL…",
    autocomplete: "off",
    "aria-label": "Search music",
  });
  const searchHost = h("div", { class: "search-results" });
  const searchCard = card({
    title: "Add to queue",
    subtitle: "Results come from the same LavaLink node the bot plays from.",
    children: h("div", { class: "stack-tight" }, h("div", { class: "row" }, searchInput), searchHost),
  });

  const tabsHost = h("div");
  const queueHost = h("div", { class: "queue-list" });
  const lyricsHost = h("div", { class: "lyrics-box" });
  const historyHost = h("div", { class: "queue-list" });
  const topHost = h("div", { class: "queue-list" });
  let tabsBuilt = false;
  const tabCard = card({
    title: "Up next",
    subtitle: "Queue, lyrics, history and the server's most played tracks.",
    actions: h("div", { class: "row", id: "queue-actions" }),
    children: h("div", { class: "stack-tight" }, tabsHost, queueHost),
  });
  const queueActions = tabCard.querySelector("#queue-actions") || tabCard;

  const playlistsHost = h("div", { class: "stack-tight" });
  const playlistsCard = card({
    title: "Your playlists",
    subtitle: "Saved in the bot and shared with your Discord account.",
    actions: button({ label: "New playlist", icon: "plus", size: "sm", variant: "outline", onClick: createPlaylist }),
    children: playlistsHost,
  });

  const fixesCard = card({
    title: "Audio repairs",
    subtitle: "Only usable while you are in the bot's voice channel.",
    children: h(
      "div",
      { class: "stack-tight" },
      h(
        "div",
        { class: "quick-grid" },
        button({ label: "Reset region", icon: "globe", variant: "outline", onClick: () => runFix("region", "Region reset to automatic") }),
        button({ label: "Rejoin VC", icon: "phone", variant: "outline", onClick: () => runFix("rejoin", "Rejoined and resumed") }),
        button({ label: "Clear filters", icon: "sliders", variant: "outline", onClick: () => runFix("filters", "Filters cleared") }),
        button({ label: "Reload player", icon: "refresh", variant: "outline", onClick: () => loadAll(true) })
      ),
      h("p", { class: "muted", style: "font-size:11.5px;line-height:1.5" }, "Repairs are refused unless you are in the same voice channel as the bot.")
    ),
  });

  const layout = h(
    "div",
    { class: "music-layout" },
    h("div", { class: "stack" }, playerCard, searchCard),
    h("div", { class: "stack" }, tabCard, playlistsCard, fixesCard)
  );
  const extras = h("div", { class: "grid grid--2" });
  mount(content, layout, extras);

  const extrasHistory = h("div");
  const extrasTop = h("div");
  mount(extras, extrasHistory, extrasTop);

  /* --------------------------- player render --------------------------- */

  function setLiveBadge(text, tone) {
    liveBadge.replaceWith((liveBadge = badge({ label: text, tone, dot: true })));
  }

  function renderPlayer() {
    const music = state.music;
    if (state.loading) {
      clear(playerHero);
      clear(seekRow);
      clear(controlsRow);
      clear(volumeRow);
      playerHero.append(
        skeleton({ w: "92px", h: 92, radius: 12 }),
        h("div", { class: "player-meta" }, skeleton({ w: "60%", h: 18 }), h("div", { style: "height:6px" }), skeleton({ w: "38%", h: 12 }))
      );
      return;
    }
    if (state.error) {
      clear(playerHero);
      clear(seekRow);
      clear(controlsRow);
      clear(volumeRow);
      playerHero.append(errorState({ error: state.error, title: "Player state unavailable", onRetry: () => loadAll(true), compact: true }));
      return;
    }

    const track = music.current;
    clear(playerHero);
    if (track) {
      playerHero.append(
        artNode({ ...track, artwork: track.artwork }, "player-art"),
        h(
          "div",
          { class: "player-meta" },
          h("div", { class: "player-title", title: track.title }, track.title),
          h("div", { class: "player-artist" }, track.author || "Unknown artist"),
          h(
            "div",
            { class: "row", style: "gap:5px;margin-top:8px;flex-wrap:wrap" },
            badge({ label: music.paused ? "Paused" : "Playing", tone: music.paused ? "warning" : "success", dot: true }),
            music.channelName ? badge({ label: `#${music.channelName}`, tone: "neutral" }) : null,
            track.requester ? badge({ label: `by ${track.requester}`, tone: "neutral" }) : null,
            music.autoplay ? badge({ label: "Autoplay", tone: "violet" }) : null
          )
        )
      );
    } else {
      playerHero.append(
        h("div", { class: "player-art player-art--fallback" }, icon("music", { size: 26 })),
        h(
          "div",
          { class: "player-meta" },
          h("div", { class: "player-title" }, music.connected ? "Idle" : "Not connected"),
          h("div", { class: "player-artist" }, music.connected ? "Queue a track to start playing." : "The bot isn't in a voice channel. Join one, then use /play or the search above."),
          music.channelName ? h("div", { class: "row", style: "margin-top:8px" }, badge({ label: `#${music.channelName}`, tone: "neutral" })) : null
        )
      );
    }

    const duration = music.duration || track?.duration || 0;
    const max = Math.max(1, toSeconds(duration));
    clear(seekRow);
    if (track) {
      const seek = h("input", {
        type: "range",
        min: "0",
        max: String(Math.round(max)),
        step: "1",
        value: String(Math.round(clamp(music.position, 0, max))),
        "aria-label": "Seek",
        disabled: !track || state.busy === "seek",
      });
      const positionLabel = h("span", null, fmtClock(music.position));
      on(seek, "input", () => {
        positionLabel.textContent = fmtClock(Number(seek.value));
      });
      on(seek, "change", () => sendControl("seek", { position: Number(seek.value) }, "seek"));
      seekRow.append(positionLabel, seek, h("span", null, max > 1 ? fmtClock(max) : "--:--"));
    } else {
      seekRow.append(h("span", null, "0:00"), h("div", { class: "progress", style: "flex:1" }, progressBar({ value: 0 })), h("span", null, "--:--"));
    }

    clear(controlsRow);
    const disabled = !music.connected && !track;
    controlsRow.append(
      iconButton({ icon: "skip-back", label: "Previous", onClick: () => sendControl("previous"), disabled: disabled || state.busy === "previous" }),
      h(
        "button",
        {
          class: "player-btn player-btn--primary",
          type: "button",
          "aria-label": music.paused ? "Resume" : "Pause",
          title: music.paused ? "Resume" : "Pause",
          disabled,
          onclick: () => sendControl(music.paused ? "resume" : "pause"),
        },
        icon(music.paused ? "play" : "pause", { size: 18 })
      ),
      iconButton({ icon: "skip-forward", label: "Skip", onClick: () => sendControl("skip"), disabled }),
      iconButton({ icon: "square", label: "Stop", onClick: () => stopPlayback(), disabled }),
      h("span", { class: "spacer" }),
      h(
        "button",
        {
          class: `player-btn${music.shuffle ? " is-active" : ""}`,
          type: "button",
          "aria-pressed": String(music.shuffle),
          "aria-label": "Shuffle",
          title: "Shuffle",
          disabled,
          onclick: () => sendControl("shuffle", { value: !music.shuffle }),
        },
        icon("shuffle", { size: 16 })
      ),
      h(
        "button",
        {
          class: `player-btn${music.loop !== "off" ? " is-active" : ""}`,
          type: "button",
          "aria-label": `Loop: ${music.loop}`,
          title: `Loop: ${music.loop}`,
          disabled,
          onclick: () => {
            const next = LOOP_MODES[(LOOP_MODES.indexOf(music.loop) + 1) % LOOP_MODES.length];
            sendControl("loop", { value: next });
          },
        },
        icon(music.loop === "track" ? "repeat" : "repeat", { size: 16 })
      ),
      h(
        "button",
        {
          class: `player-btn${music.autoplay ? " is-active" : ""}`,
          type: "button",
          "aria-pressed": String(music.autoplay),
          "aria-label": "Autoplay",
          title: "Autoplay similar tracks",
          disabled,
          onclick: () => sendControl("autoplay", { value: !music.autoplay }),
        },
        icon("radio", { size: 16 })
      )
    );

    clear(volumeRow);
    const volume = h("input", {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: String(Math.round(music.volume)),
      "aria-label": "Volume",
      disabled: !music.connected,
    });
    const volumeLabel = h("span", null, `${Math.round(music.volume)}%`);
    on(volume, "input", () => {
      volumeLabel.textContent = `${volume.value}%`;
    });
    on(volume, "change", () => sendControl("volume", { volume: Number(volume.value) }));
    volumeRow.append(icon("volume-2", { size: 14 }), volume, volumeLabel);

    const badges = playerCard.querySelector("#player-badges");
    if (badges) {
      clear(badges);
      badges.append(
        ...[
          badge({ label: music.connected ? "Voice connected" : "Not connected", tone: music.connected ? "success" : "neutral", dot: true }),
          music.loop !== "off" ? badge({ label: `Loop ${music.loop}`, tone: "accent" }) : null,
          music.filters.length ? badge({ label: plural(music.filters.length, "filter"), tone: "violet" }) : null,
        ].filter(Boolean)
      );
    }

    if (state.loading) setLiveBadge("Connecting…", "neutral");
    else if (state.error) setLiveBadge("Unavailable", "danger");
    else if (music.connected) setLiveBadge(music.paused ? "Paused" : "Live", music.paused ? "warning" : "success");
    else setLiveBadge("Idle", "neutral");
  }

  /* ---------------------------- tabs/queue ---------------------------- */

  function mountTabs() {
    if (tabsBuilt) return;
    tabsBuilt = true;
    const hosts = { queue: queueHost, lyrics: lyricsHost, history: historyHost, top: topHost };
    const handle = tabs({
      tabs: TABS.map((tab) => ({ ...tab, render: () => hosts[tab.id] })),
      active: state.tab,
      onChange: (id) => {
        state.tab = id;
        renderTabBody();
        if (id === "lyrics") ensureLyrics();
      },
    });
    tabsHost.append(handle.el);
  }

  function renderQueueActions() {
    if (!queueActions) return;
    clear(queueActions);
    if (state.tab !== "queue") return;
    const music = state.music;
    queueActions.append(
      h("span", { class: "muted", style: "font-size:11.5px" }, `${music.queue.length} queued`),
      button({ label: "Shuffle", size: "sm", variant: "ghost", icon: "shuffle", onClick: () => sendControl("shuffle_queue"), disabled: music.queue.length < 2 }),
      button({ label: "Clear", size: "sm", variant: "ghost", icon: "trash", onClick: clearQueue, disabled: !music.queue.length })
    );
  }

  function renderTabBody() {
    renderQueueActions();
    if (state.tab === "queue") renderQueue();
    else if (state.tab === "lyrics") renderLyrics();
    else if (state.tab === "history") renderHistoryList();
    else renderTopList();
  }

  function renderQueue() {
    clear(queueHost);
    if (state.music.queue.length === 0) {
      queueHost.append(
        emptyState({
          icon: "list-music",
          title: "Queue is empty",
          message: state.music.connected ? "Search above or use /play in Discord to add tracks." : "The bot isn't connected to voice yet.",
          compact: true,
        })
      );
      return;
    }
    state.music.queue.forEach((track, index) => {
      queueHost.append(
        h(
          "div",
          { class: "queue-row" },
          h("span", { class: "queue-index" }, String(index + 1)),
          h(
            "div",
            { class: "queue-main" },
            h("div", { class: "queue-title", title: track.title }, track.title),
            h("div", { class: "queue-sub" }, `${track.author || "Unknown"}${track.duration ? ` · ${fmtClock(toSeconds(track.duration))}` : ""}`)
          ),
          button({ label: "Play", size: "sm", variant: "ghost", onClick: () => sendControl("jump", { index }) }),
          iconButton({ icon: "x", label: "Remove", onClick: () => sendControl("remove", { index }) }),
          iconButton({ icon: "trash", label: "Remove", onClick: () => sendControl("remove", { index }) })
        )
      );
    });
  }

  function renderHistoryList() {
    const host = historyHost;
    clear(host);
    if (state.history.loading) {
      host.append(skeleton({ h: 18 }), skeleton({ h: 18 }), skeleton({ h: 18 }));
      return;
    }
    if (state.history.error) {
      host.append(errorState({ error: state.history.error, compact: true, onRetry: () => loadHistory(true) }));
      return;
    }
    if (!state.history.items.length) {
      host.append(emptyState({ icon: "history", title: "No history yet", compact: true }));
      return;
    }
    for (const item of state.history.items) {
      host.append(
        h(
          "div",
          { class: "queue-row" },
          artNode(item, "result-art"),
          h(
            "div",
            { class: "queue-main" },
            h("div", { class: "queue-title" }, item.title || "Unknown"),
            h("div", { class: "queue-sub" }, `${item.author || item.artist || "Unknown"}${item.played_at ? ` · ${fmtRelative(item.played_at)}` : ""}`)
          ),
          button({ label: "Play", size: "sm", variant: "ghost", onClick: () => playQuery(item.uri || `${item.title} ${item.author || ""}`) })
        )
      );
    }
  }

  function renderTopList() {
    const host = topHost;
    clear(host);
    if (state.top.loading) {
      host.append(skeleton({ h: 18 }), skeleton({ h: 18 }), skeleton({ h: 18 }));
      return;
    }
    if (state.top.error) {
      host.append(errorState({ error: state.top.error, compact: true, onRetry: () => loadTop(true) }));
      return;
    }
    if (!state.top.items.length) {
      host.append(emptyState({ icon: "chart", title: "Nothing played yet", message: "The most-played chart fills up as the bot plays music.", compact: true }));
      return;
    }
    state.top.items.forEach((item, index) => {
      host.append(
        h(
          "div",
          { class: "queue-row" },
          h("span", { class: "queue-index" }, `#${index + 1}`),
          h(
            "div",
            { class: "queue-main" },
            h("div", { class: "queue-title" }, item.title || "Unknown"),
            h("div", { class: "queue-sub" }, `${item.artist || item.author || "Unknown"} · ${plural(item.plays || 0, "play")}`)
          ),
          button({ label: "Play", size: "sm", variant: "ghost", onClick: () => playQuery(item.url || item.uri || `${item.title} ${item.artist || ""}`) })
        )
      );
    });
  }

  /* ------------------------------ lyrics ------------------------------ */

  function lyricKey() {
    const track = state.music.current;
    return track ? `${track.title}::${track.author}` : "";
  }

  function ensureLyrics(force = false) {
    const track = state.music.current;
    const key = lyricKey();
    if (!track) {
      state.lyrics = { status: "empty", lyrics: [], error: null, key: "" };
      renderLyrics();
      return;
    }
    if (!force && state.lyrics.key === key && state.lyrics.status !== "idle") {
      renderLyrics();
      return;
    }
    state.lyrics = { status: "loading", lines: [], error: null, key };
    renderLyrics();
    endpoints
      .musicLyrics({ title: track.title, author: track.author, duration: Math.round(toSeconds(track.duration)) })
      .then((payload) => {
        if (disposed || state.lyrics.key !== key) return;
        const raw =
          (typeof payload === "string" && payload) ||
          payload?.lyrics ||
          payload?.synced_lyrics ||
          payload?.plainLyrics ||
          payload?.result?.lyrics ||
          "";
        const lines = Array.isArray(raw)
          ? raw.map((line) => (typeof line === "string" ? line : line?.text || line?.line || "")).filter(Boolean)
          : String(raw).split(/\r?\n/).map((line) => line.trimEnd());
        state.lyrics = { status: lines.filter((line) => line.trim()).length ? "ready" : "empty", lines, error: null, key };
        renderLyrics();
      })
      .catch((error) => {
        if (disposed || state.lyrics.key !== key) return;
        state.lyrics = { status: "error", lines: [], error, key };
        renderLyrics();
      });
  }

  function renderLyrics() {
    clear(lyricsHost);
    if (state.tab !== "lyrics") return;
    const songs = state.lyrics;
    if (!state.music.current) {
      lyricsHost.append(emptyState({ icon: "mic", title: "Nothing playing", message: "Lyrics appear here for the current track.", compact: true }));
      return;
    }
    if (songs.status === "loading") {
      lyricsHost.append(spinner({ size: 16, label: "Looking up lyrics" }));
      return;
    }
    if (songs.status === "error") {
      lyricsHost.append(
        callout({ tone: "warning", title: "Lyrics unavailable", children: h("div", { class: "stack-tight" }, h("p", null, songs.error?.message || "The lyrics provider didn't answer."), button({ label: "Try again", size: "sm", onClick: () => ensureLyrics(true) })) })
      );
      return;
    }
    if (!songs.lines.length) {
      lyricsHost.append(emptyState({ icon: "mic", title: "No lyrics found", message: "This track isn't in the lyrics database.", compact: true }));
      return;
    }
    songs.lines.forEach((line) => lyricsHost.append(h("div", { class: "lyrics-line" }, line || "\u00a0")));
  }

  /* ----------------------------- playlists ----------------------------- */

  async function loadPlaylists(force = false) {
    if (!user?.id) {
      state.playlists = { loading: false, error: null, items: [], expanded: null, busy: "" };
      renderPlaylists();
      return;
    }
    if (!force && state.playlists.items.length) {
      renderPlaylists();
      return;
    }
    state.playlists.loading = true;
    renderPlaylists();
    try {
      const payload = await endpoints.playlists(user.id);
      const items = asList(payload, ["playlists", "data"]);
      state.playlists = { loading: false, error: null, items, expanded: state.playlists.expanded, busy: "" };
    } catch (error) {
      state.playlists = { loading: false, error, items: [], expanded: state.playlists.expanded, busy: "" };
    }
    renderPlaylists();
  }

  function renderPlaylists() {
    clear(playlistsHost);
    const { loading, error, items, expanded, busy } = state.playlists;
    if (loading) {
      playlistsHost.append(skeleton({ h: 34 }), skeleton({ h: 34 }));
      return;
    }
    if (error) {
      playlistsHost.append(errorState({ error, compact: true, onRetry: () => loadPlaylists(true) }));
      return;
    }
    if (!user?.id) {
      playlistsHost.append(callout({ tone: "info", title: "Sign in required", children: "Playlists are tied to your Discord account." }));
      return;
    }
    if (!items.length) {
      playlistsHost.append(
        emptyState({ icon: "list-music", title: "No playlists yet", message: "Create one and add tracks from search or the queue.", action: button({ label: "New playlist", size: "sm", variant: "primary", onClick: createPlaylist }), compact: true })
      );
      return;
    }
    for (const playlist of items) {
      const name = playlist.name || playlist.id || "Playlist";
      const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
      const isOpen = expanded === name;
      playlistsHost.append(
        h(
          "div",
          { class: "list-row" },
          h(
            "div",
            { class: "list-row-main" },
            h("div", { class: "list-row-title" }, name),
            h("div", { class: "list-row-sub" }, `${plural(playlist.track_count ?? tracks.length, "track")}${playlist.updated_at ? ` · updated ${fmtRelative(playlist.updated_at)}` : ""}`)
          ),
          button({
            label: "Play",
            size: "sm",
            variant: "primary",
            loading: busy === `play:${name}`,
            disabled: Boolean(busy) || !tracks.length,
            onClick: () => playPlaylist(name),
          }),
          iconButton({
            icon: isOpen ? "chevron-up" : "chevron-down",
            label: isOpen ? "Hide tracks" : "Show tracks",
            onClick: () => {
              state.playlists.expanded = isOpen ? null : name;
              renderPlaylists();
            },
          }),
          iconButton({ icon: "edit", label: `Rename ${name}`, onClick: () => renamePlaylist(name) }),
          iconButton({ icon: "trash", label: `Delete ${name}`, onClick: () => deletePlaylist(name) })
        )
      );
      if (isOpen) {
        const box = h("div", { class: "stack-tight", style: "padding:2px 8px 10px 16px" });
        if (!tracks.length) box.append(h("p", { class: "muted", style: "font-size:11.5px" }, "This playlist is empty."));
        tracks.forEach((track, index) => {
          box.append(
            h(
              "div",
              { class: "queue-row" },
              h("span", { class: "queue-index" }, String(index + 1)),
              h("div", { class: "queue-main" }, h("div", { class: "queue-title" }, track.title || "Unknown"), h("div", { class: "queue-sub" }, track.artist || "Unknown")),
              iconButton({ icon: "x", label: "Remove track", onClick: () => removePlaylistTrack(name, index) })
            )
          );
        });
        playlistsHost.append(box);
      }
    }
  }

  async function createPlaylist() {
    if (!user?.id) return;
    const name = await promptDialog("New playlist", "Playlist name", "", "Create");
    if (!name) return;
    state.playlists.busy = "create";
    renderPlaylists();
    try {
      await endpoints.playlistCreate(user.id, { name });
      notify.success(`Created “${name}”`);
      await loadPlaylists(true);
    } catch (error) {
      notify.error(error?.message || "Couldn't create playlist");
    } finally {
      state.playlists.busy = "";
      renderPlaylists();
    }
  }

  async function renamePlaylist(name) {
    const next = await promptDialog("Rename playlist", "New name", name, "Rename");
    if (!next || next === name) return;
    try {
      await endpoints.playlistRename(user.id, name, next);
      notify.success("Playlist renamed");
      if (state.playlists.expanded === name) state.playlists.expanded = next;
      await loadPlaylists(true);
    } catch (error) {
      notify.error(error?.message || "Couldn't rename playlist");
    }
  }

  async function deletePlaylist(name) {
    const confirmed = await ctx.confirm({
      title: `Delete “${name}”?`,
      message: "The playlist and its saved tracks are removed for your account. This can't be undone.",
      confirmLabel: "Delete playlist",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await endpoints.playlistDelete(user.id, name);
      notify.success("Playlist deleted");
      if (state.playlists.expanded === name) state.playlists.expanded = null;
      await loadPlaylists(true);
    } catch (error) {
      notify.error(error?.message || "Couldn't delete playlist");
    }
  }

  async function removePlaylistTrack(name, index) {
    try {
      await endpoints.playlistRemoveTrack(user.id, name, index);
      notify.success("Track removed");
      await loadPlaylists(true);
    } catch (error) {
      notify.error(error?.message || "Couldn't remove track");
    }
  }

  async function playPlaylist(name) {
    if (!state.music.connected) {
      notify.warning("The bot isn't in a voice channel yet");
      return;
    }
    state.playlists.busy = `play:${name}`;
    renderPlaylists();
    try {
      await endpoints.playlistPlay(user.id, { name, guild_id: guildId });
      notify.success(`Queued “${name}”`);
      setTimeout(() => loadState(), 600);
    } catch (error) {
      notify.error(error?.message || "Couldn't play playlist");
    } finally {
      state.playlists.busy = "";
      renderPlaylists();
    }
  }

  /* ------------------------------ search ------------------------------ */

  function renderSearch() {
    clear(searchHost);
    const { loading, error, results, query } = state.search;
    if (loading) {
      searchHost.append(spinner({ size: 16, label: "Searching" }));
      return;
    }
    if (error) {
      searchHost.append(errorState({ error, compact: true, onRetry: () => runSearch(query) }));
      return;
    }
    if (!results.length) {
      searchHost.append(
        h("p", { class: "muted", style: "font-size:11.5px" }, query ? "No matches. Try a different spelling or a direct URL." : "Search results appear here. You can also paste a YouTube/Spotify/SoundCloud URL.")
      );
      return;
    }
    for (const track of results) {
      const normalized = readTrack(track) || { title: String(track.title || "Unknown"), author: "", duration: 0 };
      searchHost.append(
        h(
          "div",
          { class: "result-row" },
          artNode(normalized, "result-art"),
          h(
            "div",
            { class: "result-main" },
            h("div", { class: "result-title", title: normalized.title }, normalized.title),
            h("div", { class: "result-sub" }, `${normalized.author}${normalized.duration ? ` · ${fmtClock(toSeconds(normalized.duration))}` : ""}`)
          ),
          h(
            "div",
            { class: "result-actions" },
            button({ label: "Queue", size: "sm", variant: "outline", onClick: () => enqueue(normalized, false) }),
            button({ label: "Play", size: "sm", variant: "primary", onClick: () => enqueue(normalized, true) })
          )
        )
      );
    }
  }

  async function runSearch(query) {
    const trimmed = String(query || "").trim();
    state.search.query = trimmed;
    if (!trimmed) {
      state.search.results = [];
      state.search.error = null;
      state.search.loading = false;
      renderSearch();
      return;
    }
    const seq = ++requestSeq;
    state.search.loading = true;
    state.search.error = null;
    renderSearch();
    try {
      const payload = await endpoints.musicSearch(trimmed);
      if (disposed || seq !== requestSeq) return;
      state.search.results = asList(payload, ["results", "tracks", "data"]).slice(0, 10);
      state.search.loading = false;
    } catch (error) {
      if (disposed || seq !== requestSeq) return;
      state.search.results = [];
      state.search.loading = false;
      state.search.error = error;
    }
    renderSearch();
  }

  async function enqueue(track, playNow) {
    if (!state.music.connected) {
      notify.warning("The bot needs to be in a voice channel first");
      return;
    }
    const query = track.uri || `${track.title} ${track.author || ""}`.trim();
    try {
      await sendControl(playNow ? "play" : "queue", { query, uri: track.uri || undefined, title: track.title });
      notify.success(playNow ? "Playing now" : "Added to queue");
      setTimeout(() => loadState(), 700);
    } catch {
      /* sendControl already surfaced the error */
    }
  }

  function playQuery(query) {
    return enqueue({ title: query, uri: query, author: "" }, true);
  }

  /* ----------------------------- controls ----------------------------- */

  async function sendControl(action, extra = {}, busyKey = action) {
    state.busy = busyKey;
    renderPlayer();
    try {
      const payload = { guild_id: guildId, action, ...extra };
      const response = await endpoints.musicControl(payload);
      if (response?.error) throw new Error(response.error);
      await loadState();
      return response;
    } catch (error) {
      notify.error(error?.message || `Couldn't ${action}`);
      throw error;
    } finally {
      state.busy = "";
      renderPlayer();
    }
  }

  async function stopPlayback() {
    const ok = await ctx.confirm({
      title: "Stop playback?",
      message: "Playback stops, the queue is cleared and the bot leaves the voice channel.",
      confirmLabel: "Stop and leave",
      danger: true,
    });
    if (!ok) return;
    await sendControl("stop").catch(() => {});
  }

  async function clearQueue() {
    const ok = await ctx.confirm({ title: "Clear the queue?", message: "Upcoming tracks are removed. The current track keeps playing.", confirmLabel: "Clear queue", danger: true });
    if (!ok) return;
    await sendControl("clear").catch(() => {});
  }

  async function runFix(fix, message) {
    try {
      const response = await endpoints.musicFix(guildId, fix);
      notify.success(response?.status || message);
      setTimeout(() => loadState(), 800);
    } catch (error) {
      notify.error(error?.message || "Repair failed");
    }
  }

  function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    autoBtn.replaceWith(
      (autoBtn = button({
        label: state.autoRefresh ? "Auto-refresh on" : "Auto-refresh off",
        icon: state.autoRefresh ? "activity" : "pause",
        variant: "outline",
        size: "sm",
        onClick: toggleAutoRefresh,
      }))
    );
    startPolling();
    notify.info(state.autoRefresh ? "Auto-refresh every 6s" : "Auto-refresh paused");
  }

  /* ------------------------------- load ------------------------------- */

  async function loadState(silent = false) {
    if (!silent) state.loading = true;
    try {
      const payload = await endpoints.musicState(guildId);
      if (disposed) return;
      const music = normalizeState(payload);
      if (silent && state.music.current && music.current && lyricKeyFor(music) !== lyricKey()) {
        state.lyrics = { status: "idle", lines: [], error: null, key: "" };
      }
      state.music = music;
      state.error = null;
      state.loading = false;
      renderPlayer();
      renderQueueActions();
      if (state.tab === "queue") renderQueue();
      if (state.tab === "lyrics") ensureLyrics();
    } catch (error) {
      if (disposed) return;
      state.loading = false;
      state.error = error;
      renderPlayer();
    }
  }

  function lyricKeyFor(music) {
    return music.current ? `${music.current.title}::${music.current.author}` : "";
  }

  async function loadHistory(force = false) {
    if (!force && state.history.items.length) return;
    state.history.loading = true;
    if (state.tab === "history") renderTabBody();
    try {
      const payload = await endpoints.musicHistory(guildId, 30);
      state.history = { loading: false, items: asList(payload, ["history", "tracks", "data"]), error: null };
    } catch (error) {
      state.history = { loading: false, items: [], error };
    }
    if (state.tab === "history") renderTabBody();
    renderHistoryCard();
  }

  async function loadTop(force = false) {
    if (!force && state.top.items.length) return;
    state.top.loading = true;
    try {
      const payload = await endpoints.musicTopSongs(guildId);
      state.top = { loading: false, items: asList(payload, ["top", "songs", "data"]), error: null };
    } catch (error) {
      state.top = { loading: false, items: [], error };
    }
    if (state.tab === "top") renderTabBody();
    renderTopCard();
  }

  function renderHistoryCard() {
    clear(extrasHistory);
    extrasHistory.append(
      card({
        title: "Recently played",
        subtitle: "The last tracks in this server.",
        actions: iconButton({ icon: "refresh", label: "Reload history", onClick: () => loadHistory(true) }),
        children: state.history.loading
          ? h("div", { class: "stack-tight" }, skeleton({ h: 16 }), skeleton({ h: 16 }), skeleton({ h: 16 }))
          : state.history.error
            ? errorState({ error: state.history.error, compact: true, onRetry: () => loadHistory(true) })
            : state.history.items.length
              ? h("div", { class: "stack-tight" }, state.history.items.slice(0, 8).map((item) =>
                  h(
                    "div",
                    { class: "list-row" },
                    h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, item.title || "Unknown"), h("div", { class: "list-row-sub" }, `${item.author || item.artist || "Unknown"}${item.played_at ? ` · ${fmtRelative(item.played_at)}` : ""}`)),
                    button({ label: "Play", size: "sm", variant: "ghost", onClick: () => playQuery(item.uri || `${item.title} ${item.author || ""}`) })
                  )
                ))
              : emptyState({ icon: "history", title: "Nothing played yet", compact: true }),
      })
    );
  }

  function renderTopCard() {
    clear(extrasTop);
    extrasTop.append(
      card({
        title: "Most played",
        subtitle: "All-time favourites in this server.",
        actions: iconButton({ icon: "refresh", label: "Reload chart", onClick: () => loadTop(true) }),
        children: state.top.loading
          ? h("div", { class: "stack-tight" }, skeleton({ h: 16 }), skeleton({ h: 16 }), skeleton({ h: 16 }))
          : state.top.error
            ? errorState({ error: state.top.error, compact: true, onRetry: () => loadTop(true) })
            : state.top.items.length
              ? h("div", { class: "stack-tight" }, state.top.items.slice(0, 8).map((item, index) =>
                  h(
                    "div",
                    { class: "list-row" },
                    h("span", { class: "queue-index" }, `#${index + 1}`),
                    h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, item.title || "Unknown"), h("div", { class: "list-row-sub" }, `${item.artist || "Unknown"} · ${plural(item.plays || 0, "play")}`)),
                    button({ label: "Play", size: "sm", variant: "ghost", onClick: () => playQuery(item.url || item.uri || `${item.title} ${item.artist || ""}`) })
                  )
                ))
              : emptyState({ icon: "chart", title: "No plays recorded", compact: true }),
      })
    );
  }

  async function loadAll(manual = false) {
    if (manual) refreshBtn.classList.add("is-loading");
    await Promise.all([
      loadState(!manual),
      loadPlaylists(),
      loadHistory(true),
      loadTop(true),
    ]).catch((error) => {
      if (!disposed) notify.error(error?.message || "Couldn't load music data");
    });
    mountTabs();
    renderTabBody();
    renderSearch();
    renderPlaylists();
    if (manual) refreshBtn.classList.remove("is-loading");
  }

  /* ------------------------------ polling ------------------------------ */

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
    if (!state.autoRefresh) return;
    pollTimer = setInterval(() => {
      if (disposed || document.visibilityState === "hidden") return;
      if (state.busy) return;
      loadState(true);
    }, 6000);
  }

  const onVisibility = () => {
    if (document.visibilityState === "visible" && state.autoRefresh) loadState(true);
  };
  document.addEventListener("visibilitychange", onVisibility);

  on(searchInput, "input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value), 420);
  });
  on(searchInput, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(searchTimer);
      const value = searchInput.value.trim();
      if (!value) return;
      if (/^https?:\/\//i.test(value)) enqueue({ title: value, uri: value, author: "" }, false);
      else runSearch(value);
    }
  });

  /* -------------------------------- boot -------------------------------- */

  renderPlayer();
  mountTabs();
  renderQueueActions();
  renderQueue();
  renderPlaylists();
  renderSearch();
  renderHistoryCard();
  renderTopCard();

  await loadAll();
  startPolling();

  return () => {
    disposed = true;
    clearInterval(pollTimer);
    clearTimeout(searchTimer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/* A tiny modal-based text prompt built on the shared modal styles. We avoid
 * window.prompt because browsers may block it and it can't be styled. */
function promptDialog(title, label, initial, confirmLabel = "Save") {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    };
    const input = h("input", { class: "input", value: initial || "", maxlength: "100", "aria-label": label });
    const overlay = h(
      "div",
      { class: "overlay", role: "dialog", "aria-modal": "true", "aria-label": title },
      h(
        "div",
        { class: "modal", style: "max-width:420px" },
        h("div", { class: "modal-head" }, h("h2", null, title), iconButton({ icon: "x", label: "Close", onClick: () => finish(null) })),
        h("div", { class: "modal-body" }, h("label", { class: "field" }, h("span", { class: "field-label" }, label), input)),
        h(
          "div",
          { class: "modal-foot" },
          button({ label: "Cancel", variant: "ghost", onClick: () => finish(null) }),
          button({ label: confirmLabel, variant: "primary", onClick: () => finish(input.value.trim() || null) })
        )
      )
    );
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish(null);
      if (event.key === "Enter") {
        event.preventDefault();
        finish(input.value.trim() || null);
      }
    });
    document.body.append(overlay);
    requestAnimationFrame(() => input.focus());
  });
}
