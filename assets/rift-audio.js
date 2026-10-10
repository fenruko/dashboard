/*
 * Rift Audio
 * A small, framework-free dashboard client. The interface is useful without a
 * backend (demo data stays local), then progressively connects to the Rift bot
 * API when an API base is configured in Settings.
 */

const root = document.getElementById("app");
const storageKey = "rift_audio_preferences_v1";
const queueKey = "rift_audio_queue_v1";
const playlistKey = "rift_audio_playlists_v1";
const tokenKeys = ["rift_dashboard_token", "rift_token"];

const icons = {
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18.4V6.7a1 1 0 0 1 1.44-.9l9.06 4.52a1 1 0 0 1 0 1.79L7.44 16.6A1 1 0 0 1 6 15.7v2.7Z"/><path d="M10 4v16"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/></svg>',
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2.1 4.8-4.9 2.2 2.2-4.9 4.8-2.1Z"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0"/><path d="M7 14a5 5 0 0 1 10 0"/><path d="M10 14a2 2 0 0 1 4 0"/><circle cx="12" cy="18" r="1.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.4 2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1s-8.8-5-8.8-10.1a4.3 4.3 0 0 1 7.7-2.6L12 7.5l1.1-1.4a4.3 4.3 0 0 1 7.7 2.6Z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.3 2.3-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.1h-3.24v-.1a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.3-2.3.06-.06A1.7 1.7 0 0 0 6.4 15a1.7 1.7 0 0 0-1.56-1.04h-.1v-3.24h.1A1.7 1.7 0 0 0 6.4 9.68 1.7 1.7 0 0 0 6.06 7.8L6 7.74l2.3-2.3.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.04-1.56v-.1h3.24v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.3 2.3-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.1v3.24h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.2 5.7c0-1.2 1.3-2 2.3-1.3l8.1 6.1c.8.6.8 1.8 0 2.4l-8.1 6.1c-1 .7-2.3 0-2.3-1.3V5.7Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.8" y="5" width="3.8" height="14" rx="1"/><rect x="13.4" y="5" width="3.8" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2.3v14H6zM18.1 5.7c0-1.2-1.3-2-2.3-1.3L9 10.5c-.8.6-.8 1.8 0 2.4l6.8 6.1c1 .7 2.3 0 2.3-1.3V5.7Z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.7 5H18v14h-2.3zM5.9 5.7c0-1.2 1.3-2 2.3-1.3l6.8 6.1c.8.6.8 1.8 0 2.4l-6.8 6.1c-1 .7-2.3 0-2.3-1.3V5.7Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4M4 7h3c4.5 0 5.5 10 10 10h3M16 13l4 4-4 4M4 17h3c1.5 0 2.6-1.1 3.7-2.6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 7h18M7 22l-4-4 4-4M21 17H3"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9.3a4 4 0 0 1 0 5.4M18.8 6.6a8 8 0 0 1 0 10.8"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h11M4 12h11M4 18h7"/><path d="m18 16 3 2-3 2v-4Z"/></svg>',
  lyrics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M8 13h.01M16 13h.01M8 17h8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.3 4.3L19 6.7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 19 14-14 2 2L7 21l-2-2Z"/><path d="m14 4 .8-2 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM5 8l.6-1.4L7 8l1.4.6L7 9.2 6.4 11 5.8 9.2 4 8.6 5.8 8Z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 1.9 7.1L21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9L12 2Z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M20 15v5h-5"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2.1-2.1a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2.1 2.1a5 5 0 1 0 7.1 7.1l1.2-1.2"/></svg>',
  headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h4v6H6a2 2 0 0 1-2-2v-4ZM20 14h-4v6h2a2 2 0 0 0 2-2v-4Z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4.2 0 7-2.9 7-6.8 0-2.8-1.6-5-4.1-7.6-.2 2.1-1.4 3.3-2.9 4.2.1-3-1.4-5.5-3.5-7.7C8.7 8.2 5 10.9 5 15.2 5 19.1 7.8 22 12 22Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0 1 4"/><path d="M20 4v7h-7"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
};

