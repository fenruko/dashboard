import test from "node:test";
import assert from "node:assert/strict";

import { createApiClient } from "../../assets/app/core/api.js";
import { createSocket } from "../../assets/app/core/ws.js";

test("the circuit breaker opens after repeated network failures and recovers", async () => {
  let clock = 1_000;
  let calls = 0;
  let reachable = false;
  const api = createApiClient({
    baseUrl: "https://bot.test/api",
    now: () => clock,
    maxAttempts: 1,
    breakerThreshold: 2,
    breakerCooldown: 1_000,
    fetchImpl: async () => {
      calls += 1;
      if (!reachable) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await assert.rejects(api.get("/stats"), /reach the Rift backend/);
  assert.equal(api.isBreakerOpen(), false, "one failure is not enough");
  await assert.rejects(api.get("/stats"), /reach the Rift backend/);
  assert.equal(api.isBreakerOpen(), true, "two failures open the breaker");
  assert.ok(api.breakerRemaining() > 0);

  const before = calls;
  await assert.rejects(api.get("/stats"), /backend|unavailable|reach/i);
  assert.equal(calls, before, "requests are rejected locally while the breaker is open");

  clock += 5_000;
  reachable = true;
  const data = await api.get("/stats");
  assert.deepEqual(data, { ok: true });
  assert.equal(api.isBreakerOpen(), false, "a success closes the breaker");
  assert.equal(api.getMetrics().failures, 2);
});

test("websocket reconnects with backoff, buffers sends and honours auth failures", () => {
  const sockets = [];
  const timers = [];
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(payload) {
      this.sent.push(payload);
    }
    close(code = 1000) {
      this.readyState = 3;
      this.closedWith = code;
    }
  }

  const statuses = [];
  const socket = createSocket({
    url: "wss://bot.test/ws",
    WebSocketImpl: FakeSocket,
    onStatus: (status) => statuses.push(status.status),
    minDelay: 1_000,
    maxDelay: 8_000,
    random: () => 0.5,
    setTimeoutImpl: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeoutImpl: (id) => {
      const timer = timers[id - 1];
      if (timer) timer.cancelled = true;
    },
  });

  socket.connect();
  assert.equal(sockets.length, 1);
  assert.equal(socket.send({ hello: "world" }), false, "sends queue until open");
  sockets[0].readyState = 1;
  sockets[0].onopen();
  assert.deepEqual(sockets[0].sent, ['{"hello":"world"}']);

  sockets[0].onclose({ code: 1006 });
  assert.equal(socket.status, "reconnecting");
  const retry = timers.at(-1);
  assert.ok(retry.ms >= 1_000, "backoff waits before reconnecting");
  retry.fn();
  assert.equal(sockets.length, 2, "a second socket is created");

  sockets[1].onopen();
  const retriesBefore = timers.length;
  sockets[1].onclose({ code: 4001 });
  assert.equal(socket.status, "error");
  assert.equal(timers.length, retriesBefore, "a rejected token is not retried in a loop");

  socket.dispose();
  assert.ok(statuses.includes("open"));
});
