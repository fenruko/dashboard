import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("config.js", "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const config = sandbox.window.RIFT_CONFIG;

test("production config targets the live bot API, not a local or demo host", () => {
  assert.equal(typeof config, "object");
  assert.match(config.apiBase, /^https:\/\/[a-z0-9.-]+\/api$/i);
  assert.equal(/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(config.apiBase), false);
  assert.equal(config.demo, false);
});

test("production config includes the Discord OAuth application settings", () => {
  assert.match(config.discordClientId, /^\d{17,20}$/);
  assert.match(config.invitePermissions, /^\d+$/);
  assert.equal(config.siteName, "Rift");
});