const icon = (name) => icons[name] || icons.spark;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const formatTime = (seconds) => {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const palettes = [
  ["#8b70f5", "#323aa8", "#ff91c3"],
  ["#f07c8d", "#6d3474", "#ffc477"],
  ["#37c8c5", "#24599e", "#baf0a9"],
  ["#fb9b4b", "#9b2e73", "#ffd582"],
  ["#85a3ff", "#2d2572", "#ff9fe7"],
  ["#9ec77e", "#285e5c", "#e9ed91"],
  ["#e971ba", "#573a9c", "#9df2e6"],
  ["#6bc3f1", "#244a78", "#f3c994"],
];

function paletteFor(seed) {
  let hash = 0;
  for (const character of String(seed)) hash = (hash << 5) - hash + character.charCodeAt(0);
  return palettes[Math.abs(hash) % palettes.length];
}

function lyricSet(title) {
  const subject = title.toLowerCase();
  return [
    { at: 0, words: [[0, "The"], [0.42, "streetlights"], [1.08, "fold"], [1.47, "into"], [1.9, "gold"]] },
    { at: 4.2, words: [[4.2, "while"], [4.58, "we"], [4.85, "trace"], [5.27, "the"], [5.55, "shape"], [5.95, "of"], [6.2, "home"]] },
    { at: 8.8, words: [[8.8, "Every"], [9.28, "little"], [9.7, "heartbeat"], [10.45, "finds"], [10.85, "a"], [11.12, "way"]] },
    { at: 13.1, words: [[13.1, "to"], [13.38, "turn"], [13.72, subject], [14.45, "into"], [14.92, "a"], [15.2, "wave"]] },
    { at: 18.4, words: [[18.4, "Keep"], [18.78, "the"], [19.02, "room"], [19.39, "in"], [19.66, "motion"]] },
    { at: 22.3, words: [[22.3, "keep"], [22.67, "the"], [22.93, "night"], [23.34, "alive"]] },
    { at: 26.4, words: [[26.4, "I"], [26.63, "can"], [26.94, "feel"], [27.3, "the"], [27.55, "signal"], [28.08, "rise"]] },
    { at: 30.3, words: [[30.3, "through"], [30.72, "the"], [30.95, "space"], [31.4, "between"], [31.9, "our"], [32.2, "eyes"]] },
    { at: 35.4, words: [[35.4, "No"], [35.7, "rush,"], [36.14, "just"], [36.45, "the"], [36.7, "right"], [37.1, "frequency"]] },
  ];
}

function createTrack(id, title, artist, album, duration, genre, listens, paletteIndex = null) {
  const colors = paletteIndex === null ? paletteFor(id) : palettes[paletteIndex % palettes.length];
  return { id, title, artist, album, duration, genre, listens, colors, lyrics: lyricSet(title), lyricQuality: "Enhanced timing", lyricSource: "LRCLIB + bot timing" };
}

const catalog = [
  createTrack("afterimage", "Afterimage", "Nyla Reed", "Cobalt Hours", 221, "Alt pop", "18.4k", 0),
  createTrack("glow-state", "Glow State", "Milo June", "Soft Signals", 198, "Indie electronic", "16.9k", 2),
  createTrack("paper-suns", "Paper Suns", "The Low Season", "Almost Morning", 245, "Dream pop", "14.2k", 1),
  createTrack("coastline", "Coastline Static", "Vera Bell", "Blue Room", 214, "Indie pop", "11.8k", 7),
  createTrack("sleepless", "Sleepless In Stereo", "Harbor Club", "Between Stations", 206, "Synthwave", "10.3k", 4),
  createTrack("gold-leaf", "Gold Leaf", "Lumen Park", "Second Nature", 192, "Indie folk", "9.7k", 5),
  createTrack("tiny-weather", "Tiny Weather", "Kite Museum", "Handwritten Maps", 231, "Bedroom pop", "8.9k", 3),
  createTrack("ribbon", "Ribbon In The Dark", "Fable Run", "Good Company", 217, "Alternative", "8.4k", 6),
  createTrack("night-bloom", "Night Bloom", "Mara Sol", "Violet Season", 229, "Ambient pop", "7.8k", 0),
  createTrack("slow-cinema", "Slow Cinema", "Orion Lake", "Screensaver", 201, "Electronic", "7.1k", 2),
  createTrack("familiar", "Familiar Orbit", "Koda Lane", "Satellite Heart", 238, "Indie rock", "6.8k", 7),
  createTrack("mirror-room", "Mirror Room", "Hush City", "Side A", 187, "Lo-fi", "6.3k", 4),
  createTrack("honeylight", "Honeylight", "June & The Hours", "Sunprint", 213, "Pop", "5.6k", 3),
  createTrack("strange-days", "Strange Days", "Lover's Loop", "Feel It Again", 225, "Alt rock", "5.1k", 1),
  createTrack("velvet-signal", "Velvet Signal", "Iris West", "Nocturne", 219, "R&B", "4.7k", 6),
];

const trackCache = new Map(catalog.map((track) => [track.id, track]));
const defaultPlaylists = [
  { id: "late-frames", name: "Late Frames", tracks: 28, duration: "1h 47m", tone: ["#8b70f5", "#263daa", "#ef8ec7"], synced: true },
  { id: "good-weather", name: "Good Weather", tracks: 19, duration: "1h 12m", tone: ["#e9995b", "#823a6b", "#f9da8d"], synced: true },
  { id: "quiet-charge", name: "Quiet Charge", tracks: 34, duration: "2h 23m", tone: ["#5cc7bf", "#24556f", "#c9ee9f"], synced: false },
];

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

const savedPreferences = readJSON(storageKey, {});
const savedQueueIds = readJSON(queueKey, ["glow-state", "paper-suns", "coastline", "sleepless", "gold-leaf"]);
const savedPlaylists = readJSON(playlistKey, defaultPlaylists);
const initialApiBase = document.documentElement.dataset.apiBase || savedPreferences.apiBase || "";
const pathGuild = /^\/g\/([^/]+)/.exec(location.pathname)?.[1];

const state = {
  current: trackCache.get(savedPreferences.currentId) || catalog[0],
  queue: savedQueueIds.map((id) => trackCache.get(id)).filter(Boolean),
  history: [catalog[6], catalog[3], catalog[10], catalog[1], catalog[8]],
  playlists: Array.isArray(savedPlaylists) ? savedPlaylists : defaultPlaylists,
  position: Number(savedPreferences.position) || 71,
  playing: false,
  volume: clamp(Number(savedPreferences.volume ?? 82), 0, 100),
  shuffle: Boolean(savedPreferences.shuffle),
  repeat: savedPreferences.repeat || "off",
  activeTab: savedPreferences.activeTab || "for-you",
  sideTab: savedPreferences.sideTab || "queue",
  // Keep the original Rift Dashboard cyan theme as the default. Older local
  // preferences from the first Audio preview are migrated back to Rift.
  theme: savedPreferences.theme && savedPreferences.theme !== "aurora" ? savedPreferences.theme : "rift",
  density: savedPreferences.density || "cozy",
  reducedMotion: Boolean(savedPreferences.reducedMotion),
  visualizer: savedPreferences.visualizer !== false,
  direct: false,
  apiBase: initialApiBase,
  guildId: pathGuild || savedPreferences.guildId || "demo-guild",
  server: { id: pathGuild || savedPreferences.guildId || "demo-guild", name: "Starlight Society", channel: "Luma Lounge", voiceDetected: false },
  selectedServer: pathGuild || savedPreferences.guildId || "demo-guild",
  modal: null,
  searchQuery: "",
  remoteResults: [],
  remoteSearchQuery: "",
  searchLoading: false,
  toasts: [],
  floatOpen: Boolean(savedPreferences.floatOpen),
  floatPos: savedPreferences.floatPos || { left: Math.max(20, window.innerWidth - 330), top: 95 },
  lyrics: null,
  lyricQuality: "Preview timing",
  lyricSource: "Local demo timing",
  lastLyricLine: null,
  mixTags: savedPreferences.mixTags || ["night drive", "soft focus", "alt pop"],
  remoteOnline: false,
  syncing: false,
  voiceStatus: "not-connected",
  audioRequest: 0,
};

state.position = clamp(state.position, 0, state.current.duration - 1);

const audio = new Audio();
audio.preload = "metadata";
// No Web Audio processing is used, so leave crossOrigin unset: an authorized
// media URL can play in the browser even when it does not opt into canvas/WebAudio CORS.
audio.volume = state.volume / 100;
audio.addEventListener("timeupdate", () => {
  if (!state.direct || !Number.isFinite(audio.currentTime)) return;
  state.position = audio.currentTime;
  if (Number.isFinite(audio.duration) && audio.duration > 0) state.current.duration = audio.duration;
  updateProgressUI();
});
audio.addEventListener("loadedmetadata", () => {
  if (state.direct && Number.isFinite(audio.duration) && audio.duration > 0) {
    state.current.duration = audio.duration;
    updateProgressUI();
  }
});
audio.addEventListener("ended", () => nextTrack());
audio.addEventListener("error", () => {
  if (state.direct && state.playing) {
    state.playing = false;
    updateMediaSession();
    updatePlayerUI();
    toast("The browser stream could not be played. Your bot queue is unchanged.", "error");
  }
});

function savePreferences() {
  const preferences = {
    currentId: state.current.id,
    position: Math.floor(state.position),
    volume: state.volume,
    shuffle: state.shuffle,
    repeat: state.repeat,
    activeTab: state.activeTab,
    sideTab: state.sideTab,
    theme: state.theme,
    density: state.density,
    reducedMotion: state.reducedMotion,
    visualizer: state.visualizer,
    apiBase: state.apiBase,
    guildId: state.guildId,
    floatOpen: state.floatOpen,
    floatPos: state.floatPos,
    mixTags: state.mixTags,
  };
  localStorage.setItem(storageKey, JSON.stringify(preferences));
  localStorage.setItem(queueKey, JSON.stringify(state.queue.map((track) => track.id)));
  localStorage.setItem(playlistKey, JSON.stringify(state.playlists));
}

function getToken() {
  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  return "";
}

function apiUrl(path, params = {}) {
  if (!state.apiBase) return null;
  const base = state.apiBase.replace(/\/$/, "");
  const url = new URL(`${base}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function requestAPI(path, { method = "GET", body, params } = {}) {
  const url = apiUrl(path, params);
  if (!url) throw new Error("No dashboard API configured");
  const token = getToken();
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

function normalizeDuration(value, fallback = 210) {
  if (typeof value === "number") return value > 10000 ? Math.round(value / 1000) : Math.round(value);
  if (typeof value === "string") {
    const pieces = value.split(":").map(Number);
    if (pieces.every(Number.isFinite)) return pieces.reduce((total, item) => total * 60 + item, 0);
  }
  return fallback;
}

function normalizeTrack(raw, index = 0) {
  const info = raw?.info || raw || {};
  const title = info.title || info.name || raw?.title || `Untitled signal ${index + 1}`;
  const artist = info.author || info.artist || raw?.artist || raw?.author || "Unknown artist";
  const id = String(info.identifier || raw?.id || `${slug(title)}-${slug(artist)}`);
  if (trackCache.has(id)) return trackCache.get(id);
  const colors = paletteFor(id);
  const track = {
    id,
    title,
    artist,
    album: info.album || raw?.album || "Search result",
    duration: normalizeDuration(info.length || info.duration || raw?.duration),
    genre: raw?.genre || "Music",
    listens: raw?.listens || "New",
    colors,
    artwork: info.artwork || info.artworkUrl || raw?.artwork || raw?.image || raw?.artworkUrl100 || "",
    previewUrl: raw?.previewUrl || raw?.preview_url || "",
    streamUrl: raw?.streamUrl || raw?.stream_url || "",
    uri: info.uri || raw?.uri || "",
    lyrics: lyricSet(title),
    lyricQuality: "Line timing",
    lyricSource: "Waiting for lyrics sync",
  };
  trackCache.set(id, track);
  return track;
}

function visibleTracks() {
  if (state.activeTab === "popular") return [...catalog].sort((a, b) => Number.parseFloat(b.listens) - Number.parseFloat(a.listens)).slice(0, 8);
  if (state.activeTab === "history") return state.history.concat(catalog.filter((track) => !state.history.some((item) => item.id === track.id))).slice(0, 8);
  if (state.activeTab === "recommended") return [catalog[2], catalog[8], catalog[12], catalog[10], catalog[7], catalog[14], catalog[5], catalog[11]];
  return [catalog[1], catalog[2], catalog[3], catalog[6], catalog[8], catalog[11], catalog[4], catalog[12]];
}

function getLyrics() { return state.lyrics || state.current.lyrics || lyricSet(state.current.title); }

function cover(track, extraClass = "") {
  const colors = track.colors || paletteFor(track.id);
  const titleWords = String(track.title).split(/\s+/).slice(0, 2).join(" ");
  const image = track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="cover ${track.artwork ? "cover-image" : ""} ${extraClass}" style="--a:${colors[0]};--b:${colors[1]};--c:${colors[2]}">${image}<span class="cover-grid"></span><span class="cover-label"><small>${escapeHtml(track.artist)}</small>${escapeHtml(titleWords)}</span></div>`;
}

function miniCover(track) { return `<span class="mini-cover">${cover(track)}</span>`; }

function equalizer() {
  return `<span class="equalizer ${state.playing && state.visualizer ? "" : "paused"}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
}

function nowTrackMarkup() {
  return `<div class="now-info">
    <div class="now-cover">${cover(state.current)}</div>
    <div class="now-track">
      <strong>${escapeHtml(state.current.title)}</strong>
      <span>${escapeHtml(state.current.artist)} · ${escapeHtml(state.current.album)}</span>
      <span class="synced-mark">${icon("bot")} ${state.apiBase ? "Bot session ready" : "Local session · connect API to sync"}</span>
    </div>
  </div>`;
}

function navMarkup() {
  const primary = [
    ["home", "Home", "home"], ["discover", "Discover", "discover"], ["library", "Library", "library"], ["radio", "Mix radio", "radio"],
  ];
  const collection = [["clock", "History", "history"], ["heart", "Liked songs", "liked"]];
  const item = ([iconName, label, key]) => `<button class="nav-item ${key === "home" ? "active" : ""}" type="button" data-action="nav" data-nav="${key}">${icon(iconName)}<span>${label}</span></button>`;
  return `<aside class="sidebar" aria-label="Music navigation">
    <a class="brand" href="/" aria-label="Rift Audio home"><span class="brand-mark">R</span><span class="brand-copy"><span class="brand-name">RIFT</span><span class="brand-sub">COMMAND CENTER</span></span></a>
    <button class="server-switcher" type="button" data-action="open-server" aria-label="Choose Discord server">
      <span class="server-logo">${escapeHtml(state.server.name.charAt(0))}</span>
      <span class="server-switch-copy"><strong>${escapeHtml(state.server.name)}</strong><span>${state.apiBase ? escapeHtml(state.server.channel) : "Choose a server"}</span></span>${icon("chevron")}
    </button>
    <p class="nav-label">Listen</p><nav class="nav">${primary.map(item).join("")}</nav>
    <p class="nav-label">Collection</p><nav class="nav">${collection.map(item).join("")}</nav>
    <div class="sidebar-bottom"><div class="sync-card"><div class="sync-card-top"><span class="sync-card-title"><i class="sync-dot"></i>${state.apiBase ? "Sync connected" : "Local-first mode"}</span><time>${state.syncing ? "syncing" : state.apiBase ? "live" : "offline"}</time></div><p>${state.apiBase ? "Queue and playlists reconcile with Rift Bot." : "Your queue is saved here. Add an API in settings to sync it with Rift Bot."}</p><button type="button" data-action="sync-now">${state.apiBase ? "Sync now" : "Configure sync"}</button></div></div>
  </aside>`;
}

function heroMarkup() {
  return `<div class="page-heading"><div><h1>Music</h1><p>Player, queue, sync, and listening intelligence for your server.</p></div><span class="dashboard-badge"><i></i>${state.apiBase ? "24/7 · Active" : "Local · Ready"}</span></div>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <div class="overline"><i class="pulse"></i> Now playing</div>
      <h2 id="hero-title">${escapeHtml(state.current.title)}</h2>
      <p class="hero-artist">${escapeHtml(state.current.artist)} <span>·</span> ${escapeHtml(state.current.album)}</p>
      <p class="hero-description">A focused player surface that stays in step with Rift Bot, your queue, and the room you choose.</p>
      <div class="hero-actions">
        <button class="button button-primary" type="button" data-action="play-toggle">${state.playing ? icon("pause") : icon("play")} ${state.playing ? "Pause" : "Play"}</button>
        <button class="button button-secondary" type="button" data-action="open-mix">${icon("spark")} Signal Mix</button>
        <button class="button button-secondary" type="button" data-action="open-server">${icon("mic")} ${state.apiBase ? "Voice channel" : "Choose server"}</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><span>This week</span><strong>14h 38m</strong><small>↗ 18% more</small></div>
        <div class="stat-card"><span>Signals saved</span><strong>164</strong><small>12 new finds</small></div>
        <div class="stat-card"><span>Queue health</span><strong>${state.queue.length} tracks</strong><small>${formatTime(state.queue.reduce((sum, track) => sum + track.duration, 0))} lined up</small></div>
      </div>
    </div>
    <div class="hero-now"><div class="hero-now-art">${cover(state.current)}<div class="hero-now-meta">${equalizer()}<span>${state.playing ? "Playing now" : "Ready to play"}</span></div></div></div>
  </section>`;
}

function tabMarkup() {
  const tabs = [["for-you", "For you"], ["popular", "Popular"], ["history", "History"], ["recommended", "Recommended"]];
  return tabs.map(([id, label]) => `<button type="button" class="tab ${state.activeTab === id ? "active" : ""}" data-action="set-tab" data-tab="${id}">${label}</button>`).join("");
}

function albumCard(track) {
  const isCurrent = state.current.id === track.id;
  return `<button class="album-card ${isCurrent ? "now" : ""}" type="button" data-action="play-track" data-id="${escapeHtml(track.id)}" aria-label="Play ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}"><span class="album-cover">${cover(track)}<span class="album-play">${isCurrent && state.playing ? icon("pause") : icon("play")}</span></span><span class="album-text"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></span></button>`;
}

function discoverMarkup() {
  const tracks = visibleTracks();
  return `<section class="section-card discover-card">
    <header class="section-head"><div class="section-title-wrap"><h2>${state.activeTab === "popular" ? "Most popular right now" : state.activeTab === "history" ? "Your recent history" : state.activeTab === "recommended" ? "Picked from your patterns" : "Keep the feeling going"}</h2><p>${state.activeTab === "history" ? "A calm record of every return." : "Updated quietly from your taste profile."}</p></div><div class="tabs" role="tablist" aria-label="Discovery filters">${tabMarkup()}</div></header>
    <div class="discover-body"><div class="track-grid">${tracks.map(albumCard).join("")}</div>
      <div class="mix-card"><div class="mix-card-inner"><span class="mix-orb">${icon("radio")}</span><div class="mix-copy"><h3>Signal Mix · ${state.mixTags.slice(0, 2).map(escapeHtml).join(" + ")}</h3><p>A living radio built around your late-night pop, hazy guitars, and everything you keep returning to.</p><div class="mix-tags">${state.mixTags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div></div><button class="button button-soft button-tiny" type="button" data-action="open-mix">Tune mix</button></div></div>
    </div>
  </section>`;
}

function libraryMarkup() {
  const rows = [state.current, ...state.queue.slice(0, 5)];
  return `<section class="section-card library-card"><header class="section-head"><div class="section-title-wrap"><h2>In your rotation</h2><p>A light view of your live queue and recent intent.</p></div><button type="button" class="text-button" data-action="open-search">Search all music</button></header><div class="library-list">${rows.map((track, index) => `<div class="library-row ${track.id === state.current.id ? "playing" : ""}"><span class="library-index">${track.id === state.current.id && state.playing ? "♫" : String(index + 1).padStart(2, "0")}</span><div class="library-track">${miniCover(track)}<span class="track-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></span></div><span class="library-album">${escapeHtml(track.album)}</span><span class="library-duration">${formatTime(track.duration)}</span><button class="library-more" type="button" data-action="queue-track" data-id="${escapeHtml(track.id)}" title="Add to queue">${icon("plus")}</button></div>`).join("")}</div></section>`;
}

function queueMarkup() {
  return `<section class="section-card queue-card"><div class="queue-tabs" role="tablist"><button type="button" class="queue-tab ${state.sideTab === "queue" ? "active" : ""}" data-action="side-tab" data-side-tab="queue">Up next <span>(${state.queue.length})</span></button><button type="button" class="queue-tab ${state.sideTab === "lyrics" ? "active" : ""}" data-action="side-tab" data-side-tab="lyrics">Lyrics</button></div>
    <div class="queue-panel" id="queue-panel" ${state.sideTab !== "queue" ? "hidden" : ""}>${state.queue.length ? state.queue.map((track, index) => `<div class="queue-row" draggable="true" data-queue-index="${index}"><span class="queue-grip" title="Drag to reorder">${icon("grip")}</span>${miniCover(track)}<span class="track-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${formatTime(track.duration)}</span></span><button class="queue-remove" type="button" data-action="remove-queue" data-index="${index}" aria-label="Remove ${escapeHtml(track.title)}">${icon("x")}</button></div>`).join("") : `<div class="search-empty">${icon("queue")}Your queue is clear.<br>Search or start a mix to add something.</div>`}</div>
    <div class="lyrics-panel" id="lyrics-panel" ${state.sideTab !== "lyrics" ? "hidden" : ""}>${lyricsMarkup()}</div>
    <footer class="queue-footer" ${state.sideTab !== "queue" ? "hidden" : ""}><span class="queue-count">Drag to reorder · ${formatTime(state.queue.reduce((sum, track) => sum + track.duration, 0))} remaining</span><button type="button" data-action="clear-queue">Clear queue</button></footer>
  </section>`;
}

function lyricsMarkup() {
  const lyrics = getLyrics();
  const lines = lyrics.map((line, index) => `<p class="lyric-line" data-action="seek-lyric" data-at="${line.at}" data-line="${index}">${line.words.map(([at, word]) => `<span class="lyric-word" data-word-at="${at}">${escapeHtml(word)} </span>`).join("")}</p>`).join("");
  return `<div class="lyrics-meta"><span class="lyrics-quality"><i></i>${escapeHtml(state.lyricQuality)} · ${escapeHtml(state.lyricSource)}</span><button type="button" data-action="refresh-lyrics">Refresh</button></div><div class="lyrics-scroll" id="lyrics-scroll">${lines}</div>`;
}

function playlistMarkup() {
  return `<section class="section-card playlist-card"><div class="quick-card"><div class="quick-card-head"><h3>Playlist vault</h3><span class="connection-pill"><i></i>${state.apiBase ? "two-way sync" : "local draft"}</span></div><p class="playlist-note">Save here, then Rift Bot can see the same list without an export.</p><div class="playlist-list">${state.playlists.slice(0, 3).map((playlist) => `<button class="playlist-row" type="button" data-action="play-playlist" data-id="${escapeHtml(playlist.id)}"><span class="playlist-art" style="--a:${playlist.tone?.[0] || "#8b70f5"};--b:${playlist.tone?.[1] || "#323aa8"};--c:${playlist.tone?.[2] || "#ff91c3"}"><i></i></span><span class="playlist-copy"><strong>${escapeHtml(playlist.name)}</strong><span>${playlist.tracks} tracks · ${escapeHtml(playlist.duration)}</span></span>${icon("play")}</button>`).join("")}</div><div class="playlist-actions"><button class="text-button playlist-sync" type="button" data-action="open-playlist">${icon("plus")} New synced list</button><button class="text-button playlist-sync" type="button" data-action="sync-now">${icon("refresh")} ${state.apiBase ? "Reconcile" : "Set up sync"}</button></div></div></section>`;
}

function quickMarkup() {
  const quick = [catalog[10], catalog[14], catalog[5]];
  return `<section class="section-card quick-card"><div class="quick-card-head"><h3>From your saved radio</h3><span class="connection-pill"><i></i>fresh</span></div><div class="quick-list">${quick.map((track) => `<div class="quick-row">${miniCover(track)}<span class="track-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.genre)}</span></span><button type="button" data-action="queue-track" data-id="${escapeHtml(track.id)}" aria-label="Queue ${escapeHtml(track.title)}">${icon("plus")}</button></div>`).join("")}</div></section>`;
}

function playerMarkup() {
  const progress = clamp((state.position / Math.max(1, state.current.duration)) * 100, 0, 100);
  return `<footer class="player-bar" aria-label="Player controls">
    ${nowTrackMarkup()}
    <div class="player-core"><div class="transport"><button class="${state.shuffle ? "active" : ""}" type="button" data-action="shuffle" aria-label="Toggle shuffle">${icon("shuffle")}</button><button type="button" data-action="previous" aria-label="Previous track">${icon("prev")}</button><button class="main-play" type="button" data-action="play-toggle" aria-label="${state.playing ? "Pause" : "Play"}">${state.playing ? icon("pause") : icon("play")}</button><button type="button" data-action="next" aria-label="Next track">${icon("next")}</button><button class="${state.repeat !== "off" ? "active" : ""}" type="button" data-action="repeat" aria-label="Repeat ${state.repeat}">${icon("repeat")}</button></div><div class="timeline"><time id="elapsed-time">${formatTime(state.position)}</time><input id="seek-range" class="range" type="range" min="0" max="${Math.max(1, Math.floor(state.current.duration))}" value="${Math.floor(state.position)}" style="--value:${progress}%" aria-label="Seek through ${escapeHtml(state.current.title)}"><time id="duration-time">${formatTime(state.current.duration)}</time></div></div>
    <div class="player-extra"><div class="volume">${icon("volume")}<input id="volume-range" class="range" type="range" min="0" max="100" value="${state.volume}" style="--value:${state.volume}%" aria-label="Volume"></div><button class="beta-button ${state.direct ? "active" : ""}" type="button" data-action="toggle-direct" title="Listen in your browser, beta">${icon("headphones")}<span>Browser listen</span><em>BETA</em></button><button class="icon-button ${state.sideTab === "queue" ? "active" : ""}" type="button" data-action="side-tab" data-side-tab="queue" aria-label="Show queue">${icon("queue")}</button><button class="icon-button ${state.sideTab === "lyrics" ? "active" : ""}" type="button" data-action="side-tab" data-side-tab="lyrics" aria-label="Show lyrics">${icon("lyrics")}</button><button class="icon-button" type="button" data-action="popout" aria-label="Pop out draggable player">${icon("expand")}</button></div>
  </footer>`;
}

function topbarMarkup() {
  return `<header class="topbar"><button class="icon-button mobile-menu" type="button" data-action="open-server" aria-label="Open menu">${icon("mark")}</button><div class="breadcrumb"><strong>Audio</strong><span class="slash">/</span>Home</div><button class="search-trigger" type="button" data-action="open-search">${icon("search")}<span>Search tracks, artists, playlists…</span><kbd class="keycap">⌘ K</kbd></button><div class="top-actions"><button class="icon-button" type="button" data-action="sync-now" aria-label="Sync now">${icon("refresh")}</button><button class="icon-button" type="button" data-action="open-settings" aria-label="Customize player">${icon("settings")}</button><button class="icon-button" type="button" data-action="open-server" aria-label="Voice server and channel">${icon("mic")}</button><span class="avatar" aria-label="Your profile">S</span></div></header>`;
}

function mobileNavMarkup() {
  return `<nav class="mobile-nav" aria-label="Mobile music navigation"><button class="active" type="button" data-action="nav" data-nav="home" aria-label="Home">${icon("home")}</button><button type="button" data-action="open-search" aria-label="Search">${icon("search")}</button><button type="button" data-action="open-mix" aria-label="Mix radio">${icon("radio")}</button><button type="button" data-action="side-tab" data-side-tab="queue" aria-label="Queue">${icon("queue")}</button><button type="button" data-action="open-settings" aria-label="Settings">${icon("settings")}</button></nav>`;
}

function floatingMarkup() {
  const progress = clamp((state.position / Math.max(1, state.current.duration)) * 100, 0, 100);
  const pos = state.floatPos || { left: 40, top: 90 };
  return `<section class="floating-player" id="floating-player" style="left:${clamp(pos.left, 9, Math.max(9, window.innerWidth - 295))}px;top:${clamp(pos.top, 9, Math.max(9, window.innerHeight - 165))}px" ${state.floatOpen ? "" : "hidden"} aria-label="Draggable mini player"><header class="float-head" data-drag-float><span>${icon("grip")} Drag player</span><button type="button" data-action="popout" aria-label="Close mini player">${icon("x")}</button></header><div class="float-content"><div class="float-cover">${cover(state.current)}</div><div class="float-copy"><strong>${escapeHtml(state.current.title)}</strong><span>${escapeHtml(state.current.artist)}</span><div class="float-transport"><button type="button" data-action="previous" aria-label="Previous">${icon("prev")}</button><button class="float-main" type="button" data-action="play-toggle" aria-label="${state.playing ? "Pause" : "Play"}">${state.playing ? icon("pause") : icon("play")}</button><button type="button" data-action="next" aria-label="Next">${icon("next")}</button></div></div></div><div class="float-progress"><i style="width:${progress}%"></i></div></section>`;
}

function modalMarkup() {
  if (!state.modal) return "";
  if (state.modal === "search") return searchModal();
  if (state.modal === "settings") return settingsModal();
  if (state.modal === "server") return serverModal();
  if (state.modal === "beta") return betaModal();
  if (state.modal === "mix") return mixModal();
  if (state.modal === "playlist") return playlistModal();
  return "";
}

function searchResults() {
  const query = state.searchQuery.trim().toLowerCase();
  let local = query ? catalog.filter((track) => `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLowerCase().includes(query)) : [...catalog];
  const all = [...state.remoteResults, ...local];
  const unique = [];
  const seen = new Set();
  for (const track of all) {
    if (!seen.has(track.id)) { seen.add(track.id); unique.push(track); }
  }
  while (unique.length < 10 && query) unique.push(generatedTrack(query, unique.length));
  return unique.slice(0, 10);
}

function generatedTrack(query, index) {
  const words = query.split(/\s+/).filter(Boolean);
  const stem = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || "New Signal";
  const suffixes = ["Afterglow", "At Dawn", "In Motion", "Is A Color", "On Repeat", "At The Door", "In Stereo", "Takes Time", "In The Blue", "Again"];
  const artists = ["Room Service", "Ari Sun", "Halcyon Club", "Northstar", "Pale Echo", "Soft Archive", "Horizon Kids", "Rae Lumen", "Cloud Office", "Morning Park"];
  const id = `instant-${slug(query)}-${index}`;
  if (trackCache.has(id)) return trackCache.get(id);
  const track = createTrack(id, `${stem} ${suffixes[index % suffixes.length]}`, artists[index % artists.length], "Instant discoveries", 178 + index * 7, "Instant match", "New");
  trackCache.set(id, track);
  return track;
}

function searchModal() {
  const results = searchResults();
  const label = state.searchQuery ? `${results.length} instant matches · updates on every character` : "Start typing for ten instant suggestions";
  return `<div class="modal-layer" data-modal-layer><section class="modal search-modal" role="dialog" aria-modal="true" aria-label="Search music"><header class="modal-head"><div><h2>Find your next signal</h2><p>Fast local suggestions first, then your bot and iTunes metadata if connected.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close search">${icon("x")}</button></header><label class="search-field">${icon("search")}<input id="search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Try an artist, lyric, mood, or track" value="${escapeHtml(state.searchQuery)}" aria-label="Search music"><kbd>ESC</kbd></label><div class="search-state"><span>${state.searchLoading ? "Looking for fresh matches…" : label}</span><strong>${state.remoteResults.length ? "Live metadata mixed in" : "10 results max"}</strong></div><div class="search-results" id="search-results">${searchResultsMarkup(results)}</div></section></div>`;
}

function searchResultsMarkup(results) {
  if (!results.length) return `<div class="search-empty">${icon("search")}No close signals yet.<br>Try a mood, artist, or a little less text.</div>`;
  return results.map((track) => `<div class="search-row" role="button" tabindex="0" data-action="play-track" data-id="${escapeHtml(track.id)}">${miniCover(track)}<span class="track-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</span></span><span class="search-duration">${formatTime(track.duration)}</span><button class="search-add" type="button" data-action="queue-track" data-id="${escapeHtml(track.id)}" aria-label="Add ${escapeHtml(track.title)} to queue">${icon("plus")}</button></div>`).join("");
}

function settingsModal() {
  const themes = ["rift", "tide", "ember", "rose"];
  return `<div class="modal-layer" data-modal-layer><section class="modal small" role="dialog" aria-modal="true" aria-label="Customize Rift Audio"><header class="modal-head"><div><h2>Shape your space</h2><p>These controls stay on this device and cost nothing while the player is idle.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close settings">${icon("x")}</button></header><div class="settings-body"><div class="setting-group"><span class="setting-label">Accent theme</span><div class="theme-picks">${themes.map((theme) => `<button type="button" class="theme-pick ${state.theme === theme ? "active" : ""}" data-action="theme" data-theme-pick="${theme}" aria-label="Use ${theme} theme"><i></i></button>`).join("")}</div></div><div class="setting-group"><span class="setting-label">Density</span><div class="segmented"><button type="button" class="${state.density === "cozy" ? "active" : ""}" data-action="density" data-density="cozy">Cozy</button><button type="button" class="${state.density === "compact" ? "active" : ""}" data-action="density" data-density="compact">Compact</button></div></div><div class="setting-group"><div class="setting-line"><div><strong>Motion visuals</strong><span>Keep the tiny player equalizer and ambient movement on.</span></div><button type="button" class="switch ${state.visualizer ? "on" : ""}" data-action="toggle-pref" data-pref="visualizer" aria-label="Toggle motion visuals"><i></i></button></div><div class="setting-line"><div><strong>Reduce motion</strong><span>Use instant state changes and stop decorative animation.</span></div><button type="button" class="switch ${state.reducedMotion ? "on" : ""}" data-action="toggle-pref" data-pref="reducedMotion" aria-label="Toggle reduced motion"><i></i></button></div></div><div class="setting-group"><span class="setting-label">Rift Bot API</span><div class="api-config"><input id="api-base-input" type="url" placeholder="https://your-api.example.com/api" value="${escapeHtml(state.apiBase)}" aria-label="Rift Bot API base URL"><button type="button" data-action="save-api">Save</button></div><p class="api-help">Uses your existing dashboard token when available. Leave blank for local demo mode.</p></div></div></section></div>`;
}

function serverModal() {
  const serverChoices = [
    { id: state.guildId, name: state.server.name, channel: state.server.channel, active: true },
    { id: "night-archive", name: "Night Archive", channel: "No voice activity", active: false },
    { id: "weekend-radio", name: "Weekend Radio", channel: "No voice activity", active: false },
  ];
  const selected = serverChoices.find((item) => item.id === state.selectedServer) || serverChoices[0];
  const detectionCopy = state.apiBase ? `Voice detection checks the signed-in account before moving Rift. ${state.voiceStatus === "detected" ? `We found you in ${state.server.channel}.` : "Choose where to send Rift."}` : "Connect the dashboard API and sign in to detect the voice channel your Discord account is already in.";
  return `<div class="modal-layer" data-modal-layer><section class="modal small" role="dialog" aria-modal="true" aria-label="Choose a Discord server"><header class="modal-head"><div><h2>Choose your listening room</h2><p>Rift asks before it joins or moves a voice session.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close server chooser">${icon("x")}</button></header><div class="server-body"><div class="server-list">${serverChoices.map((item) => `<button class="server-choice ${item.id === state.selectedServer ? "active" : ""}" type="button" data-action="select-server" data-server="${item.id}"><span class="choice-logo">${escapeHtml(item.name.charAt(0))}</span><span class="choice-copy"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.channel)}</span></span><span class="choice-state ${item.active ? "" : "idle"}">${item.id === state.selectedServer ? "Selected" : item.active ? "Active" : "Idle"}</span></button>`).join("")}</div><div class="voice-detect">${icon("mic")}<div><strong>${state.apiBase && state.voiceStatus === "detected" ? "Voice presence found" : "Private voice detection"}</strong><p>${escapeHtml(detectionCopy)}</p></div></div></div><footer class="modal-actions"><button class="button button-soft" type="button" data-action="detect-voice">${icon("refresh")} Detect voice</button><button class="button button-accent" type="button" data-action="connect-server" data-server="${escapeHtml(selected.id)}">${icon("bot")} Join player here</button></footer></section></div>`;
}

