/* Rift Music Room — lightweight server-music player.
 * Icons below are Lucide (ISC license, https://lucide.dev), inlined to avoid
 * an extra download and extra rendering work. Same icon set the dashboard uses.
 */
"use strict";

const API_BASE = (window.RIFT_API_BASE || "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api").replace(/\/$/, "");
const TOKEN_KEY = "rift_dashboard_token";
const LRCLIB = "https://lrclib.net";

const POLL_STATE_MS = 8000;
const POLL_STATE_MAX_MS = 30000;
const POLL_HISTORY_MS = 60000;
const POLL_PLAYLIST_MS = 120000;
const POLL_VOICE_MS = 45000;
const TICK_MS = 1000;
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_LIMIT = 8;
const REQUEST_TIMEOUT_MS = 12000;

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>',
  next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  repeat1: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  list: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};

function icon(name, filled) {
  const body = ICONS[name] || ICONS.music;
  if (filled) {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true">${body}</svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(String(value), window.location.href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

function objectText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  return String(value.name ?? value.text ?? value["#text"] ?? value.title ?? "");
}

function listFrom(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys || []) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (payload?.data && typeof payload.data === "object" && payload.data !== payload) return listFrom(payload.data, keys);
  return [];
}

/* Accepts the backend's track shapes (Lavalink-style, plain, iTunes-mapped). */
function normalizeTrack(track) {
  track = track || {};
  const info = track.info && typeof track.info === "object" ? track.info : {};
  const title = objectText(track.title ?? info.title ?? track.name ?? track.trackName ?? track["#text"]) || "Unknown track";
  const artist = objectText(track.artist ?? info.author ?? track.author ?? track.artistName ?? track.uploader) || "Unknown artist";
  const raw = Number(track.duration_ms ?? track.duration ?? track.length ?? track.trackTimeMillis ?? info.length ?? info.duration ?? 0);
  const durationMs = raw > 0 && raw < 1000 ? raw * 1000 : raw;
  const urlUri = /^https:\/\//i.test(String(track.url || "")) && !/(?:itunes|music)\.apple\.com/i.test(String(track.url)) ? String(track.url) : "";
  const uri = String(track.uri ?? track.identifier ?? info.uri ?? info.url ?? urlUri ?? "");
  const id = String(track.id ?? track.encoded ?? track.track ?? info.identifier ?? track.trackId ?? uri ?? `${title}-${artist}`);
  const query = objectText(track.query) || uri || id || `${title} ${artist}`;
  return {
    id, uri,
    title, artist,
    album: objectText(track.album ?? info.albumName ?? info.album ?? track.collectionName),
    artwork: safeUrl(track.artwork ?? track.thumbnail ?? track.image ?? track.album_art ?? track.artworkUrl ?? info.artworkUrl ?? track.artworkUrl100),
    url: safeUrl(track.url ?? info.uri ?? track.trackViewUrl),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
    query,
  };
}

function fmtTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

function voicePresenceFrom(payload, fallbackGuildId, fallbackGuildName) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const nested = data?.voice_state ?? data?.voiceState ?? data?.voice ?? data?.voice_channel ?? data?.channel ?? data;
  const channelId = String(nested?.channel_id ?? nested?.channelId ?? nested?.id ?? data?.channel_id ?? data?.voice_channel_id ?? "");
  const inVoice = Boolean(data?.in_voice ?? data?.inVoice ?? data?.voice_connected ?? data?.connected ?? nested?.in_voice ?? channelId);
  if (!inVoice || !channelId) return null;
  return {
    guildId: String(data?.guild_id ?? data?.guildId ?? fallbackGuildId),
    guildName: objectText(data?.guild_name ?? data?.guildName ?? fallbackGuildName) || "your server",
    channelId,
    channelName: objectText(nested?.channel_name ?? nested?.channelName ?? nested?.name ?? data?.channel_name) || "Voice channel",
  };
}

/* Line-level LRC only. Word timings are parsed out; we highlight whole lines. */
function parseLrc(input) {
  const rows = [];
  const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const toSeconds = (min, sec, frac) => {
    let f = Number(`0.${String(frac || "0").padEnd(3, "0")}`);
    if (!Number.isFinite(f)) f = 0;
    return Number(min) * 60 + Number(sec) + f;
  };
  for (const rawLine of String(input || "").split(/\r?\n/)) {
    const stamps = [...rawLine.matchAll(stamp)];
    if (!stamps.length) continue;
    const text = rawLine.replace(stamp, "").replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, "").trim();
    if (!text) continue;
    for (const m of stamps) rows.push({ time: toSeconds(m[1], m[2], m[3]), text });
  }
  rows.sort((a, b) => a.time - b.time);
  return rows;
}

