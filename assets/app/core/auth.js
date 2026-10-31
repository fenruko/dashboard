/* Discord OAuth2 (implicit grant) + session state.
 *
 * The bot's API trusts Discord user tokens directly: every request sends
 * `Authorization: Bearer <discord token>`. We therefore only ever store the
 * token in localStorage, verify it against /users/@me, and let the API answer
 * 401/403 for per-guild permissions. Nothing is proxied through a third party.
 */

import { createStore } from "./store.js";
import { buildLoginUrl, getConfig } from "../config.js";

export const TOKEN_KEY = "rift_dashboard_token";
export const TOKEN_EXPIRY_KEY = "rift_dashboard_token_expiry";
export const DISCORD_API = "https://discord.com/api/v10";

const PERM_ADMINISTRATOR = 1n << 3n;
const PERM_MANAGE_GUILD = 1n << 5n;
const PERM_MANAGE_ROLES = 1n << 28n;

/* ---------- storage ---------- */

let memoryToken = "";

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

export function writeToken(token, { expiresInSeconds } = {}) {
  memoryToken = token || "";
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (token && expiresInSeconds) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
    } else if (!token) {
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  } catch {
    /* private mode: memory-only session still works for this tab */
  }
}

export function readTokenExpiry() {
  try {
    return Number(localStorage.getItem(TOKEN_EXPIRY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function clearToken() {
  writeToken("");
}

/** Parse `#access_token=…&expires_in=…` from the OAuth redirect. */
export function parseOAuthHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const token = params.get("access_token");
  if (!token) return { error: params.get("error_description") || params.get("error") || "" };
  return {
    token,
    tokenType: params.get("token_type") || "Bearer",
    expiresIn: Number(params.get("expires_in")) || 0,
    scope: params.get("scope") || "",
    state: params.get("state") || "",
  };
}

/* ---------- Discord identity ---------- */

async function fetchWithTimeout(fetchImpl, url, { token, timeout = 12_000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 429 && attempt < retries) {
        const retryAfter = Number(response.headers.get("retry-after")) || 1;
        await new Promise((resolve) => setTimeout(resolve, Math.min(5, retryAfter) * 1000));
        continue;
      }
      if (!response.ok) {
        const err = new Error(
          response.status === 401 ? "Discord rejected that login. Please sign in again." : `Discord API error (${response.status}).`
        );
        err.status = response.status;
        throw err;
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (err.status === 401) throw err;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Couldn't reach Discord.");
}

export async function fetchDiscordUser(token, { fetchImpl = (...a) => fetch(...a) } = {}) {
  const user = await fetchWithTimeout(fetchImpl, `${DISCORD_API}/users/@me`, { token });
  return normalizeUser(user);
}

export async function fetchDiscordGuilds(token, { fetchImpl = (...a) => fetch(...a) } = {}) {
  const all = [];
  let after = "0";
  for (let page = 0; page < 10; page += 1) {
    const batch = await fetchWithTimeout(fetchImpl, `${DISCORD_API}/users/@me/guilds?limit=200&after=${after}`, { token });
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 200) break;
    after = batch[batch.length - 1].id;
  }
  return all.map(normalizeGuild);
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: String(user.id || ""),
    username: user.username || user.global_name || "unknown",
    globalName: user.global_name || "",
    discriminator: user.discriminator || "",
    avatar: user.avatar || null,
    bot: Boolean(user.bot),
    email: user.email || "",
    locale: user.locale || "",
    mfaEnabled: Boolean(user.mfa_enabled),
    premiumType: user.premium_type ?? 0,
    avatarUrl: avatarUrl(user),
  };
}

export function avatarUrl(user, size = 128) {
  if (!user) return "";
  if (user.avatarUrl) return user.avatarUrl;
  if (!user.avatar) {
    const index = Number(BigInt(user.id || 0) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = String(user.avatar).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

export function guildIconUrl(guild, size = 128) {
  if (!guild?.icon) return "";
  const ext = String(guild.icon).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=${size}`;
}

export function hasManagePermission(raw) {
  if (raw?.owner) return true;
  try {
    const bits = BigInt(raw?.permissions ?? 0);
    return (bits & PERM_ADMINISTRATOR) !== 0n || (bits & PERM_MANAGE_GUILD) !== 0n;
  } catch {
    return false;
  }
}

export function hasPermission(guild, permission) {
  try {
    const bits = BigInt(guild?.permissions ?? 0);
    if (guild?.owner) return true;
    if ((bits & PERM_ADMINISTRATOR) !== 0n) return true;
    return (bits & BigInt(permission)) !== 0n;
  } catch {
    return false;
  }
}

export const PERMISSIONS = {
  ADMINISTRATOR: Number(PERM_ADMINISTRATOR),
  MANAGE_GUILD: Number(PERM_MANAGE_GUILD),
  MANAGE_ROLES: Number(PERM_MANAGE_ROLES),
};

export function normalizeGuild(raw) {
  const manageable = hasManagePermission(raw);
  return {
    id: String(raw.id),
    name: raw.name || "Unnamed server",
    icon: raw.icon || null,
    iconUrl: guildIconUrl(raw),
    owner: Boolean(raw.owner),
    permissions: String(raw.permissions ?? "0"),
    features: Array.isArray(raw.features) ? raw.features : [],
    manageable,
    botPresent: null,
    lastVisited: 0,
  };
}

/* ---------- auth store ---------- */

const RETURN_KEY = "rift_login_return";
const STATE_KEY = "rift_login_state";

export function createAuth({ api, config = getConfig(), fetchImpl = (...a) => fetch(...a), storagePrefix = "rift" } = {}) {
  const store = createStore(
    {
      status: "booting",
      user: null,
      guilds: [],
      error: null,
      token: readToken(),
      demo: Boolean(config.demo),
      botPresenceKnown: false,
      expiresAt: readTokenExpiry(),
    },
    { name: "auth" }
  );

  let inflight = null;
  let disposed = false;

  function setStatus(status, patch = {}) {
    store.set({ status, ...patch });
  }

  async function loadSession({ silent = false } = {}) {
    if (inflight) return inflight;
    const token = readToken();
    if (!token) {
      setStatus("anonymous", { user: null, guilds: [], token: "" });
      return null;
    }
    const expiresAt = readTokenExpiry();
    if (expiresAt && Date.now() > expiresAt) {
      clearToken();
      setStatus("expired", { token: "", user: null, guilds: [], error: new Error("Your Discord session expired. Sign in again.") });
      return null;
    }
    if (!silent) setStatus("authenticating", { token, error: null });
    inflight = (async () => {
      try {
        const isDemo = Boolean(getConfig().demo);
        const [user, guilds] = isDemo
          ? await Promise.all([api.get("/demo/me").then(normalizeUser), api.get("/demo/guilds").then((rows) => rows.map(normalizeGuild))])
          : await Promise.all([fetchDiscordUser(token, { fetchImpl }), fetchDiscordGuilds(token, { fetchImpl })]);

        let botIds = null;
        try {
          const ids = await api.get("/bot/guild-ids", { cacheTtl: 60_000, retries: 1 });
          if (Array.isArray(ids)) botIds = new Set(ids.map(String));
        } catch {
          botIds = null;
        }

        const guildsWithPresence = guilds
          .map((guild) => ({
            ...guild,
            botPresent: botIds ? botIds.has(guild.id) : null,
          }))
          .sort((a, b) => Number(b.manageable) - Number(a.manageable) || a.name.localeCompare(b.name));

        if (disposed) return null;
        setStatus("ready", {
          user,
          guilds: guildsWithPresence,
          token,
          error: null,
          demo: isDemo,
          botPresenceKnown: Boolean(botIds),
          expiresAt,
        });
        return { user, guilds: guildsWithPresence };
      } catch (err) {
        if (disposed) return null;
        if (err?.status === 401) {
          clearToken();
          setStatus("expired", { token: "", user: null, guilds: [], error: err });
        } else {
          setStatus("error", { error: err, token });
        }
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  async function beginLogin({ returnTo } = {}) {
    const state = `${storagePrefix}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    try {
      sessionStorage.setItem(STATE_KEY, state);
      sessionStorage.setItem(RETURN_KEY, returnTo || location.pathname + location.search);
    } catch {
      /* ignore */
    }
    location.assign(buildLoginUrl({ state, prompt: "none" }));
  }

  function consumeLoginState(state) {
    try {
      const expected = sessionStorage.getItem(STATE_KEY);
      sessionStorage.removeItem(STATE_KEY);
      return !expected || !state || expected === state;
    } catch {
      return true;
    }
  }

  function consumeReturnTo() {
    try {
      const value = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      return value && value !== "/login" ? value : "/guilds";
    } catch {
      return "/guilds";
    }
  }

  /** Handles the OAuth redirect; returns a path to continue to (or null). */
  async function handleCallback(hash = location.hash) {
    const parsed = parseOAuthHash(hash);
    if (!parsed) return null;
    if (parsed.error) {
      setStatus("anonymous", { error: new Error(parsed.error) });
      if (typeof history !== "undefined") history.replaceState(null, "", location.pathname + location.search);
      return null;
    }
    if (!consumeLoginState(parsed.state)) {
      setStatus("anonymous", { error: new Error("Login could not be verified. Please try again.") });
      if (typeof history !== "undefined") history.replaceState(null, "", location.pathname + location.search);
      return null;
    }
    writeToken(parsed.token, { expiresInSeconds: parsed.expiresIn });
    if (typeof history !== "undefined") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    setStatus("authenticating", { token: parsed.token, expiresAt: readTokenExpiry() });
    await loadSession();
    return store.get().status === "ready" ? consumeReturnTo() : null;
  }

  async function loginWithToken(token, { expiresInSeconds } = {}) {
    writeToken(token, { expiresInSeconds });
    setStatus("authenticating", { token, error: null });
    await loadSession();
    return store.get().status === "ready";
  }

  function logout({ redirect = true } = {}) {
    clearToken();
    setStatus("anonymous", { user: null, guilds: [], token: "", error: null, botPresenceKnown: false });
    try {
      localStorage.removeItem(`${storagePrefix}_last_guild`);
    } catch {
      /* ignore */
    }
    if (redirect && typeof location !== "undefined") location.assign("/login");
  }

  function markUnauthorized() {
    if (store.get().status !== "ready") return;
    setStatus("expired", {
      error: new Error("Your Discord session expired. Sign in again to keep managing your servers."),
    });
  }

  function onStorage(event) {
    if (event.key !== TOKEN_KEY) return;
    if (!event.newValue && store.get().status === "ready") {
      setStatus("anonymous", { user: null, guilds: [], token: "" });
    } else if (event.newValue && event.newValue !== store.get().token) {
      loadSession();
    }
  }

  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  function guildById(id) {
    return store.get().guilds.find((guild) => String(guild.id) === String(id)) || null;
  }

  function dispose() {
    disposed = true;
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  }

  return {
    store,
    get: store.get,
    subscribe: store.subscribe,
    loadSession,
    beginLogin,
    handleCallback,
    loginWithToken,
    logout,
    markUnauthorized,
    consumeReturnTo,
    guildById,
    refresh: () => loadSession(),
    dispose,
  };
}