function betaModal() {
  return `<div class="modal-layer" data-modal-layer><section class="modal small" role="dialog" aria-modal="true" aria-label="Enable browser listen beta"><header class="modal-head"><div><h2>Listen in this browser</h2><p>A separate, opt-in audio path for when you do not want to enter a voice channel.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close browser listen beta">${icon("x")}</button></header><div class="beta-body"><div class="beta-hero">${icon("headphones")}<div><h3>Browser Listen <span class="chip">BETA</span></h3><p>When a licensed stream or an iTunes preview is available, Rift plays it through a normal HTML audio element.</p></div></div><div class="beta-list"><div><i>✓</i><span>Appears in browser and operating-system media controls through the Media Session API.</span></div><div><i>✓</i><span>Does not join, record, or relay your Discord voice channel.</span></div><div><i>✓</i><span>Uses a stream URL supplied by your API when available; otherwise it can ask iTunes for a public preview.</span></div></div><p class="beta-legal">Beta is intentionally stream-source agnostic. It will not scrape or re-broadcast protected audio. Full browser listening needs an authorized stream URL from your music backend.</p></div><footer class="modal-actions start"><button class="button button-soft" type="button" data-action="close-modal">Not now</button><button class="button button-accent" type="button" data-action="enable-direct">Enable browser listen</button></footer></section></div>`;
}