/* Plain GET with a timeout and no custom headers (avoids CORS preflight). */
async function plainGet(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(String(url), { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function request(path, options) {
  options = options || {};
  let url = `${API_BASE}${path}`;
  if (options.params) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== "") sp.set(key, String(value));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, options.timeout || REQUEST_TIMEOUT_MS);
  const outer = options.signal;
  const onOuterAbort = () => ctrl.abort();
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }
  try {
    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(options.body);
    }
    const res = await fetch(url, { method: options.method || "GET", headers, body: payload, signal: ctrl.signal });
    let data = null;
    try { data = await res.json(); } catch { /* empty body is fine */ }
    if (!res.ok) {
      const error = new Error(data?.error || data?.message || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  } catch (err) {
    if (err && err.name === "AbortError" && !outer?.aborted) {
      const error = new Error(timedOut ? "The music server did not respond." : "Request cancelled.");
      error.status = 0;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener("abort", onOuterAbort);
  }
}

/* ---------- Lyrics: backend first, LRCLIB direct as fallback ---------- */

const lyricsCache = new Map();

function lyricsKey(track) {
  const bucket = Math.round((track.durationMs || 0) / 5000);
  return `${track.title}|||${track.artist}|||${bucket}`.toLowerCase();
}

function lyricsFromPayload(syncedText, plainText, instrumental) {
  const synced = parseLrc(syncedText || "");
  const plain = String(plainText || "").trim();
  if (synced.length) return { status: "synced", synced, plain };
  if (instrumental) return { status: "instrumental", synced: [], plain };
  if (plain) return { status: "plain", synced: [], plain };
  return { status: "missing", synced: [], plain: "" };
}

async function lyricsViaBackend(track, guildId, signal) {
  const result = await request("/music/lyrics", {
    params: {
      title: track.title,
      artist: track.artist,
      album: track.album || undefined,
      duration: track.durationMs ? Math.round(track.durationMs / 1000) : undefined,
      track_id: track.uri || track.id,
      guild_id: guildId,
    },
    timeout: 8000,
    signal,
  });
  if (!result) return null;
  const syncedText = result.enhanced_lrc || result.synced_lyrics || result.syncedLyrics || "";
  const plainText = result.plain_lyrics || result.plainLyrics || "";
  const instrumental = Boolean(result.instrumental);
  const parsed = lyricsFromPayload(syncedText, plainText, instrumental);
  return parsed.status === "missing" ? null : parsed;
}

async function lyricsViaLrclib(track) {
  // Precise lookup first.
  try {
    const get = new URL(`${LRCLIB}/api/get`);
    get.searchParams.set("artist_name", track.artist);
    get.searchParams.set("track_name", track.title);
    if (track.album) get.searchParams.set("album_name", track.album);
    if (track.durationMs) get.searchParams.set("duration", String(Math.round(track.durationMs / 1000)));
    const hit = await plainGet(get, 8000);
    if (hit && (hit.syncedLyrics || hit.plainLyrics || hit.instrumental)) {
      return lyricsFromPayload(hit.syncedLyrics || "", hit.plainLyrics || "", hit.instrumental);
    }
  } catch { /* fall through to search */ }
  // Fuzzy search fallback.
  const search = new URL(`${LRCLIB}/api/search`);
  search.searchParams.set("q", `${track.title} ${track.artist}`.slice(0, 160));
  const hits = await plainGet(search, 8000);
  if (!Array.isArray(hits) || !hits.length) return { status: "missing", synced: [], plain: "" };
  const withSync = hits.find((h) => h && h.syncedLyrics);
  const best = withSync || hits[0];
  return lyricsFromPayload(best.syncedLyrics || "", best.plainLyrics || "", best.instrumental);
}

async function fetchLyrics(track, guildId, signal) {
  const key = lyricsKey(track);
  if (lyricsCache.has(key)) return lyricsCache.get(key);
  try {
    const saved = sessionStorage.getItem(`rift_lyrics:${key}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.status) { lyricsCache.set(key, parsed); return parsed; }
    }
  } catch { /* private mode */ }
  let result = null;
  try {
    result = await lyricsViaBackend(track, guildId, signal);
  } catch { result = null; }
  if (!result && !signal?.aborted) {
    try { result = await lyricsViaLrclib(track); }
    catch { result = { status: "missing", synced: [], plain: "" }; }
  }
  result = result || { status: "missing", synced: [], plain: "" };
  lyricsCache.set(key, result);
  if (lyricsCache.size > 60) lyricsCache.delete(lyricsCache.keys().next().value);
  try { sessionStorage.setItem(`rift_lyrics:${key}`, JSON.stringify(result)); } catch { /* quota */ }
  return result;
}

/* ---------- Search fallback (iTunes catalog, backend query still plays it) ---------- */

async function catalogSearch(query, limit) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(limit));
  const json = await plainGet(url, 8000);
  return (json?.results || []).slice(0, limit).map((raw) => normalizeTrack({
    id: `itunes-${raw.trackId ?? raw.collectionId ?? raw.trackName}`,
    title: raw.trackName || raw.collectionName,
    artist: raw.artistName,
    album: raw.collectionName,
    artwork: raw.artworkUrl100,
    duration_ms: raw.trackTimeMillis,
    query: `${raw.trackName || ""} ${raw.artistName || ""}`.trim(),
  }));
}

/* ============================== MusicRoom ============================== */

class MusicRoom {
  constructor(root, guildId) {
    this.root = root;
    this.guildId = String(guildId);
    this.titleBefore = document.title;
    this.userId = "";
    this.track = null;
    this.queueList = [];
    this.paused = true;
    this.shuffle = false;
    this.loop = 0;
    this.volume = 70;
    this.position = 0;
    this.positionAt = Date.now();
    this.connected = false;
    this.channelName = "";
    this.online = false;
    this.history = [];
    this.playlists = [];
    this.playlistRevision = 0;
    this.localPlaylists = this.readLocal();
    this.channels = [];
    this.voice = null;
    this.searchResults = [];
    this.searchText = "";
    this.searchState = "idle"; // idle | busy | error
    this.searchError = "";
    this.lyrics = { status: "idle", synced: [], plain: "" };
    this.lyricsKey = "";
    this.lyricIndex = -1;
    this.previewTrack = null;
    this.seeking = false;
    this.pollDelay = POLL_STATE_MS;
    this.lastStateAt = 0;
    this.controlBusy = false;
    this.positionPushAt = 0;
    this.disposed = false;
    this.ac = new AbortController();
    this.timers = [];
    this.rowSig = { search: "", queue: "", history: "", playlists: "" };

    this.renderSkeleton();
    this.cacheRefs();
    this.bindEvents();
    this.bindAudio();
    this.bindMediaSession();
    this.boot();
  }

  /* ----- setup ----- */

  serverName() {
    return document.querySelector("aside img + span")?.textContent?.trim() || "This server";
  }

  readLocal() {
    try {
      return JSON.parse(localStorage.getItem(`rift_music_playlists:${this.guildId}`) || "[]");
    } catch {
      return [];
    }
  }

  saveLocal() {
    try { localStorage.setItem(`rift_music_playlists:${this.guildId}`, JSON.stringify(this.localPlaylists)); } catch { /* quota */ }
  }

  renderSkeleton() {
    this.root.innerHTML = `
    <div class="mr-wrap">
      <div class="mr-toast" id="mrToast" role="status" aria-live="polite"></div>
      <header class="mr-head">
        <div>
          <h1>Music</h1>
          <p class="mr-sub">${esc(this.serverName())}</p>
        </div>
        <div class="mr-head-right">
          <span class="mr-status" id="mrStatus"><i></i><span>Connecting…</span></span>
          <button class="mr-btn" id="mrRetry" data-act="retry" hidden>Retry</button>
        </div>
      </header>

      <div class="mr-voice" id="mrVoice">
        <span class="mr-dot" id="mrVoiceDot"></span>
        <span class="mr-voice-state" id="mrVoiceState">Not connected</span>
        <span class="mr-voice-hint" id="mrVoiceHint" hidden></span>
        <button class="mr-btn" id="mrVoiceJoin" data-act="voice-join" hidden>Join</button>
        <span class="mr-voice-spacer"></span>
        <select id="mrVoiceSelect" aria-label="Voice channel"><option value="">Select channel</option></select>
        <button class="mr-btn" id="mrVoiceConnect" data-act="voice-connect">Connect</button>
      </div>

      <div class="mr-top">
        <section class="mr-card" aria-label="Player">
          <div class="mr-card-h"><span class="mr-label">Now playing</span></div>
          <div class="mr-now">
            <div class="mr-art"><span class="mr-art-fallback" id="mrArtFb">${icon("list")}</span><img id="mrArt" alt="" hidden></div>
            <div class="mr-meta">
              <div class="mr-title" id="mrTitle">Nothing playing</div>
              <div class="mr-artist" id="mrArtist">Search below to start.</div>
            </div>
          </div>
          <div class="mr-prog">
            <span id="mrCur">0:00</span>
            <input class="mr-range" id="mrSeek" type="range" min="0" max="1" step="1" value="0" aria-label="Seek" disabled>
            <span id="mrTot">0:00</span>
          </div>
          <div class="mr-transport">
            <button class="mr-icon-btn" data-act="shuffle" id="mrShuffle" title="Shuffle" aria-label="Shuffle">${icon("shuffle")}</button>
            <button class="mr-icon-btn" data-act="prev" title="Previous" aria-label="Previous">${icon("prev")}</button>
            <button class="mr-play" data-act="toggle" id="mrPlay" title="Play" aria-label="Play">${icon("play", true)}</button>
            <button class="mr-icon-btn" data-act="next" title="Next" aria-label="Next">${icon("next")}</button>
            <button class="mr-icon-btn" data-act="repeat" id="mrRepeat" title="Repeat: off" aria-label="Repeat">${icon("repeat")}</button>
            <button class="mr-icon-btn" data-act="stop" title="Stop" aria-label="Stop">${icon("stop")}</button>
          </div>
          <div class="mr-vol">${icon("volume")}<input class="mr-range" id="mrVol" type="range" min="0" max="100" step="1" value="70" aria-label="Volume"><span id="mrVolVal">70%</span></div>
          <div class="mr-preview" id="mrPreview" hidden>
            <div class="mr-preview-top"><span class="mr-label" id="mrPreviewLabel">Preview</span><button class="mr-icon-btn" data-act="preview-close" aria-label="Close preview">${icon("x")}</button></div>
            <audio id="mrAudio" controls preload="none" playsinline></audio>
          </div>
        </section>

        <section class="mr-card mr-lyrics-card" aria-label="Lyrics">
          <div class="mr-card-h"><span class="mr-label">Lyrics</span><span class="mr-badge" id="mrLyrBadge">—</span></div>
          <div class="mr-lyr-track" id="mrLyrTrack">Nothing playing</div>
          <div class="mr-lyr" id="mrLyr"></div>
          <div class="mr-note">Source: LRCLIB</div>
        </section>
      </div>

      <div class="mr-cols">
        <section class="mr-card" aria-label="Search">
          <div class="mr-card-h"><span class="mr-label">Search</span></div>
          <div class="mr-searchbox">${icon("search")}<input id="mrSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Song or artist" aria-label="Search music"><button class="mr-icon-btn" data-act="search-clear" id="mrSearchClear" aria-label="Clear search" hidden>${icon("x")}</button></div>
          <div class="mr-results" id="mrResults"><div class="mr-state">Type at least 2 characters.</div></div>
        </section>
        <section class="mr-card" aria-label="Queue">
          <div class="mr-card-h"><span class="mr-label">Queue <span id="mrQCount"></span></span><button class="mr-link-btn" data-act="queue-clear" id="mrQClear">Clear</button></div>
          <div id="mrQueue"><div class="mr-empty">Queue is empty.</div></div>
        </section>
      </div>

      <div class="mr-cols">
        <section class="mr-card" aria-label="Playlists">
          <div class="mr-card-h"><span class="mr-label">Playlists</span><button class="mr-link-btn" data-act="pl-new">New</button></div>
          <div id="mrPlaylists"><div class="mr-empty">No playlists yet.</div></div>
        </section>
        <section class="mr-card" aria-label="History">
          <div class="mr-card-h"><span class="mr-label">History</span></div>
          <div id="mrHistory"><div class="mr-empty">No history yet.</div></div>
        </section>
      </div>

      <footer class="mr-foot">Playback runs on the server bot. Previews play 30 seconds in this browser.</footer>

      <div class="mr-modal-bg" id="mrModalBg" hidden>
        <form class="mr-modal" id="mrModalForm">
          <h2>New playlist</h2>
          <p id="mrPlInfo"></p>
          <input id="mrPlName" maxlength="64" placeholder="Name" required autocomplete="off">
          <div class="mr-modal-foot">
            <button type="button" class="mr-btn" data-act="pl-cancel">Cancel</button>
            <button type="submit" class="mr-btn primary">Save</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  cacheRefs() {
    const q = (id) => this.root.querySelector(id);
    this.el = {
      toast: q("#mrToast"), status: q("#mrStatus"), retry: q("#mrRetry"),
      voiceDot: q("#mrVoiceDot"), voiceState: q("#mrVoiceState"), voiceHint: q("#mrVoiceHint"),
      voiceJoin: q("#mrVoiceJoin"), voiceSelect: q("#mrVoiceSelect"), voiceConnect: q("#mrVoiceConnect"),
      art: q("#mrArt"), artFb: q("#mrArtFb"), title: q("#mrTitle"), artist: q("#mrArtist"),
      cur: q("#mrCur"), tot: q("#mrTot"), seek: q("#mrSeek"),
      play: q("#mrPlay"), shuffle: q("#mrShuffle"), repeat: q("#mrRepeat"),
      vol: q("#mrVol"), volVal: q("#mrVolVal"),
      preview: q("#mrPreview"), previewLabel: q("#mrPreviewLabel"), audio: q("#mrAudio"),
      lyrBadge: q("#mrLyrBadge"), lyrTrack: q("#mrLyrTrack"), lyr: q("#mrLyr"),
      search: q("#mrSearch"), searchClear: q("#mrSearchClear"), results: q("#mrResults"),
      queue: q("#mrQueue"), qCount: q("#mrQCount"), qClear: q("#mrQClear"),
      playlists: q("#mrPlaylists"), history: q("#mrHistory"),
      modalBg: q("#mrModalBg"), modalForm: q("#mrModalForm"), plName: q("#mrPlName"), plInfo: q("#mrPlInfo"),
    };
  }

  later(fn, ms) {
    const id = setTimeout(() => { if (!this.disposed) fn(); }, ms);
    this.timers.push(id);
    return id;
  }

  every(fn, ms) {
    const id = setInterval(() => { if (!this.disposed && !document.hidden) fn(); }, ms);
    this.timers.push(id);
    return id;
  }

  bindEvents() {
    const s = this.ac.signal;
    this.root.addEventListener("click", (e) => this.onClick(e), { signal: s });
    this.root.addEventListener("input", (e) => this.onInput(e), { signal: s });
    this.root.addEventListener("change", (e) => this.onChange(e), { signal: s });
    this.el.modalForm.addEventListener("submit", (e) => { e.preventDefault(); this.savePlaylist(); }, { signal: s });
    document.addEventListener("keydown", (e) => {
      if (this.disposed) return;
      if (e.key === "Escape" && !this.el.modalBg.hidden) this.closeModal();
      else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        this.el.search.focus();
      }
    }, { signal: s });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !this.disposed && Date.now() - this.lastStateAt > 5000) this.refreshState();
    }, { signal: s });
  }

  bindAudio() {
    const a = this.el.audio;
    a.addEventListener("play", () => { this.pushMedia(); });
    a.addEventListener("pause", () => { this.pushMedia(); });
    a.addEventListener("ended", () => { this.closePreview(); this.pushMedia(); });
    a.addEventListener("error", () => {
      if (this.previewTrack) this.toast("This preview could not be played.", true);
    });
  }

  /* ----- boot ----- */

  boot() {
    this.syncMediaMeta();
    this.pushMedia();
    this.refreshState();
    this.loadChannels();
    this.refreshHistory();
    this.loadAccount().then(() => {
      if (this.disposed || !this.userId) return;
      this.refreshPlaylists();
      this.checkVoice();
      this.every(() => this.refreshPlaylists(), POLL_PLAYLIST_MS);
      this.every(() => this.checkVoice(), POLL_VOICE_MS);
    });
    this.every(() => this.refreshHistory(), POLL_HISTORY_MS);
    this.every(() => this.tick(), TICK_MS);
  }

  /* ----- data ----- */

  scheduleStatePoll() {
    clearTimeout(this.stateTimer);
    this.stateTimer = setTimeout(() => { if (!this.disposed) this.refreshState(); }, this.pollDelay);
    this.timers.push(this.stateTimer);
  }

  async refreshState() {
    if (this.disposed || document.hidden) { this.scheduleStatePoll(); return; }
    try {
      const state = await request(`/music/state/${encodeURIComponent(this.guildId)}`);
      if (this.disposed) return;
      this.applyState(state || {});
      this.online = true;
      this.pollDelay = POLL_STATE_MS;
      this.setStatus(true);
      this.lastStateAt = Date.now();
    } catch {
      if (this.disposed) return;
      this.online = false;
      this.setStatus(false);
      this.pollDelay = Math.min(Math.round(this.pollDelay * 1.5), POLL_STATE_MAX_MS);
    }
    this.scheduleStatePoll();
  }

  readPositionSeconds(state, durationMs) {
    const explicit =
      state.position_ms ?? state.positionMs ?? state.position_seconds ?? state.positionSeconds;
    if (explicit !== undefined && explicit !== null && explicit !== "") {
      const n = Number(explicit);
      if (Number.isFinite(n)) {
        if (state.position_ms !== undefined || state.positionMs !== undefined) return Math.max(0, n / 1000);
        return Math.max(0, n);
      }
    }
    const generic = Number(state.position);
    if (Number.isFinite(generic) && generic > 0) {
      // Some servers send ms here; detect by comparing with duration.
      const durS = durationMs / 1000;
      if (durS > 0 && generic > durS * 2) return generic / 1000;
      return generic;
    }
    return 0;
  }

  applyState(state) {
    const raw = state.current ?? state.now_playing ?? state.track ?? null;
    const hasTrack = raw && (raw.title || raw.name || raw.trackName || raw.info?.title);
    const next = hasTrack ? normalizeTrack(raw) : null;
    const trackChanged = (next?.id || "") + (next?.title || "") !== (this.track?.id || "") + (this.track?.title || "");

    this.track = next;
    this.queueList = listFrom(state, ["queue", "tracks_in_queue", "up_next"]).map(normalizeTrack);
    this.paused = !next || Boolean(state.paused ?? state.is_paused ?? false);
    this.shuffle = Boolean(state.shuffle ?? state.modes?.shuffle ?? false);
    this.loop = Number(state.loop ?? state.modes?.loop ?? 0) || 0;

    const volRaw = state.volume ?? state.player_volume;
    if (volRaw !== null && volRaw !== undefined && volRaw !== "") {
      let v = Number(volRaw);
      if (Number.isFinite(v)) {
        if (v >= 0 && v <= 1) v *= 100;
        this.volume = Math.max(0, Math.min(100, Math.round(v)));
      }
    }

    this.position = this.readPositionSeconds(state, next?.durationMs || 0);
    this.positionAt = Date.now();

    const channel = objectText(state.voice_channel_name || state.channel_name || state.voice_channel || state.channel?.name);
    this.connected = Boolean(state.connected ?? state.voice_connected ?? state.in_voice ?? channel);
    this.channelName = channel;

    this.updatePlayer();
    this.updateVoice();
    this.updateQueue();
    if (trackChanged) {
      this.onTrackChange();
    } else {
      this.tickProgress();
      if (this.paused !== wasPaused) this.pushMedia();
    }
  }

  onTrackChange() {
    this.syncMediaMeta();
    this.pushMedia();
    this.tickProgress();
    const key = this.track ? lyricsKey(this.track) : "";
    if (key !== this.lyricsKey) {
      this.lyricsKey = key;
      this.lyrics = { status: this.track ? "loading" : "idle", synced: [], plain: "" };
      this.lyricIndex = -1;
      this.renderLyrics();
      if (this.track) {
        const wanted = key;
        if (this.lyricsCtrl) this.lyricsCtrl.abort();
        this.lyricsCtrl = new AbortController();
        fetchLyrics(this.track, this.guildId, this.lyricsCtrl.signal).then((result) => {
          if (this.disposed || wanted !== this.lyricsKey) return;
          this.lyrics = result;
          this.lyricIndex = -1;
          this.renderLyrics();
          this.tickLyrics();
        }).catch(() => {
          if (this.disposed || wanted !== this.lyricsKey) return;
          this.lyrics = { status: "missing", synced: [], plain: "" };
          this.renderLyrics();
        });
      }
    }
  }

  botPosition() {
    const playing = this.track && !this.paused;
    return Math.max(0, this.position + (playing ? (Date.now() - this.positionAt) / 1000 : 0));
  }

  activePosition() {
    if (this.previewTrack && this.el.audio && !this.el.audio.paused) return this.el.audio.currentTime || 0;
    return this.botPosition();
  }

  async loadChannels() {
    try {
      const result = await request(`/guild/${encodeURIComponent(this.guildId)}/info`);
      this.channels = listFrom(result, ["channels"]).filter((ch) =>
        String(ch.type) === "2" || ch.type === "voice" || ch.type === "GUILD_VOICE" || ch.kind === "voice");
      const sel = this.el.voiceSelect;
      const prev = sel.value;
      sel.innerHTML = `<option value="">Select channel</option>` + this.channels.map((ch) =>
        `<option value="${esc(ch.id)}">${esc(ch.name || "Voice channel")}</option>`).join("");
      if (prev) sel.value = prev;
    } catch { /* voice select stays empty; controls still work */ }
  }

  async loadAccount() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return;
      const user = await res.json();
      this.userId = String(user?.id || "");
    } catch { /* playlists and voice hints stay local-only */ }
  }

  async refreshHistory() {
    try {
      const result = await request(`/music/history/${encodeURIComponent(this.guildId)}`, { params: { limit: 12 } });
      this.history = listFrom(result, ["history", "tracks", "items"]).map(normalizeTrack).slice(0, 12);
      this.updateHistory();
    } catch { /* keep last history */ }
  }

  async refreshPlaylists() {
    if (!this.userId || this.disposed) return;
    try {
      const result = await request(`/playlists/${encodeURIComponent(this.userId)}`);
      const next = listFrom(result, ["playlists", "items", "data"]).map((pl) => ({
        ...pl,
        tracks: (pl.tracks || []).map(normalizeTrack),
      }));
      const rev = Number(result?.revision ?? result?.playlist_revision ?? result?.meta?.revision ?? result?.data?.revision);
      if (Number.isFinite(rev) && rev >= 0) this.playlistRevision = rev;
      this.playlists = next;
      this.updatePlaylists();
    } catch { /* keep last library */ }
  }

  async checkVoice() {
    if (!this.userId || this.disposed) return;
    try {
      const voice = await request(`/user/voice/${encodeURIComponent(this.guildId)}/${encodeURIComponent(this.userId)}`);
      this.voice = voicePresenceFrom(voice, this.guildId, this.serverName());
    } catch {
      this.voice = null;
    }
    this.updateVoice();
  }

  allPlaylists() {
    const seen = new Set(this.playlists.map((p) => String(p.name || p.id || "").toLowerCase()));
    const local = this.localPlaylists.filter((p) => !seen.has(String(p.name || p.id || "").toLowerCase()));
    return [...this.playlists.map((p) => ({ ...p, localOnly: false })), ...local.map((p) => ({ ...p, localOnly: true }))];
  }

  /* ----- controls ----- */

  async control(action, value, extra) {
    this.controlBusy = true;
    try {
      const body = { guild_id: this.guildId, action, ...(value !== undefined ? { value } : {}), ...(extra || {}) };
      await request("/music/control", { method: "POST", body });
      return true;
    } catch (err) {
      this.toast(err.message || "Could not reach the music server.", true);
      return false;
    } finally {
      this.controlBusy = false;
    }
  }

  async refreshSoon(ms) {
    await new Promise((r) => setTimeout(r, ms || 400));
    if (!this.disposed) this.refreshStateNow();
  }

  async refreshStateNow() {
    clearTimeout(this.stateTimer);
    this.pollDelay = POLL_STATE_MS;
    try {
      const state = await request(`/music/state/${encodeURIComponent(this.guildId)}`);
      if (this.disposed) return;
      this.applyState(state || {});
      this.online = true;
      this.setStatus(true);
      this.lastStateAt = Date.now();
    } catch {
      this.online = false;
      this.setStatus(false);
    }
    this.scheduleStatePoll();
  }

  async toggle() {
    if (!this.track) {
      if (this.queueList.length) {
        const next = this.queueList[0];
        const ok = await this.control("play", next.query, { track: next.uri || next.query, query: next.query });
        if (ok) this.refreshSoon();
      } else {
        this.toast("Search for a song to start playback.");
      }
      return;
    }
    // Optimistic flip so the button feels instant.
    this.paused = !this.paused;
    this.positionAt = Date.now();
    this.updatePlayer();
    this.pushMedia();
    const ok = await this.control("toggle");
    if (ok) this.refreshSoon(600);
    else { this.paused = !this.paused; this.updatePlayer(); this.pushMedia(); }
  }

  async playTrack(track) {
    const item = normalizeTrack(track);
    const ok = await this.control("play", item.query, { track: item.uri || item.query, query: item.query });
    if (ok) { this.toast(`Playing ${item.title}.`); this.refreshSoon(); }
  }

  async queueTrack(track) {
    const item = normalizeTrack(track);
    const ok = await this.control("queue", undefined, { track: item.uri || item.query });
    if (ok) { this.toast(`Queued ${item.title}.`); this.refreshSoon(); }
  }

  async playPreview(track) {
    const item = normalizeTrack(track);
    let previewUrl = "";
    try {
      const result = await request("/music/stream", {
        params: { title: item.title, artist: item.artist, track_id: item.uri || item.id, guild_id: this.guildId },
      });
      const payload = result?.data && typeof result.data === "object" ? result.data : result;
      previewUrl = safeUrl(payload?.preview_url || payload?.previewUrl || payload?.stream_url || payload?.url || payload?.preview);
    } catch { /* handled below */ }
    if (!previewUrl) {
      this.toast("No preview for this song. Play it on the server instead.", true);
      return;
    }
    this.previewTrack = { ...item, previewUrl };
    this.el.previewLabel.textContent = `Preview · ${item.title} — ${item.artist}`;
    this.el.preview.hidden = false;
    const a = this.el.audio;
    a.src = previewUrl;
    a.load();
    try {
      await a.play();
      this.syncMediaMeta();
      this.pushMedia();
    } catch {
      this.toast("The browser blocked playback. Press play on the preview player.");
    }
  }

  closePreview() {
    this.previewTrack = null;
    const a = this.el.audio;
    a.pause();
    a.removeAttribute("src");
    a.load();
    this.el.preview.hidden = true;
    this.syncMediaMeta();
    this.pushMedia();
  }

  /* Playlists: remote endpoint first, sequential queue as fallback. */

  async playPlaylist(playlist) {
    const tracks = (playlist.tracks || []).map(normalizeTrack).filter((t) => t.query);
    if (!tracks.length) { this.toast("This playlist has no songs.", true); return; }
    if (!playlist.localOnly && this.userId) {
      try {
        await request(`/playlists/${encodeURIComponent(this.userId)}/play`, {
          method: "POST",
          body: { guild_id: this.guildId, playlist_id: playlist.id, name: playlist.name },
        });
        this.toast(`Playing ${playlist.name}.`);
        this.refreshSoon(600);
        return;
      } catch { /* fall through to sequential start */ }
    }
    const first = tracks[0];
    const ok = await this.control("play", first.query, { track: first.uri || first.query, query: first.query });
    if (!ok) return;
    let added = 0;
    for (const track of tracks.slice(1, 15)) {
      try {
        await request("/music/control", {
          method: "POST",
          body: { guild_id: this.guildId, action: "queue", track: track.uri || track.query },
        });
        added++;
      } catch { break; }
    }
    this.toast(added > 0 ? `Playing ${playlist.name} (${added + 1} songs queued).` : `Playing ${playlist.name}.`);
    this.refreshSoon(600);
  }

  openModal() {
    const tracks = [this.track, ...this.queueList].filter(Boolean);
    this.el.plInfo.textContent = tracks.length ? `${tracks.length} song${tracks.length === 1 ? "" : "s"} from the current queue.` : "The queue is empty.";
    this.el.plName.value = "";
    this.el.modalBg.hidden = false;
    this.el.plName.focus();
  }

  closeModal() {
    this.el.modalBg.hidden = true;
  }

  async savePlaylist() {
    const name = this.el.plName.value.trim().slice(0, 64);
    if (!name) { this.toast("Enter a name first.", true); return; }
    const tracks = [this.track, ...this.queueList].filter(Boolean);
    if (!tracks.length) { this.toast("Nothing to save. Queue is empty.", true); return; }
    const playlist = {
      id: (window.crypto?.randomUUID && window.crypto.randomUUID()) || `pl-${Date.now()}`,
      name,
      tracks,
      track_count: tracks.length,
      created_at: new Date().toISOString(),
    };
    let synced = false;
    let syncError = "";
    if (this.userId) {
      const body = {
        revision: this.playlistRevision,
        playlist: {
          id: playlist.id,
          name,
          tracks: tracks.map((t) => ({
            id: t.id, uri: t.uri || undefined, query: t.query,
            title: t.title, artist: t.artist, album: t.album || undefined,
            artwork: t.artwork || undefined, duration_ms: t.durationMs || undefined,
          })),
        },
      };
      const attempt = (key) => request(`/playlists/${encodeURIComponent(this.userId)}/sync`, {
        method: "PUT", body, headers: { "Idempotency-Key": key },
      });
      try {
        let result;
        const key = (window.crypto?.randomUUID && window.crypto.randomUUID()) || `${this.userId}-${playlist.id}`;
        try {
          result = await attempt(key);
        } catch (err) {
          if (err.status !== 409) throw err;
          await this.refreshPlaylists();
          body.revision = this.playlistRevision;
          result = await attempt(`${key}-retry`);
        }
        const rev = Number(result?.revision ?? result?.playlist_revision ?? result?.data?.revision);
        if (Number.isFinite(rev) && rev >= 0) this.playlistRevision = rev;
        await this.refreshPlaylists();
        synced = true;
      } catch (err) {
        syncError = err.message || "Sync failed.";
      }
    }
    if (!synced) {
      this.localPlaylists = [playlist, ...this.localPlaylists.filter((p) => String(p.name).toLowerCase() !== name.toLowerCase())].slice(0, 30);
      this.saveLocal();
      this.updatePlaylists();
    }
    this.closeModal();
    this.toast(synced ? `Saved ${name}.` : `Saved ${name} in this browser.${syncError ? ` Sync failed: ${syncError}` : ""}`, !synced && !!syncError);
  }

  /* ----- search ----- */

  onSearchInput(value) {
    this.searchText = value;
    this.el.searchClear.hidden = !value;
    clearTimeout(this.searchTimer);
    const query = value.trim();
    if (query.length < 2) {
      if (this.searchCtrl) this.searchCtrl.abort();
      this.searchResults = [];
      this.searchState = "idle";
      this.updateSearch();
      return;
    }
    this.searchTimer = setTimeout(() => this.runSearch(query), SEARCH_DEBOUNCE_MS);
  }

  async runSearch(query) {
    if (this.searchCtrl) this.searchCtrl.abort();
    const ctrl = new AbortController();
    this.searchCtrl = ctrl;
    this.searchState = "busy";
    this.searchError = "";
    this.updateSearch();
    try {
      let results;
      try {
        const res = await request("/music/search", {
          params: { q: query, limit: SEARCH_LIMIT, guild_id: this.guildId },
          signal: ctrl.signal,
        });
        results = listFrom(res, ["results", "tracks", "items", "data"]).slice(0, SEARCH_LIMIT).map(normalizeTrack);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err.status === 401 || err.status === 403) throw err;
        results = await catalogSearch(query, SEARCH_LIMIT);
      }
      if (ctrl.signal.aborted || query !== this.el.search.value.trim()) return;
      this.searchResults = results;
      this.searchState = "idle";
    } catch (err) {
      if (ctrl.signal.aborted) return;
      this.searchResults = [];
      this.searchState = "error";
      this.searchError = err.message || "Search failed.";
    }
    this.updateSearch();
  }

  /* ----- events ----- */

  trackOf(source, index) {
    const lists = { search: this.searchResults, queue: this.queueList, history: this.history };
    return lists[source]?.[Number(index)] || null;
  }

  onClick(e) {
    if (e.target === this.el.modalBg) { this.closeModal(); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn || !this.root.contains(btn)) return;
    const act = btn.dataset.act;
    switch (act) {
      case "retry": this.pollDelay = POLL_STATE_MS; this.refreshStateNow(); this.loadChannels(); break;
      case "toggle": this.toggle(); break;
      case "next": this.control("skip").then((ok) => ok && this.refreshSoon()); break;
      case "prev": this.control("previous").then((ok) => ok && this.refreshSoon()); break;
      case "shuffle": this.control("shuffle").then((ok) => ok && this.refreshSoon()); break;
      case "repeat": this.control("repeat").then((ok) => ok && this.refreshSoon()); break;
      case "stop": this.control("stop").then((ok) => { if (ok) { this.toast("Stopped."); this.refreshSoon(); } }); break;
      case "play-row": { const t = this.trackOf(btn.dataset.src, btn.dataset.i); if (t) this.playTrack(t); break; }
      case "queue-row": { const t = this.trackOf(btn.dataset.src, btn.dataset.i); if (t) this.queueTrack(t); break; }
      case "preview-row": { const t = this.trackOf(btn.dataset.src, btn.dataset.i); if (t) this.playPreview(t); break; }
      case "preview-close": this.closePreview(); break;
      case "queue-clear": this.control("clear").then((ok) => ok && this.refreshSoon()); break;
      case "queue-remove": this.control("remove", Number(btn.dataset.i)).then((ok) => ok && this.refreshSoon()); break;
      case "search-clear":
        if (this.searchCtrl) this.searchCtrl.abort();
        this.el.search.value = "";
        this.onSearchInput("");
        this.el.search.focus();
        break;
      case "pl-new": this.openModal(); break;
      case "pl-cancel": this.closeModal(); break;
      case "pl-play": { const pl = this.allPlaylists()[Number(btn.dataset.i)]; if (pl) this.playPlaylist(pl); break; }
      case "voice-connect": {
        const id = this.el.voiceSelect.value;
        if (!id) { this.toast("Select a voice channel first.", true); break; }
        this.control("join", id, { channel_id: id }).then((ok) => { if (ok) { this.toast("Connecting the bot."); this.refreshSoon(800); } });
        break;
      }
      case "voice-join":
        if (this.voice?.channelId) {
          this.control("join", this.voice.channelId, { channel_id: this.voice.channelId }).then((ok) => {
            if (ok) { this.toast(`Joining ${this.voice.channelName}.`); this.refreshSoon(800); }
          });
        }
        break;
    }
  }

  onInput(e) {
    const t = e.target;
    if (t.id === "mrSearch") this.onSearchInput(t.value);
    else if (t.id === "mrSeek") {
      this.seeking = true;
      this.el.cur.textContent = fmtTime(Number(t.value));
    } else if (t.id === "mrVol") {
      this.el.volVal.textContent = `${t.value}%`;
      clearTimeout(this.volTimer);
      this.volTimer = setTimeout(() => {
        this.volume = Number(t.value);
        this.control("volume", Number(t.value));
      }, 500);
    }
  }

  onChange(e) {
    const t = e.target;
    if (t.id === "mrSeek") {
      const seconds = Math.max(0, Number(t.value));
      const ms = Math.round(seconds * 1000);
      this.position = seconds;
      this.positionAt = Date.now();
      this.control("seek", ms, { position: ms }).then((ok) => ok && this.refreshSoon(800));
      setTimeout(() => { this.seeking = false; }, 1200);
    } else if (t.id === "mrVol") {
      clearTimeout(this.volTimer);
      this.volume = Number(t.value);
      this.el.volVal.textContent = `${t.value}%`;
      this.control("volume", Number(t.value));
    }
  }

  /* ----- rendering (targeted updates only) ----- */

  toast(message, isError) {
    const el = this.el.toast;
    el.textContent = message;
    el.className = `mr-toast show${isError ? " err" : ""}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
  }

  setStatus(online) {
    const label = online ? "Online" : "Offline";
    this.el.status.className = `mr-status ${online ? "on" : "off"}`;
    this.el.status.lastElementChild.textContent = online ? label : "Offline";
    this.el.retry.hidden = online;
    if (!online) this.el.retry.hidden = false;
  }

  updatePlayer() {
    const t = this.track;
    this.el.title.textContent = t ? t.title : "Nothing playing";
    this.el.title.title = t ? t.title : "";
    this.el.artist.textContent = t ? `${t.artist}${t.album ? ` · ${t.album}` : ""}` : "Search below to start.";
    if (t?.artwork) {
      if (this.el.art.src !== t.artwork) this.el.art.src = t.artwork;
      this.el.art.hidden = false;
      this.el.artFb.style.display = "none";
    } else {
      this.el.art.hidden = true;
      this.el.art.removeAttribute("src");
      this.el.artFb.style.display = "";
    }
    this.el.play.innerHTML = icon(this.paused ? "play" : "pause", true);
    this.el.play.title = this.paused ? "Play" : "Pause";
    this.el.play.setAttribute("aria-label", this.paused ? "Play" : "Pause");
    this.el.shuffle.classList.toggle("active", this.shuffle);
    this.el.repeat.classList.toggle("active", this.loop > 0);
    this.el.repeat.innerHTML = icon(this.loop === 2 ? "repeat1" : "repeat");
    this.el.repeat.title = `Repeat: ${this.loop === 2 ? "one" : this.loop === 1 ? "all" : "off"}`;
    if (document.activeElement !== this.el.vol) {
      this.el.vol.value = String(this.volume);
      this.el.volVal.textContent = `${this.volume}%`;
    }
    this.el.seek.disabled = !t;
    this.tickProgress();
  }

  updateVoice() {
    const dot = this.el.voiceDot;
    dot.classList.toggle("live", this.connected);
    this.el.voiceState.innerHTML = this.connected
      ? `Connected${this.channelName ? ` to <strong>${esc(this.channelName)}</strong>` : ""}`
      : "Not connected";
    const showHint = this.voice && this.voice.guildId === this.guildId && this.voice.channelId;
    this.el.voiceHint.hidden = !showHint;
    this.el.voiceJoin.hidden = !showHint;
    if (showHint) this.el.voiceHint.textContent = `You are in ${this.voice.channelName}.`;
  }

  rowHTML(track, index, source, opts) {
    opts = opts || {};
    const art = track.artwork
      ? `<img class="mr-row-art" src="${esc(track.artwork)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<span class="mr-row-art-fb">${icon("list")}</span>`;
    const dur = track.durationMs ? fmtTime(track.durationMs / 1000) : "";
    const actions = opts.queue
      ? `<button class="mr-icon-btn" data-act="queue-remove" data-i="${index}" title="Remove" aria-label="Remove">${icon("x")}</button>`
      : `<button class="mr-icon-btn" data-act="queue-row" data-src="${source}" data-i="${index}" title="Add to queue" aria-label="Add to queue">${icon("plus")}</button>`
        + (opts.preview ? `<button class="mr-icon-btn" data-act="preview-row" data-src="${source}" data-i="${index}" title="Preview (30 seconds)" aria-label="Preview">${icon("headphones")}</button>` : "");
    return `<div class="mr-row">${art}`
      + `<button class="mr-row-main" data-act="play-row" data-src="${source}" data-i="${index}" title="Play ${esc(track.title)}"><strong>${esc(track.title)}</strong><small>${esc(track.artist)}</small></button>`
      + `<div class="mr-row-side">${dur ? `<span class="mr-dur">${dur}</span>` : ""}${actions}</div></div>`;
  }

  updateSearch() {
    const box = this.el.results;
    if (this.searchState === "busy") {
      box.innerHTML = `<div class="mr-state"><span class="mr-spin"></span>Searching…</div>`;
      this.rowSig.search = "busy";
      return;
    }
    if (this.searchState === "error") {
      box.innerHTML = `<div class="mr-state err">${esc(this.searchError)}</div>`;
      this.rowSig.search = "error";
      return;
    }
    if (!this.searchText.trim()) {
      box.innerHTML = `<div class="mr-state">Type at least 2 characters.</div>`;
      this.rowSig.search = "";
      return;
    }
    if (!this.searchResults.length) {
      box.innerHTML = `<div class="mr-state">No results for “${esc(this.searchText.trim())}”.</div>`;
      this.rowSig.search = "empty";
      return;
    }
    const sig = this.searchResults.map((t) => t.id).join("|");
    if (sig === this.rowSig.search) return;
    this.rowSig.search = sig;
    box.innerHTML = `<div class="mr-rows">${this.searchResults.map((t, i) => this.rowHTML(t, i, "search", { preview: true })).join("")}</div>`;
  }

  updateQueue() {
    const sig = this.queueList.map((t) => t.id).join("|");
    if (sig === this.rowSig.queue) {
      this.el.qCount.textContent = this.queueList.length ? `(${this.queueList.length})` : "";
      return;
    }
    this.rowSig.queue = sig;
    this.el.qCount.textContent = this.queueList.length ? `(${this.queueList.length})` : "";
    this.el.qClear.disabled = !this.queueList.length;
    this.el.queue.innerHTML = this.queueList.length
      ? `<div class="mr-rows">${this.queueList.slice(0, 30).map((t, i) => this.rowHTML(t, i, "queue", { queue: true })).join("")}</div>`
        + (this.queueList.length > 30 ? `<div class="mr-note">+ ${this.queueList.length - 30} more</div>` : "")
      : `<div class="mr-empty">Queue is empty.</div>`;
  }

  updateHistory() {
    const sig = this.history.map((t) => t.id).join("|");
    if (sig === this.rowSig.history) return;
    this.rowSig.history = sig;
    this.el.history.innerHTML = this.history.length
      ? `<div class="mr-rows">${this.history.map((t, i) => this.rowHTML(t, i, "history", { preview: false })).join("")}</div>`
      : `<div class="mr-empty">No history yet.</div>`;
  }

  updatePlaylists() {
    const all = this.allPlaylists();
    const sig = all.map((p) => `${p.id || p.name}:${p.track_count ?? (p.tracks || []).length}`).join("|");
    if (sig === this.rowSig.playlists) return;
    this.rowSig.playlists = sig;
    if (!all.length) {
      this.el.playlists.innerHTML = `<div class="mr-empty">No playlists yet.</div>`;
      return;
    }
    this.el.playlists.innerHTML = all.map((pl, i) => {
      const tracks = pl.tracks || [];
      const count = Number(pl.track_count ?? tracks.length ?? 0);
      const cover = tracks[0]?.artwork
        ? `<span class="mr-pl-cover"><img src="${esc(tracks[0].artwork)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="mr-pl-cover"><span class="mr-pl-cover-fb">${icon("list")}</span></span>`;
      return `<div class="mr-pl-row">${cover}`
        + `<div class="mr-pl-info"><strong>${esc(pl.name || "Untitled")}</strong><span>${count} song${count === 1 ? "" : "s"} · ${pl.localOnly ? "This browser" : "Synced"}</span></div>`
        + `<button class="mr-icon-btn" data-act="pl-play" data-i="${i}" title="Play ${esc(pl.name || "playlist")}" aria-label="Play">${icon("play")}</button></div>`;
    }).join("");
  }

  /* ----- lyrics ----- */

  renderLyrics() {
    const badge = this.el.lyrBadge;
    const box = this.el.lyr;
    this.el.lyrTrack.textContent = this.track ? `${this.track.title} — ${this.track.artist}` : "Nothing playing";
    const status = this.track ? this.lyrics.status : "idle";
    if (!this.track) {
      badge.textContent = "—";
      box.innerHTML = `<div class="mr-lyr-empty">${icon("music")}<span>Lyrics show here when a song plays.</span></div>`;
      return;
    }
    if (status === "loading") {
      badge.textContent = "…";
      box.innerHTML = `<div class="mr-lyr-empty"><span class="mr-spin"></span><span>Finding lyrics…</span></div>`;
      return;
    }
    if (status === "synced") {
      badge.textContent = "Synced";
      box.innerHTML = this.lyrics.synced.map((line, i) =>
        `<div class="mr-line" data-i="${i}">${esc(line.text)}</div>`).join("");
      this.lineEls = [...box.children];
      return;
    }
    if (status === "plain") {
      badge.textContent = "Plain text";
      box.innerHTML = `<div class="mr-plain">${esc(this.lyrics.plain)}</div>`;
      return;
    }
    if (status === "instrumental") {
      badge.textContent = "Instrumental";
      box.innerHTML = `<div class="mr-lyr-empty">${icon("music")}<span>This song has no lyrics.</span></div>`;
      return;
    }
    badge.textContent = "None found";
    box.innerHTML = `<div class="mr-lyr-empty">${icon("music")}<span>No lyrics found for this song.</span></div>`;
  }

  /* ----- 1s tick: progress + lyrics + media position ----- */

  tick() {
    this.tickProgress();
    this.tickLyrics();
    const now = Date.now();
    if (now - this.positionPushAt > 5000) {
      this.positionPushAt = now;
      this.pushPosition();
    }
  }

  tickProgress() {
    const t = this.track;
    const dur = t ? t.durationMs / 1000 : 0;
    const pos = Math.max(0, this.botPosition());
    this.el.tot.textContent = fmtTime(dur);
    if (!this.seeking) {
      const seek = this.el.seek;
      seek.max = String(Math.max(1, Math.floor(dur)));
      seek.value = String(Math.min(Math.floor(pos), Math.max(1, Math.floor(dur))));
      seek.style.setProperty("--p", dur > 0 ? `${Math.min(100, (pos / dur) * 100)}%` : "0%");
      this.el.cur.textContent = fmtTime(pos);
    }
    const vol = this.el.vol;
    vol.style.setProperty("--p", `${this.volume}%`);
  }

  tickLyrics() {
    if (this.lyrics.status !== "synced" || !this.lyrics.synced.length || !this.lineEls?.length) return;
    const pos = this.activePosition();
    const rows = this.lyrics.synced;
    let index = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].time <= pos + 0.1) index = i;
      else break;
    }
    if (index === this.lyricIndex) return;
    if (this.lineEls[this.lyricIndex]) this.lineEls[this.lyricIndex].classList.remove("on");
    this.lyricIndex = index;
    const active = this.lineEls[index];
    if (active) {
      active.classList.add("on");
      const box = this.el.lyr;
      const top = active.offsetTop - box.clientHeight * 0.4;
      box.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    }
  }

  /* ----- browser / OS media controls ----- */

  bindMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const bind = (name, handler) => { try { session.setActionHandler(name, handler); } catch { /* unsupported */ } };
    bind("play", () => {
      if (this.previewTrack && this.el.audio) this.el.audio.play().catch(() => {});
      else if (this.paused) this.toggle();
    });
    bind("pause", () => {
      if (this.previewTrack && this.el.audio) this.el.audio.pause();
      else if (!this.paused) this.toggle();
    });
    bind("previoustrack", () => this.control("previous").then((ok) => ok && this.refreshSoon()));
    bind("nexttrack", () => this.control("skip").then((ok) => ok && this.refreshSoon()));
    bind("stop", () => this.control("stop").then((ok) => ok && this.refreshSoon()));
    bind("seekto", (d) => {
      if (!Number.isFinite(d.seekTime)) return;
      if (this.previewTrack && this.el.audio) this.el.audio.currentTime = d.seekTime;
      else {
        const ms = Math.round(d.seekTime * 1000);
        this.position = d.seekTime;
        this.positionAt = Date.now();
        this.control("seek", ms, { position: ms });
      }
    });
    bind("seekbackward", (d) => {
      const off = d.seekOffset || 10;
      if (this.previewTrack && this.el.audio) this.el.audio.currentTime = Math.max(0, this.el.audio.currentTime - off);
      else {
        const ms = Math.max(0, Math.round((this.botPosition() - off) * 1000));
        this.control("seek", ms, { position: ms });
      }
    });
    bind("seekforward", (d) => {
      const off = d.seekOffset || 10;
      if (this.previewTrack && this.el.audio) this.el.audio.currentTime += off;
      else {
        const ms = Math.round((this.botPosition() + off) * 1000);
        this.control("seek", ms, { position: ms });
      }
    });
  }

  syncMediaMeta() {
    const t = this.previewTrack || this.track;
    document.title = t ? `${t.title} · ${t.artist} | Rift Dashboard` : "Music · Rift Dashboard";
    if (!("mediaSession" in navigator)) return;
    try {
      if (!t) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
        return;
      }
      if ("MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.artist,
          album: t.album || "Rift Music",
          artwork: t.artwork ? [{ src: t.artwork, sizes: "512x512" }] : [],
        });
      }
    } catch { /* older browsers */ }
  }

  pushMedia() {
    if (!("mediaSession" in navigator)) return;
    try {
      const playing = this.previewTrack
        ? !!this.el.audio && !this.el.audio.paused
        : !!this.track && !this.paused;
      navigator.mediaSession.playbackState = !this.track && !this.previewTrack ? "none" : playing ? "playing" : "paused";
    } catch { /* ignore */ }
    this.pushPosition();
  }

  pushPosition() {
    if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
    try {
      const t = this.previewTrack || this.track;
      if (!t) return;
      const duration = this.previewTrack && this.el.audio?.duration
        ? this.el.audio.duration
        : (t.durationMs || 0) / 1000;
      if (!Number.isFinite(duration) || duration <= 0) return;
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, this.activePosition()), duration),
      });
    } catch { /* not supported with current metadata */ }
  }

  /* ----- teardown ----- */

  dispose() {
    this.disposed = true;
    this.ac.abort();
    this.timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    clearTimeout(this.stateTimer);
    clearTimeout(this.searchTimer);
    clearTimeout(this.volTimer);
    clearTimeout(this.toastTimer);
    if (this.searchCtrl) this.searchCtrl.abort();
    if (this.lyricsCtrl) this.lyricsCtrl.abort();
    try {
      this.el.audio.pause();
      this.el.audio.removeAttribute("src");
      this.el.audio.load();
    } catch { /* already gone */ }
    document.title = this.titleBefore;
    try {
      if ("mediaSession" in navigator) {
        ["play", "pause", "previoustrack", "nexttrack", "stop", "seekto", "seekbackward", "seekforward"]
          .forEach((name) => navigator.mediaSession.setActionHandler(name, null));
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    } catch { /* unsupported */ }
  }
}

