import test from "node:test";
import assert from "node:assert/strict";
import { channelMatches, channelTypeLabel, channelOptions } from "../../assets/app/data/channels.js";

test("accepts both discord.py names and numeric types", () => {
  assert.ok(channelMatches({ type: "text" }, "text"));
  assert.ok(channelMatches({ type: 0 }, "text"));
  assert.ok(channelMatches({ type: "stage_voice" }, "voice"));
  assert.ok(channelMatches({ type: "category" }, "category"));
  assert.ok(!channelMatches({ type: "voice" }, "sendable"));
  assert.ok(channelMatches({ type: "x" }, "unknown-kind"));
});

test("labels and options", () => {
  assert.equal(channelTypeLabel({ type: 5 }), "announcement");
  assert.deepEqual(channelOptions({ channels: [{ id: 1, name: "a", type: "text" }, { id: 2, name: "v", type: "voice" }] }, "text").map((o) => o.label), ["#a"]);
});