function mixModal() {
  const options = ["night drive", "soft focus", "indie pulse", "warm vocals", "dream pop", "deep cuts", "new finds", "sunlit", "low key"];
  return `<div class="modal-layer" data-modal-layer><section class="modal small" role="dialog" aria-modal="true" aria-label="Tune Signal Mix"><header class="modal-head"><div><h2>Tune your Signal Mix</h2><p>Pick up to three niches. Rift turns them into a flexible radio, not a fixed playlist.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close mix tuner">${icon("x")}</button></header><div class="settings-body"><div class="taste-grid">${options.map((option) => `<button type="button" class="taste-chip ${state.mixTags.includes(option) ? "selected" : ""}" data-action="toggle-taste" data-taste="${option}">${state.mixTags.includes(option) ? icon("check") : ""}${escapeHtml(option)}</button>`).join("")}</div><div class="mix-preview"><span>${icon("spark")}</span><div><strong>${state.mixTags.length ? state.mixTags.join(" · ") : "Choose a few signals"}</strong><p>${state.mixTags.length ? "Your radio will favor this texture, then leave room for useful surprises." : "Three small choices make a far more personal radio."}</p></div></div></div><footer class="modal-actions"><button class="button button-soft" type="button" data-action="close-modal">Cancel</button><button class="button button-accent" type="button" data-action="start-mix">${icon("radio")} Start this mix</button></footer></section></div>`;
}

