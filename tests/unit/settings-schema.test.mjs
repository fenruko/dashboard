import test from "node:test";
import assert from "node:assert/strict";

import {
  SETTINGS_SECTIONS,
  buildSettingsModel,
  buildSettingsPayload,
  coerceValue,
  getSection,
  inferFieldType,
  prettyKey,
  validateField,
  validateSection,
} from "../../assets/app/data/settings-schema.js";

test("every settings section the bot exposes is present exactly once", () => {
  const keys = SETTINGS_SECTIONS.map((section) => section.key);
  assert.equal(new Set(keys).size, keys.length);
  const expected = [
    "automod", "antinuke", "antiraid", "welcome", "goodbye", "leveling",
    "voice_xp", "invites", "vanity", "reports", "counting", "prefix",
    "disabled_commands", "jail", "tickets", "boost", "starboard", "logging",
    "verification", "modmail", "suggestions", "confessions", "bump",
    "boosterrole", "socials", "giveaways", "autoresponder", "reaction_roles",
  ];
  for (const key of expected) assert.ok(keys.includes(key), `${key} missing from schema`);
  for (const section of SETTINGS_SECTIONS) {
    assert.ok(section.title, `${section.key} has a title`);
    assert.ok(["merge", "keys", "strict", "detected", "readonly", "socials"].includes(section.mode), `${section.key} has a known mode`);
  }
});

test("unknown keys returned by the bot surface as editable extras", () => {
  const section = getSection("automod");
  const model = buildSettingsModel(section, {
    enabled: true,
    extra_unknown: { nested: true },
    another_one: 42,
  });
  assert.equal(model.fields.find((field) => field.key === "enabled")?.type, "boolean");
  const extras = model.extras.map((field) => field.key);
  assert.deepEqual(extras.sort(), ["another_one", "extra_unknown"]);
  assert.equal(model.extras.find((field) => field.key === "extra_unknown").type, "json");
});

test("field inference covers the shapes the bot returns", () => {
  assert.equal(inferFieldType("enabled", true), "boolean");
  assert.equal(inferFieldType("threshold", 4), "number");
  assert.equal(inferFieldType("blocked_words", ["a"]), "tags");
  assert.equal(inferFieldType("some_object", { a: 1 }), "json");
  assert.equal(inferFieldType("embed_color", "#ff0000"), "color");
  assert.equal(inferFieldType("role_id", "300000000000000001"), "role");
  assert.equal(inferFieldType("channel_id", "200000000000000001"), "channel");
  assert.equal(prettyKey("xp_per_message"), "Xp Per Message");
});

test("coerceValue converts browser strings to API types", () => {
  assert.equal(coerceValue({ type: "number" }, "12"), 12);
  assert.equal(coerceValue({ type: "number" }, ""), null);
  assert.equal(coerceValue({ type: "boolean" }, "false"), true, "checkbox semantics: presence is truthy");
  assert.deepEqual(coerceValue({ type: "tags" }, [" a ", "", "b"]), ["a", "b"]);
  assert.equal(coerceValue({ type: "channel" }, "123"), "123");
  assert.equal(coerceValue({ type: "channel" }, "not-an-id"), null);
});

test("validation catches required, numeric and picker mistakes", () => {
  assert.match(validateField({ key: "role_id", label: "Role", type: "role", required: true }, ""), /required/);
  assert.equal(validateField({ key: "threshold", type: "number", min: 1 }, "0"), "Must be at least 1.");
  assert.equal(validateField({ key: "threshold", type: "number", max: 10 }, "11"), "Must be at most 10.");
  assert.equal(validateField({ key: "threshold", type: "number" }, "abc"), "Enter a number.");
  assert.equal(validateField({ key: "channel_id", type: "channel" }, "abc"), "Pick a valid item.");
  assert.equal(validateField({ key: "message", type: "textarea" }, ""), "");

  const verification = getSection("verification");
  const errors = validateSection(verification, { role_id: "", type: "button", password: "", roles_to_remove: [] }, new Set());
  assert.ok(errors.role_id);
});

