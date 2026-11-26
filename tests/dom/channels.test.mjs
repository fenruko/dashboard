/* Channels page + the verification role picker, driven against the demo backend. */

import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

import { createHarness, installDom, flush } from "./harness.mjs";
import { createStore } from "../../assets/app/core/store.js";

installDom();

function freshRoot() {
  document.getElementById("root").innerHTML = "";
  document.getElementById("overlay-root").innerHTML = "";
  document.getElementById("toast-root").innerHTML = "";
}

/** Mount a page with a live hub the test can push events into. */
async function mountWithLive(harness, modulePath, options) {
  const handlers = new Map();
  const live = {
    statusStore: createStore({ stats: "open", vc: "open" }, { name: `live-${Math.random()}` }),
    subscribe: (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type).delete(fn);
    },
  };
  const emit = (type, payload) => [...(handlers.get(type) || [])].forEach((fn) => fn(payload));
  const pageModule = await import(pathToFileURL(resolvePath(process.cwd(), modulePath)).href);
  const ctx = { ...harness.makeCtx(options), live };
  const cleanup = await pageModule.mountPage(ctx);
  return { cleanup, emit };
}

const rowNames = () => [...document.querySelectorAll(".ch-row .ch-name-text")].map((node) => node.textContent);
const rowFor = (name) => [...document.querySelectorAll(".ch-row")].find((row) => row.querySelector(".ch-name-text")?.textContent === name);
const clickText = (label) => {
  const node = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === label);
  assert.ok(node, `expected a button labelled “${label}”`);
  node.click();
};

test("channels page lists categories with their channels", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: `/g/${harness.guild.id}/channels`, params: { guildId: harness.guild.id } });
  await flush(8);
  const names = rowNames();
  assert.ok(names.includes("general") && names.includes("STAFF") && names.includes("TICKETS"));
  assert.ok(names.indexOf("ticket-0042") > names.indexOf("TICKETS"), "the ticket channel is listed under its category");
  assert.ok(names.indexOf("general") < names.indexOf("STAFF"), "uncategorised channels come first");
  cleanup();
});

test("up/down arrows persist a reorder to the bot", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: "/", params: { guildId: harness.guild.id } });
  await flush(8);
  const before = rowNames();
  assert.equal(before[0], "general");
  rowFor("general").querySelector('button[aria-label="Move general down"]').click();
  await flush(8);
  const after = rowNames();
  assert.deepEqual(after.slice(0, 2), ["announcements", "general"]);
  const stored = harness.backend.handle ? null : null;
  void stored;
  const snapshot = await harness.endpoints.channels(harness.guild.id);
  const order = snapshot.channels.filter((c) => !c.parent_id && c.type === "text").sort((a, b) => a.position - b.position).map((c) => c.name);
  assert.deepEqual(order.slice(0, 2), ["announcements", "general"], "the backend saw the new order");
  cleanup();
});

test("selecting a channel shows its permissions and saving an overwrite round-trips", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: "/", params: { guildId: harness.guild.id } });
  await flush(8);
  rowFor("logs").querySelector(".ch-name").click();
  await flush(2);
  clickText("Permissions (1)");
  await flush(2);
  assert.match(document.querySelector(".ch-targets").textContent, /Moderator/);
  const deny = document.querySelector('.tri-btn--deny[aria-label="Deny Embed links"]');
  assert.ok(deny, "permission grid renders text permissions for a text channel");
  deny.click();
  await flush(1);
  clickText("Save permissions");
  await flush(8);
  const snapshot = await harness.endpoints.channels(harness.guild.id);
  const logs = snapshot.channels.find((c) => c.name === "logs");
  assert.ok(logs.overwrites[0].deny.includes("embed_links"));
  assert.ok(harness.toasts.some((t) => t.type === "success"));
  cleanup();
});

