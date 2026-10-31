import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_GUILDS, DEMO_USER, DEMO_USER_ID, createDemoBackend } from "../../tools/demo-backend.mjs";
import { createApiClient } from "../../assets/app/core/api.js";
import { createEndpoints } from "../../assets/app/data/endpoints.js";
import { createFetchAdapter } from "../dom/harness.mjs";

const GUILD = DEMO_GUILDS[0].id;

function setup({ token = "demo-token", backend = createDemoBackend({ latency: 0 }) } = {}) {
  const calls = [];
  const adapter = createFetchAdapter(backend);
  const api = createApiClient({
    baseUrl: "https://api.test/api",
    getToken: () => token,
    maxAttempts: 1,
    breakerThreshold: 999,
    onEvent: () => {},
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method || "GET" });
      return adapter(url, init);
    },
  });
  return { api, endpoints: createEndpoints(api), backend, calls };
}

test("every dashboard read endpoint returns the shape its page consumes", async (t) => {
  const { endpoints: e } = setup();

  await t.test("platform + guild", async () => {
    const stats = await e.stats();
    assert.equal(typeof stats.guilds, "number");
    assert.equal(typeof stats.users, "number");
    assert.equal(typeof stats.uptime, "number");
    assert.ok(stats.shard_count >= 1);

    const ids = await e.botGuildIds();
    assert.ok(Array.isArray(ids.guild_ids ?? ids));
    const info = await e.guildInfo(GUILD);
    assert.equal(info.id, GUILD);
    assert.ok(Array.isArray(info.channels) && info.channels.length > 0);
    assert.ok(Array.isArray(info.roles) && info.roles.length > 0);
  });

  await t.test("analytics", async () => {
    const data = await e.analytics(GUILD);
    assert.equal(data.guild_name, "Rift HQ");
    assert.equal(data.dates.length, data.joins.length);
    assert.equal(data.dates.length, data.messages.length);
    assert.equal(data.dates.length, data.voice.length);
    assert.ok(data.dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)));
  });

  await t.test("moderation", async () => {
    const stats = await e.modStats(GUILD);
    assert.ok(stats.total >= 0);
    assert.ok(stats.by_action && typeof stats.by_action === "object");
    assert.ok(Array.isArray(stats.top_mods));

    const page = await e.modLogs(GUILD, { limit: 5, offset: 0 });
    assert.equal(page.logs.length, 5);
    assert.ok(page.total >= 20);
    const filtered = await e.modLogs(GUILD, { limit: 50, type: "ban" });
    assert.ok(filtered.logs.length > 0);
    assert.ok(filtered.logs.every((log) => log.action === "ban"));

    const members = await e.modMembers(GUILD, "a");
    assert.ok(members.members.length > 0 && members.members.length <= 25);
    const roles = await e.modRoles(GUILD);
    assert.ok(roles.roles.every((role) => role.id && role.name));
    const bans = await e.modBans(GUILD);
    assert.ok(Array.isArray(bans.bans));
    const dossier = await e.modUser(GUILD, DEMO_USER_ID);
    assert.equal(dossier.user.id, DEMO_USER_ID);
    assert.ok(Array.isArray(dossier.warnings));
    assert.ok(Array.isArray(dossier.history));
  });

  await t.test("verification activity", async () => {
    const flags = await e.verificationFlags(GUILD);
    assert.ok(Array.isArray(flags) && flags.length > 0);
    assert.ok(flags[0].fingerprint_hash);
    const prints = await e.verificationFingerprints(GUILD);
    assert.ok(Array.isArray(prints) && prints.length > 0);
    assert.equal(typeof prints[0].metadata, "object");
  });

  await t.test("music", async () => {
    const state = await e.musicState(GUILD);
    assert.equal(typeof state.connected, "boolean");
    assert.equal(typeof state.playing, "boolean");
    assert.ok(state.volume >= 0 && state.volume <= 100);
    assert.ok(Array.isArray(state.queue));
    const history = await e.musicHistory(GUILD, 5);
    assert.ok(Array.isArray(history.history));
    assert.ok(history.history.length <= 5);
    const top = await e.musicTopSongs(GUILD);
    assert.ok(Array.isArray(top.top));
    const lyrics = await e.musicLyrics({ title: "Neon Skyline", author: "Aster", duration: 214 });
    assert.ok(typeof lyrics.lyrics === "string" && lyrics.lyrics.length > 20);
    const search = await e.musicSearch("neon");
    assert.ok(Array.isArray(search.results) && search.results.length > 0);
    assert.ok(search.results[0].uri);
  });

  await t.test("playlists", async () => {
    const data = await e.playlists(DEMO_USER_ID);
    assert.ok(Array.isArray(data.playlists));
    assert.ok(data.playlists.every((playlist) => typeof playlist.name === "string"));
  });

  await t.test("voice calls", async () => {
    const guilds = await e.vcGuilds();
    assert.ok(Array.isArray(guilds.guilds));
    const status = await e.vcStatus();
    assert.equal(typeof status, "object");
  });

  await t.test("stocks", async () => {
    const market = await e.stocksMarket();
    assert.ok(Array.isArray(market.stocks) && market.stocks.length >= 5);
    assert.ok(market.stocks.every((stock) => stock.symbol && stock.price > 0));
    const portfolio = await e.stocksPortfolio(DEMO_USER_ID);
    assert.ok(Array.isArray(portfolio.holdings));
    assert.ok(portfolio.cash >= 0);
    const board = await e.stocksLeaderboard();
    assert.ok(Array.isArray(board.leaderboard));
  });

  await t.test("last.fm", async () => {
    const profile = await e.lastfmProfile(DEMO_USER_ID);
    assert.equal(profile.username, "rift_demo");
    const now = await e.lastfmNowPlaying(DEMO_USER_ID);
    assert.ok(now.now_playing);
    assert.ok(Array.isArray(now.recent));
    const artists = await e.lastfmTopArtists(DEMO_USER_ID);
    assert.ok(Array.isArray(artists.artists));
    const tracks = await e.lastfmTopTracks(DEMO_USER_ID, "1month");
    assert.ok(Array.isArray(tracks.tracks));
    const weekly = await e.lastfmWeeklyArtists(DEMO_USER_ID);
    assert.ok(Array.isArray(weekly.artists));
    const genres = await e.lastfmGenres(DEMO_USER_ID);
    assert.ok(Array.isArray(genres.genres));
    const heatmap = await e.lastfmHeatmap(DEMO_USER_ID);
    assert.ok(Array.isArray(heatmap.weeks) && heatmap.weeks.length > 10);
  });

  await t.test("preferences", async () => {
    const prefs = await e.prefsGet(DEMO_USER_ID);
    assert.equal(typeof prefs, "object");
  });
});