test("strict setters receive every curated field, not just the edited one", () => {
  const verification = getSection("verification");
  const raw = { role_id: "300000000000000104", type: "button", roles_to_remove: ["300000000000000108"], channel_id: "200000000000000103", message_id: "8", password_configured: true };
  const values = { role_id: "300000000000000104", type: "password", password: "hunter2!", roles_to_remove: ["300000000000000108"] };
  const payload = buildSettingsPayload(verification, raw, values, new Set(["type", "password"]));
  assert.deepEqual(payload.role_id, "300000000000000104");
  assert.equal(payload.type, "password");
  assert.equal(payload.password, "hunter2!");
  assert.equal(payload.password_hash, undefined);
  assert.equal(payload.password_configured, undefined);
  assert.deepEqual(payload.roles_to_remove, [300000000000000108]);
  assert.equal(payload.channel_id, undefined, "pinned channel is not sent back");
});

test("strict payload never sends an empty password (would clear the hash)", () => {
  const verification = getSection("verification");
  const payload = buildSettingsPayload(
    verification,
    { role_id: "1", type: "button", roles_to_remove: [] },
    { role_id: "1", type: "button", password: "", roles_to_remove: [] },
    new Set()
  );
  assert.equal("password" in payload, false);
});

test("keys mode sends the fixed bot key set", () => {
  const leveling = getSection("leveling");
  const raw = { xp_per_message: 10, xp_cooldown: 5, xp_formula_base: 100, xp_formula_exponent: 1.5, level_up_channel: "2", level_up_messages: true, level_up_image: false };
  const values = { ...raw, xp_per_message: "22" };
  const payload = buildSettingsPayload(leveling, raw, values, new Set(["xp_per_message"]));
  assert.equal(payload.xp_per_message, 22);
  assert.equal(payload.xp_formula_base, 100);
  assert.deepEqual(payload.level_up_image, false);
});

test("merge mode preserves unknown keys and only sends edited curated ones", () => {
  const automod = getSection("automod");
  const raw = { enabled: true, punishment: "timeout", blocked_words: ["slur"], extra_unknown: "keep-me" };
  const values = { enabled: false, punishment: "timeout", blocked_words: ["slur", "spam"], extra_unknown: "keep-me" };
  const payload = buildSettingsPayload(automod, raw, values, new Set(["enabled", "blocked_words"]));
  assert.equal(payload.enabled, false);
  assert.deepEqual(payload.blocked_words, ["slur", "spam"]);
  assert.equal(payload.extra_unknown, "keep-me");
});

test("socials payload filters invalid rows and normalises platforms", () => {
  const socials = getSection("socials");
  const values = {
    subscriptions: [
      { platform: "YouTube", username: " RiftBot ", channel_id: "2" },
      { platform: "twitch", username: "", channel_id: "3" },
      { platform: "myspace", username: "x", channel_id: "4" },
    ],
  };
  const payload = buildSettingsPayload(socials, { subscriptions: [] }, values, new Set());
  assert.deepEqual(payload.subscriptions, [{ platform: "youtube", username: "RiftBot", channel_id: "2" }]);
});

test("keys-mode validation ignores curated fields outside the bot key set", () => {
  const synthetic = {
    key: "synthetic",
    mode: "keys",
    keys: ["xp_per_message"],
    fields: [
      { key: "xp_per_message", label: "XP per message", type: "number", min: 0 },
      { key: "not_a_bot_key", label: "Not a bot key", type: "number", min: 5 },
    ],
  };
  const errors = validateSection(synthetic, { xp_per_message: "10", not_a_bot_key: "1" }, new Set());
  assert.equal(errors.not_a_bot_key, undefined);
  assert.equal(errors.xp_per_message, undefined);
  const flagged = validateSection(synthetic, { xp_per_message: "-5", not_a_bot_key: "1" }, new Set());
  assert.ok(flagged.xp_per_message);
});
