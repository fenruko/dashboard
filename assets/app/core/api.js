/* Rift API client.
 *
 * Reliability rules baked in here (and covered by tests/integration):
 *  - every request is abortable and time-bounded;
 *  - GETs are de-duplicated while in flight and cached with an explicit TTL;
 *  - transient failures (network / 408 / 429 / 5xx) retry with exponential
 *    backoff + jitter and honour Retry-After;
 *  - a failing backend trips a circuit breaker so the console isn't flooded
 *    and a sleeping home server isn't hammered;
 *  - 401 means "session expired" and surfaces once, it never causes a redirect
 *    loop and it never wipes the user's settings on a transient hiccup;
 *  - errors are normalised into one shape the UI can render.
 */

import { withRetry } from "./format.js";
import { getConfig, getStoredApiFallbacks } from "../config.js";

const DEFAULT_TIMEOUT = 15_000;
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 521, 522, 524]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  constructor(message, { status = 0, code = "", payload = null, retryable = false, network = false, retryAfter = 0, method = "", path = "", requestId = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.retryable = retryable;
    this.network = network;
    this.retryAfter = retryAfter;
    this.method = method;
    this.path = path;
    this.requestId = requestId;
  }

  get isAuth() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isOffline() {
    return this.network;
  }
}

export function messageForStatus(status, payload) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  switch (status) {
    case 400:
      return "That request wasn't valid — check the values and try again.";
    case 401:
      return "Your Discord session expired. Sign in again to continue.";
    case 403:
      return "You don't have permission to do that here.";
    case 404:
      return "That wasn't found — it may have been removed or the bot may not be in this server.";
    case 409:
      return "That conflicts with the current state. Refresh and try again.";
    case 413:
      return "That upload is too large.";
    case 429:
      return "Rift is rate limiting requests. Give it a moment.";
    case 500:
      return "Rift's backend hit an internal error.";
    case 503:
      return "That service is temporarily unavailable.";
    default:
      return status ? `Request failed (${status}).` : "Couldn't reach the Rift backend.";
  }
}

export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || value === "") return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

function buildQuery(params) {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => v != null && search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function combineSignals(signals) {
  const active = signals.filter(Boolean);
  if (!active.length) return { signal: undefined, cleanup: () => {} };
  if (active.length === 1) return { signal: active[0], cleanup: () => {} };
  if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
    return { signal: AbortSignal.any(active), cleanup: () => {} };
  }
  const controller = new AbortController();
  const listeners = active.map((signal) => {
    const onAbort = () => controller.abort(signal.reason);
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  });
  return {
    signal: controller.signal,
    cleanup: () => listeners.forEach((off) => off()),
  };
}