test("the artist chart endpoint streams SVG, not JSON", async () => {
  const { api } = setup();
  const response = await api.raw(`/lastfm/chart/${DEMO_USER_ID}`, {
    params: { type: "artists", size: 3, period: "7day", labels: true, gap: 0, rounded: true, bg: "141414" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  const body = await response.text();
  assert.match(body, /^<svg/);
  assert.match(body, /rect/);
});

test("settings endpoints round-trip every section", async () => {
  const { endpoints: e } = setup();
  const { SETTINGS_SECTIONS } = await import("../../assets/app/data/settings-schema.js");
  for (const section of SETTINGS_SECTIONS) {
    const data = await e.settingsGet(GUILD, section.key);
    assert.equal(data.section, section.key, `${section.key} echoes its name`);
    assert.equal(typeof data.data, "object", `${section.key} returns an object`);
    assert.ok(data.data !== null, `${section.key} data is not null`);
  }

  const before = await e.settingsGet(GUILD, "automod");
  await e.settingsSave(GUILD, "automod", { enabled: false, punishment: "timeout", detection_threshold: 6 });
  const after = await e.settingsGet(GUILD, "automod");
  assert.equal(after.data.enabled, false);
  assert.equal(after.data.detection_threshold, 6);
  assert.equal(after.data.punishment, "timeout");
  // Fields that were not part of the patch survive.
  assert.deepEqual(after.data.blocked_words, before.data.blocked_words);
});

test("verification settings preserve the live panel and password hash", async () => {
  const { endpoints: e, backend } = setup();
  const before = await e.settingsGet(GUILD, "verification");
  assert.ok(Array.isArray(before.data.roles_to_remove));
  await e.settingsSave(GUILD, "verification", {
    role_id: before.data.role_id,
    type: "password",
    password: "correct horse battery",
    roles_to_remove: [],
  });
  const after = await e.settingsGet(GUILD, "verification");
  assert.equal(after.data.type, "password");
  assert.equal(after.data.password_configured, true);
  assert.equal(after.data.channel_id, before.data.channel_id);
  assert.equal(after.data.message_id, before.data.message_id);

  await e.settingsSave(GUILD, "verification", { role_id: before.data.role_id, type: "button" });
  const button = await e.settingsGet(GUILD, "verification");
  assert.equal(button.data.type, "button");
  assert.equal(button.data.password_configured, true, "the bot keeps the existing hash when switching modes");

  assert.ok(backend.metrics.requests > 0);
});

test("authentication is enforced and surfaced as ApiError(401)", async () => {
  const { endpoints: e } = setup({ token: "" });
  await assert.rejects(() => e.musicState(GUILD), (err) => {
    assert.equal(err.status, 401);
    assert.equal(err.name, "ApiError");
    return true;
  });
  await assert.rejects(() => e.modLogs(GUILD), (err) => err.status === 401);
});

test("retries: 0 issues exactly one fetch; retries: n issues n + 1", async () => {
  let calls = 0;
  const api = createApiClient({
    baseUrl: "https://api.test/api",
    getToken: () => "t",
    maxAttempts: 3,
    breakerThreshold: 999,
    fetchImpl: async () => {
      calls += 1;
      throw new TypeError("offline");
    },
  });
  await assert.rejects(() => api.get("/x", { retries: 0 }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => api.get("/y", { retries: 2 }));
  assert.equal(calls, 3);
});

test("unknown guilds return 404 instead of empty success payloads", async () => {
  const { endpoints: e } = setup();
  await assert.rejects(() => e.guildInfo("999999999999999999"), (err) => err.status === 404);
  await assert.rejects(() => e.settingsGet("999999999999999999", "automod"), (err) => err.status === 404);
  await assert.rejects(() => e.analytics("999999999999999999"), (err) => err.status === 404);
});

test("moderator actions validate payloads and mutate real state", async () => {
  const { endpoints: e, backend } = setup();
  const target = "900000000000000004";
  await assert.rejects(
    () => e.modAction({ guild_id: GUILD, action: "warn", target: "" }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => e.modAction({ guild_id: GUILD, action: "explode", target }),
    (err) => err.status === 400
  );
  const result = await e.modAction({ guild_id: GUILD, action: "timeout", target, duration: 60, reason: "test timeout" });
  assert.equal(result.status, "timed_out");
  const after = await e.modUser(GUILD, target);
  assert.ok(after.history.some((entry) => entry.action === "timeout"));
  assert.ok(backend.metrics.requests >= 4);
});

test("music controls mutate state and reject nonsense", async () => {
  const { endpoints: e } = setup();
  await assert.rejects(() => e.musicControl({ guild_id: GUILD, action: "warp" }), (err) => err.status === 400);
  await e.musicControl({ guild_id: GUILD, action: "volume", volume: 35 });
  assert.equal((await e.musicState(GUILD)).volume, 35);
  await e.musicControl({ guild_id: GUILD, action: "pause" });
  const paused = await e.musicState(GUILD);
  assert.equal(paused.paused, true);
  assert.equal(paused.playing, false);
  await e.musicControl({ guild_id: GUILD, action: "resume" });
  assert.equal((await e.musicState(GUILD)).paused, false);
});

test("stock trades validate quantity and balance", async () => {
  const { endpoints: e } = setup();
  const market = await e.stocksMarket();
  const symbol = market.stocks[0].symbol;
  await assert.rejects(
    () => e.stocksTrade({ user_id: DEMO_USER_ID, symbol, action: "buy", quantity: 0 }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => e.stocksTrade({ user_id: DEMO_USER_ID, symbol: "NOPE", action: "buy", quantity: 1 }),
    (err) => err.status === 404
  );
  const before = await e.stocksPortfolio(DEMO_USER_ID, { force: true });
  const trade = await e.stocksTrade({ user_id: DEMO_USER_ID, symbol, action: "buy", quantity: 2 });
  assert.equal(trade.status, "bought");
  const after = await e.stocksPortfolio(DEMO_USER_ID, { force: true });
  assert.equal(after.cash, Number((before.cash - trade.cost).toFixed(2)));
  await assert.rejects(
    () => e.stocksTrade({ user_id: DEMO_USER_ID, symbol, action: "sell", quantity: 10_000 }),
    (err) => err.status === 400
  );
});

test("public preferences only expose the current user's document", async () => {
  const { endpoints: e } = setup();
  await e.prefsSet(DEMO_USER_ID, { theme: "dark", density: "compact" });
  const prefs = await e.prefsGet(DEMO_USER_ID);
  assert.equal(prefs.theme, "dark");
  assert.equal(prefs.density, "compact");
  const other = await e.prefsGet(DEMO_USER.id === DEMO_USER_ID ? "900000000000000002" : DEMO_USER_ID);
  assert.notEqual(other.theme, "dark");
});
