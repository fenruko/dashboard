/* Rift Music Room — dependency-free enhancement for the existing dashboard music route. */
const API_BASE = (window.RIFT_API_BASE || "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api").replace(/\/$/, "");
const TOKEN_KEY = "rift_dashboard_token";
const DEFAULT_ORDER = ["discover", "radio", "lyrics", "history", "playlists"];
const ACCENTS = [
  { name: "Glacier", value: "#45c7ff" },
  { name: "Ultraviolet", value: "#a58bff" },
  { name: "Mint", value: "#65e8c3" },
  { name: "Solar", value: "#ffbd69" },
  { name: "Rose", value: "#ff7aa8" },
];
const MOODS = ["Indie glow", "Late night", "Focus flow", "Dream pop", "Electronic", "Soft landing", "Alt & left-field", "Golden hour"];
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  next: '<path d="m5 5 10 7-10 7z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
  previous: '<path d="m19 5-10 7 10 7z" fill="currentColor" stroke="none"/><path d="M5 5v14"/>',
  shuffle: '<path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2.5c2 0 3.1-.8 4.3-2.4l6.4-8.2C16.4 5.8 17.5 5 19.5 5H22M2 6h2.5c1.3 0 2.2.3 3 1"/><path d="M14 16.5c1.3 1.7 2.2 2.5 4.2 2.5H22"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1L19 15Z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  dots: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};

function icon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function safeUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(String(value), window.location.href);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch { return ""; }
}
function objectText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  return String(value.name ?? value.text ?? value["#text"] ?? value.title ?? "");
}
function normalizeTrack(track = {}) {
  const info = track?.info && typeof track.info === "object" ? track.info : {};
  const title = objectText(track.title ?? info.title ?? track.name ?? track.trackName ?? track["#text"]) || "Unknown track";
  const artist = objectText(track.artist ?? info.author ?? track.author ?? track.artistName ?? track.uploader ?? track.byline) || "Unknown artist";
  const durationRaw = Number(track.duration_ms ?? track.duration ?? track.length ?? track.trackTimeMillis ?? info.length ?? info.duration ?? 0);
  const durationMs = durationRaw > 0 && durationRaw < 1000 ? durationRaw * 1000 : durationRaw;
  const idCandidate = String(track.id ?? info.identifier ?? track.identifier ?? track.encoded ?? track.track ?? "");
  const urlUri = /^https:\/\//i.test(String(track.url || "")) && !/(?:itunes|music)\.apple\.com/i.test(String(track.url)) ? String(track.url) : "";
  const uri = String(track.uri ?? track.identifier ?? info.uri ?? info.url ?? (/^(?:https:\/\/|(?:yt|ytm|sc|sp|am|dz)search:)/i.test(idCandidate) ? idCandidate : urlUri));
  const id = String((track.id ?? track.encoded ?? track.track ?? info.identifier ?? track.trackId ?? uri) || `${title}-${artist}`);
  const fallbackQuery = /^(?:itunes|chart)-/i.test(id) ? `${title} ${artist}` : (uri || id || `${title} ${artist}`);
  return {
    id, uri, encoded: String(track.encoded ?? track.track ?? ""), title, artist,
    album: objectText(track.album ?? info.albumName ?? info.album ?? track.collectionName ?? track.album_name),
    artwork: safeUrl(track.artwork ?? track.thumbnail ?? track.image ?? track.album_art ?? track.artworkUrl ?? info.artworkUrl ?? track.artworkUrl100 ?? track.artworkUrl60),
    url: safeUrl(track.url ?? info.uri ?? track.trackViewUrl ?? track.external_url),
    durationMs,
    query: objectText(track.query) || fallbackQuery,
    source: objectText(track.source ?? info.sourceName),
    plays: Number(track.plays ?? track.play_count ?? 0) || 0,
  };
}
function itunesTrack(raw) {
  const image = raw.artworkUrl600 || raw.artworkUrl512 || raw.artworkUrl100 || raw.artworkUrl60 || "";
  const hiRes = image.replace(/\/\d+x\d+bb\.(jpg|png|webp)(\?.*)?$/i, "/600x600bb.$1$2");
  return normalizeTrack({
    id: `itunes-${raw.trackId ?? raw.collectionId ?? raw.trackName}`,
    title: raw.trackName || raw.collectionName,
    artist: raw.artistName,
    album: raw.collectionName,
    artwork: hiRes || image,
    url: raw.trackViewUrl,
    duration_ms: raw.trackTimeMillis,
  });
}
function formatTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
function durationSeconds(ms) { return Math.max(0, Number(ms || 0) / 1000); }
function listFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (payload?.data && typeof payload.data === "object" && payload.data !== payload) return listFrom(payload.data, keys);
  return [];
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
    channelName: objectText(nested?.channel_name ?? nested?.channelName ?? nested?.name ?? data?.channel_name ?? data?.voice_channel_name) || "Voice channel",
  };
}
function lrcSeconds(min, sec, fraction = "0") {
  let fractionValue = Number(`0.${String(fraction).padEnd(3, "0")}`);
  if (!Number.isFinite(fractionValue)) fractionValue = 0;
  return Number(min) * 60 + Number(sec) + fractionValue;
}
function parseLrc(input) {
  const rows = [];
  const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const rawLine of String(input || "").split(/\r?\n/)) {
    const stamps = [...rawLine.matchAll(stamp)];
    if (!stamps.length) continue;
    const text = rawLine.replace(stamp, "").trim();
    const words = [];
    const wordStamp = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g;
    for (const match of text.matchAll(wordStamp)) {
      const word = match[4];
      if (word) words.push({ time: lrcSeconds(match[1], match[2], match[3] || "0"), text: word });
    }
    const cleanText = words.length ? words.map((w) => w.text).join("").trim() : text.replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, "").trim();
    if (!cleanText) continue;
    for (const match of stamps) rows.push({ time: lrcSeconds(match[1], match[2], match[3] || "0"), text: cleanText, words });
  }
  return rows.sort((a, b) => a.time - b.time);
}

