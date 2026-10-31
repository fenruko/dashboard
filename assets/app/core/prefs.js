/* User preferences: instant local UI prefs, best-effort sync to the bot's
 * /api/prefs/<userId> store so choices follow the account across devices. */

import { createStore } from "./store.js";

const KEY = "rift_dashboard_prefs";

export const DEFAULT_PREFS = {
  theme: "dark",
  density: "comfortable",
  reducedMotion: false,
  autoRefresh: true,
  refreshInterval: 30_000,
  sidebarCompact: false,
  confirmDestructive: true,
  showTimestamps: true,
  timezone: "local",
  lastGuildId: "",
  seenShortcuts: false,
  showDeveloperTools: false,
};

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeLocal(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota/private mode */
  }
}

export function applyPrefsToDocument(prefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = prefs.theme === "system" ? (window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark") : prefs.theme;
  root.dataset.theme = theme === "light" ? "light" : "dark";
  root.dataset.density = prefs.density === "compact" ? "compact" : "comfortable";
  root.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f6f8fb" : "#08090c");
}

export function createPreferences({ api, getUserId } = {}) {
  const initial = { ...DEFAULT_PREFS, ...readLocal() };
  const store = createStore(initial, { name: "prefs" });
  applyPrefsToDocument(initial);

  let saveTimer = null;
  let syncEnabled = false;

  function persist() {
    const prefs = store.get();
    writeLocal(prefs);
    applyPrefsToDocument(prefs);
    if (!syncEnabled || !api) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const userId = getUserId?.();
      if (!userId) return;
      try {
        await api.post(`/prefs/${encodeURIComponent(userId)}`, {
          theme: prefs.theme,
          density: prefs.density,
          reducedMotion: prefs.reducedMotion,
          autoRefresh: prefs.autoRefresh,
          refreshInterval: prefs.refreshInterval,
          sidebarCompact: prefs.sidebarCompact,
          confirmDestructive: prefs.confirmDestructive,
          showTimestamps: prefs.showTimestamps,
          lastGuildId: prefs.lastGuildId,
        });
      } catch {
        /* local prefs remain authoritative; retry on next change */
      }
    }, 900);
  }

  function set(patch) {
    store.set(patch);
    persist();
  }

  function reset() {
    store.set({ ...DEFAULT_PREFS, lastGuildId: store.get().lastGuildId });
    persist();
  }

  async function hydrateFromServer() {
    const userId = getUserId?.();
    if (!api || !userId) return;
    syncEnabled = true;
    try {
      const remote = await api.get(`/prefs/${encodeURIComponent(userId)}`, { retries: 1, timeoutMs: 8_000 });
      if (!remote || typeof remote !== "object" || Array.isArray(remote)) return;
      const patch = {};
      for (const key of Object.keys(DEFAULT_PREFS)) {
        if (remote[key] === undefined || remote[key] === null) continue;
        if (key === "lastGuildId") continue;
        patch[key] = remote[key];
      }
      if (Object.keys(patch).length) {
        store.set(patch);
        writeLocal(store.get());
        applyPrefsToDocument(store.get());
      }
    } catch {
      /* prefs sync is optional */
    }
  }

  // System theme changes should re-apply when the user chose "system".
  if (typeof window !== "undefined" && window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      if (store.get().theme === "system") applyPrefsToDocument(store.get());
    };
    media.addEventListener?.("change", handler);
  }

  return {
    store,
    get: store.get,
    subscribe: store.subscribe,
    set,
    reset,
    hydrateFromServer,
    apply: () => applyPrefsToDocument(store.get()),
  };
}
