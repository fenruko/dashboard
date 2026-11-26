import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLayout, buildLayout, groupsFor, indexById, layoutToItems, moveCategory, moveChannel, nudge, stateOf, withState,
} from "../../assets/app/data/channel-layout.js";

// Real-sized snowflakes: they must stay strings end to end.
const ID = (n) => `12000000000000000${String(n).padStart(2, "0")}`;
const sample = () => [
  { id: ID(1), name: "welcome", type: "text", position: 0, parent_id: null },
  { id: ID(10), name: "Info", type: "category", position: 1, parent_id: null },
  { id: ID(20), name: "Voice", type: "category", position: 2, parent_id: null },
  { id: ID(11), name: "rules", type: "text", position: 0, parent_id: ID(10) },
  { id: ID(12), name: "news", type: "news", position: 1, parent_id: ID(10) },
  { id: ID(13), name: "lounge", type: "voice", position: 2, parent_id: ID(10) },
  { id: ID(21), name: "gaming", type: "voice", position: 0, parent_id: ID(20) },
  { id: ID(22), name: "chat", type: "text", position: 1, parent_id: ID(20) },
];

test("layout puts uncategorised first, categories ordered, text before voice", () => {
  const layout = buildLayout(sample());
  assert.deepEqual(layout.top, [ID(1)]);
  assert.deepEqual(layout.cats.map((c) => c.id), [ID(10), ID(20)]);
  assert.deepEqual(layout.cats[1].children, [ID(22), ID(21)], "text sorts above voice even if its position is higher");
});

test("moveChannel across categories keeps the text/voice buckets", () => {
  const channels = sample();
  const byId = indexById(channels);
  const next = moveChannel(buildLayout(channels), byId, ID(13), { parentId: ID(20) });
  assert.deepEqual(next.cats[0].children, [ID(11), ID(12)]);
  assert.deepEqual(next.cats[1].children, [ID(22), ID(21), ID(13)]);
  const text = moveChannel(next, byId, ID(11), { parentId: ID(20), beforeId: ID(21) });
  assert.deepEqual(text.cats[1].children, [ID(22), ID(11), ID(21), ID(13)], "a text channel dropped before a voice one stays in the text bucket");
});

test("moveChannel can uncategorise and rejects categories", () => {
  const channels = sample();
  const byId = indexById(channels);
  const layout = buildLayout(channels);
  assert.deepEqual(moveChannel(layout, byId, ID(11), { parentId: null }).top, [ID(1), ID(11)]);
  assert.equal(moveChannel(layout, byId, ID(10), { parentId: ID(20) }), layout);
});

test("moveCategory and nudge reorder without crossing buckets", () => {
  const channels = sample();
  const byId = indexById(channels);
  const layout = buildLayout(channels);
  assert.deepEqual(moveCategory(layout, ID(20), ID(10)).cats.map((c) => c.id), [ID(20), ID(10)]);
  assert.deepEqual(nudge(layout, byId, ID(20), -1).cats.map((c) => c.id), [ID(20), ID(10)]);
  assert.equal(nudge(layout, byId, ID(10), -1), layout, "top edge is a no-op");
  assert.deepEqual(nudge(layout, byId, ID(12), -1).cats[0].children, [ID(12), ID(11), ID(13)]);
  assert.equal(nudge(layout, byId, ID(12), 1), layout, "cannot step a text channel below a voice one");
});

test("layoutToItems/applyLayout produce the reorder payload", () => {
  const channels = sample();
  const byId = indexById(channels);
  const next = moveChannel(buildLayout(channels), byId, ID(22), { parentId: ID(10), beforeId: ID(12) });
  const items = layoutToItems(next);
  assert.deepEqual(items.find((i) => i.id === ID(22)), { id: ID(22), position: 1, parent_id: ID(10) });
  assert.deepEqual(items.find((i) => i.id === ID(1)), { id: ID(1), position: 0, parent_id: null });
  assert.equal(items.find((i) => i.id === ID(20)).parent_id, undefined, "categories carry no parent_id");
  assert.ok(items.every((i) => typeof i.id === "string"));
  const applied = applyLayout(channels, next);
  assert.equal(applied.find((c) => c.id === ID(22)).parent_id, ID(10));
  assert.equal(applied.find((c) => c.id === ID(10)).parent_id, null);
});

test("permission helpers: tri-state, groups by channel kind", () => {
  const ow = { allow: ["view_channel"], deny: ["send_messages"] };
  assert.equal(stateOf(ow, "view_channel"), "allow");
  assert.equal(stateOf(ow, "send_messages"), "deny");
  assert.equal(stateOf(ow, "connect"), "inherit");
  assert.deepEqual(withState(ow, "view_channel", "deny").deny.sort(), ["send_messages", "view_channel"]);
  assert.deepEqual(withState(ow, "send_messages", "inherit").deny, []);
  const names = (channel) => groupsFor(channel).map((g) => g.id);
  assert.deepEqual(names({ type: "text" }), ["general", "text"]);
  assert.deepEqual(names({ type: "voice" }), ["general", "voice"]);
  assert.deepEqual(names({ type: "category" }), ["general", "text", "voice"]);
});
