import test from "node:test";
import assert from "node:assert/strict";

import { compilePath, guildPath, matchRoute } from "../../assets/app/core/router.js";
import { createStore } from "../../assets/app/core/store.js";

const ROUTES = [
  { path: "/g/:guildId/settings/:section" },
  { path: "/g/:guildId/settings" },
  { path: "/g/:guildId/analytics" },
  { path: "/g/:guildId" },
  { path: "/guilds" },
  { path: "/appeals/thread/:token" },
  { path: "/" },
];

test("route compilation handles params, trailing slashes and root", () => {
  assert.equal(compilePath("/g/:guildId").regex.test("/g/123"), true);
  assert.equal(compilePath("/g/:guildId").regex.test("/g/123/"), true);
  assert.equal(compilePath("/g/:guildId").regex.test("/g/123/analytics"), false);
  assert.equal(compilePath("/").regex.test("/"), true);
});

test("route matching prefers the first matching definition and decodes params", () => {
  assert.deepEqual(matchRoute(ROUTES, "/g/100/settings/welcome")?.params, { guildId: "100", section: "welcome" });
  assert.deepEqual(matchRoute(ROUTES, "/g/100/settings")?.params, { guildId: "100" });
  assert.deepEqual(matchRoute(ROUTES, "/g/100/analytics")?.params, { guildId: "100" });
  assert.deepEqual(matchRoute(ROUTES, "/g/100")?.params, { guildId: "100" });
  assert.deepEqual(matchRoute(ROUTES, "/appeals/thread/abc-123")?.params, { token: "abc-123" });
  assert.equal(matchRoute(ROUTES, "/nope"), null);
  assert.deepEqual(matchRoute(ROUTES, "/g/%E2%9C%93")?.params, { guildId: "✓" });
});

test("guildPath builds deep links without double slashes", () => {
  assert.equal(guildPath("100"), "/g/100");
  assert.equal(guildPath("100", "settings/welcome"), "/g/100/settings/welcome");
});

test("store notifies only on real changes and isolates subscriber failures", () => {
  const store = createStore({ count: 0, label: "a" }, { name: "test" });
  const seen = [];
  const unsubscribe = store.subscribe((state) => seen.push(state.count));
  store.set({ count: 1 });
  store.set({ count: 1 });
  store.set({ label: "b" });
  store.set((state) => ({ count: state.count + 1 }));
  assert.deepEqual(seen, [1, 1, 2], "plain subscribers hear every change; select() filters");
  unsubscribe();
  store.set({ count: 10 });
  assert.equal(seen.length, 3);
  assert.equal(store.get().count, 10);
});

test("store select isolates derived values", () => {
  const store = createStore({ a: 1, b: 1 });
  const values = [];
  store.select((state) => state.a, (value) => values.push(value));
  store.set({ b: 2 });
  store.set({ a: 2 });
  store.set({ a: 2 });
  assert.deepEqual(values, [2]);
});

test("store reset restores the initial shape but keeps explicit patches", () => {
  const store = createStore({ x: 1, y: 2 });
  store.set({ x: 9 });
  store.reset();
  assert.deepEqual(store.get(), { x: 1, y: 2 });
  store.reset({ y: 42 });
  assert.equal(store.get().y, 42);
});