function playlistModal() {
  const queueDuration = formatTime(state.queue.reduce((total, track) => total + track.duration, 0));
  return `<div class="modal-layer" data-modal-layer><section class="modal small" role="dialog" aria-modal="true" aria-label="Create synced playlist"><header class="modal-head"><div><h2>Save a two-way playlist</h2><p>Rift writes this playlist to the bot when your sync endpoint is available, while retaining a safe local draft.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close playlist creator">${icon("x")}</button></header><div class="settings-body"><label class="playlist-field"><span class="setting-label">Playlist name</span><input id="playlist-name-input" type="text" maxlength="64" autocomplete="off" placeholder="e.g. rainy window at 2am" aria-label="Playlist name"></label><div class="playlist-build"><span class="playlist-art" style="--a:${state.current.colors?.[0] || "#8b70f5"};--b:${state.current.colors?.[1] || "#323aa8"};--c:${state.current.colors?.[2] || "#ff91c3"}"><i></i></span><div><strong>Start with your live queue</strong><p>${state.queue.length} tracks · ${queueDuration} · includes ${escapeHtml(state.current.title)} next</p></div></div><p class="playlist-privacy">${state.apiBase ? "The bot receives only the playlist identity and track references for the selected server." : "No API is configured, so this saves as a local draft until you connect Rift Bot."}</p></div><footer class="modal-actions"><button class="button button-soft" type="button" data-action="close-modal">Cancel</button><button class="button button-accent" type="button" data-action="save-playlist">${icon("link")} Save & ${state.apiBase ? "sync" : "keep draft"}</button></footer></section></div>`;
}

function toastMarkup() {
  return `<div class="toast-region" aria-live="polite">${state.toasts.map((item) => `<div class="toast ${item.type || ""}"><i>${item.type === "error" ? "!" : "✓"}</i><span>${escapeHtml(item.message)}</span></div>`).join("")}</div>`;
}

function render() {
  document.documentElement.setAttribute("data-theme", state.theme);
  root.innerHTML = `<div class="app ${state.reducedMotion ? "reduced-motion" : ""}" data-density="${state.density}"><div class="ambient"></div><div class="noise"></div><div class="shell">${navMarkup()}<main class="main">${topbarMarkup()}<div class="content">${heroMarkup()}<div class="dashboard-grid"><div>${discoverMarkup()}${libraryMarkup()}</div><aside class="side-stack">${queueMarkup()}${quickMarkup()}${playlistMarkup()}</aside></div></div></main></div>${mobileNavMarkup()}${playerMarkup()}${floatingMarkup()}${modalMarkup()}${toastMarkup()}</div>`;
  updateProgressUI();
  updateMediaSession();
  if (state.modal === "search") requestAnimationFrame(() => document.getElementById("search-input")?.focus());
}

function updatePlayerUI() {
  const playButtons = root.querySelectorAll('[data-action="play-toggle"]');
  for (const button of playButtons) {
    button.innerHTML = state.playing ? icon("pause") : icon("play");
    button.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  }
  const heroLabel = root.querySelector(".hero-now-meta span:last-child");
  if (heroLabel) heroLabel.textContent = state.playing ? "Playing now" : "Ready to play";
  root.querySelectorAll(".equalizer").forEach((el) => el.classList.toggle("paused", !state.playing || !state.visualizer));
}

