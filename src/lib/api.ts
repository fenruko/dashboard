// Central API client - supports live backend and graceful mock fallback
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api";

type FetchOpts = { params?: Record<string, any>; auth?: string };

async function request(path: string, method: string = "GET", body?: any, opts: FetchOpts = {}) {
  const token = opts.auth || localStorage.getItem("rift_token") || "";
  const url = new URL(`${API_BASE}${path}`);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (e) {
    // let caller decide fallback
    throw e;
  }
}

export const api = {
  get: (p: string, params?: any, auth?: string) => request(p, "GET", undefined, { params, auth }),
  post: (p: string, body?: any) => request(p, "POST", body),
  // Domain methods
  stats: () => request("/stats"),
  botGuildIds: () => request("/bot/guild-ids"),
  guildInfo: (id: string) => request(`/guild/${id}/info`),
  analytics: (id: string) => request(`/analytics/${id}`),
  getSetting: (guild: string, key: string) => request(`/guild/${guild}/settings/${key}`),
  setSetting: (guild: string, key: string, val: any) => request(`/guild/${guild}/settings/${key}`, "POST", val),
  modLogs: (id: string, params?: any) => request(`/mod/logs/${id}`, "GET", undefined, { params }),
  modAction: (body: any) => request("/mod/action", "POST", body),
  modBans: (id: string) => request(`/mod/bans/${id}`),
  musicState: (id: string) => request(`/music/state/${id}`),
  musicControl: (body: any) => request("/music/control", "POST", body),
  musicHistory: (id: string) => request(`/music/history/${id}`),
  playlists: (id: string) => request(`/playlists/${id}`),
  playPlaylist: (id: string, body: any) => request(`/playlists/${id}/play`, "POST", body),
  lastfmProfile: (id: string) => request(`/lastfm/profile/${id}`),
  lastfmNow: (id: string) => request(`/lastfm/nowplaying/${id}`),
  lastfmTopArtists: (id: string, params?: any) => request(`/lastfm/topartists/${id}`, "GET", undefined, { params }),
  lastfmTopTracks: (id: string, params?: any) => request(`/lastfm/toptracks/${id}`, "GET", undefined, { params }),
  lastfmGenres: (id: string) => request(`/lastfm/genres/${id}`),
  stocksMarket: () => request("/stocks/market"),
  stocksPortfolio: (id: string) => request(`/stocks/portfolio/${id}`),
  stocksLeaderboard: () => request("/stocks/leaderboard"),
  stocksTrade: (body: any) => request("/stocks/trade", "POST", body),
  vcStatus: (params: any) => request("/vc/status", "GET", undefined, { params }),
  vcCall: (body: any) => request("/vc/call", "POST", body),
  vcJoin: (body: any) => request("/vc/join", "POST", body),
  vcHangup: (body: any) => request("/vc/hangup", "POST", body),
  verificationFlags: (id: string) => request(`/verification/flags/${id}`),
  verificationPrints: (id: string) => request(`/verification/fingerprints/${id}`),
};

// Discord OAuth helpers
export const DISCORD_CLIENT_ID = (import.meta as any).env?.VITE_DISCORD_CLIENT_ID || "";
const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/callback` : "";

export function getDiscordAuthUrl() {
  const scope = "identify guilds";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", DISCORD_CLIENT_ID || "0");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", scope);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function fetchDiscordUser(token: string) {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("discord user fetch failed");
  return res.json();
}
export async function fetchDiscordGuilds(token: string) {
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("guilds fetch failed");
  return res.json();
}

// Mock data generators for beautiful analytics when API unavailable
export function mockSeries(points = 24, base = 50, variance = 30) {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = i / points;
    const trend = Math.sin(t * Math.PI * 2) * 10 + Math.cos(t * Math.PI * 4) * 5;
    const noise = (Math.random() - 0.5) * variance;
    return {
      x: now - (points - i) * 3600000,
      y: Math.max(5, base + trend + noise + i * 0.8),
      label: `${i}h`,
    };
  });
}
export function mockAnalytics() {
  return {
    members: { total: 12483, online: 3421, growth: mockSeries(30, 12000, 200) },
    messages: { today: 48291, week: 312_493, series: mockSeries(24, 1800, 600) },
    commands: { today: 8923, top: [{ name: "play", count: 3421 }, { name: "ban", count: 123 }, { name: "level", count: 892 }] },
    moderation: { actions: 342, bans: 12, series: mockSeries(30, 15, 10) },
    music: { hours: 128.5, plays: 4321, series: mockSeries(24, 80, 40) },
    leveling: { avg: 23, distribution: [12, 19, 30, 45, 67, 89, 54, 32] },
    invites: { total: 8921, active: 234, series: mockSeries(14, 40, 20) },
    verification: { success: 0.94, flagged: 23, series: mockSeries(14, 80, 15) },
    economy: { volume: 1_234_567, trades: 892, series: mockSeries(30, 50000, 20000) },
    voice: { minutes: 45230, peak: 342, series: mockSeries(24, 120, 60) },
  };
}
