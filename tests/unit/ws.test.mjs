import test from "node:test";
import assert from "node:assert/strict";

import { wsUrlFor } from "../../assets/app/core/ws.js";

test("absolute https API bases become wss sockets with the token", () => {
  assert.equal(
    wsUrlFor("https://bot.example.com/api", "/ws", "abc"),
    "wss://bot.example.com/ws?access_token=abc"
  );
});

test("relative API bases resolve against the page origin", (t) => {
  const previous = globalThis.location;
  globalThis.location = { href: "https://dash.test/g/123/music" };
  t.after(() => {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  });
  assert.equal(wsUrlFor("/api", "/ws/vc", "demo-token"), "wss://dash.test/ws/vc?access_token=demo-token");
});

test("http API bases stay ws rather than wss", () => {
  assert.equal(wsUrlFor("http://127.0.0.1:4173/api", "/ws"), "ws://127.0.0.1:4173/ws");
});

test("an API base with a path keeps that path prefix", () => {
  assert.equal(wsUrlFor("https://example.com/rift/api/", "/ws"), "wss://example.com/rift/ws");
});