function updateProgressUI() {
  const duration = Math.max(1, state.current.duration);
  const progress = clamp((state.position / duration) * 100, 0, 100);
  const elapsed = document.getElementById("elapsed-time");
  const durationEl = document.getElementById("duration-time");
  const range = document.getElementById("seek-range");
  if (elapsed) elapsed.textContent = formatTime(state.position);
  if (durationEl) durationEl.textContent = formatTime(duration);
  if (range) {
    range.max = String(Math.floor(duration));
    range.value = String(Math.floor(state.position));
    range.style.setProperty("--value", `${progress}%`);
  }
  const floatProgress = root.querySelector(".float-progress i");
  if (floatProgress) floatProgress.style.width = `${progress}%`;
  updateLyricsUI();
}

function updateLyricsUI() {
  const words = [...root.querySelectorAll(".lyric-word")];
  if (!words.length) return;
  let activeIndex = -1;
  words.forEach((word, index) => { if (Number(word.dataset.wordAt) <= state.position + 0.04) activeIndex = index; });
  words.forEach((word, index) => {
    word.classList.toggle("past", index < activeIndex);
    word.classList.toggle("active", index === activeIndex);
  });
  const currentLine = activeIndex >= 0 ? words[activeIndex].closest(".lyric-line") : null;
  root.querySelectorAll(".lyric-line").forEach((line) => line.classList.toggle("active", line === currentLine));
  if (currentLine && state.lastLyricLine !== currentLine.dataset.line) {
    state.lastLyricLine = currentLine.dataset.line;
    const scroll = document.getElementById("lyrics-scroll");
    if (scroll) scroll.scrollTo({ top: Math.max(0, currentLine.offsetTop - scroll.clientHeight * .36), behavior: state.reducedMotion ? "auto" : "smooth" });
  }
}

function toast(message, type = "") {
  const id = `${Date.now()}-${Math.random()}`;
  state.toasts = [...state.toasts, { id, message, type }].slice(-4);
  const region = root.querySelector(".toast-region");
  if (region) region.innerHTML = toastMarkup().replace(/^<div class="toast-region" aria-live="polite">|<\/div>$/g, "");
  else render();
  window.setTimeout(() => {
    state.toasts = state.toasts.filter((item) => item.id !== id);
    const toastNode = root.querySelector(".toast-region");
    if (toastNode) toastNode.innerHTML = state.toasts.map((item) => `<div class="toast ${item.type || ""}"><i>${item.type === "error" ? "!" : "✓"}</i><span>${escapeHtml(item.message)}</span></div>`).join("");
  }, 4200);
}

function setModal(modal) {
  state.modal = modal;
  render();
}

function currentIndex() {
  return catalog.findIndex((track) => track.id === state.current.id);
}

function setTrack(track, { play = true, addHistory = true } = {}) {
  if (!track) return;
  audio.pause();
  audio.removeAttribute("src");
  state.audioRequest += 1;
  state.current = track;
  state.position = 0;
  state.lyrics = null;
  state.lyricQuality = track.lyricQuality || "Preview timing";
  state.lyricSource = track.lyricSource || "Local timing";
  state.lastLyricLine = null;
  if (addHistory) state.history = [track, ...state.history.filter((item) => item.id !== track.id)].slice(0, 16);
  if (play) state.playing = true;
  savePreferences();
  render();
  if (play && state.direct) startDirectAudio();
  if (play) sendControl("play", { track: serializeTrack(track) });
  loadLyrics(track);
}

function serializeTrack(track) {
  return { id: track.id, title: track.title, artist: track.artist, album: track.album, uri: track.uri || undefined, duration: track.duration };
}

function togglePlay() {
  if (state.playing) {
    state.playing = false;
    audio.pause();
    sendControl("pause");
  } else {
    state.playing = true;
    if (state.direct) startDirectAudio();
    sendControl("resume");
  }
  savePreferences();
  updatePlayerUI();
  updateMediaSession();
}

function nextTrack() {
  if (state.repeat === "one") { state.position = 0; if (state.direct) { audio.currentTime = 0; audio.play().catch(() => {}); } updateProgressUI(); return; }
  let next;
  if (state.shuffle && state.queue.length) next = state.queue[Math.floor(Math.random() * state.queue.length)];
  else if (state.queue.length) next = state.queue.shift();
  else {
    const index = currentIndex();
    next = catalog[(index + 1 + catalog.length) % catalog.length];
  }
  if (!next && state.repeat === "all") next = catalog[0];
  if (next) setTrack(next, { play: state.playing });
  else { state.playing = false; updatePlayerUI(); }
  savePreferences();
}

function previousTrack() {
  if (state.position > 4) {
    state.position = 0;
    if (state.direct) audio.currentTime = 0;
    updateProgressUI();
    return;
  }
  const index = currentIndex();
  setTrack(catalog[(index - 1 + catalog.length) % catalog.length], { play: state.playing });
}

function addToQueue(track, announce = true) {
  if (!track) return;
  state.queue.push(track);
  savePreferences();
  sendControl("queue", { track: serializeTrack(track) });
  if (announce) toast(`${track.title} was added to Up next.`, "success");
  render();
}

function removeFromQueue(index) {
  const [removed] = state.queue.splice(index, 1);
  savePreferences();
  sendControl("remove", { position: index });
  if (removed) toast(`${removed.title} removed from queue.`);
  render();
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  savePreferences();
  sendControl("shuffle", { enabled: state.shuffle });
  render();
}

function cycleRepeat() {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  savePreferences();
  sendControl("repeat", { mode: state.repeat });
  toast(`Repeat ${state.repeat === "off" ? "turned off" : `set to ${state.repeat}`}.`);
  render();
}

async function sendControl(action, extra = {}) {
  if (!state.apiBase) return;
  try {
    await requestAPI("/music/control", { method: "POST", body: { guild_id: state.guildId, action, ...extra } });
    state.remoteOnline = true;
  } catch {
    state.remoteOnline = false;
  }
}

async function syncFromBot({ announce = false } = {}) {
  if (!state.apiBase || state.syncing) {
    if (announce && !state.apiBase) { state.modal = "settings"; render(); toast("Add your Rift Bot API URL to turn on two-way sync."); }
    return;
  }
  state.syncing = true;
  render();
  try {
    const [music, history, playlists, voice] = await Promise.allSettled([
      requestAPI(`/music/state/${encodeURIComponent(state.guildId)}`),
      requestAPI(`/music/history/${encodeURIComponent(state.guildId)}`),
      requestAPI(`/playlists/${encodeURIComponent(state.guildId)}`),
      requestAPI("/vc/status", { params: { guild_id: state.guildId } }),
    ]);
    if (music.status === "fulfilled" && music.value) applyRemoteMusicState(music.value);
    if (history.status === "fulfilled" && history.value) {
      const entries = history.value.history || history.value.items || history.value;
      if (Array.isArray(entries)) state.history = entries.map(normalizeTrack).slice(0, 16);
    }
    if (playlists.status === "fulfilled" && playlists.value) {
      const entries = playlists.value.playlists || playlists.value.items || playlists.value;
      if (Array.isArray(entries) && entries.length) state.playlists = entries.map((item, index) => ({ id: String(item.id || item.name || `playlist-${index}`), name: item.name || `Playlist ${index + 1}`, tracks: item.tracks?.length || item.track_count || item.tracks || 0, duration: item.duration || "—", tone: paletteFor(item.name || index), synced: true }));
    }
    if (voice.status === "fulfilled" && voice.value) applyVoiceStatus(voice.value);
    state.remoteOnline = true;
    if (announce) toast("Queue, playlists, and voice state are up to date.", "success");
  } catch {
    state.remoteOnline = false;
    if (announce) toast("Rift Bot is not reachable right now. Your local changes are safe.", "error");
  } finally {
    state.syncing = false;
    savePreferences();
    render();
  }
}

function applyRemoteMusicState(remote) {
  const now = remote.current || remote.track || remote.now_playing;
  if (now) {
    const track = normalizeTrack(now);
    if (track.id !== state.current.id) {
      state.current = track;
      state.lyrics = null;
      state.lyricQuality = track.lyricQuality || "Line timing";
      state.lyricSource = "Rift Bot state";
      loadLyrics(track);
    }
    state.position = Number(remote.position ?? remote.elapsed ?? state.position) || 0;
    if (typeof remote.playing === "boolean") state.playing = remote.playing;
  }
  const queue = remote.queue || remote.up_next;
  if (Array.isArray(queue)) state.queue = queue.map(normalizeTrack).slice(0, 100);
  if (remote.channel || remote.voice_channel) {
    state.server.channel = remote.channel?.name || remote.voice_channel?.name || remote.channel || remote.voice_channel;
    state.voiceStatus = "detected";
  }
}

function applyVoiceStatus(remote) {
  const channel = remote.channel || remote.voice_channel || remote.voice?.channel || remote.connected_channel;
  if (channel) {
    state.server.channel = typeof channel === "string" ? channel : channel.name || state.server.channel;
    state.voiceStatus = "detected";
  }
}

