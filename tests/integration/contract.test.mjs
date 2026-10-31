/* Guards the dashboard against drifting away from web_server.py.
 *
 * tests/fixtures/bot-routes.json is extracted from the uploaded bot server
 * (including the routes documented as registered by utils/audio_api.py).
 * Every endpoint helper is executed once and its request path is matched
 * against that manifest, so a typo or an invented route fails CI. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createApiClient } from "../../assets/app/core/api.js";
import { createEndpoints } from "../../assets/app/data/endpoints.js";

const ROUTES = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/bot-routes.json", import.meta.url)), "utf8"));
const GUILD = "100000000000000001";
const USER = "900000000000000001";

function patternToRegex(pattern) {
  const body = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/<int:[^>]+>|<string:[^>]+>|<[^>]+>/g, "[^/]+")
    .replace(/<path:[^>]+>/g, ".+");
  return new RegExp(`^${body}/?$`);
}

function manifestMatch(path, method) {
  return ROUTES.some((route) => {
    if (route.kind !== "route") return false;
    if (!patternToRegex(route.path).test(path)) return false;
    const methods = route.methods?.length ? route.methods : ["GET"];
    return methods.includes(method);
  });
}

function setup() {
  const calls = [];
  const api = createApiClient({
    baseUrl: "https://api.test/api",
    getToken: () => "token",
    maxAttempts: 1,
    breakerThreshold: 999,
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url));
      calls.push({ path: parsed.pathname, method: init?.method || "GET" });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  return { api, endpoints: createEndpoints(api), calls };
}

test("every endpoint helper maps to a real bot route", async () => {
  const { endpoints: e, calls, api } = setup();
  const invocations = [
    ["stats", () => e.stats()],
    ["botGuildIds", () => e.botGuildIds()],
    ["guildInfo", () => e.guildInfo(GUILD)],
    ["analytics", () => e.analytics(GUILD)],
    ["settingsGet", () => e.settingsGet(GUILD, "automod")],
    ["settingsSave", () => e.settingsSave(GUILD, "automod", { enabled: true })],
    ["modStats", () => e.modStats(GUILD)],
    ["modLogs", () => e.modLogs(GUILD, { limit: 5 })],
    ["modAction", () => e.modAction({ guild_id: GUILD, action: "warn", target: USER })],
    ["modBans", () => e.modBans(GUILD)],
    ["modMembers", () => e.modMembers(GUILD, "nova")],
    ["modRoles", () => e.modRoles(GUILD)],
    ["modUser", () => e.modUser(GUILD, USER)],
    ["verificationFlags", () => e.verificationFlags(GUILD)],
    ["verificationFingerprints", () => e.verificationFingerprints(GUILD)],
    ["verify", () => e.verify({ token: "x".repeat(20), fingerprint: "f".repeat(64) })],
    ["musicState", () => e.musicState(GUILD)],
    ["musicControl", () => e.musicControl({ guild_id: GUILD, action: "pause" })],
    ["musicSearch", () => e.musicSearch("neon")],
    ["musicHistory", () => e.musicHistory(GUILD, 5)],
    ["musicTopSongs", () => e.musicTopSongs(GUILD)],
    ["musicLyrics", () => e.musicLyrics({ title: "Neon Skyline", author: "Aster" })],
    ["musicStream", () => e.musicStream({ query: "neon" })],
    ["musicFix", () => e.musicFix(GUILD, "region")],
    ["userVoice", () => e.userVoice(GUILD, USER)],
    ["playlists", () => e.playlists(USER)],
    ["playlistCreate", () => e.playlistCreate(USER, { name: "focus" })],
    ["playlistDelete", () => e.playlistDelete(USER, "focus")],
    ["playlistRename", () => e.playlistRename(USER, "focus", "focus 2")],
    ["playlistRemoveTrack", () => e.playlistRemoveTrack(USER, "focus", 0)],
    ["playlistPlay", () => e.playlistPlay(USER, { name: "focus", guild_id: GUILD })],
    ["vcGuilds", () => e.vcGuilds()],
    ["vcStatus", () => e.vcStatus()],
    ["vcCall", () => e.vcCall({ guild_id: GUILD })],
    ["vcJoin", () => e.vcJoin({ guild_id: GUILD, code: "R1234" })],
    ["vcHangup", () => e.vcHangup({})],
    ["stocksMarket", () => e.stocksMarket()],
    ["stocksPortfolio", () => e.stocksPortfolio(USER)],
    ["stocksTrade", () => e.stocksTrade({ user_id: USER, symbol: "RIFT", action: "buy", quantity: 1 })],
    ["stocksLeaderboard", () => e.stocksLeaderboard()],
    ["lastfmProfile", () => e.lastfmProfile(USER)],
    ["lastfmNowPlaying", () => e.lastfmNowPlaying(USER)],
    ["lastfmTopArtists", () => e.lastfmTopArtists(USER)],
    ["lastfmTopTracks", () => e.lastfmTopTracks(USER)],
    ["lastfmWeeklyArtists", () => e.lastfmWeeklyArtists(USER)],
    ["lastfmGenres", () => e.lastfmGenres(USER)],
    ["lastfmHeatmap", () => e.lastfmHeatmap(USER)],
    ["prefsGet", () => e.prefsGet(USER)],
    ["prefsSet", () => e.prefsSet(USER, { theme: "dark" })],
    ["appealsLookup", () => e.appealsLookup(USER)],
    ["appealsSendOtp", () => e.appealsSendOtp(USER)],
    ["appealsVerifyOtp", () => e.appealsVerifyOtp(USER, "1234")],
    ["appealsUpload", () => e.appealsUpload("v", "data:image/png;base64,AA==")],
    ["appealsSubmit", () => e.appealsSubmit({ verify_token: "v", reason: "x".repeat(20) })],
    ["appealsThread", () => e.appealsThread("token")],
    ["appealsThreadMessage", () => e.appealsThreadMessage("token", "hello", [])],
    ["appealsThreadUpload", () => e.appealsThreadUpload("token", "data:image/png;base64,AA==")],
    ["bugReportUpload", () => e.bugReportUpload("key", "data:image/png;base64,AA==")],
    ["bugReportSubmit", () => e.bugReportSubmit({ user_id: USER, description: "Something broke", upload_key: "key" })],
  ];

  for (const [name, run] of invocations) {
    const before = calls.length;
    try {
      await run();
    } catch {
      /* The stub only checks routing, not responses. */
    }
    assert.equal(calls.length, before + 1, `${name} made exactly one request`);
    const { path, method } = calls[calls.length - 1];
    assert.equal(manifestMatch(path, method), true, `${name} → ${method} ${path} is not in web_server.py`);
  }
  assert.ok(calls.length >= invocations.length);

  // Raw SVG chart + public attachment URLs are not fetched through api.request.
  const chart = e.lastfmChartUrl(USER, { type: "artists", size: 4 });
  assert.equal(manifestMatch(`/api${chart.path}`, "GET"), true);
  const attachment = e.appealsAttachmentUrl(12, "thread-token");
  const attachmentPath = new URL(attachment).pathname;
  assert.equal(manifestMatch(attachmentPath, "GET"), true);
  assert.match(attachment, /\?token=thread-token$/);
  assert.ok(api);
});

test("no dashboard route is silently absent from the manifest (allowlisting demo-only)", () => {
  const demoOnly = ["/api/demo/me", "/api/demo/guilds"];
  for (const path of demoOnly) {
    assert.equal(manifestMatch(path, "GET"), false, `${path} is a dev-mock endpoint and must not be presented as bot API`);
  }
  const dashboardPaths = ["/api/stats", "/api/analytics/1", "/api/mod/logs/1", "/api/music/state/1", "/api/stocks/market", "/api/vc/call", "/api/appeals/thread/abc", "/api/bugreports/submit"];
  for (const path of dashboardPaths) {
    assert.equal(manifestMatch(path, path.includes("submit") || path.includes("call") ? "POST" : "GET"), true, path);
  }
});