/* ---------- server-list voice hint (throttled, cached) ---------- */

let pickerMount = null;
let pickerTimer = 0;
let pickerBusy = false;
const pickerCache = new Map(); // guildId -> { at, found }

async function renderPickerVoice(mount) {
  if (pickerBusy) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  pickerBusy = true;
  try {
    const userRes = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token}` } });
    if (!userRes.ok) return;
    const user = await userRes.json();
    const candidates = [...document.querySelectorAll("[data-rift-guild-id]")]
      .map((b) => ({ guildId: String(b.dataset.riftGuildId || ""), guildName: b.dataset.serverName || "your server" }))
      .filter((c) => c.guildId)
      .slice(0, 12);
    const now = Date.now();
    let location = null;
    for (const candidate of candidates) {
      const cached = pickerCache.get(candidate.guildId);
      if (cached && now - cached.at < 180000 && !cached.found) continue;
      try {
        const voice = await request(`/user/voice/${encodeURIComponent(candidate.guildId)}/${encodeURIComponent(user.id)}`, { timeout: 6000 });
        const presence = voicePresenceFrom(voice, candidate.guildId, candidate.guildName);
        pickerCache.set(candidate.guildId, { at: now, found: !!presence });
        if (presence) { location = presence; break; }
      } catch {
        pickerCache.set(candidate.guildId, { at: now, found: false });
      }
      if (!mount.isConnected) return;
    }
    if (!mount.isConnected || !location) return;
    try {
      if (sessionStorage.getItem(`rift_voice_picker_dismissed:${location.guildId}`)) return;
    } catch { /* private mode */ }
    mount.innerHTML = `<section class="mr-pick-voice" role="status">${icon("mic")}`
      + `<div class="mr-pick-copy"><strong>You are in ${esc(location.channelName)}</strong><small>${esc(location.guildName)}</small></div>`
      + `<button class="mr-btn primary" data-picker-action="open" data-guild-id="${esc(location.guildId)}">Open music</button>`
      + `<button class="mr-icon-btn" data-picker-action="dismiss" data-guild-id="${esc(location.guildId)}" aria-label="Dismiss">${icon("x")}</button></section>`;
  } catch { /* hint is optional */ }
  finally { pickerBusy = false; }
}

function syncVoicePicker() {
  const mount = document.querySelector("[data-rift-voice-picker]");
  if (window.location.pathname !== "/guilds" || !mount) {
    clearInterval(pickerTimer);
    pickerTimer = 0;
    pickerMount = null;
    return;
  }
  if (mount === pickerMount) return;
  clearInterval(pickerTimer);
  pickerMount = mount;
  renderPickerVoice(mount);
  pickerTimer = setInterval(() => {
    if (pickerMount === mount && mount.isConnected && window.location.pathname === "/guilds" && !document.hidden) {
      renderPickerVoice(mount);
    }
  }, 60000);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-picker-action]");
  if (!button) return;
  if (button.dataset.pickerAction === "open" && button.dataset.guildId) {
    window.location.href = `/g/${encodeURIComponent(button.dataset.guildId)}/music`;
  } else if (button.dataset.pickerAction === "dismiss") {
    try { sessionStorage.setItem(`rift_voice_picker_dismissed:${button.dataset.guildId}`, "1"); } catch { /* private mode */ }
    button.closest(".mr-pick-voice")?.remove();
  }
});

/* ---------- route sync ---------- */

let activeRoom = null;
let activeMount = null;
let activeGuildId = "";

function syncRoute() {
  const mount = document.querySelector("[data-rift-music-root]");
  const match = window.location.pathname.match(/^\/g\/([^/]+)\/music\/?$/);
  if (!mount || !match) {
    if (activeRoom) activeRoom.dispose();
    activeRoom = null;
    activeMount = null;
    activeGuildId = "";
    return;
  }
  const guildId = decodeURIComponent(match[1]);
  if (activeRoom && activeMount === mount && activeGuildId === guildId) return;
  if (activeRoom) activeRoom.dispose();
  activeMount = mount;
  activeGuildId = guildId;
  activeRoom = new MusicRoom(mount, guildId);
}

function installRouteHooks() {
  const originalPush = history.pushState;
  history.pushState = function (...args) {
    const result = originalPush.apply(this, args);
    window.dispatchEvent(new Event("rift:routechange"));
    return result;
  };
  const originalReplace = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplace.apply(this, args);
    window.dispatchEvent(new Event("rift:routechange"));
    return result;
  };
  let debounce = 0;
  const sync = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { syncRoute(); syncVoicePicker(); }, 200);
  };
  window.addEventListener("popstate", sync);
  window.addEventListener("rift:routechange", sync);
  const observer = new MutationObserver(sync);
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
  syncRoute();
  syncVoicePicker();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRouteHooks, { once: true });
else installRouteHooks();