async function detectVoice() {
  if (!state.apiBase) { toast("Connect the dashboard API first, then Rift can ask Discord for your voice presence."); return; }
  try {
    const data = await requestAPI("/vc/status", { params: { guild_id: state.selectedServer } });
    applyVoiceStatus(data || {});
    if (state.voiceStatus === "detected") toast(`We found ${state.server.channel}. Rift will wait for your confirmation.`, "success");
    else toast("No active voice room was returned. You can still choose a server.");
  } catch { toast("Voice detection is unavailable until the bot API responds.", "error"); }
  render();
}

async function connectServer() {
  const chosen = state.selectedServer;
  const target = chosen === state.guildId ? state.server.channel : "General voice";
  if (state.apiBase) await sendControl("connect", { channel_id: chosen === state.guildId ? state.server.channel : undefined, target_guild_id: chosen });
  state.server = { ...state.server, id: chosen, channel: target };
  state.guildId = chosen;
  state.modal = null;
  savePreferences();
  render();
  toast(`Rift player is ready in ${target}.`, "success");
}

async function loadLyrics(track) {
  if (!state.apiBase) return;
  try {
    const payload = await requestAPI("/music/lyrics", { params: { title: track.title, artist: track.artist, track_id: track.id } });
    const parsed = parseLyrics(payload?.enhanced_lrc || payload?.synced_lyrics || payload?.syncedLyrics || payload?.lyrics);
    if (parsed.length) {
      state.lyrics = parsed;
      state.lyricQuality = payload?.word_timed || payload?.enhanced_lrc ? "Word timing" : "Line timing";
      state.lyricSource = payload?.source || "Rift lyrics";
      if (state.sideTab === "lyrics") render();
    }
  } catch {
    // The local preview timing keeps the lyrics surface responsive if the lyric route is unavailable.
  }
}

function parseLyrics(text) {
  if (!text || typeof text !== "string") return [];
  const result = [];
  const parseTime = (value) => {
    const [minutes, seconds] = String(value).split(":");
    return Number(minutes) * 60 + Number(seconds);
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g)];
    if (!timestamps.length) continue;
    let copy = rawLine.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "").trim();
    if (!copy) continue;
    const start = parseTime(timestamps[0][1]);
    const enhanced = [...copy.matchAll(/<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>([^<]+)/g)];
    let words;
    if (enhanced.length) {
      words = enhanced.map((entry) => [parseTime(entry[1]), entry[2].trim()]).filter(([, word]) => word);
    } else {
      const plainWords = copy.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean);
      words = plainWords.map((word, index) => [start + index * 0.36, word]);
    }
    result.push({ at: start, words });
  }
  return result.slice(0, 80);
}

async function fetchRemoteSearch(query) {
  const cleaned = query.trim();
  if (!cleaned) { state.remoteResults = []; state.searchLoading = false; renderSearchOnly(); return; }
  state.searchLoading = true;
  renderSearchOnly();
  let received = [];
  try {
    if (state.apiBase) {
      const payload = await requestAPI("/music/search", { params: { q: cleaned, limit: 10, guild_id: state.guildId } });
      const list = payload?.tracks || payload?.results || payload?.data || [];
      if (Array.isArray(list)) received = list.map(normalizeTrack);
    }
    if (!received.length) {
      const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(cleaned)}&entity=song&media=music&limit=10&country=US`;
      const response = await fetch(endpoint);
      const payload = await response.json();
      received = (payload.results || []).map((item, index) => normalizeTrack({
        id: `itunes-${item.trackId || index}`,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        duration: item.trackTimeMillis,
        artwork: item.artworkUrl100?.replace("100x100", "600x600"),
        previewUrl: item.previewUrl,
        genre: item.primaryGenreName,
      }, index));
    }
  } catch {
    // Local immediate search intentionally remains available with no network.
  }
  if (state.searchQuery.trim() === cleaned) {
    state.remoteResults = received.slice(0, 10);
    state.remoteSearchQuery = cleaned;
    state.searchLoading = false;
    renderSearchOnly();
  }
}

let searchTimer = null;
function scheduleSearch(query) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => fetchRemoteSearch(query), 240);
}

function renderSearchOnly() {
  const resultsElement = document.getElementById("search-results");
  if (resultsElement) resultsElement.innerHTML = searchResultsMarkup(searchResults());
  const stateElement = root.querySelector(".search-state");
  if (stateElement) stateElement.innerHTML = `<span>${state.searchLoading ? "Looking for fresh matches…" : state.searchQuery ? `${searchResults().length} instant matches · updates on every character` : "Start typing for ten instant suggestions"}</span><strong>${state.remoteResults.length ? "Live metadata mixed in" : "10 results max"}</strong>`;
}

async function startDirectAudio() {
  const requestId = ++state.audioRequest;
  const track = state.current;
  let source = track.streamUrl || track.previewUrl;
  try {
    if (!source && state.apiBase) {
      const stream = await requestAPI("/music/stream", { params: { guild_id: state.guildId, track_id: track.id, title: track.title, artist: track.artist } });
      source = stream?.stream_url || stream?.url || stream?.preview_url;
    }
    if (!source) {
      const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(`${track.title} ${track.artist}`)}&entity=song&media=music&limit=1&country=US`;
      const response = await fetch(endpoint);
      const result = await response.json();
      source = result?.results?.[0]?.previewUrl || "";
      if (source) track.previewUrl = source;
    }
  } catch {
    source = "";
  }
  if (requestId !== state.audioRequest || !state.direct || state.current.id !== track.id) return;
  if (!source) {
    state.playing = false;
    updatePlayerUI();
    updateMediaSession();
    toast("No approved browser stream is available for this track yet. The bot queue can still play it.", "error");
    return;
  }
  try {
    audio.src = source;
    audio.currentTime = Math.min(state.position, 2);
    await audio.play();
    state.playing = true;
    updatePlayerUI();
    updateMediaSession();
    toast("Browser Listen is playing through your media controls.", "success");
  } catch {
    state.playing = false;
    updatePlayerUI();
    updateMediaSession();
    toast("Your browser blocked that stream. Try pressing play again.", "error");
  }
}

function enableDirect() {
  state.direct = true;
  state.modal = null;
  savePreferences();
  render();
  toast("Browser Listen is on. It will use an approved stream or a preview.", "success");
}

function toggleDirect() {
  if (state.direct) {
    state.direct = false;
    audio.pause();
    state.playing = false;
    state.audioRequest += 1;
    savePreferences();
    render();
    toast("Browser Listen is off. Rift Bot controls remain available.");
  } else setModal("beta");
}

function updateMediaSession() {
  if (!("mediaSession" in navigator)) return;
  try {
    const colors = state.current.colors || paletteFor(state.current.id);
    const art = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset=".57" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient></defs><rect width="512" height="512" rx="68" fill="url(#g)"/><circle cx="362" cy="142" r="92" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="3"/><circle cx="170" cy="344" r="57" fill="rgba(255,255,255,.32)"/><text x="55" y="420" fill="white" font-family="Arial,sans-serif" font-size="39" font-weight="700">${escapeHtml(state.current.title).slice(0, 18)}</text></svg>`)}`;
    navigator.mediaSession.metadata = new MediaMetadata({ title: state.current.title, artist: state.current.artist, album: state.current.album, artwork: [{ src: art, sizes: "512x512", type: "image/svg+xml" }] });
    navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";
  } catch {
    // Media Session is progressive enhancement; it never blocks the core player.
  }
}

if ("mediaSession" in navigator) {
  const handlers = {
    play: () => { if (!state.playing) togglePlay(); },
    pause: () => { if (state.playing) togglePlay(); },
    previoustrack: previousTrack,
    nexttrack: nextTrack,
    seekbackward: (details) => { state.position = Math.max(0, state.position - (details.seekOffset || 10)); if (state.direct) audio.currentTime = state.position; updateProgressUI(); },
    seekforward: (details) => { state.position = Math.min(state.current.duration, state.position + (details.seekOffset || 10)); if (state.direct) audio.currentTime = state.position; updateProgressUI(); },
    seekto: (details) => { if (details.seekTime !== undefined) { state.position = clamp(details.seekTime, 0, state.current.duration); if (state.direct) audio.currentTime = state.position; updateProgressUI(); } },
  };
  for (const [name, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch { /* Unsupported handler */ }
  }
}

function startMix() {
  const mix = [catalog[8], catalog[3], catalog[6], catalog[14], catalog[11], catalog[2], catalog[12]];
  state.queue = [...mix, ...state.queue.filter((track) => !mix.some((mixTrack) => mixTrack.id === track.id))];
  state.modal = null;
  setTrack(mix[0], { play: true });
  savePreferences();
  toast(`Signal Mix started · ${state.mixTags.join(", ")}.`, "success");
}

function playPlaylist(id) {
  const playlist = state.playlists.find((item) => item.id === id);
  const offsets = id.length % 5;
  const selections = catalog.slice(offsets, offsets + 6);
  state.queue = selections.slice(1);
  setTrack(selections[0] || catalog[0], { play: true });
  sendControl("play_playlist", { playlist_id: id, name: playlist?.name });
  if (state.apiBase) requestAPI(`/playlists/${encodeURIComponent(state.guildId)}/play`, { method: "POST", body: { guild_id: state.guildId, playlist_id: id, name: playlist?.name } }).catch(() => {});
  toast(`${playlist?.name || "Playlist"} is queued on this device${state.apiBase ? " and shared with Rift Bot" : ""}.`, "success");
}

async function savePlaylist() {
  const input = document.getElementById("playlist-name-input");
  const name = input?.value.trim();
  if (!name) { toast("Give this playlist a name first.", "error"); input?.focus(); return; }
  const id = `${slug(name)}-${Date.now().toString(36).slice(-5)}`;
  const tracks = [state.current, ...state.queue].slice(0, 100);
  const playlist = { id, name, tracks: tracks.length, duration: formatTime(tracks.reduce((total, track) => total + track.duration, 0)), tone: paletteFor(id), synced: false };
  state.playlists = [playlist, ...state.playlists];
  state.modal = null;
  savePreferences();
  render();
  if (!state.apiBase) { toast(`${name} is saved as a local draft. Configure sync when your bot API is ready.`); return; }
  try {
    const response = await requestAPI(`/playlists/${encodeURIComponent(state.guildId)}/sync`, {
      method: "PUT",
      body: { revision: Date.now(), origin: "dashboard", playlist: { id, name, tracks: tracks.map(serializeTrack) } },
    });
    const saved = response?.playlist || response;
    const matching = state.playlists.find((item) => item.id === id);
    if (matching) matching.synced = true;
    if (saved?.id && saved.id !== id && matching) matching.id = String(saved.id);
    savePreferences();
    render();
    toast(`${name} is now in sync with Rift Bot.`, "success");
  } catch {
    toast(`${name} was saved locally. Rift Bot will retry when its sync route is available.`, "error");
  }
}

function setSideTab(side) {
  state.sideTab = side;
  savePreferences();
  render();
}

function setTheme(theme) { state.theme = theme; savePreferences(); render(); }
function setDensity(density) { state.density = density; savePreferences(); render(); }
function togglePreference(pref) { state[pref] = !state[pref]; savePreferences(); render(); }

function moveQueueItem(from, to) {
  if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return;
  const [item] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, item);
  savePreferences();
  sendControl("move", { from, to });
  render();
}

