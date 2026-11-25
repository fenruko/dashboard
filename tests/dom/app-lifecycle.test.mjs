import test from "node:test";
import assert from "node:assert/strict";
import { installDom, createFetchAdapter, flush } from "./harness.mjs";
import { createDemoBackend } from "../../tools/demo-backend.mjs";

class StubSocket {
  constructor() {
    this.readyState = 0;
    setTimeout(() => this.onerror?.(new Event("error")), 0);
  }
  send() {}
  close() {
    this.onclose?.({ code: 1000 });
  }
}

/** Count listeners added to window/document and not yet removed, per event type. */
function trackListeners(window) {
  const live = new Map();
  const patch = (target, label) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, fn, opts) => {
      const key = `${label}:${type}`;
      const set = live.get(key) || new Set();
      set.add(fn);
      live.set(key, set);
      return add(type, fn, opts);
    };
    target.removeEventListener = (type, fn, opts) => {
      live.get(`${label}:${type}`)?.delete(fn);
      return remove(type, fn, opts);
    };
  };
  patch(window, "window");
  patch(window.document, "document");
  // jsdom's selector engine (nwsapi) registers its own document mouseover/mouseout
  // trackers; they are test-environment noise, not application listeners.
  const noise = /^document:mouse(over|out)$/;
  return () => Object.fromEntries([...live].map(([k, v]) => [k, v.size]).filter(([k, n]) => n > 0 && !noise.test(k)));
}

async function boot() {
  const dom = installDom({ url: "https://dash.test/guilds" });
  dom.window.localStorage.setItem("rift_dashboard_token", "demo-token");
  const snapshot = trackListeners(dom.window);

  const intervals = new Map();
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  globalThis.setInterval = (fn, ms, ...rest) => {
    const id = realSet(fn, ms, ...rest);
    intervals.set(id, ms);
    return id;
  };
  globalThis.clearInterval = (id) => {
    intervals.delete(id);
    return realClear(id);
  };

  const { createApp } = await import("../../assets/app/app.js");
  const app = createApp({
    root: dom.window.document.getElementById("root"),
    fetchImpl: createFetchAdapter(createDemoBackend()),
    WebSocketImpl: StubSocket,
    config: { apiBase: "https://api.test/api" },
  });
  const restore = () => {
    globalThis.setInterval = realSet;
    globalThis.clearInterval = realClear;
  };
  return { dom, app, snapshot, intervals, restore };
}

test("stop() removes every global listener the app added", async () => {
  const { app, snapshot, restore } = await boot();
  try {
    await app.start();
    await flush();
    const during = snapshot();
    for (const type of ["window:keydown", "window:online", "window:offline", "window:error", "window:unhandledrejection", "document:visibilitychange", "window:popstate"]) {
      assert.ok(during[type] >= 1, `expected a ${type} listener while running`);
    }
    app.stop();
    assert.deepEqual(snapshot(), {}, "no listeners should survive stop()");
  } finally {
    restore();
  }
});

test("the connection pill is event driven: no 1.5s polling interval", async () => {
  const { app, intervals, restore } = await boot();
  try {
    await app.start();
    await flush();
    assert.ok(![...intervals.values()].includes(1500), "polling interval is back");
    app.stop();
  } finally {
    restore();
  }
});

test("a keydown event without a key does not throw", async () => {
  const { app, dom, restore } = await boot();
  const errors = [];
  dom.window.addEventListener("error", (event) => errors.push(event.message));
  try {
    await app.start();
    await flush();
    dom.window.dispatchEvent(new dom.window.Event("keydown")); // no .key at all
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "g" }));
    assert.deepEqual(errors, []);
    app.stop();
  } finally {
    restore();
  }
});

test("shortcut sheet 'Got it' closes its own dialog, not whichever overlay is last", async () => {
  const { app, dom, restore } = await boot();
  try {
    await app.start();
    await flush();
    app.openShortcuts();
    const doc = dom.window.document;
    // Another overlay that precedes the shortcuts dialog in document order. The old
    // `.overlay:last-child` selector matched this one first and removed the wrong dialog.
    const host = doc.createElement("div");
    const stray = doc.createElement("div");
    stray.className = "overlay stray";
    host.append(stray);
    doc.body.prepend(host);
    const gotIt = [...doc.querySelectorAll("button")].find((b) => b.textContent.trim() === "Got it");
    assert.ok(gotIt, "Got it button should exist");
    gotIt.click();
    await new Promise((resolve) => setTimeout(resolve, 200)); // modal exit animation is 120ms
    assert.ok(doc.querySelector(".overlay.stray"), "unrelated overlay must survive");
    assert.ok(![...doc.querySelectorAll("button")].some((b) => b.textContent.trim() === "Got it"), "shortcuts dialog should be gone");
    app.stop();
  } finally {
    restore();
  }
});

test("relativeTime tolerates missing or invalid input", async () => {
  installDom();
  const { relativeTime } = await import("../../assets/app/ui/components.js");
  for (const bad of [undefined, null, "not a date", NaN]) {
    assert.doesNotThrow(() => relativeTime(bad), String(bad));
  }
  const ok = relativeTime(Date.now() - 5 * 60_000);
  assert.match(ok.textContent, /minute/);
  assert.ok(ok.getAttribute("datetime"));
});

test("loadPage caches a module and falls back to the not-found page for unknown names", async () => {
  installDom();
  const { loadPage } = await import("../../assets/app/app.js");
  assert.equal(loadPage("settings"), loadPage("settings"));
  const fallback = await loadPage("nope-not-a-page");
  const notfound = await loadPage("notfound");
  assert.equal(fallback.mountPage, notfound.mountPage);
});
