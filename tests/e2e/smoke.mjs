/* End-to-end smoke test for the static site + API + websockets.
 *
 * Starts the real dev server and standalone mock API as child processes,
 * exercises the same HTTP/WS surfaces a browser would, and tears everything
 * down. Run with `npm run test:e2e`.
 */

import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";

const DEV_PORT = Number(process.env.E2E_PORT || 4175);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 8799);
const base = `http://127.0.0.1:${DEV_PORT}`;
const mockBase = `http://127.0.0.1:${MOCK_PORT}`;
const children = [];

function start(command, env, name) {
  const child = spawn(process.execPath, command, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function waitForHttp(url, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} → ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function waitForSocket(url, type, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for ${type} from ${url}`));
    }, timeout);
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (message.type === type) {
        clearTimeout(timer);
        socket.close();
        resolve(message);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload, headers: response.headers };
}

const auth = { Authorization: "Bearer demo-token" };

try {
  start(["tools/mock-server.mjs"], { MOCK_PORT: String(MOCK_PORT) }, "mock");
  start(["tools/dev-server.mjs"], { PORT: String(DEV_PORT) }, "dev");
  await waitForHttp(`${base}/__mock/health`);
  await waitForHttp(`${mockBase}/health`);

  /* ------------------------------ static ------------------------------ */

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /assets\/app\/main\.js/);
  assert.match(html, /id="root"/);

  const config = await (await fetch(`${base}/config.js`)).text();
  assert.match(config, /apiBase/);
  assert.match(config, /demo: true/);
  assert.ok(config.includes('apiBase: "/api"'), "dev uses a same-origin API path so previews and remote browsers work");

  const deepLink = await fetch(`${base}/g/100000000000000001/settings/verification`);
  assert.equal(deepLink.status, 200, "SPA deep links fall back to index.html");

  const css = await fetch(`${base}/assets/app/app.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type"), /text\/css/);
  const cssText = await css.text();
  assert.ok(cssText.length > 50_000, "stylesheet is present");

  const traversal = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
  assert.equal(traversal.status, 403, "encoded path traversal is refused");
  const plainDots = await fetch(`${base}/../../etc/passwd`);
  assert.equal((await plainDots.text()).includes("root:x:"), false, "never serves files outside the site root");

  /* -------------------------- development API ------------------------- */

  const publicStats = await json(`${base}/api/stats`);
  assert.equal(publicStats.status, 200);
  assert.equal("cpu" in publicStats.payload, false, "hardware stats require auth");

  const protectedCall = await json(`${base}/api/guild/100000000000000001/settings/automod`);
  assert.equal(protectedCall.status, 401, "settings require a Discord bearer token");

  const stats = await json(`${base}/api/stats`, { headers: auth });
  assert.equal(stats.status, 200);
  assert.equal(typeof stats.payload.guilds, "number");

  const settingsBefore = await json(`${base}/api/guild/100000000000000001/settings/automod`, { headers: auth });
  assert.equal(settingsBefore.status, 200);
  const updated = await json(`${base}/api/guild/100000000000000001/settings/automod`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: !settingsBefore.payload.data.enabled }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.ok, true);
  const settingsAfter = await json(`${base}/api/guild/100000000000000001/settings/automod`, { headers: auth });
  assert.equal(settingsAfter.payload.data.enabled, !settingsBefore.payload.data.enabled, "settings survive a write");

  const missing = await json(`${base}/api/guild/999999999999999999/info`, { headers: auth });
  assert.equal(missing.status, 404);

  const options = await fetch(`${base}/api/stats`, { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "*");

  /* ---------------------------- standalone API ------------------------ */

  const standalone = await json(`${mockBase}/api/stats`, { headers: auth });
  assert.equal(standalone.status, 200);
  assert.equal(typeof standalone.payload.users, "number");

  /* ------------------------------ websockets -------------------------- */

  const devStats = await waitForSocket(`ws://127.0.0.1:${DEV_PORT}/ws?access_token=demo-token`, "stats");
  assert.ok(devStats.data.guilds >= 1);
  const devMusic = await waitForSocket(`ws://127.0.0.1:${DEV_PORT}/ws?access_token=demo-token`, "music_state");
  assert.ok("connected" in devMusic.data);
  const devVc = await waitForSocket(`ws://127.0.0.1:${DEV_PORT}/ws/vc?access_token=demo-token`, "call_state");
  assert.equal(devVc.data, null, "no call is active yet");

  const mockStats = await waitForSocket(`ws://127.0.0.1:${MOCK_PORT}/ws?access_token=demo-token`, "stats");
  assert.ok(mockStats.data.guilds >= 1);

  console.log("\nE2E smoke passed: static site, config, API, settings write, 403 guard, CORS and websockets.\n");
} finally {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await Promise.race([
    Promise.all(children.map((child) => (child.exitCode == null ? once(child, "exit") : null))).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