test("deleting a channel needs its name typed, then removes it", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: "/", params: { guildId: harness.guild.id } });
  await flush(8);
  rowFor("counting").querySelector(".ch-name").click();
  await flush(2);
  clickText("Delete");
  await flush(2);
  const confirm = [...document.querySelectorAll(".modal button")].find((b) => /Delete channel/.test(b.textContent));
  assert.ok(confirm);
  confirm.click();
  await flush(4);
  assert.ok(document.querySelector(".modal"), "confirming without typing the name keeps the dialog open");
  assert.ok(rowNames().includes("counting"), "nothing was deleted yet");
  const input = document.querySelector(".modal input");
  input.value = "counting";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await flush(1);
  confirm.click();
  await flush(10);
  assert.equal(rowNames().includes("counting"), false);
  const snapshot = await harness.endpoints.channels(harness.guild.id);
  assert.equal(snapshot.channels.some((c) => c.name === "counting"), false);
  cleanup();
});

test("a live snapshot from Discord updates the tree instantly", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup, emit } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: "/", params: { guildId: harness.guild.id } });
  await flush(8);
  assert.equal(rowNames().includes("brand-new"), false);
  const snapshot = await harness.endpoints.channels(harness.guild.id);
  snapshot.channels.push({ id: "200000000000000999", name: "brand-new", type: "text", position: 99, parent_id: null, synced: false, overwrites: [] });
  emit("channels_snapshot", { guild_id: harness.guild.id, data: undefined, ...snapshot });
  assert.ok(rowNames().includes("brand-new"), "channel created in Discord appears without a reload");

  emit("channels_snapshot", { ...snapshot, channels: snapshot.channels.filter((c) => c.name !== "brand-new") });
  assert.equal(rowNames().includes("brand-new"), false, "channel deleted in Discord disappears");

  emit("channels_snapshot", { ...snapshot, guild_id: "999", channels: [] });
  assert.ok(rowNames().length > 5, "snapshots for another server are ignored");
  cleanup();
});

test("a live delete of the open channel closes its editor", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup, emit } = await mountWithLive(harness, "assets/app/pages/channels.js", { path: "/", params: { guildId: harness.guild.id } });
  await flush(8);
  rowFor("music").querySelector(".ch-name").click();
  await flush(2);
  assert.match(document.querySelector(".ch-detail-head").textContent, /music/);
  const snapshot = await harness.endpoints.channels(harness.guild.id);
  emit("channels_snapshot", { ...snapshot, channels: snapshot.channels.filter((c) => c.name !== "music") });
  assert.equal(document.querySelector(".ch-detail-head"), null);
  assert.ok(harness.toasts.some((t) => /deleted/.test(t.message)));
  cleanup();
});

test("verification offers web mode and a role autocomplete that saves exact ids", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountWithLive(harness, "assets/app/pages/settings.js", {
    path: `/g/${harness.guild.id}/settings/verification`,
    params: { guildId: harness.guild.id, section: "verification" },
  });
  await flush(10);
  const options = [...document.querySelectorAll("select option")].map((option) => option.value);
  assert.ok(options.includes("web"), "web verification is selectable");

  const input = document.querySelector(".role-select .tag-editor-input");
  assert.ok(input, "roles-to-remove is an autocomplete, not a free-text id box");
  assert.match(document.querySelector(".role-select").textContent, /Level 10/, "existing ids render as role names");
  input.focus();
  input.value = "boost";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const items = [...document.querySelectorAll(".suggest-item")];
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Boosters/);
  items[0].dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  await flush(1);
  assert.match(document.querySelector(".role-select").textContent, /@Boosters/);

  const select = [...document.querySelectorAll("select")].find((node) => [...node.options].some((o) => o.value === "web"));
  select.value = "web";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await flush(1);
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Save changes")).click();
  await flush(12);
  const stored = harness.backend.getGuildSettings(harness.guild.id).verification;
  assert.equal(stored.type, "web");
  assert.deepEqual(stored.roles_to_remove.map(String).sort(), ["300000000000000106", "300000000000000108"]);
  cleanup();
});
