import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_GUILDS, createDemoBackend } from "../../tools/demo-backend.mjs";
import { createApiClient } from "../../assets/app/core/api.js";
import { createEndpoints } from "../../assets/app/data/endpoints.js";
import { createFetchAdapter } from "../dom/harness.mjs";

const GUILD = DEMO_GUILDS[0].id;
const unwrap = (r) => r?.data ?? r;

function setup() {
  const backend = createDemoBackend({ latency: 0, seed: 7 });
  const api = createApiClient({ baseUrl: "https://api.test/api", getToken: () => "demo-token", maxAttempts: 1, breakerThreshold: 999, fetchImpl: createFetchAdapter(backend) });
  return createEndpoints(api);
}

test("autoresponder: create → list → update → delete (trigger with slash/space)", async () => {
  const e = setup();
  await e.autoresponderCreate(GUILD, { trigger: "a/b c", response: "hi" });
  const list = unwrap(await e.autoresponders(GUILD));
  assert.ok(JSON.stringify(list).includes("a/b c"));
  await e.autoresponderUpdate(GUILD, "a/b c", { response: "yo" });
  await e.autoresponderDelete(GUILD, "a/b c");
  assert.ok(!JSON.stringify(unwrap(await e.autoresponders(GUILD))).includes("a/b c"));
});

test("giveaway: create → end → reroll → delete", async () => {
  const e = setup();
  const info = unwrap(await e.guildInfo(GUILD));
  const channel = info.channels.find((c) => c.type === "text" || c.type === 0);
  const created = unwrap(await e.giveawayCreate(GUILD, { prize: "Nitro", duration: "1h", winners: 1, channel_id: String(channel.id) }));
  const id = created.message_id ?? created.giveaway?.message_id;
  assert.ok(id, "create returns a message id");
  await e.giveawayEnd(GUILD, id);
  await assert.rejects(() => e.giveawayReroll(GUILD, id, { count: 1 }), /entered/); // nobody joined
  await e.giveawayDelete(GUILD, id);
});

test("giveaway rejects a bad duration", async () => {
  const e = setup();
  await assert.rejects(() => e.giveawayCreate(GUILD, { prize: "x", duration: "soon", winners: 1, channel_id: "800000000000000001" }));
});