async function request(path, options = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (options.params) Object.entries(options.params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  let data = null;
  try { data = await response.json(); } catch { /* an empty response is valid for controls */ }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

class MusicRoom {
  constructor(root, guildId) {
    this.root = root;
    this.guildId = String(guildId);
    this.originalDocumentTitle = document.title;
    this.userId = "";
    this.user = null;
    this.state = null;
    this.history = [];
    this.remotePlaylists = [];
    this.playlistRevision = 0;
    this.localPlaylists = this.readLocalPlaylists();
    this.channels = [];
    this.searchResults = [];
    this.searchQuery = "";
    this.searchBusy = false;
    this.searchError = "";
    this.searchSource = "LAVALINK";
    this.searchCache = new Map();
    this.catalogResults = [];
    this.catalogBusy = false;
    this.catalogError = "";
    this.catalogTab = "for-you";
    this.lastfmTaste = undefined;
    this.lastfmTastePromise = null;
    this.radioResults = [];
    this.radioMood = ["Indie glow", "Late night"];
    this.radioQuery = "";
    this.radioBusy = false;
    this.draftTracks = [];
    this.lyrics = null;
    this.lyricsStatus = "idle";
    this.lyricsTrackKey = "";
    this.activeLyricIndex = -1;
    this.positionSeconds = 0;
    this.positionUpdatedAt = Date.now();
    this.browserTrack = null;
    this.voicePresence = null;
    this.modal = "";
    this.toastTimer = 0;
    this.searchTimer = 0;
    this.controllers = new Set();
    this.preferences = this.readPreferences();
    this.radioMood = [...(this.preferences.radioMood || this.radioMood)];
    this.apiOnline = false;
    this.disposed = false;
    this.boundClick = (event) => this.handleClick(event);
    this.boundInput = (event) => this.handleInput(event);
    this.boundChange = (event) => this.handleChange(event);
    this.boundKey = (event) => this.handleKeydown(event);
    this.boundDragStart = (event) => this.handleDragStart(event);
    this.boundDragOver = (event) => this.handleDragOver(event);
    this.boundDrop = (event) => this.handleDrop(event);
    this.boundDragEnd = () => this.root.querySelectorAll(".is-dragging").forEach((node) => node.classList.remove("is-dragging"));
    this.boundSubmit = (event) => this.handleSubmit(event);
    root.addEventListener("click", this.boundClick);
    root.addEventListener("input", this.boundInput);
    root.addEventListener("change", this.boundChange);
    root.addEventListener("keydown", this.boundKey);
    root.addEventListener("dragstart", this.boundDragStart);
    root.addEventListener("dragover", this.boundDragOver);
    root.addEventListener("drop", this.boundDrop);
    root.addEventListener("dragend", this.boundDragEnd);
    root.addEventListener("submit", this.boundSubmit);
    this.render();
    this.installMediaSession();
    this.refreshAll();
    this.pollTimer = window.setInterval(() => {
      if (!document.hidden && !this.disposed) this.refreshState();
    }, 5000);
    this.historyTimer = window.setInterval(() => {
      if (!document.hidden && !this.disposed) this.refreshHistory();
    }, 30000);
    this.voiceTimer = window.setInterval(() => {
      if (!document.hidden && !this.disposed) this.checkVoicePresence();
    }, 20000);
    this.playlistTimer = window.setInterval(() => {
      if (!document.hidden && !this.disposed && this.userId) this.refreshRemotePlaylists();
    }, 45000);
    this.tickFrame = requestAnimationFrame(() => this.tick());
  }

  readPreferences() {
    const defaults = { accent: ACCENTS[0].value, compact: false, visible: { discover: true, radio: true, lyrics: true, history: true, playlists: true }, order: [...DEFAULT_ORDER], radioMood: ["Indie glow", "Late night"] };
    try {
      const saved = JSON.parse(localStorage.getItem(`rift_music_room:${this.guildId}`) || "null");
      if (!saved) return defaults;
      const order = [...new Set([...(saved.order || []), ...DEFAULT_ORDER])].filter((key) => DEFAULT_ORDER.includes(key));
      const accent = ACCENTS.some((item) => item.value === saved.accent) ? saved.accent : defaults.accent;
      return { ...defaults, ...saved, accent, visible: { ...defaults.visible, ...(saved.visible || {}) }, order };
    } catch { return defaults; }
  }
  savePreferences() { localStorage.setItem(`rift_music_room:${this.guildId}`, JSON.stringify(this.preferences)); }
  readLocalPlaylists() {
    try { return JSON.parse(localStorage.getItem(`rift_music_playlists:${this.guildId}`) || "[]").map((p) => ({ ...p, localOnly: true })); }
    catch { return []; }
  }
  saveLocalPlaylists() { localStorage.setItem(`rift_music_playlists:${this.guildId}`, JSON.stringify(this.localPlaylists)); }
  allPlaylists() {
    const remote = this.remotePlaylists.map((p) => ({ ...p, localOnly: false }));
    const seen = new Set(remote.map((p) => String(p.name || p.id || "").toLowerCase()));
    return [...remote, ...this.localPlaylists.filter((p) => !seen.has(String(p.name || p.id || "").toLowerCase()))];
  }
  current() {
    if (!this.state) return null;
    const raw = this.state.current ?? this.state.now_playing ?? this.state.track ?? null;
    if (!raw || !(raw.title || raw.name || raw.trackName || raw.info?.title)) return null;
    return normalizeTrack(raw);
  }
  queue() {
    return listFrom(this.state, ["queue", "tracks_in_queue", "up_next"]).map((track) => normalizeTrack(track));
  }
  shuffleValue() { return Boolean(this.state?.shuffle ?? this.state?.modes?.shuffle ?? false); }
  loopValue() { return Number(this.state?.loop ?? this.state?.modes?.loop ?? 0) || 0; }
  isPaused() { return !this.current() || Boolean(this.state?.paused ?? this.state?.is_paused ?? false); }
  volumeValue() {
    const raw = this.state?.volume ?? this.state?.player_volume;
    if (raw === null || raw === undefined || raw === "") return 70;
    let value = Number(raw);
    if (!Number.isFinite(value)) return 70;
    if (value >= 0 && value <= 1) value *= 100;
    return Math.max(0, Math.min(100, value));
  }
  getBotPosition() {
    const isPlaying = !!this.current() && !this.isPaused();
    return Math.max(0, this.positionSeconds + (isPlaying ? (Date.now() - this.positionUpdatedAt) / 1000 : 0));
  }
  getActivePosition() {
    if (this.browserTrack && this.audio && !this.audio.paused) return this.audio.currentTime || 0;
    return this.getBotPosition();
  }
  connectionLabel() {
    const s = this.state || {};
    const channel = objectText(s.voice_channel_name || s.channel_name || s.voice_channel || s.channel?.name);
    const connected = s.connected ?? s.voice_connected ?? s.in_voice ?? Boolean(channel);
    return connected && channel ? `Connected · ${channel}` : connected ? "Connected to voice" : "Bot not in voice";
  }

  async refreshAll() {
    await Promise.allSettled([this.refreshState(), this.refreshHistory(), this.loadAccountAndPlaylists(), this.loadChannels(), this.checkVoicePresence()]);
    this.loadDiscovery("for-you");
  }
  async refreshState() {
    try {
      const state = await request(`/music/state/${encodeURIComponent(this.guildId)}`);
      if (this.disposed) return;
      this.state = state || {};
      this.apiOnline = true;
      const serverPosition = Number(state?.position ?? (state?.position_ms != null ? Number(state.position_ms) / 1000 : state?.position_seconds) ?? 0);
      this.positionSeconds = Number.isFinite(serverPosition) ? serverPosition : 0;
      this.positionUpdatedAt = Date.now();
      this.updateTrackContext();
      this.render();
      this.syncMediaSession();
      this.tickProgress();
    } catch (error) {
      this.apiOnline = false;
      if (!this.state) this.render();
      this.setConnectionStatus(error.message || "Music service is offline", false);
    }
  }
  async refreshHistory() {
    try {
      const result = await request(`/music/history/${encodeURIComponent(this.guildId)}`, { params: { limit: 20 } });
      this.history = listFrom(result, ["history", "tracks", "items"]).map((item) => normalizeTrack(item));
      if (this.catalogTab === "history") { this.catalogResults = this.history.slice(0, 12); this.updateDiscovery(); }
      if (this.preferences.visible.history) this.updateHistory();
    } catch { if (!this.history.length) this.history = []; }
  }
  async loadAccountAndPlaylists() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      this.user = await response.json();
      this.userId = String(this.user?.id || "");
      if (!this.userId) return;
      await this.refreshRemotePlaylists();
      if (this.disposed) return;
      this.render();
      this.checkVoicePresence();
    } catch { /* account details are progressive enhancement */ }
  }
  async refreshRemotePlaylists() {
    if (!this.userId || this.disposed) return;
    try {
      const result = await request(`/playlists/${encodeURIComponent(this.userId)}`);
      const next = listFrom(result, ["playlists", "items", "data"]).map((playlist) => ({ ...playlist, tracks: (playlist.tracks || []).map((track) => normalizeTrack(track)) }));
      const revision = Number(result?.revision ?? result?.playlist_revision ?? result?.meta?.revision ?? result?.data?.revision);
      if (Number.isFinite(revision) && revision >= 0) this.playlistRevision = revision;
      const changed = JSON.stringify(next.map((p) => [p.id, p.revision, p.updated_at, p.track_count])) !== JSON.stringify(this.remotePlaylists.map((p) => [p.id, p.revision, p.updated_at, p.track_count]));
      this.remotePlaylists = next;
      if (changed) this.render();
    } catch { /* keep the last synchronized library visible */ }
  }
  async loadChannels() {
    try {
      const result = await request(`/guild/${encodeURIComponent(this.guildId)}/info`);
      const channels = listFrom(result, ["channels"]);
      this.channels = channels.filter((ch) => String(ch.type) === "2" || ch.type === "voice" || ch.type === "GUILD_VOICE" || ch.kind === "voice");
      this.updateVoiceChannels();
    } catch { /* the standard music controls remain available */ }
  }
  async checkVoicePresence() {
    if (!this.userId) return;
    try {
      const userVoice = await request(`/user/voice/${encodeURIComponent(this.guildId)}/${encodeURIComponent(this.userId)}`);
      this.voicePresence = voicePresenceFrom(userVoice, this.guildId, this.serverName());
      this.updateVoicePrompt();
    } catch { this.voicePresence = null; this.updateVoicePrompt(); }
  }
  updateTrackContext() {
    const current = this.current();
    const key = current ? `${current.id}|${current.title}|${current.artist}` : "";
    if (key !== this.lyricsTrackKey) {
      this.lyricsTrackKey = key;
      this.lyrics = null;
      this.lyricsStatus = current ? "loading" : "idle";
      this.activeLyricIndex = -1;
      this.updateLyrics();
      if (current) this.fetchLyrics(current, key);
    }
  }

  async catalogSearch(query, limit = 10, signal) {
    const clean = String(query || "").trim();
    if (!clean) return [];
    const cacheKey = `${clean.toLowerCase()}|${limit}`;
    if (this.searchCache.has(cacheKey)) return this.searchCache.get(cacheKey);
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", clean);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Music search unavailable (${response.status})`);
    const json = await response.json();
    const results = (json.results || []).slice(0, limit).map(itunesTrack);
    this.searchCache.set(cacheKey, results);
    if (this.searchCache.size > 50) this.searchCache.delete(this.searchCache.keys().next().value);
    return results;
  }
  async musicSearch(query, limit = 10, signal) {
    const clean = String(query || "").trim();
    if (!clean) return [];
    const cacheKey = `lavalink:${this.guildId}:${clean.toLowerCase()}|${limit}`;
    if (this.searchCache.has(cacheKey)) return this.searchCache.get(cacheKey);
    const response = await request("/music/search", { params: { q: clean, limit, guild_id: this.guildId }, signal });
    const results = listFrom(response, ["results", "tracks", "items", "data"]).slice(0, limit).map((track) => normalizeTrack(track));
    this.searchCache.set(cacheKey, results);
    if (this.searchCache.size > 50) this.searchCache.delete(this.searchCache.keys().next().value);
    return results;
  }
  async runSearch(query) {
    if (this.searchController) this.searchController.abort();
    this.searchController = null;
    const clean = query.trim();
    this.searchQuery = query;
    if (!clean) {
      this.searchResults = [];
      this.searchBusy = false;
      this.searchError = "";
      this.searchSource = "LAVALINK";
      this.renderSearchResults();
      return;
    }
    const controller = new AbortController();
    this.searchController = controller;
    this.searchBusy = true;
    this.searchError = "";
    this.searchSource = "LAVALINK";
    this.renderSearchResults();
    try {
      let results;
      try {
        results = await this.musicSearch(clean, 10, controller.signal);
      } catch (error) {
        if (error.name === "AbortError") return;
        if (error.status === 401 || error.status === 403 || error.status === 429) throw error;
        results = await this.catalogSearch(clean, 10, controller.signal);
        this.searchSource = "CATALOG FALLBACK";
      }
      if (controller.signal.aborted || clean !== this.searchQuery.trim()) return;
      this.searchResults = results;
      this.searchBusy = false;
      this.renderSearchResults();
    } catch (error) {
      if (error.name === "AbortError") return;
      this.searchBusy = false;
      this.searchError = error.message || "Search could not be reached.";
      this.searchResults = [];
      this.renderSearchResults();
    }
  }
  async loadLastFmTaste() {
    if (!this.userId) return null;
    if (this.lastfmTaste !== undefined) return this.lastfmTaste;
    if (this.lastfmTastePromise) return this.lastfmTastePromise;
    this.lastfmTastePromise = Promise.allSettled([
      request(`/lastfm/topartists/${encodeURIComponent(this.userId)}`, { params: { period: "1month" } }),
      request(`/lastfm/toptracks/${encodeURIComponent(this.userId)}`, { params: { period: "1month" } }),
      request(`/lastfm/genres/${encodeURIComponent(this.userId)}`),
    ]).then((results) => {
      const artists = results[0].status === "fulfilled" ? listFrom(results[0].value, ["artists", "topartists"]).map((item) => objectText(item.name ?? item.artist)).filter(Boolean) : [];
      const tracks = results[1].status === "fulfilled" ? listFrom(results[1].value, ["tracks", "toptracks"]).map((item) => normalizeTrack(item)) : [];
      const genres = results[2].status === "fulfilled" ? listFrom(results[2].value, ["genres", "tags"]).map((item) => objectText(item.name ?? item)).filter(Boolean) : [];
      this.lastfmTaste = artists.length || tracks.length || genres.length ? { artists, tracks, genres } : null;
      return this.lastfmTaste;
    }).catch(() => { this.lastfmTaste = null; return null; });
    return this.lastfmTastePromise;
  }
  async loadDiscovery(tab = this.catalogTab) {
    this.catalogTab = tab;
    const generation = (this.discoveryGeneration || 0) + 1;
    this.discoveryGeneration = generation;
    this.catalogBusy = true;
    this.catalogError = "";
    this.updateDiscovery();
    try {
      let results = [];
      if (tab === "popular") {
        results = await this.fetchPopular();
      } else if (tab === "for-you") {
        const taste = await this.loadLastFmTaste();
        if (taste?.artists?.length) {
          const seeds = taste.artists.slice(0, 3);
          const searches = await Promise.allSettled(seeds.map((artist) => this.musicSearch(`${artist} ${taste.genres?.[0] || "top tracks"}`, 4)));
          const recommended = searches.flatMap((result) => result.status === "fulfilled" ? result.value : []);
          const seen = new Set();
          results = recommended.filter((track) => !seen.has(track.id) && seen.add(track.id)).slice(0, 10);
        } else {
          const seed = this.current()?.artist || this.history[0]?.artist || taste?.genres?.[0] || "indie pop";
          const query = this.current() ? `${seed} similar artists` : this.history.length ? `${seed} essentials` : `${seed} new music`;
          try { results = await this.musicSearch(query, 10); }
          catch (error) { if (error.status === 401 || error.status === 403) throw error; results = await this.catalogSearch(query, 10); }
        }
        if (!results.length) results = await this.fetchPopular();
      } else if (tab === "history") {
        results = this.history.slice(0, 12);
      }
      if (generation !== this.discoveryGeneration) return;
      this.catalogResults = results;
      this.catalogBusy = false;
      this.updateDiscovery();
    } catch (error) {
      if (generation !== this.discoveryGeneration) return;
      this.catalogBusy = false;
      this.catalogError = error.message || "Couldn't load this collection.";
      this.updateDiscovery();
    }
  }
  async fetchPopular() {
    const cacheKey = `rift_music_popular_v1:${this.guildId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { const value = JSON.parse(cached); if (Date.now() - value.time < 15 * 60 * 1000) return value.tracks; }
    } catch { /* refresh */ }
    let tracks = [];
    try {
      const response = await request(`/music/topsongs/${encodeURIComponent(this.guildId)}`);
      tracks = listFrom(response, ["top", "tracks"]).map((track) => normalizeTrack(track)).filter((track) => track.title);
    } catch { /* fall back to a public chart if the server has no history yet */ }
    if (!tracks.length) {
      try {
        const response = await fetch("https://itunes.apple.com/us/rss/topsongs/limit=25/json");
        if (response.ok) {
          const feed = await response.json();
          tracks = (feed?.feed?.entry || []).map((entry) => normalizeTrack({
            id: `chart-${entry.id?.attributes?.id || entry.title?.label}`,
            title: entry["im:name"]?.label,
            artist: entry["im:artist"]?.label,
            album: entry["im:collection"]?.["im:name"]?.label,
            artwork: entry["im:image"]?.at(-1)?.label,
            url: entry.link?.find?.((link) => link.attributes?.rel === "alternate")?.attributes?.href,
          })).filter((track) => track.title);
        }
      } catch { /* public chart can be blocked by browser policy */ }
    }
    if (!tracks.length) tracks = await this.catalogSearch("top hits popular songs", 10);
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), tracks })); } catch { /* storage quota */ }
    return tracks;
  }

  async fetchLyrics(track, key) {
    const cacheKey = `rift_lyrics:${this.guildId}:${track.id}:${track.title}`;
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) {
        this.lyrics = JSON.parse(saved);
        this.lyricsStatus = this.lyrics?.synced?.length ? "synced" : this.lyrics?.plain ? "plain" : "missing";
        this.updateLyrics();
        return;
      }
    } catch { /* ignore bad cache */ }
    let result = null;
    try {
      result = await request("/music/lyrics", { params: {
        title: track.title,
        artist: track.artist,
        album: track.album || undefined,
        duration: Math.round(durationSeconds(track.durationMs)) || undefined,
        track_id: track.uri || track.id,
        guild_id: this.guildId,
      } });
    } catch { /* LRCLIB lookup is handled by the backend; keep the player usable if lyrics are unavailable */ }
    if (this.disposed || key !== this.lyricsTrackKey) return;
    if (result) {
      const syncedText = result.enhanced_lrc || result.synced_lyrics || result.syncedLyrics || "";
      const synced = parseLrc(syncedText);
      const plain = String(result.plain_lyrics || result.plainLyrics || "");
      this.lyrics = {
        synced,
        plain,
        isWordSynced: synced.some((line) => line.words.length > 0),
        source: "LRCLIB via Rift",
      };
      this.lyricsStatus = synced.length ? "synced" : plain ? "plain" : "missing";
    } else {
      this.lyrics = { synced: [], plain: "", isWordSynced: false, source: "LRCLIB via Rift" };
      this.lyricsStatus = "missing";
    }
    try { sessionStorage.setItem(cacheKey, JSON.stringify(this.lyrics)); } catch { /* storage quota */ }
    this.updateLyrics();
    this.tickLyrics();
  }

  async control(action, value, extra = {}) {
    try {
      const body = { guild_id: this.guildId, action, ...(value !== undefined ? { value } : {}), ...extra };
      await request("/music/control", { method: "POST", body });
      await this.refreshState();
      return true;
    } catch (error) {
      this.notify(error.message || `Couldn't ${action} music.`, "error");
      return false;
    }
  }
  async playOnBot(track) {
    const item = normalizeTrack(track);
    const ok = await this.control("play", item.query, { track: item.uri || item.query, query: item.query });
    if (ok) this.notify(`Sent “${item.title}” to ${this.connectionLabel().replace("Connected · ", "")} queue.`, "success");
  }
  async queueOnBot(track) {
    const item = normalizeTrack(track);
    const ok = await this.control("queue", undefined, { track: item.uri || item.query });
    if (ok) this.notify(`Added “${item.title}” to the server queue.`, "success");
  }
  async handleStandardControl(action) {
    if (action === "toggle" && !this.current()) {
      if (this.queue().length) { const next = this.queue()[0]; return this.control("play", next.query || next.uri || next.id, { track: next.uri || next.query, query: next.query || "" }); }
      this.notify("Search for a track to start this server’s player.", "info");
      return false;
    }
    const ok = await this.control(action);
    if (ok && action === "stop") this.notify("Playback stopped.", "success");
    return ok;
  }
  async reorderQueue(from, to) {
    const queue = this.queue();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    this.state = { ...(this.state || {}), queue };
    this.render();
    await this.control("move", { from, to }, { from, to });
  }
  async removeQueueItem(index) {
    await this.control("remove", index);
  }
  async playPreview(track) {
    const item = normalizeTrack(track);
    let previewUrl = "";
    try {
      const result = await request("/music/stream", { params: {
        title: item.title,
        artist: item.artist,
        track_id: item.uri || item.id,
        guild_id: this.guildId,
      } });
      const payload = result?.data && typeof result.data === "object" ? result.data : result;
      previewUrl = safeUrl(payload?.preview_url || payload?.previewUrl || payload?.stream_url || payload?.url || payload?.preview);
    } catch { /* the preview endpoint is the only browser-audio source */ }
    if (!previewUrl) {
      this.notify("No 30-second browser preview is available from the stream endpoint. Try Play on server instead.", "error");
      return;
    }
    if (!this.audio) this.audio = this.root.querySelector("#mr-audio");
    if (!this.audio) return;
    this.browserTrack = { ...item, previewUrl };
    this.audio.src = previewUrl;
    this.audio.load();
    try {
      await this.audio.play();
      this.syncMediaSession();
      this.updateBrowserPlayer();
      this.notify("Free iTunes preview playing · up to 30 seconds. No voice-channel join needed.", "success");
    } catch {
      this.notify("The browser blocked playback. Press Play in the audio controls to start it.", "error");
      this.updateBrowserPlayer();
    }
  }
  async playRadio() {
    const input = this.root.querySelector("#mr-radio-niche");
    const freeform = (input?.value || this.radioQuery).trim();
    this.radioQuery = freeform;
    const tags = [...this.radioMood, freeform].filter(Boolean).join(" ");
    const query = tags || "feel good mix";
    this.radioBusy = true;
    this.radioResults = [];
    this.updateRadio();
    try {
      let results;
      try { results = await this.musicSearch(`${query} mix`, 10); }
      catch (error) { if (error.status === 401 || error.status === 403 || error.status === 429) throw error; results = await this.catalogSearch(`${query} mix`, 10); }
      this.radioResults = results;
      this.radioBusy = false;
      this.updateRadio();
      if (!results.length) { this.notify("No tracks found for that mix yet.", "error"); return; }
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      const first = shuffled[0];
      const started = await this.control("play", first.query, { track: first.uri || first.query, query: first.query });
      if (!started) return;
      let added = 0;
      for (const track of shuffled.slice(1, 7)) {
        try {
          await request("/music/control", { method: "POST", body: { guild_id: this.guildId, action: "queue", track: track.uri || track.query } });
          added++;
        } catch { break; }
      }
      await this.refreshState();
      this.notify(`Your ${query} mix is on · ${added + 1} tracks sent to the server.`, "success");
    } catch (error) {
      this.radioBusy = false;
      this.updateRadio();
      this.notify(error.message || "Couldn't build this mix.", "error");
    }
  }

  async savePlaylist(name) {
    const cleanName = String(name || "").trim().slice(0, 64);
    if (!cleanName) { this.notify("Give your playlist a name first.", "error"); return; }
    const nowAndQueue = [this.current(), ...this.queue()].filter(Boolean);
    const tracks = this.draftTracks.length ? [...this.draftTracks] : nowAndQueue;
    const playlist = { id: window.crypto?.randomUUID?.() || `playlist-${Date.now()}`, name: cleanName, tracks, track_count: tracks.length, created_at: new Date().toISOString(), localOnly: true };
    let mirrored = false;
    let syncError = null;
    if (this.userId) {
      const body = {
        revision: this.playlistRevision,
        origin: "rift-dashboard",
        playlist: {
          id: playlist.id,
          name: cleanName,
          description: "",
          is_public: false,
          tracks: tracks.map((track) => ({
            id: track.id,
            uri: track.uri || undefined,
            query: track.query,
            title: track.title,
            artist: track.artist,
            album: track.album || undefined,
            artwork: track.artwork || undefined,
            url: track.url || undefined,
            duration_ms: track.durationMs || undefined,
          })),
        },
      };
      let idempotencyKey = window.crypto?.randomUUID?.() || `${this.userId}-${playlist.id}-${Date.now()}`;
      const sync = () => request(`/playlists/${encodeURIComponent(this.userId)}/sync`, {
        method: "PUT", body, headers: { "Idempotency-Key": idempotencyKey },
      });
      try {
        let result;
        try { result = await sync(); }
        catch (error) {
          if (error.status !== 409) throw error;
          await this.refreshRemotePlaylists();
          body.revision = this.playlistRevision;
          idempotencyKey = window.crypto?.randomUUID?.() || `${idempotencyKey}-retry-${this.playlistRevision}`;
          result = await sync();
        }
        const revision = Number(result?.revision ?? result?.playlist_revision ?? result?.data?.revision);
        if (Number.isFinite(revision) && revision >= 0) this.playlistRevision = revision;
        await this.refreshRemotePlaylists();
        mirrored = this.remotePlaylists.some((item) => String(item.id || "") === playlist.id || String(item.name || "").toLowerCase() === cleanName.toLowerCase());
        if (!mirrored) {
          const saved = result?.playlist || playlist;
          const savedId = String(saved.id || playlist.id);
          this.remotePlaylists = [{ ...saved, id: savedId, tracks: (saved.tracks || tracks).map((track) => normalizeTrack(track)), localOnly: false }, ...this.remotePlaylists.filter((item) => String(item.id || "") !== savedId && String(item.name || "").toLowerCase() !== cleanName.toLowerCase())];
          mirrored = true;
        }
      } catch (error) { syncError = error; }
    }
    if (!mirrored) {
      this.localPlaylists = [playlist, ...this.localPlaylists.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase())];
      this.saveLocalPlaylists();
    }
    this.draftTracks = [];
    this.modal = "";
    this.render();
    this.notify(mirrored ? "Playlist synchronized to your bot library." : syncError ? `Saved on this browser · bot sync failed: ${syncError.message}` : "Saved on this browser. Sign in to sync playlists with the bot.", mirrored ? "success" : "info");
  }
  async playPlaylist(playlist) {
    if (this.userId && !playlist.localOnly) {
      try {
        await request(`/playlists/${encodeURIComponent(this.userId)}/play`, { method: "POST", body: { guild_id: this.guildId, playlist_id: playlist.id, name: playlist.name } });
        this.notify(`Playing “${playlist.name}” on the server.`, "success");
        window.setTimeout(() => this.refreshState(), 400);
      } catch (error) { this.notify(error.message || "Couldn't play this playlist.", "error"); }
      return;
    }
    const tracks = playlist.tracks || [];
    if (!tracks.length) { this.notify("This saved playlist has no tracks yet.", "error"); return; }
    const first = normalizeTrack(tracks[0]);
    const ok = await this.control("play", first.query || `${first.title} ${first.artist}`, { track: first.uri || first.query, query: first.query });
    if (!ok) return;
    for (const raw of tracks.slice(1, 10)) {
      const track = normalizeTrack(raw);
      try { await request("/music/control", { method: "POST", body: { guild_id: this.guildId, action: "queue", track: track.uri || track.query } }); }
      catch { break; }
    }
    this.notify(`Sent “${playlist.name}” to the server queue.`, "success");
    await this.refreshState();
  }

  addToDraft(track) {
    const item = normalizeTrack(track);
    if (!this.draftTracks.some((entry) => entry.id === item.id)) this.draftTracks.push(item);
    this.notify(`Added “${item.title}” to your playlist draft.`, "success");
    this.render();
  }
  getTrack(source, index) {
    const sources = {
      search: this.searchResults,
      catalog: this.catalogResults,
      history: this.history,
      queue: this.queue(),
      radio: this.radioResults,
      draft: this.draftTracks,
    };
    return sources[source]?.[Number(index)] || null;
  }

  trackRow(track, index, source, options = {}) {
    const item = normalizeTrack(track);
    const art = item.artwork ? `<img class="mr-row-art" src="${esc(item.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="mr-row-art mr-art-fallback">${icon("disc")}</span>`;
    const label = options.compact ? "" : `<span class="mr-row-album">${item.plays ? `${item.plays.toLocaleString()} plays` : esc(item.album || item.artist)}</span>`;
    const preview = `<button class="mr-icon-button mr-row-preview" data-action="preview-track" data-source="${source}" data-index="${index}" aria-label="Play free browser preview" title="Free browser preview · Beta">${icon("play")}</button>`;
    return `<article class="mr-track-row ${options.compact ? "is-compact" : ""}">
      <span class="mr-row-index">${String(index + 1).padStart(2, "0")}</span>${art}
      <button class="mr-row-title" data-action="play-track" data-source="${source}" data-index="${index}" title="Play ${esc(item.title)} on server"><span>${esc(item.title)}</span><small>${esc(item.artist)}</small></button>
      ${label}<span class="mr-row-duration">${item.durationMs ? formatTime(durationSeconds(item.durationMs)) : ""}</span>
      <div class="mr-row-actions">${preview}<button class="mr-icon-button" data-action="queue-track" data-source="${source}" data-index="${index}" aria-label="Add to server queue" title="Add to queue">${icon("plus")}</button><button class="mr-icon-button" data-action="draft-track" data-source="${source}" data-index="${index}" aria-label="Add to playlist draft" title="Add to playlist draft">${icon("heart")}</button></div>
    </article>`;
  }
  discoveryHTML() {
    const tabs = [["for-you", "For you"], ["popular", "Popular"], ["history", "History"], ["playlists", "Playlists"]];
    let content = "";
    if (this.catalogBusy) content = `<div class="mr-loading"><span class="mr-spinner"></span><span>Finding your next favorite…</span></div>`;
    else if (this.catalogError) content = `<div class="mr-empty">${esc(this.catalogError)} <button data-action="retry-discovery">Try again</button></div>`;
    else if (this.catalogTab === "playlists") content = this.playlistsHTML();
    else if (this.catalogTab === "history") content = this.catalogResults.length ? `<div class="mr-track-list">${this.catalogResults.slice(0, 12).map((t, i) => this.trackRow(t, i, "catalog", { compact: true })).join("")}</div>` : `<div class="mr-empty">Your listening history will gather here as this server plays music.</div>`;
    else if (!this.catalogResults.length) content = `<div class="mr-empty">Nothing here yet. Try the search bar above, or choose a mood below.</div>`;
    else if (this.catalogTab === "popular") content = `<div class="mr-track-list">${this.catalogResults.slice(0, 12).map((t, i) => this.trackRow(t, i, "catalog")).join("")}</div>`;
    else content = `<div class="mr-featured-grid">${this.catalogResults.slice(0, 8).map((track, index) => this.featureCard(track, index)).join("")}</div>`;
    return `<section class="mr-module" data-widget="discover"><div class="mr-module-head"><div><div class="mr-eyebrow">Your listening space</div><h2>Discover</h2></div><div class="mr-head-actions"><button class="mr-text-button" data-action="refresh-discovery">Refresh</button><span class="mr-drag-handle" draggable="true" title="Drag to reorder">⠿</span></div></div>
      <div class="mr-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${this.catalogTab === id}" class="mr-tab ${this.catalogTab === id ? "is-active" : ""}" data-action="discovery-tab" data-tab="${id}">${label}</button>`).join("")}</div><div id="mr-discovery-content">${content}</div>
    </section>`;
  }
  featureCard(track, index) {
    const item = normalizeTrack(track);
    const art = item.artwork ? `<img src="${esc(item.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="mr-feature-art-fallback">${icon("disc")}</div>`;
    return `<article class="mr-feature-card"><div class="mr-feature-art">${art}<button class="mr-floating-play" data-action="play-track" data-source="catalog" data-index="${index}" aria-label="Play ${esc(item.title)}">${icon("play")}</button></div><div class="mr-feature-meta"><strong title="${esc(item.title)}">${esc(item.title)}</strong><span>${esc(item.artist)}</span></div><button class="mr-feature-add" data-action="queue-track" data-source="catalog" data-index="${index}" aria-label="Add ${esc(item.title)} to queue">${icon("plus")}</button></article>`;
  }
  searchResultsHTML() {
    if (this.searchBusy) return `<div class="mr-search-state"><span class="mr-spinner"></span><span>Searching 10 tracks…</span></div>`;
    if (this.searchError) return `<div class="mr-search-state is-error">${esc(this.searchError)}</div>`;
    if (this.searchQuery.trim().length < 1) return `<div class="mr-search-state"><span class="mr-search-tip">Start typing for instant suggestions. Results include artwork and browser previews when available.</span></div>`;
    if (!this.searchResults.length) return `<div class="mr-search-state">No matches for “${esc(this.searchQuery)}”. Try an artist or album.</div>`;
    return `<div class="mr-search-summary"><span>${this.searchResults.length} results</span><span>${esc(this.searchSource)}</span></div><div class="mr-search-list">${this.searchResults.map((track, index) => this.trackRow(track, index, "search", { compact: true })).join("")}</div>`;
  }
  playlistsHTML() {
    const playlists = this.allPlaylists();
    if (!playlists.length) return `<div class="mr-playlist-empty"><div class="mr-empty-orb">${icon("disc")}</div><h3>Build a library that moves with you.</h3><p>Save the server queue as a playlist. Your synchronized bot playlists appear here too.</p><button class="mr-button mr-button-primary" data-action="new-playlist">${icon("plus")} Create playlist</button></div>`;
    return `<div class="mr-playlist-list">${playlists.map((playlist, index) => {
      const tracks = playlist.tracks || [];
      const art = tracks[0]?.artwork;
      return `<article class="mr-playlist-card"><div class="mr-playlist-cover">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : `<div class="mr-playlist-cover-art">${icon("disc")}</div>`}</div><div class="mr-playlist-info"><strong>${esc(playlist.name || "Untitled playlist")}</strong><span>${Number(playlist.track_count ?? tracks.length ?? 0)} tracks · ${playlist.localOnly ? "This browser" : "Bot library"}</span></div><span class="mr-source-pill ${playlist.localOnly ? "is-local" : ""}">${playlist.localOnly ? "LOCAL" : "SYNCED"}</span><button class="mr-icon-button" data-action="play-playlist" data-index="${index}" title="Play playlist">${icon("play")}</button></article>`;
    }).join("")}</div>`;
  }
  radioHTML() {
    const results = this.radioResults.length ? `<div class="mr-radio-result-list">${this.radioResults.slice(0, 5).map((track, index) => this.trackRow(track, index, "radio", { compact: true })).join("")}</div>` : "";
    return `<section class="mr-module mr-radio-module" data-widget="radio"><div class="mr-module-head"><div><div class="mr-eyebrow">A little less predictable</div><h2>Make a radio mix</h2></div><span class="mr-drag-handle" draggable="true" title="Drag to reorder">⠿</span></div><p class="mr-module-description">Choose a mood and a niche. Rift threads the signals into a fresh, server-ready mix.</p><div class="mr-mood-chips">${MOODS.map((mood) => `<button class="mr-mood-chip ${this.radioMood.includes(mood) ? "is-selected" : ""}" data-action="toggle-mood" data-mood="${esc(mood)}" aria-pressed="${this.radioMood.includes(mood)}">${esc(mood)}</button>`).join("")}</div><div class="mr-radio-bottom"><label class="mr-radio-input-wrap"><span class="sr-only">Add a niche</span><input id="mr-radio-niche" maxlength="48" placeholder="Add a niche · shoegaze, 90s R&B…" value="${esc(this.radioQuery)}"></label><button class="mr-button mr-button-primary" data-action="start-radio" ${this.radioBusy ? "disabled" : ""}>${this.radioBusy ? `<span class="mr-spinner"></span> Building` : `${icon("spark")} Start mix`}</button></div>${results}<div class="mr-radio-note">Powered by the music catalog · Additions are sent to this server’s bot queue.</div></section>`;
  }
  lyricsHTML() {
    const current = this.current();
    let content = "";
    if (!current) content = `<div class="mr-lyrics-placeholder"><div class="mr-lyrics-symbol">♫</div><p>Lyrics will appear in sync when a track is playing.</p><span>LRCLIB · timestamped where available</span></div>`;
    else if (this.lyricsStatus === "loading") content = `<div class="mr-loading"><span class="mr-spinner"></span><span>Finding lyrics for ${esc(current.title)}…</span></div>`;
    else if (this.lyricsStatus === "synced" && this.lyrics?.synced?.length) content = `<div class="mr-lyrics-list" id="mr-lyrics-list">${this.lyrics.synced.map((line, index) => `<div class="mr-lyric-line" data-lyric-index="${index}" data-time="${line.time}">${line.words.length ? line.words.map((word) => `<span class="mr-lyric-word" data-word-time="${word.time}">${esc(word.text)}</span>`).join("") : esc(line.text)}</div>`).join("")}</div>`;
    else if (this.lyricsStatus === "plain" && this.lyrics?.plain) content = `<div class="mr-plain-lyrics">${esc(this.lyrics.plain)}</div>`;
    else content = `<div class="mr-lyrics-placeholder"><div class="mr-lyrics-symbol">♪</div><p>We couldn’t find lyrics for this track.</p><span>Try again when another song is playing.</span></div>`;
    const badge = this.lyricsStatus === "synced" ? (this.lyrics?.isWordSynced ? "WORD SYNC" : "LINE SYNC") : this.lyricsStatus === "plain" ? "UNSYNCED" : "LRCLIB";
    return `<section class="mr-module" data-widget="lyrics"><div class="mr-module-head"><div><div class="mr-eyebrow">In step with the song</div><h2>Lyrics</h2></div><div class="mr-head-actions"><span class="mr-source-pill">${badge}</span><span class="mr-drag-handle" draggable="true" title="Drag to reorder">⠿</span></div></div><div class="mr-lyrics-track">${current ? `${esc(current.title)} <span>· ${esc(current.artist)}</span>` : "Waiting for music"}</div>${content}<div class="mr-lyrics-foot">Timed LRCLIB lyrics are highlighted from source timestamps. Word glow appears only for word-timed lyrics; line-only tracks use line sync.</div></section>`;
  }
  historyHTML() {
    return this.history.length ? `<div class="mr-track-list">${this.history.slice(0, 8).map((track, index) => this.trackRow(track, index, "history", { compact: true })).join("")}</div>` : `<div class="mr-empty">No plays here yet. Start a track to begin this server’s history.</div>`;
  }
  queueHTML() {
    const current = this.current();
    const queue = this.queue();
    return `<section class="mr-module mr-queue-module"><div class="mr-module-head"><div><div class="mr-eyebrow">Coming up next</div><h2>Queue <span class="mr-count">${queue.length}</span></h2></div><div class="mr-head-actions"><button class="mr-text-button" data-action="clear-queue" ${queue.length ? "" : "disabled"}>Clear</button>${icon("queue", "mr-head-icon")}</div></div>
      ${current ? `<div class="mr-queue-current"><span class="mr-live-dot"></span><span>Now playing</span><strong>${esc(current.title)}</strong></div>` : `<div class="mr-queue-current is-idle"><span class="mr-live-dot"></span><span>Waiting for a track</span></div>`}
      ${queue.length ? `<div class="mr-queue-list">${queue.slice(0, 30).map((track, index) => `<article class="mr-queue-row" draggable="true" data-queue-index="${index}"><span class="mr-queue-grab" title="Drag to reorder">⠿</span><span class="mr-queue-number">${String(index + 1).padStart(2, "0")}</span>${track.artwork ? `<img src="${esc(track.artwork)}" alt="" loading="lazy" class="mr-queue-art">` : `<span class="mr-queue-art mr-art-fallback">${icon("disc")}</span>`}<button class="mr-queue-track" data-action="play-track" data-source="queue" data-index="${index}"><strong>${esc(track.title)}</strong><small>${esc(track.artist)}</small></button><span class="mr-queue-time">${track.durationMs ? formatTime(durationSeconds(track.durationMs)) : ""}</span><button class="mr-icon-button mr-remove-queue" data-action="remove-queue" data-index="${index}" aria-label="Remove ${esc(track.title)}">${icon("close")}</button></article>`).join("")}</div>` : `<div class="mr-queue-empty"><span class="mr-queue-empty-icon">${icon("queue")}</span><strong>The next track is yours.</strong><span>Search, choose a radio mix, or start a playlist.</span></div>`}
      ${queue.length > 30 ? `<div class="mr-queue-more">+ ${queue.length - 30} more tracks</div>` : ""}
    </section>`;
  }
  browserHTML() {
    const track = this.browserTrack;
    const current = this.current();
    return `<section class="mr-module mr-browser-module"><div class="mr-module-head"><div><div class="mr-eyebrow">Free · no voice-channel join needed</div><h2>Browser audio <span class="mr-beta-pill">BETA</span></h2></div>${icon("volume", "mr-head-icon")}</div><div class="mr-browser-track">${track?.artwork ? `<img src="${esc(track.artwork)}" alt="" class="mr-browser-art">` : `<span class="mr-browser-art mr-art-fallback">${icon("disc")}</span>`}<div class="mr-browser-meta"><strong>${esc(track?.title || "Preview a track here")}</strong><span>${esc(track?.artist || "Your browser’s audio player")}</span></div></div>${current ? `<button class="mr-text-button mr-browser-current-preview" data-action="preview-current">Play the current track’s free preview</button>` : `<button class="mr-text-button mr-browser-current-preview" data-action="focus-search">Find a track to preview</button>`}<div class="mr-audio-slot"><audio id="mr-audio" controls preload="none" playsinline aria-label="Browser music preview"></audio></div><div class="mr-browser-note">Free to use without joining voice. When available, this plays a 30-second iTunes preview; use the server bot for full tracks.</div><div class="mr-media-status" id="mr-media-status">${current ? "Browser media controls can control the server player." : "Play a preview to enable browser media controls."}</div></section>`;
  }
  voiceHTML() {
    const options = this.channels.map((channel) => `<option value="${esc(channel.id)}">${esc(channel.name)}</option>`).join("");
    return `<section class="mr-module mr-voice-module"><div class="mr-module-head"><div><div class="mr-eyebrow">Voice handoff</div><h2>Play in this server</h2></div>${icon("mic", "mr-head-icon")}</div><div class="mr-voice-state"><span class="mr-live-dot ${this.connectionLabel().startsWith("Connected") ? "is-connected" : ""}"></span><span>${esc(this.connectionLabel())}</span></div><div class="mr-voice-controls"><label class="sr-only" for="mr-voice-channel">Choose a voice channel</label><select id="mr-voice-channel" ${options ? "" : "disabled"}><option value="">${options ? "Choose a voice channel" : "Voice channels unavailable"}</option>${options}</select><button class="mr-button mr-button-secondary" data-action="join-voice" ${options ? "" : "disabled"}>Connect bot</button></div><p class="mr-voice-note">Voice presence detection is best-effort and depends on the bot API reporting the signed-in member’s live voice state.</p></section>`;
  }
  widgetMarkup() {
    const widgets = {
      discover: () => this.discoveryHTML(),
      radio: () => this.radioHTML(),
      lyrics: () => this.lyricsHTML(),
      history: () => `<section class="mr-module" data-widget="history"><div class="mr-module-head"><div><div class="mr-eyebrow">From this server</div><h2>Recently played</h2></div><button class="mr-text-button" data-action="discovery-tab" data-tab="history">See all</button><span class="mr-drag-handle" draggable="true" title="Drag to reorder">⠿</span></div><div id="mr-history-content">${this.historyHTML()}</div></section>`,
      playlists: () => `<section class="mr-module" data-widget="playlists"><div class="mr-module-head"><div><div class="mr-eyebrow">Personal library</div><h2>Your playlists</h2></div><div class="mr-head-actions"><button class="mr-text-button" data-action="refresh-playlists">Sync</button><button class="mr-icon-button" data-action="new-playlist" aria-label="Create playlist">${icon("plus")}</button><span class="mr-drag-handle" draggable="true" title="Drag to reorder">⠿</span></div></div>${this.playlistsHTML()}<div class="mr-sync-note">Your bot-owned playlists stay in sync across devices. If a sync conflict occurs, Rift refreshes the latest revision before retrying.</div></section>`,
    };
    return this.preferences.order.filter((key) => this.preferences.visible[key]).map((key) => widgets[key]()).join("");
  }
  modalHTML() {
    if (!this.modal) return "";
    if (this.modal === "customize") {
      return `<div class="mr-modal-backdrop" data-action="close-modal"><section class="mr-modal" role="dialog" aria-modal="true" aria-labelledby="mr-modal-title"><header class="mr-modal-head"><div><div class="mr-eyebrow">Make this room yours</div><h2 id="mr-modal-title">Customize music</h2></div><button class="mr-icon-button" data-action="close-modal" aria-label="Close">${icon("close")}</button></header><div class="mr-modal-section"><label class="mr-form-label">Accent color</label><div class="mr-swatches">${ACCENTS.map((accent) => `<button class="mr-swatch ${this.preferences.accent === accent.value ? "is-selected" : ""}" data-action="set-accent" data-accent="${accent.value}" style="--swatch:${accent.value}" aria-label="${accent.name}" title="${accent.name}"></button>`).join("")}</div></div><div class="mr-modal-section"><label class="mr-form-label">Show in your room</label><div class="mr-pref-list">${DEFAULT_ORDER.map((key) => `<label class="mr-pref-row"><span><strong>${key === "discover" ? "Discover" : key[0].toUpperCase() + key.slice(1)}</strong><small>${key === "discover" ? "Popular and recommended music" : key === "radio" ? "Mood and niche mixes" : key === "lyrics" ? "Timestamp-synced lyrics" : key === "history" ? "Recently played tracks" : "Saved playlists"}</small></span><input type="checkbox" data-pref-widget="${key}" ${this.preferences.visible[key] ? "checked" : ""}></label>`).join("")}</div></div><div class="mr-modal-section"><label class="mr-pref-row"><span><strong>Compact layout</strong><small>Reduce row spacing for a denser room</small></span><input type="checkbox" data-pref-compact ${this.preferences.compact ? "checked" : ""}></label></div><div class="mr-modal-foot"><span>Drag ⠿ handles to reorder cards.</span><button class="mr-button mr-button-primary" data-action="save-customize">Save layout</button></div></section></div>`;
    }
    if (this.modal === "playlist") {
      const tracks = this.draftTracks.length ? this.draftTracks : [this.current(), ...this.queue()].filter(Boolean);
      return `<div class="mr-modal-backdrop" data-action="close-modal"><section class="mr-modal" role="dialog" aria-modal="true" aria-labelledby="mr-modal-title"><header class="mr-modal-head"><div><div class="mr-eyebrow">A collection of your own</div><h2 id="mr-modal-title">Create playlist</h2></div><button class="mr-icon-button" data-action="close-modal" aria-label="Close">${icon("close")}</button></header><form id="mr-playlist-form"><label class="mr-form-label" for="mr-playlist-name">Playlist name</label><input class="mr-modal-input" id="mr-playlist-name" maxlength="64" placeholder="Sunday night drive" required><div class="mr-playlist-draft-count">${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} · ${this.draftTracks.length ? "from your picks" : "from the current server queue"}</div><div class="mr-modal-foot"><span>Remote sync depends on playlist write support in the bot API.</span><button class="mr-button mr-button-primary" type="submit">Save playlist</button></div></form></section></div>`;
    }
    return "";
  }

  pageHTML() {
    const current = this.current();
    const art = current?.artwork ? `<img class="mr-hero-art-image" id="mr-current-art" src="${esc(current.artwork)}" alt="Album artwork" referrerpolicy="no-referrer">` : "";
    const title = current?.title || "A little room for music";
    const artist = current?.artist || "Search, queue, and listen together";
    const album = current?.album || (current ? "Now in this server" : "Your server’s sound, in sync");
    const total = current ? durationSeconds(current.durationMs) : 0;
    const pos = this.getBotPosition();
    return `<div class="mr-shell ${this.preferences.compact ? "is-compact" : ""}" style="--mr-accent:${esc(this.preferences.accent)}">
      <div class="mr-toast" id="mr-toast" role="status" aria-live="polite"></div>
      <header class="mr-heading"><div class="mr-title-block"><div class="mr-brandline"><span class="mr-brand-mark">R</span><span>RIFT <i>/</i> MUSIC ROOM</span><span id="mr-sync-pill" class="mr-sync-pill ${this.apiOnline ? "is-online" : ""}"><i></i>${this.apiOnline ? "LIVE SYNC" : "CONNECTING"}</span></div><h1>Music <span>room</span></h1><p>A shared listening space for <strong>${esc(this.serverName())}</strong>.</p></div><div class="mr-heading-actions"><button class="mr-button mr-button-secondary" data-action="customize">${icon("settings")} Customize</button><a class="mr-button mr-button-quiet" href="https://discord.com/channels/${esc(this.guildId)}" target="_blank" rel="noreferrer">Open Discord ${icon("arrow")}</a></div></header>
      <div id="mr-voice-prompt" class="mr-voice-prompt-slot"></div>
      <section class="mr-hero ${current && !this.isPaused() ? "is-playing" : ""}" aria-label="Now playing"><div class="mr-hero-orb mr-hero-orb-one"></div><div class="mr-hero-orb mr-hero-orb-two"></div><div class="mr-hero-content"><div class="mr-cover-wrap"><div class="mr-cover-disc"></div><div class="mr-cover-card">${art}<div class="mr-cover-empty">${icon("disc")}</div></div><span class="mr-cover-state">${current ? this.isPaused() ? "PAUSED" : "ON AIR" : "READY"}</span></div><div class="mr-hero-info"><div class="mr-now-label"><span class="mr-live-dot ${current && !this.isPaused() ? "is-connected" : ""}"></span>${current ? "NOW PLAYING IN THIS SERVER" : "YOUR SERVER PLAYER"}</div><h2 title="${esc(title)}" id="mr-current-title">${esc(title)}</h2><p class="mr-current-artist" id="mr-current-artist">${esc(artist)} <span>· ${esc(album)}</span></p><div class="mr-progress-wrap"><span id="mr-current-time">${formatTime(pos)}</span><input id="mr-seek" class="mr-progress" aria-label="Seek in current track" type="range" min="0" max="${Math.max(total, 1)}" step="0.25" value="${Math.min(pos, Math.max(total, 1))}" ${current ? "" : "disabled"}><span id="mr-total-time">${formatTime(total)}</span></div><div class="mr-transport"><button class="mr-icon-button" data-action="control" data-control="previous" aria-label="Previous track" title="Previous">${icon("previous")}</button><button class="mr-play-button" data-action="control" data-control="toggle" aria-label="${this.isPaused() ? "Play" : "Pause"}" title="${this.isPaused() ? "Play" : "Pause"}">${icon(this.isPaused() ? "play" : "pause")}</button><button class="mr-icon-button" data-action="control" data-control="skip" aria-label="Next track" title="Next">${icon("next")}</button><button class="mr-icon-button ${this.shuffleValue() ? "is-on" : ""}" data-action="control" data-control="shuffle" aria-label="Toggle shuffle" title="Shuffle">${icon("shuffle")}</button><button class="mr-icon-button ${this.loopValue() ? "is-on" : ""}" data-action="control" data-control="repeat" aria-label="Toggle repeat" title="Repeat">${icon("repeat")}</button><button class="mr-icon-button mr-stop-button" data-action="control" data-control="stop" aria-label="Stop playback" title="Stop">${icon("close")}</button></div><div class="mr-volume-control">${icon("volume")}<input id="mr-volume" aria-label="Server player volume" type="range" min="0" max="100" step="1" value="${this.volumeValue()}"><span id="mr-volume-value">${this.volumeValue()}%</span></div></div><div class="mr-hero-side"><div class="mr-room-card"><span class="mr-room-card-label">ROOM STATUS</span><strong>${this.apiOnline ? "In sync" : "Connecting"}</strong><span>${esc(this.connectionLabel())}</span><div class="mr-equalizer ${current && !this.isPaused() ? "is-active" : ""}" aria-label="Playback activity">${Array.from({ length: 17 }, (_, i) => `<i style="--bar:${(i % 5) + 1}"></i>`).join("")}</div></div><div class="mr-hero-links"><button data-action="focus-search">${icon("search")} Find a song</button><button data-action="focus-lyrics">${icon("spark")} Live lyrics</button></div></div></div><div class="mr-hero-bottom"><span>${current ? `Playing from <strong>${esc(this.serverName())}</strong>` : "Pick a track to get the room started"}</span><span class="mr-hero-badge">${current ? "BOT PLAYER" : "MUSIC CONTROL"}</span></div></section>
      <div class="mr-layout"><main class="mr-main-column"><section class="mr-module mr-search-module"><div class="mr-module-head"><div><div class="mr-eyebrow">Start with a feeling, artist or track</div><h2>Find your next track</h2></div><span class="mr-search-count">10 suggestions · instant</span></div><div class="mr-search-input-wrap">${icon("search", "mr-search-icon")}<input id="mr-search" class="mr-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search songs, artists, albums…" value="${esc(this.searchQuery)}" aria-label="Search music"><kbd>/</kbd><button class="mr-search-clear" data-action="clear-search" aria-label="Clear search" ${this.searchQuery ? "" : "hidden"}>${icon("close")}</button></div><div id="mr-search-results" class="mr-search-results">${this.searchResultsHTML()}</div></section>${this.widgetMarkup()}</main><aside class="mr-side-column">${this.queueHTML()}${this.browserHTML()}${this.voiceHTML()}<section class="mr-side-tip"><div class="mr-tip-icon">${icon("spark")}</div><div><strong>Made for a room, not a screen.</strong><p>Live playback stays with the server bot. Browser previews are private to this tab.</p></div></section></aside></div>
      <footer class="mr-footer"><span>RIFT MUSIC ROOM <i>·</i> lightweight by design</span><span>Server search & playback via Lavalink · previews via iTunes · lyrics via LRCLIB</span></footer>${this.modalHTML()}
    </div>`;
  }
  serverName() {
    const name = document.querySelector("aside img + span")?.textContent?.trim();
    return name || "your server";
  }

  render() {
    if (this.disposed || !this.root.isConnected) return;
    const active = this.root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = active?.id;
    const selection = active && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
    const audio = this.audio || this.root.querySelector("#mr-audio");
    this.root.innerHTML = this.pageHTML();
    const slot = this.root.querySelector(".mr-audio-slot");
    if (audio && slot) { slot.replaceWith(audio); this.audio = audio; }
    else this.audio = this.root.querySelector("#mr-audio");
    this.bindAudio();
    this.updateVoiceChannels();
    this.updateVoicePrompt();
    this.tickProgress();
    this.tickLyrics();
    if (focusId) {
      const next = this.root.querySelector(`#${CSS.escape(focusId)}`);
      if (next) {
        next.focus({ preventScroll: true });
        if (selection && typeof next.setSelectionRange === "function") try { next.setSelectionRange(...selection); } catch { /* non-text inputs */ }
      }
    }
  }
  bindAudio() {
    if (!this.audio || this.audio.__riftBound) return;
    this.audio.__riftBound = true;
    this.audio.addEventListener("play", () => { this.syncMediaSession(); this.updateBrowserPlayer(); });
    this.audio.addEventListener("pause", () => { this.syncMediaSession(); this.updateBrowserPlayer(); });
    this.audio.addEventListener("timeupdate", () => { this.tickLyrics(); this.tickProgress(); this.syncMediaSession(); });
    this.audio.addEventListener("ended", () => { this.browserTrack = null; this.syncMediaSession(); this.updateBrowserPlayer(); this.notify("Preview finished.", "info"); });
    this.audio.addEventListener("error", () => { if (this.browserTrack) this.notify("This preview could not be played in the browser.", "error"); });
  }
  updateVoiceChannels() {
    const select = this.root.querySelector("#mr-voice-channel");
    if (!select || !this.channels.length) return;
    const previous = select.value;
    const options = this.channels.map((channel) => `<option value="${esc(channel.id)}">${esc(channel.name)}</option>`).join("");
    select.innerHTML = `<option value="">Choose a voice channel</option>${options}`;
    if (previous) select.value = previous;
    select.disabled = false;
    const join = this.root.querySelector('[data-action="join-voice"]');
    if (join) join.disabled = false;
  }
  updateVoicePrompt() {
    const slot = this.root.querySelector("#mr-voice-prompt");
    if (!slot) return;
    const presence = this.voicePresence;
    if (!presence) { slot.innerHTML = ""; return; }
    const sameGuild = presence.guildId === this.guildId;
    slot.innerHTML = `<div class="mr-voice-detected mr-voice-banner"><span class="mr-live-dot is-connected"></span><div><strong>Voice channel detected</strong><span>You’re in ${esc(presence.channelName)} · ${esc(presence.guildName)}</span></div><button class="mr-button mr-button-secondary" data-action="voice-hop">${sameGuild ? "Bring music here" : "Open this server"} ${icon("arrow")}</button><button class="mr-icon-button" data-action="dismiss-voice" aria-label="Dismiss">${icon("close")}</button></div>`;
  }
  updateSearchResults() {
    const target = this.root.querySelector("#mr-search-results");
    if (target) target.innerHTML = this.searchResultsHTML();
    const clear = this.root.querySelector(".mr-search-clear");
    if (clear) clear.hidden = !this.searchQuery;
  }
  renderSearchResults() { this.updateSearchResults(); }
  updateDiscovery() {
    const content = this.root.querySelector("#mr-discovery-content");
    if (!content) return;
    const section = this.root.querySelector('[data-widget="discover"]');
    if (section) {
      section.querySelectorAll(".mr-tab").forEach((tab) => {
        const active = tab.dataset.tab === this.catalogTab;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
    }
    content.innerHTML = this.discoveryContentOnly();
  }
  discoveryContentOnly() {
    if (this.catalogBusy) return `<div class="mr-loading"><span class="mr-spinner"></span><span>Finding your next favorite…</span></div>`;
    if (this.catalogError) return `<div class="mr-empty">${esc(this.catalogError)} <button data-action="retry-discovery">Try again</button></div>`;
    if (this.catalogTab === "playlists") return this.playlistsHTML();
    if (this.catalogTab === "history") return this.catalogResults.length ? `<div class="mr-track-list">${this.catalogResults.slice(0, 12).map((t, i) => this.trackRow(t, i, "catalog", { compact: true })).join("")}</div>` : `<div class="mr-empty">Your listening history will gather here as this server plays music.</div>`;
    if (!this.catalogResults.length) return `<div class="mr-empty">Nothing here yet. Try the search bar above, or choose a mood below.</div>`;
    return this.catalogTab === "popular" ? `<div class="mr-track-list">${this.catalogResults.slice(0, 12).map((t, i) => this.trackRow(t, i, "catalog")).join("")}</div>` : `<div class="mr-featured-grid">${this.catalogResults.slice(0, 8).map((track, index) => this.featureCard(track, index)).join("")}</div>`;
  }
  updateRadio() {
    const module = this.root.querySelector('[data-widget="radio"]');
    if (!module) return;
    const replacement = document.createElement("div");
    replacement.innerHTML = this.radioHTML();
    module.replaceWith(replacement.firstElementChild);
  }
  updateLyrics() {
    const module = this.root.querySelector('[data-widget="lyrics"]');
    if (!module) return;
    const replacement = document.createElement("div");
    replacement.innerHTML = this.lyricsHTML();
    module.replaceWith(replacement.firstElementChild);
    this.activeLyricIndex = -1;
    this.tickLyrics();
  }
  updateHistory() {
    const target = this.root.querySelector("#mr-history-content");
    if (target) target.innerHTML = this.historyHTML();
  }
  updateBrowserPlayer() {
    if (!this.root.isConnected) return;
    const track = this.browserTrack;
    const meta = this.root.querySelector(".mr-browser-meta");
    const status = this.root.querySelector("#mr-media-status");
    if (meta) meta.innerHTML = `<strong>${esc(track?.title || "Preview a track here")}</strong><span>${esc(track?.artist || "Your browser’s audio player")}</span>`;
    const art = this.root.querySelector(".mr-browser-track .mr-browser-art");
    if (art && track?.artwork && art.tagName === "IMG") art.src = track.artwork;
    else if (art && track?.artwork && art.tagName !== "IMG") {
      const image = document.createElement("img");
      image.className = "mr-browser-art"; image.alt = ""; image.src = track.artwork; image.loading = "lazy";
      art.replaceWith(image);
    } else if (art && !track && art.tagName === "IMG") {
      const fallback = document.createElement("span"); fallback.className = "mr-browser-art mr-art-fallback"; fallback.innerHTML = icon("disc"); art.replaceWith(fallback);
    }
    if (status) status.textContent = track ? (this.audio && !this.audio.paused ? "Browser preview active · use the tab or device media controls." : "Preview paused · use the audio controls to resume.") : this.current() ? "Browser media controls can control the server player." : "Play a preview to enable browser media controls.";
  }
  setConnectionStatus(text, online) {
    const pill = this.root.querySelector("#mr-sync-pill");
    if (!pill) return;
    pill.classList.toggle("is-online", online);
    pill.innerHTML = `<i></i>${esc(online ? "LIVE SYNC" : text === "Connecting" ? "CONNECTING" : "OFFLINE")}`;
    pill.title = text;
  }
  tickProgress() {
    if (!this.root.isConnected) return;
    const position = this.getBotPosition();
    const current = this.current();
    const range = this.root.querySelector("#mr-seek");
    const time = this.root.querySelector("#mr-current-time");
    const duration = current ? durationSeconds(current.durationMs) : 0;
    if (range && !range.matches(":active")) {
      range.max = String(Math.max(duration, 1));
      range.value = String(Math.min(position, Math.max(duration, 1)));
    }
    if (time) time.textContent = formatTime(position);
    const total = this.root.querySelector("#mr-total-time");
    if (total) total.textContent = formatTime(duration);
  }
  tickLyrics() {
    if (!this.root.isConnected || this.lyricsStatus !== "synced" || !this.lyrics?.synced?.length) return;
    const position = this.getActivePosition();
    const rows = this.lyrics.synced;
    let index = -1;
    for (let i = 0; i < rows.length; i++) { if (rows[i].time <= position + 0.08) index = i; else break; }
    const currentActive = this.root.querySelector(`.mr-lyric-line[data-lyric-index="${index}"].is-active`);
    if (index !== this.activeLyricIndex || (index >= 0 && !currentActive)) {
      const list = this.root.querySelector("#mr-lyrics-list");
      this.root.querySelectorAll(".mr-lyric-line.is-active").forEach((line) => line.classList.remove("is-active"));
      const active = this.root.querySelector(`.mr-lyric-line[data-lyric-index="${index}"]`);
      if (active) {
        active.classList.add("is-active");
        if (list) {
          const targetTop = active.offsetTop - list.clientHeight * 0.46;
          list.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        }
      }
      this.activeLyricIndex = index;
    }
    const activeLine = this.root.querySelector(`.mr-lyric-line[data-lyric-index="${index}"]`);
    if (activeLine) {
      const words = [...activeLine.querySelectorAll(".mr-lyric-word")];
      let activeWord = -1;
      for (let i = 0; i < words.length; i++) if (Number(words[i].dataset.wordTime) <= position + 0.035) activeWord = i;
      words.forEach((word, i) => word.classList.toggle("is-word-active", i === activeWord));
    }
  }
  tick() {
    if (this.disposed) return;
    if (!document.hidden) { this.tickProgress(); this.tickLyrics(); }
    this.tickFrame = requestAnimationFrame(() => this.tick());
  }

  installMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const bind = (name, handler) => { try { session.setActionHandler(name, handler); } catch { /* unsupported action */ } };
    bind("play", () => {
      if (this.browserTrack && this.audio) this.audio.play().catch(() => {});
      else if (this.isPaused()) this.handleStandardControl("toggle");
    });
    bind("pause", () => {
      if (this.browserTrack && this.audio) this.audio.pause();
      else if (!this.isPaused()) this.handleStandardControl("toggle");
    });
    bind("nexttrack", () => this.handleStandardControl("skip"));
    bind("previoustrack", () => this.handleStandardControl("previous"));
    bind("seekto", (details) => {
      if (this.browserTrack && this.audio && Number.isFinite(details.seekTime)) this.audio.currentTime = details.seekTime;
      else if (Number.isFinite(details.seekTime)) this.control("seek", Math.round(details.seekTime * 1000), { position: Math.round(details.seekTime * 1000) });
    });
    bind("seekforward", (details) => {
      const offset = details.seekOffset || 10;
      if (this.browserTrack && this.audio) this.audio.currentTime += offset;
      else { const position = Math.round((this.getBotPosition() + offset) * 1000); this.control("seek", position, { position }); }
    });
    bind("seekbackward", (details) => {
      const offset = details.seekOffset || 10;
      if (this.browserTrack && this.audio) this.audio.currentTime = Math.max(0, this.audio.currentTime - offset);
      else { const position = Math.max(0, Math.round((this.getBotPosition() - offset) * 1000)); this.control("seek", position, { position }); }
    });
    this.syncMediaSession();
  }
  syncMediaSession() {
    const track = this.browserTrack || this.current();
    document.title = track ? `${track.title} · ${track.artist} | Rift Dashboard` : `Music room · Rift Dashboard`;
    if (!("mediaSession" in navigator)) return;
    if (!track) {
      try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } catch { /* browser differences */ }
      return;
    }
    try {
      if ("MediaMetadata" in window) navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || "Rift Music Room",
        artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512", type: "image/jpeg" }] : [],
      });
      const playing = this.browserTrack ? !!this.audio && !this.audio.paused : !this.isPaused();
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      const duration = this.browserTrack && this.audio ? this.audio.duration : durationSeconds(track.durationMs);
      if (Number.isFinite(duration) && duration > 0 && "setPositionState" in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(this.getActivePosition(), duration) });
      }
    } catch { /* media controls are progressive enhancement */ }
  }

  notify(message, type = "info") {
    const target = this.root.querySelector("#mr-toast");
    if (!target) return;
    target.textContent = message;
    target.className = `mr-toast is-visible is-${type}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => target.classList.remove("is-visible"), 4200);
  }
  focusSearch() { this.root.querySelector("#mr-search")?.focus(); }
  handleInput(event) {
    if (event.target.id === "mr-search") {
      this.searchQuery = event.target.value;
      const clear = this.root.querySelector(".mr-search-clear");
      if (clear) clear.hidden = !this.searchQuery;
      clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => this.runSearch(this.searchQuery), 180);
    } else if (event.target.id === "mr-radio-niche") this.radioQuery = event.target.value;
    else if (event.target.id === "mr-seek") {
      const label = this.root.querySelector("#mr-current-time");
      if (label) label.textContent = formatTime(Number(event.target.value));
    }
  }
  handleSubmit(event) {
    if (event.target?.id === "mr-playlist-form") {
      event.preventDefault();
      this.savePlaylist(this.root.querySelector("#mr-playlist-name")?.value || "");
    }
  }
  handleChange(event) {
    if (event.target.id === "mr-seek") {
      const seconds = Math.max(0, Number(event.target.value));
      this.control("seek", Math.round(seconds * 1000), { position: Math.round(seconds * 1000) });
    } else if (event.target.id === "mr-volume") {
      this.control("volume", Number(event.target.value));
    } else if (event.target.matches("[data-pref-widget]")) {
      this.preferences.visible[event.target.dataset.prefWidget] = event.target.checked;
    } else if (event.target.matches("[data-pref-compact]")) this.preferences.compact = event.target.checked;
  }
  handleKeydown(event) {
    if (event.key === "Escape" && this.modal) { this.modal = ""; this.render(); return; }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault(); this.focusSearch();
    }
    if (event.key === "Enter" && event.target.id === "mr-search" && this.searchResults[0]) {
      event.preventDefault(); this.playOnBot(this.searchResults[0]);
    }
    if (event.key === "Enter" && event.target.id === "mr-radio-niche") { event.preventDefault(); this.playRadio(); }
  }
  async handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !this.root.contains(button)) return;
    const action = button.dataset.action;
    if (button.classList.contains("mr-modal-backdrop") && event.target !== button) return;
    switch (action) {
      case "customize": this.modal = "customize"; this.render(); break;
      case "save-customize": this.savePreferences(); this.modal = ""; this.render(); this.notify("Your music room layout is saved.", "success"); break;
      case "close-modal": this.modal = ""; this.render(); break;
      case "set-accent": this.preferences.accent = button.dataset.accent; this.savePreferences(); this.render(); break;
      case "focus-search": this.focusSearch(); break;
      case "focus-lyrics": this.root.querySelector('[data-widget="lyrics"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); break;
      case "control": await this.handleStandardControl(button.dataset.control); break;
      case "play-track": {
        const track = this.getTrack(button.dataset.source, button.dataset.index);
        if (track) await this.playOnBot(track);
        break;
      }
      case "queue-track": {
        const track = this.getTrack(button.dataset.source, button.dataset.index);
        if (track) await this.queueOnBot(track);
        break;
      }
      case "preview-track": {
        const track = this.getTrack(button.dataset.source, button.dataset.index);
        if (track) await this.playPreview(track);
        break;
      }
      case "preview-current": {
        const track = this.current();
        if (track) await this.playPreview(track);
        break;
      }
      case "draft-track": {
        const track = this.getTrack(button.dataset.source, button.dataset.index);
        if (track) this.addToDraft(track);
        break;
      }
      case "discovery-tab": await this.loadDiscovery(button.dataset.tab); break;
      case "retry-discovery": await this.loadDiscovery(this.catalogTab); break;
      case "refresh-discovery": await this.loadDiscovery(this.catalogTab); break;
      case "clear-search": this.searchController?.abort(); this.searchController = null; this.searchBusy = false; this.searchQuery = ""; this.searchResults = []; this.searchError = ""; this.render(); this.focusSearch(); break;
      case "toggle-mood": {
        const mood = button.dataset.mood;
        this.radioMood = this.radioMood.includes(mood) ? this.radioMood.filter((item) => item !== mood) : [...this.radioMood, mood];
        this.preferences.radioMood = [...this.radioMood]; this.savePreferences();
        this.render();
        break;
      }
      case "start-radio": await this.playRadio(); break;
      case "new-playlist": this.modal = "playlist"; this.render(); this.root.querySelector("#mr-playlist-name")?.focus(); break;
      case "play-playlist": {
        const playlist = this.allPlaylists()[Number(button.dataset.index)];
        if (playlist) await this.playPlaylist(playlist);
        break;
      }
      case "refresh-playlists": await this.loadAccountAndPlaylists(); this.render(); this.notify("Playlist library refreshed.", "success"); break;
      case "clear-queue": await this.control("clear"); break;
      case "remove-queue": await this.removeQueueItem(Number(button.dataset.index)); break;
      case "join-voice": {
        const channelId = this.root.querySelector("#mr-voice-channel")?.value;
        if (!channelId) { this.notify("Choose a voice channel first.", "error"); break; }
        const ok = await this.control("join", channelId, { channel_id: channelId });
        if (ok) this.notify("Asked the bot to connect to voice.", "success");
        break;
      }
      case "voice-hop": {
        if (this.voicePresence?.guildId === this.guildId) {
          const ok = await this.control("join", this.voicePresence.channelId, { channel_id: this.voicePresence.channelId });
          if (ok) this.notify(`Connecting to ${this.voicePresence.channelName}.`, "success");
        } else if (this.voicePresence?.guildId) window.location.href = `/g/${encodeURIComponent(this.voicePresence.guildId)}/music`;
        break;
      }
      case "dismiss-voice": this.voicePresence = null; this.updateVoicePrompt(); this.render(); break;
      default: break;
    }
  }
  handleDragStart(event) {
    const queueRow = event.target.closest("[data-queue-index]");
    const widget = event.target.closest("[data-widget]");
    if (queueRow) {
      event.dataTransfer?.setData("text/plain", `queue:${queueRow.dataset.queueIndex}`);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      queueRow.classList.add("is-dragging");
    } else if (widget && event.target.closest(".mr-drag-handle")) {
      event.dataTransfer?.setData("text/plain", `widget:${widget.dataset.widget}`);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      widget.classList.add("is-dragging");
    } else if (widget) event.preventDefault();
  }
  handleDragOver(event) {
    if (event.target.closest("[data-widget], [data-queue-index]")) event.preventDefault();
  }
  handleDrop(event) {
    const payload = event.dataTransfer?.getData("text/plain") || "";
    if (!payload) return;
    const [type, value] = payload.split(":");
    if (type === "widget") {
      const source = value;
      const target = event.target.closest("[data-widget]")?.dataset.widget;
      if (target && source !== target) {
        const order = [...this.preferences.order];
        const from = order.indexOf(source); const to = order.indexOf(target);
        if (from >= 0 && to >= 0) { order.splice(from, 1); order.splice(to, 0, source); this.preferences.order = order; this.savePreferences(); this.render(); }
      }
    } else if (type === "queue") {
      const target = event.target.closest("[data-queue-index]")?.dataset.queueIndex;
      if (target !== undefined) this.reorderQueue(Number(value), Number(target));
    }
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.pollTimer); clearInterval(this.historyTimer); clearInterval(this.voiceTimer); clearInterval(this.playlistTimer); clearTimeout(this.searchTimer); clearTimeout(this.toastTimer);
    cancelAnimationFrame(this.tickFrame);
    this.searchController?.abort();
    this.controllers.forEach((controller) => controller.abort());
    this.root.removeEventListener("click", this.boundClick);
    this.root.removeEventListener("input", this.boundInput);
    this.root.removeEventListener("change", this.boundChange);
    this.root.removeEventListener("keydown", this.boundKey);
    this.root.removeEventListener("dragstart", this.boundDragStart);
    this.root.removeEventListener("dragover", this.boundDragOver);
    this.root.removeEventListener("drop", this.boundDrop);
    this.root.removeEventListener("dragend", this.boundDragEnd);
    this.root.removeEventListener("submit", this.boundSubmit);
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load(); }
    document.title = this.originalDocumentTitle;
    try {
      if ("mediaSession" in navigator) {
        ["play", "pause", "nexttrack", "previoustrack", "seekto", "seekforward", "seekbackward"].forEach((name) => navigator.mediaSession.setActionHandler(name, null));
        navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none";
      }
    } catch { /* unsupported */ }
  }
}

let activeRoom = null;
let activeMount = null;
let activeGuildId = "";
let pickerMount = null;
let pickerController = null;
let pickerTimer = 0;
async function renderPickerVoice(mount) {
  if (pickerController) pickerController.abort();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const controller = new AbortController();
  pickerController = controller;
  try {
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!userResponse.ok) return;
    const user = await userResponse.json();
    const candidates = [...document.querySelectorAll("[data-rift-guild-id]")].map((button) => ({
      guildId: String(button.dataset.riftGuildId || ""),
      guildName: button.dataset.serverName || "your server",
    })).filter((entry) => entry.guildId);
    if (!candidates.length) return;
    let location = null;
    for (let offset = 0; offset < candidates.length && !location; offset += 4) {
      const batch = await Promise.all(candidates.slice(offset, offset + 4).map(async (candidate) => {
        try {
          const voice = await request(`/user/voice/${encodeURIComponent(candidate.guildId)}/${encodeURIComponent(user.id)}`, { signal: controller.signal });
          return voicePresenceFrom(voice, candidate.guildId, candidate.guildName);
        } catch { return null; }
      }));
      location = batch.find(Boolean) || null;
    }
    if (controller.signal.aborted || !mount.isConnected || !location) return;
    try { if (sessionStorage.getItem(`rift_voice_picker_dismissed:${location.guildId}`)) return; } catch { /* private browsing */ }
    mount.innerHTML = `<section class="mr-picker-voice-banner" role="status"><div class="mr-picker-voice-icon">${icon("mic")}</div><div class="mr-picker-voice-copy"><span>VOICE CHANNEL DETECTED</span><strong>You’re in ${esc(location.channelName)}</strong><small>${esc(location.guildName)} · Jump straight to its music room.</small></div><button class="mr-picker-voice-open" data-picker-action="open" data-guild-id="${esc(location.guildId)}">Open music room ${icon("arrow")}</button><button class="mr-picker-voice-dismiss" data-picker-action="dismiss" data-guild-id="${esc(location.guildId)}" aria-label="Dismiss">${icon("close")}</button></section>`;
  } catch { /* voice detection is optional and the server list remains usable */ }
}
function syncVoicePicker() {
  const mount = document.querySelector("[data-rift-voice-picker]");
  if (window.location.pathname !== "/guilds" || !mount) {
    if (pickerController) pickerController.abort();
    clearInterval(pickerTimer);
    pickerController = null; pickerMount = null; pickerTimer = 0;
    return;
  }
  if (mount === pickerMount) return;
  if (pickerController) pickerController.abort();
  clearInterval(pickerTimer);
  pickerMount = mount;
  renderPickerVoice(mount);
  pickerTimer = window.setInterval(() => {
    if (pickerMount === mount && mount.isConnected && window.location.pathname === "/guilds") renderPickerVoice(mount);
  }, 15000);
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-picker-action]");
  if (!button) return;
  if (button.dataset.pickerAction === "open" && button.dataset.guildId) window.location.href = `/g/${encodeURIComponent(button.dataset.guildId)}/music`;
  if (button.dataset.pickerAction === "dismiss") {
    try { sessionStorage.setItem(`rift_voice_picker_dismissed:${button.dataset.guildId}`, "1"); } catch { /* private browsing */ }
    button.closest(".mr-picker-voice-banner")?.remove();
  }
});
function syncRoute() {
  const mount = document.querySelector("[data-rift-music-root]");
  const match = window.location.pathname.match(/^\/g\/([^/]+)\/music\/?$/);
  if (!mount || !match) {
    if (activeRoom) activeRoom.dispose();
    activeRoom = null; activeMount = null; activeGuildId = "";
    return;
  }
  const guildId = decodeURIComponent(match[1]);
  if (activeRoom && activeMount === mount && activeGuildId === guildId) return;
  if (activeRoom) activeRoom.dispose();
  activeMount = mount; activeGuildId = guildId;
  activeRoom = new MusicRoom(mount, guildId);
}
function installRouteHooks() {
  const originalPush = history.pushState;
  history.pushState = function (...args) { const result = originalPush.apply(this, args); window.dispatchEvent(new Event("rift:routechange")); return result; };
  const originalReplace = history.replaceState;
  history.replaceState = function (...args) { const result = originalReplace.apply(this, args); window.dispatchEvent(new Event("rift:routechange")); return result; };
  const sync = () => { syncRoute(); syncVoicePicker(); };
  window.addEventListener("popstate", sync);
  window.addEventListener("rift:routechange", sync);
  const observer = new MutationObserver(sync);
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
  sync();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRouteHooks, { once: true });
else installRouteHooks();
