/* WebSocket client with reconnect, staleness detection, buffering and
 * visibility-aware reconnects. The bot pushes `stats` every 15s, `music_state`
 * for players and `call_state` for voice-call sessions. */

import { createStore } from "./store.js";

export function wsUrlFor(apiBase, path, token) {
  const raw = String(apiBase || "").replace(/\/+$/, "");
  const root = raw.replace(/\/api$/i, "");
  const url = new URL(`${root}${path.startsWith("/") ? path : `/${path}`}`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (token) url.searchParams.set("access_token", token);
  return url.toString();
}

export function createSocket({
  url,
  WebSocketImpl = typeof WebSocket !== "undefined" ? WebSocket : null,
  onMessage = () => {},
  onStatus = () => {},
  onAuthError = () => {},
  minDelay = 1_000,
  maxDelay = 30_000,
  staleMs = 60_000,
  watchdogMs = 10_000,
  bufferLimit = 25,
  random = Math.random,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const statusStore = createStore(
    { status: "idle", attempts: 0, lastMessageAt: 0, lastError: null, nextRetryAt: 0, closeCode: 0 },
    { name: "socket" }
  );

  let socket = null;
  let attempts = 0;
  let retryTimer = null;
  let watchdog = null;
  let disposed = false;
  let manualClose = false;
  let paused = false;
  const queue = [];

  function update(patch) {
    statusStore.set(patch);
    try {
      onStatus(statusStore.get());
    } catch {
      /* ignore */
    }
  }

  function scheduleReconnect(reason) {
    if (disposed || manualClose) return;
    attempts += 1;
    const exp = Math.min(maxDelay, minDelay * 2 ** Math.min(attempts - 1, 5));
    const delay = Math.round(exp * (0.75 + random() * 0.5));
    update({ status: paused ? "paused" : "reconnecting", attempts, lastError: reason || null, nextRetryAt: Date.now() + delay });
    clearTimeoutImpl(retryTimer);
    retryTimer = setTimeoutImpl(() => {
      if (!disposed && !paused) connect();
    }, delay);
  }

  function connect() {
    if (disposed) return;
    if (paused) {
      update({ status: "paused" });
      return;
    }
    if (!WebSocketImpl) {
      update({ status: "error", lastError: "WebSockets are not supported in this browser." });
      return;
    }
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;

    update({ status: "connecting", nextRetryAt: 0 });
    let next;
    try {
      next = new WebSocketImpl(url);
    } catch (err) {
      update({ status: "error", lastError: err });
      scheduleReconnect(err);
      return;
    }
    socket = next;

    next.onopen = () => {
      if (socket !== next) return;
      attempts = 0;
      update({ status: "open", attempts: 0, lastError: null, lastMessageAt: Date.now(), closeCode: 0 });
      while (queue.length) {
        const payload = queue.shift();
        try {
          next.send(payload);
        } catch {
          break;
        }
      }
      clearInterval(watchdog);
      watchdog = setInterval(() => {
        if (disposed || statusStore.get().status !== "open") return;
        if (typeof document !== "undefined" && document.hidden) return;
        const last = statusStore.get().lastMessageAt;
        if (staleMs > 0 && last && Date.now() - last > staleMs) {
          update({ lastError: new Error("Live connection went quiet") });
          try {
            next.close(4000, "stale");
          } catch {
            /* ignore */
          }
        }
      }, watchdogMs);
    };

    next.onmessage = (event) => {
      if (socket !== next) return;
      update({ lastMessageAt: Date.now() });
      let payload = event?.data;
      if (typeof payload !== "string") return;
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
      try {
        onMessage(payload);
      } catch (err) {
        console.error("websocket message handler failed", err);
      }
    };

    next.onerror = (event) => {
      if (socket !== next) return;
      update({ lastError: event?.message ? new Error(event.message) : new Error("WebSocket error") });
    };

    next.onclose = (event) => {
      if (socket !== next) return;
      socket = null;
      clearInterval(watchdog);
      const code = event?.code || 1006;
      update({ status: "closed", closeCode: code });
      if (code === 4001) {
        update({ status: "error", lastError: new Error("Live token rejected") });
        try {
          onAuthError();
        } catch {
          /* ignore */
        }
        return;
      }
      if (code === 4013) {
        // Server is at capacity: back off harder instead of retry-storming.
        attempts = Math.max(attempts, 3);
      }
      scheduleReconnect(new Error(`closed (${code})`));
    };
  }

  function send(data) {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    if (socket && socket.readyState === 1) {
      socket.send(payload);
      return true;
    }
    if (queue.length < bufferLimit) queue.push(payload);
    if (statusStore.get().status === "closed" || statusStore.get().status === "idle") connect();
    return false;
  }

  function close(code = 1000, reason = "client") {
    manualClose = true;
    clearTimeoutImpl(retryTimer);
    clearInterval(watchdog);
    const current = socket;
    socket = null;
    if (current) {
      try {
        current.close(code, reason);
      } catch {
        /* ignore */
      }
    }
    update({ status: "closed", closeCode: code });
  }

  function pause() {
    paused = true;
    clearTimeoutImpl(retryTimer);
    if (socket) {
      try {
        socket.close(1000, "hidden");
      } catch {
        /* ignore */
      }
    }
    update({ status: "paused" });
  }

  function resume() {
    paused = false;
    manualClose = false;
    if (!socket && !disposed) connect();
  }

  function dispose() {
    disposed = true;
    manualClose = true;
    clearTimeoutImpl(retryTimer);
    clearInterval(watchdog);
    if (socket) {
      try {
        socket.close(1000, "dispose");
      } catch {
        /* ignore */
      }
    }
    socket = null;
    statusStore.listeners.clear();
  }

  let visibilityHandler = null;
  if (typeof document !== "undefined") {
    visibilityHandler = () => {
      if (document.hidden) pause();
      else resume();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      if (statusStore.get().status !== "open") {
        manualClose = false;
        connect();
      }
    });
  }

  return { connect, close, pause, resume, dispose, send, store: statusStore, get status() { return statusStore.get().status; } };
}

/** Shared live feed: one socket for stats + music, one lazily for voice calls. */
export function createLiveHub({ getToken, getApiBase, WebSocketImpl, onEvent = () => {} } = {}) {
  const statusStore = createStore({ stats: "idle", vc: "idle" }, { name: "live" });
  const listeners = new Map();
  const musicState = new Map();
  let statsSocket = null;
  let vcSocket = null;
  let vcRefs = 0;
  let lastStats = null;
  let started = false;

  function emit(type, payload) {
    for (const fn of listeners.get(type) || []) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[live:${type}]`, err);
      }
    }
    try {
      onEvent({ type, payload });
    } catch {
      /* ignore */
    }
  }

  function handle(payload) {
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "stats") {
      lastStats = payload.data || null;
      emit("stats", lastStats);
    } else if (payload.type === "music_state") {
      const guildId = String(payload.guild_id || payload.data?.guild_id || "");
      if (guildId) musicState.set(guildId, payload.data);
      emit("music_state", { guildId, data: payload.data });
    } else if (payload.type === "call_state") {
      emit("call_state", payload.data);
    } else {
      emit(payload.type || "unknown", payload.data);
    }
  }

  function start() {
    if (started) return;
    started = true;
    statsSocket = createSocket({
      url: wsUrlFor(getApiBase(), "/ws", getToken()),
      WebSocketImpl,
      onMessage: handle,
      onStatus: (state) => {
        statusStore.set({ stats: state.status });
        emit("status", { channel: "stats", ...state });
      },
      onAuthError: () => {
        statusStore.set({ stats: "unauthorized" });
        emit("unauthorized", { channel: "stats" });
      },
      staleMs: 75_000,
    });
    statusStore.set({ stats: "connecting" });
    statsSocket.connect();
  }

  function stop() {
    started = false;
    statsSocket?.dispose();
    statsSocket = null;
    statusStore.set({ stats: "idle" });
  }

  function attachVc() {
    vcRefs += 1;
    if (vcSocket) return vcSocket;
    vcSocket = createSocket({
      url: wsUrlFor(getApiBase(), "/ws/vc", getToken()),
      WebSocketImpl,
      onMessage: handle,
      onStatus: (state) => {
        statusStore.set({ vc: state.status });
        emit("status", { channel: "vc", ...state });
      },
      onAuthError: () => {
        statusStore.set({ vc: "unauthorized" });
        emit("unauthorized", { channel: "vc" });
      },
      staleMs: 0,
    });
    statusStore.set({ vc: "connecting" });
    vcSocket.connect();
    return vcSocket;
  }

  function detachVc() {
    vcRefs = Math.max(0, vcRefs - 1);
    if (vcRefs === 0 && vcSocket) {
      vcSocket.dispose();
      vcSocket = null;
      statusStore.set({ vc: "idle" });
    }
  }

  return {
    start,
    stop,
    attachVc,
    detachVc,
    requestVcState: () => vcSocket?.send({ type: "get_state" }),
    subscribe(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    getLastStats: () => lastStats,
    getMusicState: (guildId) => musicState.get(String(guildId)) || null,
    statusStore,
    get statsSocket() {
      return statsSocket;
    },
    reconnect() {
      statsSocket?.close(1000, "manual-reconnect");
      statsSocket?.dispose();
      statsSocket = null;
      started = false;
      start();
    },
    dispose() {
      stop();
      vcSocket?.dispose();
      vcSocket = null;
      listeners.clear();
    },
  };
}
