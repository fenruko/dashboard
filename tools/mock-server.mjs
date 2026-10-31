/* Standalone mock API server.
 *
 * Useful when the dashboard is served elsewhere (GitHub Pages, a preview host,
 * a file server) and you want it pointed at the mock:
 *   npm run mock            → http://127.0.0.1:8788/api
 *   open the dashboard with ?api=http://<host>:8788/api&demo=1
 *
 * It is intentionally the same backend module the dev server and tests use. */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createMockBackend, DEMO_USER_ID } from "./mock-backend.mjs";

const PORT = Number(process.env.MOCK_PORT || 8788);
const HOST = process.env.HOST || "0.0.0.0";
const backend = createMockBackend({ latency: Number(process.env.MOCK_LATENCY || 30) });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "600",
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) throw new Error("Body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "rift-dashboard-mock", demo_user: DEMO_USER_ID, metrics: backend.metrics }));
    return;
  }
  if (!url.pathname.startsWith("/api/")) {
    res.writeHead(404, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Only /api is served here" }));
    return;
  }
  try {
    const body = req.method === "GET" || req.method === "HEAD" ? null : await readBody(req);
    const result = await backend.handle({
      method: req.method,
      path: url.pathname,
      query: url.searchParams,
      body,
      headers: req.headers,
    });
    if (result.type !== "application/json" && result.type !== "text/plain") {
      const buffer = Buffer.isBuffer(result.body) ? result.body : Buffer.from(String(result.body));
      res.writeHead(result.status, { ...cors, "Content-Type": result.type, "Content-Length": buffer.length, "Cache-Control": "no-store" });
      res.end(buffer);
      return;
    }
    const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
    res.writeHead(result.status, { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(text);
  } catch (error) {
    console.error("[mock-server]", error);
    res.writeHead(500, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error?.message || "Internal mock error" }));
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/ws" && url.pathname !== "/ws/vc") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    let closed = false;
    const isVc = url.pathname === "/ws/vc";
    const token = url.searchParams.get("access_token") || "";
    const userId = token.includes(":") ? token.split(":").pop() : DEMO_USER_ID;
    const send = () => {
      if (closed) return;
      try {
        if (isVc) ws.send(JSON.stringify({ type: "call_state", data: backend.callStateFor(userId) }));
        else {
          ws.send(JSON.stringify({ type: "stats", data: backend.liveStats() }));
          ws.send(JSON.stringify({ type: "music_state", guild_id: "100000000000000001", data: backend.musicState() }));
        }
      } catch {
        /* closed */
      }
    };
    const timer = setInterval(send, isVc ? 2500 : 4000);
    send();
    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw));
        if (message?.type === "get_state" && isVc) send();
      } catch {
        /* ignore */
      }
    });
    ws.on("close", () => {
      closed = true;
      clearInterval(timer);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Rift mock API → http://${HOST}:${PORT}/api (demo user ${DEMO_USER_ID})`);
});
