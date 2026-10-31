/* Runtime configuration + persistent app settings.
 * Resolution order (first wins):
 *   1. ?api= / ?demo= query override (persisted so a reload keeps working)
 *   2. localStorage override set from the in-app diagnostics panel
 *   3. window.RIFT_CONFIG (served from /config.js, editable without a rebuild)
 *   4. compiled-in defaults
 */

const STORAGE = {
  api: "rift_api_base",
  apiFallbacks: "rift_api_fallbacks",
  config: "rift_dashboard_config",
};

const COMPILED_DEFAULTS = {
  apiBase: "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api",
  apiBaseFallbacks: [],
  discordClientId: "1329184069426348052",
  invitePermissions: "5076723787231222",
  siteName: "Rift",
  demo: false,
};

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function runtimeConfig() {
  return typeof window !== "undefined" && window.RIFT_CONFIG && typeof window.RIFT_CONFIG === "object"
    ? window.RIFT_CONFIG
    : {};
}

export function normalizeBase(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const withoutSlash = raw.replace(/\/+$/, "");
  return /\/api$/i.test(withoutSlash) ? withoutSlash : `${withoutSlash}/api`;
}

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function getConfig() {
  const runtime = runtimeConfig();
  const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();

  // Query overrides are sticky: a support link like ?api=https://… keeps
  // working after the OAuth round-trip drops the query string.
  if (params.has("api")) {
    const candidate = normalizeBase(params.get("api"));
    if (candidate) lsSet(STORAGE.api, candidate);
  }
  if (params.has("demo")) {
    lsSet(STORAGE.demo, parseBoolean(params.get("demo")) ? "1" : "0");
  }

  const storedApi = lsGet(STORAGE.api);
  const storedDemo = lsGet(STORAGE.demo);
  const apiBase = normalizeBase(storedApi || runtime.apiBase || COMPILED_DEFAULTS.apiBase);

  const fallbacks = [
    ...(Array.isArray(runtime.apiBaseFallbacks) ? runtime.apiBaseFallbacks : []),
    ...(Array.isArray(COMPILED_DEFAULTS.apiBaseFallbacks) ? COMPILED_DEFAULTS.apiBaseFallbacks : []),
  ]
    .map(normalizeBase)
    .filter((base) => base && base !== apiBase);

  const storedConfig = (() => {
    try {
      return JSON.parse(lsGet(STORAGE.config) || "{}") || {};
    } catch {
      return {};
    }
  })();

  const demo =
    params.has("demo") ? parseBoolean(params.get("demo")) : parseBoolean(storedDemo, parseBoolean(runtime.demo, COMPILED_DEFAULTS.demo));

  return {
    ...COMPILED_DEFAULTS,
    ...runtime,
    ...storedConfig,
    apiBase,
    apiBaseFallbacks: [...new Set(fallbacks)],
    demo,
    isLocal: /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(apiBase),
  };
}

export function setApiBase(value) {
  const next = normalizeBase(value);
  if (!next) return getConfig();
  lsSet(STORAGE.api, next);
  return getConfig();
}

export function setApiFallbacks(list) {
  const normalized = [...new Set((list || []).map(normalizeBase).filter(Boolean))];
  lsSet(STORAGE.apiFallbacks, normalized.length ? JSON.stringify(normalized) : null);
  return getConfig();
}

export function setDemoMode(enabled) {
  lsSet(STORAGE.demo, enabled ? "1" : "0");
  return getConfig();
}

export function clearOverrides() {
  lsSet(STORAGE.api, null);
  lsSet(STORAGE.apiFallbacks, null);
  lsSet(STORAGE.demo, null);
  lsSet(STORAGE.config, null);
  return getConfig();
}

export function saveUiConfig(patch) {
  let current = {};
  try {
    current = JSON.parse(lsGet(STORAGE.config) || "{}") || {};
  } catch {
    current = {};
  }
  const next = { ...current, ...patch };
  lsSet(STORAGE.config, JSON.stringify(next));
  return getConfig();
}

export function getStoredApiFallbacks() {
  try {
    const list = JSON.parse(lsGet(STORAGE.apiFallbacks) || "[]");
    return Array.isArray(list) ? list.map(normalizeBase).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function oauthRedirectUri() {
  // Discord requires an exact match with the redirect registered on the app.
  if (typeof window === "undefined") return "/";
  const base = document.querySelector("base")?.getAttribute("href");
  return new URL(base || "/", window.location.origin + "/").toString();
}

export function buildLoginUrl({ state, prompt = "none" } = {}) {
  const cfg = getConfig();
  const params = new URLSearchParams({
    client_id: cfg.discordClientId,
    redirect_uri: oauthRedirectUri(),
    response_type: "token",
    scope: "identify guilds",
    prompt,
  });
  if (state) params.set("state", state);
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function buildInviteUrl(guildId) {
  const cfg = getConfig();
  const params = new URLSearchParams({
    client_id: cfg.discordClientId,
    permissions: String(cfg.invitePermissions),
    scope: "bot applications.commands",
  });
  if (guildId) {
    params.set("guild_id", String(guildId));
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export const STORAGE_KEYS = STORAGE;
