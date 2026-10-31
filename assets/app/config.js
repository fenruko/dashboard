/* Runtime configuration + persistent app settings.
 * Resolution order (first wins):
 *   1. a developer-only API override saved from Account (owner-locked)
 *   2. window.RIFT_CONFIG (served from /config.js, editable without a rebuild)
 *   3. compiled-in defaults
 *
 * The API host is deliberately not editable from a query string or from
 * Diagnostics. Only allow-listed Rift developers can change it, from Account.
 */

// Built-in developers. Deployments can grant the same tools to additional
// Discord IDs with `developerUserIds` in /config.js.
export const RIFT_DEVELOPER_IDS = Object.freeze(["834869554798395392"]);

const STORAGE = {
  api: "rift_api_base",
  apiOwner: "rift_api_base_owner",
  apiFallbacks: "rift_api_fallbacks",
  config: "rift_dashboard_config",
};

const COMPILED_DEFAULTS = {
  apiBase: "https://api.rift.baby:24633/api",
  apiBaseFallbacks: ["https://api.rift.baby/api"],
  developerUserIds: [],
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

function allowedDeveloperIds() {
  const runtime = runtimeConfig();
  return new Set(
    [...RIFT_DEVELOPER_IDS, ...(Array.isArray(runtime.developerUserIds) ? runtime.developerUserIds : [])].map(String)
  );
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

  if (params.has("demo")) {
    lsSet(STORAGE.demo, parseBoolean(params.get("demo")) ? "1" : "0");
  }

  // An API override is valid only when a developer saved it. Query strings and
  // anonymous localStorage writes cannot change the host.
  const storedOwner = lsGet(STORAGE.apiOwner);
  const storedApi = storedOwner && allowedDeveloperIds().has(storedOwner) ? lsGet(STORAGE.api) : null;
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
    isLocal: !/^https?:\/\//i.test(apiBase) || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(apiBase),
  };
}

export function setApiBase(value, ownerUserId) {
  const next = normalizeBase(value);
  if (!next || !ownerUserId || !isDeveloperUserId(ownerUserId)) return getConfig();
  lsSet(STORAGE.api, next);
  lsSet(STORAGE.apiOwner, String(ownerUserId));
  return getConfig();
}

export function clearApiBaseOverride() {
  lsSet(STORAGE.api, null);
  lsSet(STORAGE.apiOwner, null);
  return getConfig();
}

export function isDeveloperUserId(userId) {
  if (!userId) return false;
  return allowedDeveloperIds().has(String(userId));
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
  lsSet(STORAGE.apiOwner, null);
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