let draggingQueueIndex = null;
let floatingDrag = null;

root.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  const id = actionTarget.dataset.id;
  if (action === "play-toggle") return togglePlay();
  if (action === "next") return nextTrack();
  if (action === "previous") return previousTrack();
  if (action === "shuffle") return toggleShuffle();
  if (action === "repeat") return cycleRepeat();
  if (action === "play-track") return setTrack(trackCache.get(id), { play: true });
  if (action === "queue-track") return addToQueue(trackCache.get(id));
  if (action === "remove-queue") return removeFromQueue(Number(actionTarget.dataset.index));
  if (action === "clear-queue") { state.queue = []; savePreferences(); sendControl("clear"); render(); return toast("Queue cleared."); }
  if (action === "set-tab") { state.activeTab = actionTarget.dataset.tab; savePreferences(); render(); return; }
  if (action === "side-tab") return setSideTab(actionTarget.dataset.sideTab);
  if (action === "open-search") return setModal("search");
  if (action === "open-settings") return setModal("settings");
  if (action === "open-server") return setModal("server");
  if (action === "open-mix") return setModal("mix");
  if (action === "open-playlist") return setModal("playlist");
  if (action === "close-modal") return setModal(null);
  if (action === "sync-now") return syncFromBot({ announce: true });
  if (action === "toggle-direct") return toggleDirect();
  if (action === "enable-direct") return enableDirect();
  if (action === "popout") { state.floatOpen = !state.floatOpen; savePreferences(); render(); return; }
  if (action === "theme") return setTheme(actionTarget.dataset.themePick);
  if (action === "density") return setDensity(actionTarget.dataset.density);
  if (action === "toggle-pref") return togglePreference(actionTarget.dataset.pref);
  if (action === "save-api") {
    const input = document.getElementById("api-base-input");
    state.apiBase = input?.value.trim().replace(/\/$/, "") || "";
    savePreferences();
    render();
    if (state.apiBase) { toast("API saved. Testing sync now…"); syncFromBot({ announce: true }); }
    else toast("Local-first mode restored.");
    return;
  }
  if (action === "select-server") { state.selectedServer = actionTarget.dataset.server; render(); return; }
  if (action === "detect-voice") return detectVoice();
  if (action === "connect-server") return connectServer();
  if (action === "seek-lyric") {
    state.position = Number(actionTarget.dataset.at) || 0;
    if (state.direct) audio.currentTime = state.position;
    updateProgressUI();
    return;
  }
  if (action === "refresh-lyrics") { state.lyrics = null; state.lyricQuality = "Preview timing"; state.lyricSource = "Refreshing…"; render(); loadLyrics(state.current); return; }
  if (action === "toggle-taste") {
    const taste = actionTarget.dataset.taste;
    if (state.mixTags.includes(taste)) state.mixTags = state.mixTags.filter((item) => item !== taste);
    else if (state.mixTags.length < 3) state.mixTags.push(taste);
    else toast("Keep the radio specific: choose up to three niches.");
    savePreferences(); render(); return;
  }
  if (action === "start-mix") return startMix();
  if (action === "save-playlist") return savePlaylist();
  if (action === "play-playlist") return playPlaylist(actionTarget.dataset.id);
  if (action === "nav") {
    const nav = actionTarget.dataset.nav;
    if (nav === "history") { state.activeTab = "history"; render(); }
    else if (nav === "radio") setModal("mix");
    else if (nav === "library") { document.querySelector(".library-card")?.scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" }); }
    else if (nav === "discover") { document.querySelector(".discover-card")?.scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" }); }
    else if (nav === "liked") toast("Liked songs are ready for your bot sync endpoint.");
    return;
  }
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "search-input") {
    state.searchQuery = target.value;
    state.remoteResults = [];
    state.searchLoading = Boolean(target.value.trim());
    renderSearchOnly();
    scheduleSearch(target.value);
  }
  if (target.id === "seek-range") {
    state.position = Number(target.value);
    if (state.direct && Number.isFinite(audio.duration)) audio.currentTime = state.position;
    updateProgressUI();
  }
  if (target.id === "volume-range") {
    state.volume = Number(target.value);
    audio.volume = state.volume / 100;
    target.style.setProperty("--value", `${state.volume}%`);
    savePreferences();
  }
});

root.addEventListener("keydown", (event) => {
  const row = event.target.closest?.(".search-row");
  if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setTrack(trackCache.get(row.dataset.id), { play: true }); }
});

root.addEventListener("dragstart", (event) => {
  const row = event.target.closest?.("[data-queue-index]");
  if (!row) return;
  draggingQueueIndex = Number(row.dataset.queueIndex);
  row.classList.add("dragging");
  event.dataTransfer?.setData("text/plain", String(draggingQueueIndex));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
});
root.addEventListener("dragover", (event) => {
  const row = event.target.closest?.("[data-queue-index]");
  if (!row || draggingQueueIndex === null) return;
  event.preventDefault();
  root.querySelectorAll(".queue-row.over").forEach((item) => item.classList.remove("over"));
  row.classList.add("over");
});
root.addEventListener("dragleave", (event) => event.target.closest?.("[data-queue-index]")?.classList.remove("over"));
root.addEventListener("drop", (event) => {
  const row = event.target.closest?.("[data-queue-index]");
  if (!row || draggingQueueIndex === null) return;
  event.preventDefault();
  moveQueueItem(draggingQueueIndex, Number(row.dataset.queueIndex));
  draggingQueueIndex = null;
});
root.addEventListener("dragend", () => { draggingQueueIndex = null; root.querySelectorAll(".queue-row").forEach((row) => row.classList.remove("dragging", "over")); });

root.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest?.("[data-drag-float]");
  if (!handle) return;
  const player = document.getElementById("floating-player");
  if (!player) return;
  const rect = player.getBoundingClientRect();
  floatingDrag = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, player };
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});
window.addEventListener("pointermove", (event) => {
  if (!floatingDrag) return;
  const left = clamp(event.clientX - floatingDrag.offsetX, 9, window.innerWidth - floatingDrag.player.offsetWidth - 9);
  const top = clamp(event.clientY - floatingDrag.offsetY, 9, window.innerHeight - floatingDrag.player.offsetHeight - 9);
  state.floatPos = { left, top };
  floatingDrag.player.style.left = `${left}px`;
  floatingDrag.player.style.top = `${top}px`;
});
window.addEventListener("pointerup", () => { if (floatingDrag) { floatingDrag = null; savePreferences(); } });

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("search"); return; }
  if (event.key === "Escape" && state.modal) { setModal(null); return; }
  if (!typing && event.code === "Space") { event.preventDefault(); togglePlay(); }
  if (!typing && event.key.toLowerCase() === "q") setSideTab("queue");
  if (!typing && event.key.toLowerCase() === "l") setSideTab("lyrics");
});

window.setInterval(() => {
  if (!state.playing || state.direct) return;
  state.position += .25;
  if (state.position >= state.current.duration) nextTrack();
  else updateProgressUI();
}, 250);

window.setInterval(() => {
  if (state.apiBase && !state.modal) syncFromBot();
}, 9000);

window.addEventListener("resize", () => {
  if (!state.floatOpen) return;
  state.floatPos.left = clamp(state.floatPos.left, 9, Math.max(9, window.innerWidth - 295));
  state.floatPos.top = clamp(state.floatPos.top, 9, Math.max(9, window.innerHeight - 165));
  const player = document.getElementById("floating-player");
  if (player) { player.style.left = `${state.floatPos.left}px`; player.style.top = `${state.floatPos.top}px`; }
});

render();
if (state.apiBase) syncFromBot();
