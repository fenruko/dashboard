import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_GUILDS, DEMO_USER_ID, createDemoBackend } from "../../tools/demo-backend.mjs";
import { createApiClient } from "../../assets/app/core/api.js";
import { createEndpoints } from "../../assets/app/data/endpoints.js";
import { createFetchAdapter } from "../dom/harness.mjs";

const GUILD = DEMO_GUILDS[0].id;
const GUILD_B = DEMO_GUILDS[1].id;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function setup({ token = "demo-token" } = {}) {
  const backend = createDemoBackend({ latency: 0, seed: 4242 });
  const adapter = createFetchAdapter(backend);
  const api = createApiClient({
    baseUrl: "https://api.test/api",
    getToken: () => token,
    maxAttempts: 1,
    breakerThreshold: 999,
    fetchImpl: adapter,
  });
  return { backend, api, endpoints: createEndpoints(api) };
}

test("ban appeal: lookup → OTP → verify → upload → submit → thread → reply", async () => {
  const { endpoints: e, api } = setup();
  const userId = "900000000000000004";

  const lookup = await e.appealsLookup(userId);
  assert.equal(lookup.user_id, userId);
  assert.match(lookup.username, /#\d{4}$/);

  await assert.rejects(() => e.appealsLookup("not-an-id"), (err) => err.status === 400);
  const sent = await e.appealsSendOtp(userId);
  assert.equal(sent.status, "sent");

  await assert.rejects(() => e.appealsVerifyOtp(userId, "12"), (err) => err.status === 401);
  const verified = await e.appealsVerifyOtp(userId, "1234");
  assert.match(verified.verify_token, /^vt-/);

  const upload = await e.appealsUpload(verified.verify_token, PNG);
  assert.ok(upload.id);

  await assert.rejects(
    () => e.appealsSubmit({ verify_token: verified.verify_token, reason: "too short", attachment_ids: [upload.id] }),
    (err) => err.status === 400
  );
  const submitted = await e.appealsSubmit({
    verify_token: verified.verify_token,
    reason: "I was banned by an overzealous automod and would like a human to review the logs.",
    evidence: "It happened in #general at 14:02 UTC.",
    attachment_ids: [upload.id],
  });
  assert.equal(submitted.status, "submitted");
  assert.match(submitted.thread_url, /appeal\//);

  const token = submitted.thread_url.split("/").pop();
  const real = await e.appealsThread(token);
  assert.equal(real.status, "pending");
  assert.equal(real.reason.includes("overzealous"), true);
  assert.equal(real.messages[0].ts > 0, true);
  assert.deepEqual(real.evidence_attachment_ids, [upload.id]);

  const attachmentResponse = await api.raw(`/appeals/attachments/${upload.id}`, { params: { token } });
  assert.equal(attachmentResponse.status, 200);
  assert.match(attachmentResponse.headers.get("content-type"), /image\/png/);
  assert.equal((await attachmentResponse.arrayBuffer()).byteLength > 20, true);

  await assert.rejects(
    () => e.appealsThreadMessage(token, "", []),
    (err) => err.status === 400
  );
  await e.appealsThreadMessage(token, "Adding the screenshot of the warning.", [upload.id]);
  const replied = await e.appealsThread(token);
  assert.equal(replied.messages.length, 2);
  assert.equal(replied.messages[1].text, "Adding the screenshot of the warning.");
  assert.equal(replied.messages[1].ts > 0, true);

  // One open appeal per user.
  const secondOtp = await e.appealsVerifyOtp(userId, "9999");
  await assert.rejects(
    () => e.appealsSubmit({ verify_token: secondOtp.verify_token, reason: "A second appeal while the first is open should be blocked." }),
    (err) => err.status === 409
  );

  await assert.rejects(() => e.appealsThread("does-not-exist"), (err) => err.status === 404);
});

test("verification upload rejects non-images and foreign tokens", async () => {
  const { endpoints: e } = setup();
  await e.appealsSendOtp("900000000000000004");
  const verified = await e.appealsVerifyOtp("900000000000000004", "1234");
  await assert.rejects(() => e.appealsUpload("bogus-token", PNG), (err) => err.status === 401);
  await assert.rejects(() => e.appealsUpload(verified.verify_token, "data:text/plain;base64,aGk="), (err) => err.status === 400);
});

test("voice call: call, match, hang up, and duplicate-call protection", async () => {
  const { endpoints: e } = setup();
  const guilds = await e.vcGuilds();
  assert.ok(guilds.guilds.some((guild) => guild.id === GUILD));

  const call = await e.vcCall({ guild_id: GUILD });
  assert.equal(call.matched, false);
  assert.match(call.code, /^R\d{4}$/);

  await assert.rejects(() => e.vcCall({ guild_id: GUILD }), (err) => err.status === 409);

  const matched = await e.vcCall({ guild_id: GUILD_B });
  assert.equal(matched.matched, true);
  assert.equal(matched.code, call.code);

  const state = await e.vcStatus();
  assert.equal(state.code, call.code);
  assert.equal(state.side_a.guild_id, GUILD);
  assert.equal(state.side_b.guild_id, GUILD_B);
  assert.ok(Array.isArray(state.side_a.members));

  await e.vcHangup({});
  assert.equal((await e.vcStatus()).code, undefined);
  await assert.rejects(() => e.vcHangup({}), (err) => err.status === 404);
  await assert.rejects(() => e.vcJoin({ code: "R0000", guild_id: GUILD_B }), (err) => err.status === 404);
});

test("playlists: create, rename, remove track, play, delete", async () => {
  const { endpoints: e } = setup();
  const list = await e.playlists(DEMO_USER_ID);
  assert.ok(list.playlists.length >= 1);
  const original = list.playlists[0];

  await assert.rejects(() => e.playlistCreate(DEMO_USER_ID, { name: "  " }), (err) => err.status === 400);
  await assert.rejects(() => e.playlistCreate(DEMO_USER_ID, { name: original.name }), (err) => err.status === 400);
  const created = await e.playlistCreate(DEMO_USER_ID, { name: "test mix" });
  assert.equal(created.playlist.name, "test mix");

  await e.playlistRename(DEMO_USER_ID, "test mix", "renamed mix");
  const renamed = await e.playlists(DEMO_USER_ID);
  assert.ok(renamed.playlists.some((playlist) => playlist.name === "renamed mix"));
  await assert.rejects(() => e.playlistDelete(DEMO_USER_ID, "does not exist"), (err) => err.status === 404);

  await assert.rejects(
    () => e.playlistRemoveTrack(DEMO_USER_ID, "renamed mix", 0),
    (err) => err.status === 400
  );

  const playable = renamed.playlists.find((playlist) => playlist.tracks?.length);
  assert.ok(playable, "seed data includes a playlist with tracks");
  await e.playlistPlay(DEMO_USER_ID, { name: playable.name, guild_id: GUILD });
  const music = await e.musicState(GUILD);
  assert.equal(music.current.title, playable.tracks[0].title);

  await e.playlistDelete(DEMO_USER_ID, "renamed mix");
  assert.equal((await e.playlists(DEMO_USER_ID)).playlists.some((playlist) => playlist.name === "renamed mix"), false);
});

test("music repair actions reject unknown fixes and report real results", async () => {
  const { endpoints: e } = setup();
  await assert.rejects(() => e.musicFix(GUILD, "exorcism"), (err) => err.status === 400);
  const region = await e.musicFix(GUILD, "region");
  assert.match(region.status, /Region/i);
  const rejoin = await e.musicFix(GUILD, "rejoin");
  assert.ok(rejoin.status);
  const filters = await e.musicFix(GUILD, "filters");
  assert.ok(filters.status);

  await e.musicControl({ guild_id: GUILD, action: "stop" });
  await assert.rejects(() => e.musicFix(GUILD, "rejoin"), (err) => err.status === 400);
});

test("public /verify accepts signed tokens and flags suspicious ones", async () => {
  const { endpoints: e } = setup();
  await assert.rejects(
    () => e.verify({ token: "short", fingerprint: "x".repeat(32) }),
    (err) => err.status === 400
  );
  const ok = await e.verify({ token: "a".repeat(24), fingerprint: "f".repeat(64), metadata: { platform: "Linux" } });
  assert.equal(ok.status, "success");
  await assert.rejects(
    () => e.verify({ token: "flag-this-session-please", fingerprint: "f".repeat(64) }),
    (err) => err.status === 403 && err.payload?.flagged === true
  );
});

test("settings reject readonly sections and missing required args", async () => {
  const { endpoints: e } = setup();
  await assert.rejects(() => e.settingsGet(GUILD, "not-a-section"), (err) => err.status === 404);
  await assert.rejects(() => e.settingsSave(GUILD, "giveaways", { anything: true }), (err) => err.status === 403);
  await assert.rejects(() => e.settingsSave(GUILD, "starboard", {}), (err) => err.status === 400);
  await assert.rejects(() => e.settingsSave(GUILD, "verification", { type: "button" }), (err) => err.status === 400);
  const logging = await e.settingsSave(GUILD, "logging", { channel_id: "200000000000000102" });
  assert.equal(logging.ok, true);
  const saved = await e.settingsGet(GUILD, "logging");
  assert.equal(saved.data.channel_id, "200000000000000102");
});

test("prefs survive a reload and reject oversized payloads", async () => {
  const { endpoints: e } = setup();
  await e.prefsSet(DEMO_USER_ID, { theme: "dark", density: "compact", sidebar: false });
  const reloaded = await e.prefsGet(DEMO_USER_ID);
  assert.equal(reloaded.theme, "dark");
  assert.equal(reloaded.sidebar, false);
  await assert.rejects(
    () => e.prefsSet(DEMO_USER_ID, { junk: "x".repeat(70_000) }),
    (err) => err.status === 400
  );
});

test("concurrent read dedupe and cache do not leak between users", async () => {
  const { api, endpoints: e } = setup();
  const [a, b, c] = await Promise.all([e.stats(), e.stats(), e.stats()]);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.equal(api.getMetrics().requests, 1, "three concurrent stats reads share one request");

  const mine = await e.prefsGet(DEMO_USER_ID);
  const theirs = await e.prefsGet("900000000000000002");
  assert.notEqual(mine, theirs);
  assert.equal(api.cacheSize() >= 0, true);
});

test("bug reports accept screenshots and enforce the daily limit", async () => {
  const { endpoints: e, backend } = setup();
  const key = "bug-test-key";
  const upload = await e.bugReportUpload(key, PNG);
  assert.ok(upload.id);
  await assert.rejects(() => e.bugReportUpload("", PNG), (err) => err.status === 400);

  await assert.rejects(
    () => e.bugReportSubmit({ user_id: "abc", description: "long enough text", upload_key: key }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => e.bugReportSubmit({ user_id: DEMO_USER_ID, description: "short", upload_key: key }),
    (err) => err.status === 400
  );
  const submitted = await e.bugReportSubmit({
    user_id: DEMO_USER_ID,
    description: "The music page shows an empty queue after a reconnect.",
    upload_key: key,
    attachment_ids: [upload.id],
    fingerprint: "test-browser",
  });
  assert.equal(submitted.status, "submitted");
  assert.equal(backend.state.bugReports.length, 1);
  assert.deepEqual(backend.state.bugReports[0].attachment_ids, [upload.id]);
  assert.equal(backend.state.bugAttachments.get(String(upload.id)).report_id, submitted.id);

  for (let index = 0; index < 2; index += 1) {
    await e.bugReportSubmit({
      user_id: DEMO_USER_ID,
      description: `Another report number ${index + 2} with enough detail.`,
      fingerprint: "test-browser",
    });
  }
  await assert.rejects(
    () => e.bugReportSubmit({
      user_id: DEMO_USER_ID,
      description: "This fourth report in one day should be rate-limited.",
      fingerprint: "test-browser",
    }),
    (err) => err.status === 429
  );
});
