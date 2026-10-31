/* jsdom + demo-backend harness for mounting pages exactly like app.js does. */

import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { createDemoBackend, DEMO_USER, DEMO_GUILDS } from "../../tools/demo-backend.mjs";
import { createApiClient } from "../../assets/app/core/api.js";
import { createEndpoints } from "../../assets/app/data/endpoints.js";
import { createStore } from "../../assets/app/core/store.js";

const API_BASE = "https://api.test/api";

export function installDom({ url = "https://dash.test/", html = '<!doctype html><html><body><div id="root"></div><div id="overlay-root"></div><div id="toast-root"></div></body></html>' } = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const { window } = dom;
  const globals = {
    window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    history: window.history,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    SVGElement: window.SVGElement,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    CustomEvent: window.CustomEvent,
    DocumentFragment: window.DocumentFragment,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    FormData: window.FormData,
    File: window.File,
    FileList: window.FileList,
    FileReader: window.FileReader,
    Image: window.Image,
    screen: window.screen,
    crypto: globalThis.crypto,
  };
  // Always replace the DOM globals together. Mixing a Node from one JSDOM
  // window with `Node` from another makes `instanceof Node` fail, and the
  // custom renderer then stringifies elements as "[object HTMLDivElement]".
  for (const [key, value] of Object.entries(globals)) {
    try {
      globalThis[key] = value;
    } catch {
      /* some globals are read-only; pages only need the common ones */
    }
  }
  // jsdom lacks a few layout APIs pages touch.
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
  window.scrollTo = () => {};
  return dom;
}

export function createFetchAdapter(backend) {
  return async (url, init = {}) => {
    const parsed = new URL(String(url));
    let body = null;
    if (init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const result = await backend.handle({
      method: init.method || "GET",
      path: parsed.pathname,
      query: parsed.searchParams,
      body,
      headers: init.headers || {},
    });
    const headers = { "content-type": result.type || "application/json" };
    const payload =
      result.type === "application/json"
        ? JSON.stringify(result.body ?? null)
        : Buffer.isBuffer(result.body)
          ? new Uint8Array(result.body)
          : String(result.body ?? "");
    return new Response(payload, { status: result.status, headers });
  };
}

export function createHarness({ backend = createDemoBackend(), token = "demo-token", url, signedOut = false } = {}) {
  const effectiveToken = signedOut ? "" : token;
  if (url) installDom({ url });
  else if (!globalThis.window) installDom();
  const fetchImpl = createFetchAdapter(backend);
  const api = createApiClient({
    baseUrl: API_BASE,
    fetchImpl,
    getToken: () => effectiveToken,
    onUnauthorized: () => {},
    onEvent: () => {},
    maxAttempts: 1,
    breakerThreshold: 99,
  });
  const endpoints = createEndpoints(api);
  const appStore = createStore({ connection: "live", diagnostics: [], ready: true, lastRoute: null }, { name: `test-${Math.random()}` });
  const toasts = [];
  const toast = {
    success: (message, options) => toasts.push({ type: "success", message, options }),
    error: (message, options) => toasts.push({ type: "error", message, options }),
    info: (message, options) => toasts.push({ type: "info", message, options }),
    warning: (message, options) => toasts.push({ type: "warning", message, options }),
    show: (options) => toasts.push({ type: "info", ...options }),
  };
  const navigations = [];
  const router = {
    navigate: (path) => navigations.push(path),
    replace: (path) => navigations.push(path),
    getCurrent: () => ({ path: "/" }),
    beforeLeave: () => () => {},
    resolve: () => true,
  };
  const guild = {
    id: DEMO_GUILDS[0].id,
    name: DEMO_GUILDS[0].name,
    icon: null,
    owner: true,
    permissions: DEMO_GUILDS[0].permissions,
    manageable: true,
    botPresent: true,
  };
  const prefs = { get: () => ({}), set: () => {}, subscribe: () => () => {}, reset: () => {} };
  const live = {
    statusStore: createStore({ stats: "open", vc: "open" }, { name: `live-${Math.random()}` }),
    subscribe: () => () => {},
    attachVc: () => {},
    detachVc: () => {},
    requestVcState: () => {},
    getMusicState: () => null,
    start: () => {},
    stop: () => {},
    reconnect: () => {},
  };
  const confirmCalls = [];
  const confirm = async (options) => {
    confirmCalls.push(options);
    return true;
  };
  const user = { id: DEMO_USER.id, username: DEMO_USER.username, global_name: DEMO_USER.global_name, avatar: null };
  const authState = signedOut
    ? { status: "anonymous", user: null, guilds: [], token: "", demo: true, error: null }
    : { status: "ready", user, guilds: [guild], token, demo: true };
  const authListeners = new Set();
  const auth = {
    get: () => authState,
    subscribe: (fn, { immediate = false } = {}) => {
      authListeners.add(fn);
      if (immediate) fn(authState);
      return () => authListeners.delete(fn);
    },
    guildById: (id) => (id === guild.id ? guild : null),
    refresh: async () => {},
    logout: () => {},
    markUnauthorized: () => {},
    getToken: () => authState.token,
    beginLogin: async () => {},
    loginWithToken: async (nextToken) => {
      Object.assign(authState, { status: "ready", token: nextToken, user, guilds: [guild] });
      authListeners.forEach((fn) => fn(authState));
      return authState;
    },
  };
  const config = { apiBase: API_BASE, apiBaseFallbacks: [], demo: true, siteName: "Rift", discordClientId: "1329184069426348052" };

  function makeCtx({ params = {}, query = {}, path = "/", route = {} } = {}) {
    return {
      root: document.getElementById("root"),
      ctx: { params, query, path, fullPath: path, route, routePath: path },
      api,
      endpoints,
      auth,
      live,
      prefs,
      config,
      router,
      toast,
      confirm,
      guild: signedOut ? null : guild,
      guildId: signedOut ? null : guild.id,
      user: signedOut ? null : user,
      store: appStore,
      diagnosticsReport: () => "test",
      signal: new AbortController().signal,
      setTitle: () => {},
      refreshShell: () => {},
      setBanner: () => {},
    };
  }

  return { backend, api, endpoints, makeCtx, toast, toasts, confirmCalls, navigations, router, guild, user, fetchImpl, token: effectiveToken, auth };
}

export async function mountPage(modulePath, harness, options = {}) {
  // Resolve from the repository root, not from this harness file (dynamic
  // import specifiers are relative to the importing module).
  const specifier = modulePath.startsWith("file:")
    ? modulePath
    : pathToFileURL(resolvePath(process.cwd(), modulePath)).href;
  const pageModule = await import(specifier);
  const ctx = harness.makeCtx(options);
  const cleanup = await pageModule.mountPage(ctx);
  return { cleanup, ctx, root: ctx.root };
}

export const flush = async (times = 6) => {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
};
