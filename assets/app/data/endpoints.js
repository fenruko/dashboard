/* One typed-ish place for every bot endpoint the dashboard calls.
 * Grouped to match web_server.py (and utils/audio_api.py for music). Keeping
 * them here is what makes the contract test possible: tests/integration checks
 * this table against the reference server routes. */

export function createEndpoints(api) {
  const enc = encodeURIComponent;

  return {
    /* ---- platform ---- */
    stats: () => api.get("/stats", { cacheTtl: 5_000 }),
    botGuildIds: () => api.get("/bot/guild-ids", { cacheTtl: 60_000 }),
    demoMe: () => api.get("/demo/me", { retries: 0 }),
    demoGuilds: () => api.get("/demo/guilds", { retries: 0 }),

    /* ---- guild ---- */
    guildInfo: (guildId) => api.get(`/guild/${enc(guildId)}/info`, { cacheTtl: 30_000 }),
    analytics: (guildId) => api.get(`/analytics/${enc(guildId)}`, { cacheTtl: 30_000 }),

    /* ---- settings ---- */
    settingsGet: (guildId, section) => api.get(`/guild/${enc(guildId)}/settings/${enc(section)}`, { retries: 1 }),
    settingsSave: (guildId, section, data) =>
      api.post(`/guild/${enc(guildId)}/settings/${enc(section)}`, data, {
        // Settings writes are idempotent replacements; allow one retry if the
        // connection dies mid-flight, tagged so the server can de-duplicate.
        retry: true,
        retries: 2,
        idempotencyKey: `settings-${guildId}-${section}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),

    /* ---- moderation ---- */
    modStats: (guildId) => api.get(`/mod/stats/${enc(guildId)}`, { cacheTtl: 15_000 }),
    modLogs: (guildId, params = {}) => api.get(`/mod/logs/${enc(guildId)}`, { params }),
    modAction: (payload) =>
      api.post("/mod/action", payload, {
        retries: 0,
        idempotencyKey: `mod-${payload?.guild_id}-${payload?.action}-${payload?.target}-${Date.now()}`,
      }),
    modBans: (guildId) => api.get(`/mod/bans/${enc(guildId)}`),
    modMembers: (guildId, q) => api.get(`/mod/members/${enc(guildId)}`, { params: { q } }),
    modRoles: (guildId) => api.get(`/mod/roles/${enc(guildId)}`, { cacheTtl: 60_000 }),
    modUser: (guildId, q) => api.get(`/mod/user/${enc(guildId)}`, { params: { q } }),

    /* ---- verification ---- */
    verificationFlags: (guildId) => api.get(`/verification/flags/${enc(guildId)}`),
    verificationFingerprints: (guildId) => api.get(`/verification/fingerprints/${enc(guildId)}`),
    verify: (payload) => api.post("/verify", payload, { retries: 0, timeoutMs: 20_000 }),

    /* ---- music ---- */
    musicState: (guildId) => api.get(`/music/state/${enc(guildId)}`, { retries: 1, timeoutMs: 12_000 }),
    musicControl: (payload) => api.post("/music/control", payload, { retries: 0 }),
    musicSearch: (query) => api.post("/music/search", { query }, { retries: 0, timeoutMs: 20_000 }),
    musicHistory: (guildId, limit = 12) => api.get(`/music/history/${enc(guildId)}`, { params: { limit } }),
    musicTopSongs: (guildId) => api.get(`/music/topsongs/${enc(guildId)}`, { cacheTtl: 60_000 }),
    musicLyrics: (params) => api.get("/music/lyrics", { params, retries: 0, timeoutMs: 15_000 }),
    musicStream: (params) => api.get("/music/stream", { params, retries: 0 }),
    musicFix: (guildId, fix) => api.post("/music/fix", { guild_id: guildId, fix }, { retries: 0 }),
    userVoice: (guildId, userId) => api.get(`/user/voice/${enc(guildId)}/${enc(userId)}`, { retries: 0 }),

    /* ---- playlists ---- */
    playlists: (userId) => api.get(`/playlists/${enc(userId)}`),
    playlistCreate: (userId, payload) => api.post(`/playlists/${enc(userId)}/create`, payload, { retries: 0 }),
    playlistDelete: (userId, name) => api.post(`/playlists/${enc(userId)}/delete`, { name }, { retries: 0 }),
    playlistRename: (userId, name, newName) => api.post(`/playlists/${enc(userId)}/rename`, { name, new_name: newName }, { retries: 0 }),
    playlistRemoveTrack: (userId, name, index) => api.post(`/playlists/${enc(userId)}/remove_track`, { name, index }, { retries: 0 }),
    playlistPlay: (userId, payload) => api.post(`/playlists/${enc(userId)}/play`, payload, { retries: 0 }),

    /* ---- voice call ---- */
    vcGuilds: () => api.get("/vc/guilds", { cacheTtl: 30_000 }),
    vcStatus: () => api.get("/vc/status", { retries: 0 }),
    vcCall: (payload) => api.post("/vc/call", payload, { retries: 0 }),
    vcJoin: (payload) => api.post("/vc/join", payload, { retries: 0 }),
    vcHangup: (payload) => api.post("/vc/hangup", payload, { retries: 0 }),

    /* ---- stocks ---- */
    stocksMarket: (options = {}) => api.get("/stocks/market", { cacheTtl: 20_000, ...options }),
    stocksPortfolio: (userId, options = {}) => api.get(`/stocks/portfolio/${enc(userId)}`, { cacheTtl: 20_000, ...options }),
    stocksTrade: (payload) => api.post("/stocks/trade", payload, { retries: 0 }),
    stocksLeaderboard: (options = {}) => api.get("/stocks/leaderboard", { cacheTtl: 60_000, ...options }),

    /* ---- last.fm ---- */
    lastfmProfile: (userId) => api.get(`/lastfm/profile/${enc(userId)}`),
    lastfmNowPlaying: (userId) => api.get(`/lastfm/nowplaying/${enc(userId)}`),
    lastfmTopArtists: (userId, period = "7day") => api.get(`/lastfm/topartists/${enc(userId)}`, { params: { period } }),
    lastfmTopTracks: (userId, period = "7day") => api.get(`/lastfm/toptracks/${enc(userId)}`, { params: { period } }),
    lastfmWeeklyArtists: (userId) => api.get(`/lastfm/weeklyartists/${enc(userId)}`),
    lastfmGenres: (userId, period = "6month") => api.get(`/lastfm/genres/${enc(userId)}`, { params: { period } }),
    lastfmHeatmap: (userId) => api.get(`/lastfm/heatmap/${enc(userId)}`, { retries: 0 }),
    lastfmChartUrl: (userId, { type = "albums", size = 3, period = "7day", labels = true, gap = 0, rounded = true, bg = "141414" } = {}) => {
      const params = new URLSearchParams({
        type,
        size: String(size),
        period,
        labels: String(Boolean(labels)),
        gap: String(gap),
        rounded: String(Boolean(rounded)),
        bg: String(bg).replace(/^#/, ""),
      });
      return { path: `/lastfm/chart/${enc(userId)}`, params: Object.fromEntries(params) };
    },
    lastfmChartBlob: async (userId, options) => {
      const { path, params } = createEndpoints(api).lastfmChartUrl(userId, options);
      const response = await api.raw(path, { params, timeoutMs: 30_000 });
      return response.blob();
    },

    /* ---- user preferences ---- */
    prefsGet: (userId) => api.get(`/prefs/${enc(userId)}`, { retries: 1 }),
    prefsSet: (userId, data) => api.post(`/prefs/${enc(userId)}`, data, { retries: 1 }),

    /* ---- public ban appeals ---- */
    appealsLookup: (userId) => api.post("/appeals/lookup", { user_id: userId }, { retries: 0 }),
    appealsSendOtp: (userId) => api.post("/appeals/send-otp", { user_id: userId }, { retries: 0 }),
    appealsVerifyOtp: (userId, code) => api.post("/appeals/verify-otp", { user_id: userId, code }, { retries: 0 }),
    appealsUpload: (verifyToken, image) => api.post("/appeals/upload", { verify_token: verifyToken, image }, { retries: 0, timeoutMs: 30_000 }),
    appealsSubmit: (payload) => api.post("/appeals/submit", payload, { retries: 0, timeoutMs: 30_000 }),
    appealsThread: (token) => api.get(`/appeals/thread/${enc(token)}`, { retries: 1 }),
    appealsThreadMessage: (token, text, attachmentIds) =>
      api.post(`/appeals/thread/${enc(token)}/message`, { text, attachment_ids: attachmentIds }, { retries: 0 }),
    appealsThreadUpload: (token, image) => api.post(`/appeals/thread/${enc(token)}/upload`, { image }, { retries: 0, timeoutMs: 30_000 }),
    // Public attachments are authorised by the appeal's own token in the query
    // string, so they can be used directly as <img src>.
    appealsAttachmentUrl: (id, token) => `${api.getBase()}/appeals/attachments/${enc(id)}?token=${enc(token)}`,

    /* ---- public bug reports ---- */
    bugReportUpload: (uploadKey, image) =>
      api.post("/bugreports/upload", { upload_key: uploadKey, image }, { retries: 0, timeoutMs: 30_000 }),
    bugReportSubmit: (payload) => api.post("/bugreports/submit", payload, { retries: 0, timeoutMs: 30_000 }),
  };
}

/** Normalise the various list shapes the bot returns (list / {key: list}). */
export function asList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of keys) if (Array.isArray(payload[key])) return payload[key];
  if (payload.data && typeof payload.data === "object" && payload.data !== payload) return asList(payload.data, keys);
  return [];
}
