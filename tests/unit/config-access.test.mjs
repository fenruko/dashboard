import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test("the bundled production host is the public Rift API", async () => {
  globalThis.window = { RIFT_CONFIG: { apiBase: "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api" } };
  globalThis.localStorage = new MemoryStorage();
  const config = await import("../../assets/app/config.js");
  assert.equal(config.getConfig().apiBase, "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api");
});

test("only allow-listed developer IDs get developer access", async () => {
  globalThis.window = { RIFT_CONFIG: { developerUserIds: ["111111111111111111"] } };
  globalThis.localStorage = new MemoryStorage();
  const { isDeveloperUserId } = await import("../../assets/app/config.js");
  assert.equal(isDeveloperUserId("834869554798395392"), true, "fenruko is built in");
  assert.equal(isDeveloperUserId("111111111111111111"), true, "deployments can add IDs");
  assert.equal(isDeveloperUserId("900000000000000001"), false);
  assert.equal(isDeveloperUserId(""), false);
  assert.equal(isDeveloperUserId(null), false);
});

test("API host overrides are owner-locked and never come from query strings", async () => {
  globalThis.window = { RIFT_CONFIG: { apiBase: "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api" } };
  globalThis.location = new URL("https://dash.rift.cool/?api=https://evil.example/api");
  globalThis.localStorage = new MemoryStorage();
  const config = await import("../../assets/app/config.js");

  assert.equal(config.getConfig().apiBase, "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api", "query strings are ignored");

  config.setApiBase("https://attacker.example/api");
  assert.equal(config.getConfig().apiBase, "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api", "an override requires an owner");

  config.setApiBase("https://staging.rift.baby/api", "834869554798395392");
  assert.equal(config.getConfig().apiBase, "https://staging.rift.baby/api");

  config.clearApiBaseOverride();
  assert.equal(config.getConfig().apiBase, "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api");

  // A hand-written override owned by a non-developer is ignored.
  globalThis.localStorage.setItem("rift_api_base", "https://attacker.example/api");
  globalThis.localStorage.setItem("rift_api_base_owner", "900000000000000001");
  assert.equal(config.getConfig().apiBase, "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api");
});