export function createApiClient({
  fetchImpl,
  getToken = () => "",
  onUnauthorized = () => {},
  onEvent = () => {},
  now = () => Date.now(),
  timeout = DEFAULT_TIMEOUT,
  maxAttempts = 3,
  breakerThreshold = 3,
  breakerCooldown = 5_000,
  logSize = 150,
  baseUrl,
} = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  const cache = new Map();
  const inflight = new Map();
  const log = [];
  const listeners = new Set();
  const metrics = { requests: 0, failures: 0, retries: 0, cacheHits: 0, aborts: 0, unauthorized: 0 };

  let networkFailures = 0;
  let breakerUntil = 0;
  let baseIndex = 0;
  let lastBase = "";
  let unauthorizedNotifiedFor = "";

  function candidates() {
    const cfg = getConfig();
    const configured = baseUrl ? [baseUrl] : [cfg.apiBase, ...cfg.apiBaseFallbacks, ...getStoredApiFallbacks()];
    const unique = [...new Set(configured.filter(Boolean))];
    return unique.length ? unique : [cfg.apiBase];
  }

  function activeBase() {
    const list = candidates();
    if (baseIndex >= list.length) baseIndex = 0;
    lastBase = list[baseIndex];
    return lastBase;
  }

  function emit(event) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        /* a diagnostics listener must never break a request */
      }
    });
    try {
      onEvent(event);
    } catch {
      /* ignore */
    }
  }

  function pushLog(entry) {
    log.unshift(entry);
    if (log.length > logSize) log.length = logSize;
  }

  function breakerOpen() {
    return now() < breakerUntil;
  }

  function tripBreaker() {
    const attempt = Math.max(1, networkFailures - breakerThreshold + 1);
    const cooldown = Math.min(60_000, breakerCooldown * 2 ** Math.min(attempt, 5));
    breakerUntil = now() + cooldown;
    emit({ type: "breaker-open", until: breakerUntil, cooldown, base: lastBase });
    // Rotate to the next configured host (e.g. Tailscale -> public tunnel).
    const list = candidates();
    if (list.length > 1) {
      baseIndex = (baseIndex + 1) % list.length;
      emit({ type: "failover", base: activeBase() });
    }
  }

  function resetBreaker() {
    networkFailures = 0;
    breakerUntil = 0;
  }

  function cacheKey(path, params) {
    return `${path}${buildQuery(params)}`;
  }

  function readCache(key, ttl) {
    if (!ttl) return null;
    const hit = cache.get(key);
    if (!hit) return null;
    if (now() - hit.at > ttl) return null;
    metrics.cacheHits += 1;
    return hit;
  }

  function invalidate(prefix) {
    if (!prefix) {
      cache.clear();
      inflight.clear();
      return;
    }
    for (const key of [...cache.keys()]) {
      if (typeof prefix === "function" ? prefix(key) : key.startsWith(prefix)) cache.delete(key);
    }
  }

  async function parseBody(response) {
    if (response.status === 204 || response.status === 205) return null;
    const type = response.headers?.get?.("content-type") || "";
    const text = await response.text().catch(() => "");
    if (!text) return null;
    if (type.includes("application/json") || /^[\[{]/.test(text.trim())) {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }
    return { raw: text };
  }

  async function once({ method, path, body, params, signal, headers, idempotencyKey, timeoutMs }) {
    const base = activeBase();
    const url = `${base}${path}${buildQuery(params)}`;
    const token = getToken();

    const controller = new AbortController();
    const { signal: combined, cleanup } = combineSignals([signal, controller.signal]);
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs || timeout);
    const started = now();
    metrics.requests += 1;

    const requestHeaders = {
      Accept: "application/json",
      // The bot's API is often exposed through ngrok; this skips its warning
      // interstitial without affecting normal hosts.
      "ngrok-skip-browser-warning": "rift-dashboard",
      ...headers,
    };
    if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    if (idempotencyKey) requestHeaders["Idempotency-Key"] = idempotencyKey;

    let response;
    try {
      response = await doFetch(url, {
        method,
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: combined,
        credentials: "omit",
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      cleanup();
      const aborted = err?.name === "AbortError";
      const timedOut = err?.name === "TimeoutError" || controller.signal.reason?.name === "TimeoutError";
      if (aborted && signal?.aborted) {
        metrics.aborts += 1;
        pushLog({ at: now(), method, path, status: 0, ms: now() - started, outcome: "abort" });
        throw new ApiError("Request cancelled", { status: 0, method, path, code: "aborted", network: true });
      }
      metrics.failures += 1;
      networkFailures += 1;
      if (networkFailures >= breakerThreshold) tripBreaker();
      const message = timedOut
        ? "Rift's backend took too long to respond. It may be starting up."
        : "Can't reach the Rift backend. Check your connection — it retries automatically.";
      const error = new ApiError(message, { status: 0, method, path, network: true, retryable: true, code: timedOut ? "timeout" : "network" });
      pushLog({ at: now(), method, path, status: 0, ms: now() - started, outcome: timedOut ? "timeout" : "network" });
      emit({ type: "network-error", error, path, base });
      throw error;
    } finally {
      clearTimeout(timer);
      cleanup();
    }

    let payload = null;
    let parseError = null;
    try {
      payload = await parseBody(response);
    } catch (err) {
      parseError = err;
    }
    const ms = now() - started;
    const retryAfter = parseRetryAfter(response.headers?.get?.("retry-after"), now());
    const requestId = response.headers?.get?.("x-request-id") || "";
    const ok = response.ok;

    pushLog({
      at: now(),
      method,
      path,
      status: response.status,
      ms,
      outcome: ok ? "ok" : "error",
      requestId,
    });

    if (!ok) {
      if (response.status === 401) {
        metrics.unauthorized += 1;
        const key = token || "anonymous";
        if (unauthorizedNotifiedFor !== key) {
          unauthorizedNotifiedFor = key;
          try {
            onUnauthorized({ path, status: 401 });
          } catch {
            /* ignore */
          }
        }
      }
      if (response.status === 429) {
        // Retry-After drives both the in-request retry and the UI countdown.
        emit({ type: "rate-limited", path, retryAfter });
      }
      if (RETRY_STATUSES.has(response.status)) {
        networkFailures += 1;
        if (networkFailures >= breakerThreshold) tripBreaker();
      }
      throw new ApiError(messageForStatus(response.status, payload), {
        status: response.status,
        code: payload?.code || payload?.error_code || "",
        payload,
        retryable: RETRY_STATUSES.has(response.status),
        retryAfter,
        method,
        path,
        requestId,
      });
    }

    if (parseError) {
      throw new ApiError("The backend returned a malformed response.", {
        status: response.status,
        method,
        path,
        retryable: false,
      });
    }

    networkFailures = 0;
    breakerUntil = 0;
    if (response.status !== 401) unauthorizedNotifiedFor = "";
    return { payload, status: response.status, ms, retryAfter, requestId, url };
  }

  async function request(path, options = {}) {
    const {
      method = "GET",
      body,
      params,
      signal,
      headers,
      timeoutMs,
      retries,
      retry = null,
      cacheTtl = 0,
      dedupe = true,
      force = false,
      idempotencyKey,
      auth = true,
    } = options;
    const upper = String(method).toUpperCase();
    const safe = SAFE_METHODS.has(upper);
    const key = cacheKey(path, params);

    if (!force && safe && cacheTtl) {
      const hit = readCache(key, cacheTtl);
      if (hit) {
        return hit.data;
      }
    }

    if (!force && safe && dedupe && inflight.has(key)) {
      return inflight.get(key);
    }

    if (breakerOpen()) {
      const waitMs = Math.max(0, breakerUntil - now());
      throw new ApiError(
        "Rift's backend is unreachable right now. Retrying automatically in the background.",
        { status: 0, network: true, retryable: true, method: upper, path, code: "breaker-open", retryAfter: waitMs }
      );
    }

    const allowRetry = retry ?? (safe || !!retry);
    // Callers pass `retries` as the number of *extra* attempts (0 = one shot).
    // Treating it as total attempts made every retries:0 endpoint reject with
    // `undefined` because withRetry never entered its loop.
    const attempts = retries != null ? Math.max(1, Math.floor(retries) + 1) : allowRetry ? Math.max(1, maxAttempts) : 1;

    const promise = (async () => {
      const result = await withRetry(
        async () => {
          try {
            const response = await once({
              method: upper,
              path,
              body,
              params,
              signal,
              headers: auth ? headers : { ...headers, Authorization: "" },
              idempotencyKey,
              timeoutMs,
            });
            return response;
          } catch (err) {
            if (err?.code === "aborted" || signal?.aborted) throw err;
            throw err;
          }
        },
        {
          attempts,
          signal,
          baseDelay: 350,
          maxDelay: 6_000,
          shouldRetry: (err, attempt) => {
            if (err?.status === 401 || err?.status === 403 || err?.status === 404) return false;
            if (err?.status === 429) return attempt < attempts - 1;
            return Boolean(err?.retryable) && attempt < attempts - 1;
          },
          delayFor: (err, attempt, exp) =>
            Math.max(exp, Math.min(err?.retryAfter || 0, 30_000)),
          onRetry: (err, attempt, delay) => {
            metrics.retries += 1;
            emit({ type: "retry", path, attempt, delay, error: err });
          },
        }
      );
      if (safe && cacheTtl) cache.set(key, { data: result.payload, at: now() });
      return result.payload;
    })();

    if (safe && dedupe) {
      inflight.set(key, promise);
      // `.finally()` returns a rejected promise when the request fails, which
      // browsers report as an unhandled rejection. Handle both outcomes.
      const settle = () => {
        if (inflight.get(key) === promise) inflight.delete(key);
      };
      promise.then(settle, settle);
    }
    return promise;
  }

  /** Raw Response fetch (used for render-to-image endpoints that need auth). */
  async function raw(path, { params, signal, timeoutMs, headers } = {}) {
    const controller = new AbortController();
    const { signal: combined, cleanup } = combineSignals([signal, controller.signal]);
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs || timeout);
    try {
      const token = getToken();
      const response = await doFetch(`${activeBase()}${path}${buildQuery(params)}`, {
        method: "GET",
        headers: { Accept: "image/*,application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        signal: combined,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.clone().json();
        } catch {
          /* non-JSON error */
        }
        throw new ApiError(messageForStatus(response.status, payload), {
          status: response.status,
          payload,
          method: "GET",
          path,
          retryable: RETRY_STATUSES.has(response.status),
        });
      }
      networkFailures = 0;
      breakerUntil = 0;
      return response;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      networkFailures += 1;
      if (networkFailures >= breakerThreshold) tripBreaker();
      throw new ApiError("Can't reach the Rift backend.", { status: 0, network: true, retryable: true, method: "GET", path });
    } finally {
      clearTimeout(timer);
      cleanup();
    }
  }

  const api = {
    request,
    raw,
    get: (path, options = {}) => request(path, { ...options, method: "GET" }),
    post: (path, body, options = {}) => request(path, { ...options, method: "POST", body }),
    put: (path, body, options = {}) => request(path, { ...options, method: "PUT", body }),
    patch: (path, body, options = {}) => request(path, { ...options, method: "PATCH", body }),
    del: (path, options = {}) => request(path, { ...options, method: "DELETE" }),
    invalidate,
    clearCache: () => cache.clear(),
    cacheSize: () => cache.size,
    getLog: () => [...log],
    getMetrics: () => ({ ...metrics }),
    isBreakerOpen: breakerOpen,
    breakerRemaining: () => Math.max(0, breakerUntil - now()),
    getBase: () => activeBase(),
    getCandidates: () => candidates(),
    setBase: (value) => {
      const list = candidates();
      const index = list.indexOf(value);
      if (index >= 0) baseIndex = index;
      resetBreaker();
    },
    resetDiagnostics: () => {
      log.length = 0;
      Object.keys(metrics).forEach((k) => (metrics[k] = 0));
      resetBreaker();
      unauthorizedNotifiedFor = "";
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Cheap reachability probe for the status page. */
    probe: async (path = "/stats", options = {}) => {
      const started = now();
      try {
        const data = await request(path, { ...options, timeoutMs: 8_000, retries: 0, force: true });
        return { ok: true, ms: now() - started, status: 200, data };
      } catch (err) {
        return { ok: false, ms: now() - started, status: err?.status || 0, error: err };
      }
    },
  };

  return api;
}

export const api = createApiClient({
  getToken: () => {
    try {
      return localStorage.getItem("rift_dashboard_token") || "";
    } catch {
      return "";
    }
  },
});
