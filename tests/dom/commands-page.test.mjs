import test from "node:test";
import assert from "node:assert/strict";
import { createHarness, mountPage, flush } from "./harness.mjs";
import { flattenCatalog, filterCommands } from "../../assets/app/pages/commands.js";
import { createDemoBackend } from "../../tools/demo-backend.mjs";

async function catalog() {
  const res = await createDemoBackend().handle({ method: "GET", path: "/public/commands", query: new URLSearchParams(), body: null, headers: {} });
  return res.body;
}

test("flattenCatalog walks subcommands and tags each row with its category", async () => {
  const rows = flattenCatalog(await catalog());
  assert.equal(rows.length, 7); // 3 + 2 + 1 top-level, plus "warn list"
  const sub = rows.find((r) => r.path === "warn list");
  assert.equal(sub.categoryId, "moderation");
  assert.equal(rows.find((r) => r.path === "warn").type, "group");
});

test("flattenCatalog survives garbage input", () => {
  assert.deepEqual(flattenCatalog(null), []);
  assert.deepEqual(flattenCatalog({ categories: [null, { commands: [null, 5, { name: "" }] }] }), []);
  const [only] = flattenCatalog({ categories: [{ id: 1, commands: [{ name: "x", aliases: "nope", kinds: null }] }] });
  assert.deepEqual(only.aliases, []);
  assert.deepEqual(only.kinds, []);
});

test("filterCommands needs every word, matches aliases/usage, and honours category", async () => {
  const rows = flattenCatalog(await catalog());
  assert.deepEqual(filterCommands(rows, { query: "ban member" }).map((r) => r.path), ["ban"]);
  assert.deepEqual(filterCommands(rows, { query: "b" }).some((r) => r.path === "ban"), true);
  assert.deepEqual(filterCommands(rows, { categoryId: "music" }).map((r) => r.path), ["play", "skip"]);
  assert.equal(filterCommands(rows, { query: "zzzz" }).length, 0);
});

test("commands page renders results, searches, and shows API strings as text (no XSS)", async () => {
  const harness = createHarness();
  const { cleanup } = await mountPage("assets/app/pages/commands.js", harness, { path: "/g/1/commands", params: { guildId: "1" }, query: {}, route: { title: "Commands" } });
  await flush();
  const root = document.getElementById("root");
  assert.match(root.textContent, /Ban a member from the server/);
  assert.equal(root.querySelector("img"), null, "hostile command name must not become an element");
  assert.match(root.textContent, /<img src=x onerror=alert\(1\)>/);

  const input = root.querySelector("input");
  input.value = "skip";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 200)); // 120ms debounce
  assert.doesNotMatch(root.textContent, /Ban a member/);
  assert.match(root.textContent, /Skip the current song/);
  cleanup?.();
});
