/* Small, dependency-free formatting / utility helpers.
 * Everything here is pure (except the few DOM/file helpers, which no-op when
 * the browser APIs are unavailable) so it can be unit-tested directly in Node. */

export const MS = 1;
export const SECOND = 1000;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const nf = new Intl.NumberFormat("en-US");
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function num(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function int(value, fallback = 0) {
  return Math.trunc(num(value, fallback));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, num(value)));
}

export function fmtInt(value) {
  return nf.format(Math.round(num(value)));
}

export function fmtCompact(value) {
  const n = num(value);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trimZero(n / 1e9)}B`;
  if (abs >= 1e6) return `${trimZero(n / 1e6)}M`;
  if (abs >= 1e4) return `${trimZero(n / 1e3)}K`;
  if (abs >= 1e3) return `${trimZero(n / 1e3)}K`;
  return String(Math.round(n * 100) / 100);
}

function trimZero(n) {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function fmtMoney(value, { currency = "" } = {}) {
  const n = num(value);
  const body = Number.isInteger(n) ? nf.format(Math.abs(n)) : nf2.format(Math.abs(n));
  if (currency) return `${n < 0 ? "-" : ""}${body} ${currency}`;
  return `${n < 0 ? "-" : ""}$${body}`;
}

export function fmtSigned(value, digits = 2) {
  const n = num(value);
  const body = Math.abs(n) >= 1000 ? nf.format(Math.round(n * 100) / 100) : n.toFixed(digits);
  return `${n > 0 ? "+" : ""}${body}`;
}

export function fmtPercent(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

/* ---------- time ---------- */

/** Accepts seconds, milliseconds or ISO strings and returns a ms epoch. */
export function toEpochMs(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Discord-ish data is in seconds; anything >= 1e12 is already milliseconds.
    return value > 1e12 ? value : value * 1000;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return toEpochMs(numeric);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtDuration(seconds, { units = 2, pad = false } = {}) {
  let total = Math.max(0, Math.floor(num(seconds)));
  const parts = [];
  const table = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];
  for (const [label, size] of table) {
    if (!total && parts.length) break;
    const qty = Math.floor(total / size);
    if (qty || (label === "s" && !parts.length)) {
      parts.push(`${pad ? String(qty).padStart(2, "0") : qty}${label}`);
      total -= qty * size;
    }
    if (parts.length >= units) break;
  }
  return parts.join(" ") || "0s";
}

export function fmtClock(seconds) {
  const total = Math.max(0, Math.floor(num(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function fmtRelative(value, { now = Date.now(), short = false } = {}) {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  const delta = Math.round((ms - now) / 1000);
  const abs = Math.abs(delta);
  const units = [
    [31_536_000, "year"],
    [2_592_000, "month"],
    [604_800, "week"],
    [86_400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  if (abs < 45) return delta === 0 ? "just now" : delta > 0 ? "in a moment" : "just now";
  for (const [size, label] of units) {
    if (abs >= size) {
      const amount = Math.floor(abs / size);
      const plural = `${amount} ${label}${amount === 1 ? "" : "s"}`;
      if (short) return delta < 0 ? `${amount}${label[0]}` : `in ${amount}${label[0]}`;
      return delta < 0 ? `${plural} ago` : `in ${plural}`;
    }
  }
  const amount = Math.max(1, Math.round(abs / 60));
  return delta < 0 ? `${amount}m ago` : `in ${amount}m`;
}

export function fmtDateTime(value, { locale = undefined } = {}) {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(value, { locale = undefined } = {}) {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString(locale, { year: "numeric", month: "short", day: "2-digit" });
}

export function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function fmtDiscordTimestamp(value, style = "R") {
  const ms = toEpochMs(value);
  if (ms == null) return "";
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

export const PERIODS = [
  { value: "7day", label: "Last 7 days" },
  { value: "1month", label: "Last month" },
  { value: "3month", label: "Last 3 months" },
  { value: "6month", label: "Last 6 months" },
  { value: "12month", label: "Last year" },
  { value: "overall", label: "All time" },
];

/* ---------- strings ---------- */

export function truncate(text, max = 80) {
  const str = String(text ?? "");
  return str.length > max ? `${str.slice(0, Math.max(0, max - 1))}…` : str;
}

export function titleCase(text) {
  return String(text ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(name) {
  const parts = String(name ?? "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function plural(count, singular, pluralWord = `${singular}s`) {
  return `${fmtInt(count)} ${Math.abs(num(count)) === 1 ? singular : pluralWord}`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

export function csvCell(value) {
  const str = value == null ? "" : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const head = cols.map((c) => csvCell(c.label ?? c.key ?? c)).join(",");
  const body = rows.map((row) => cols.map((c) => csvCell(typeof c === "object" ? row[c.key] : row[c])).join(","));
  return [head, ...body].join("\r\n");
}

/* ---------- objects ---------- */

export function deepClone(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      /* fall through for functions/Proxies */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

/** Shallow object diff → { path: { before, after } } for review/preview UIs. */
export function diffObjects(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const out = {};
  for (const key of keys) {
    if (!deepEqual(before?.[key], after?.[key])) {
      out[key] = { before: before?.[key], after: after?.[key] };
    }
  }
  return out;
}

export function pick(object, keys) {
  const out = {};
  for (const key of keys) if (object && key in object) out[key] = object[key];
  return out;
}

export function omit(object, keys) {
  const set = new Set(keys);
  return Object.fromEntries(Object.entries(object || {}).filter(([k]) => !set.has(k)));
}

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/* ---------- ids / crypto ---------- */

let fallbackCounter = 0;
export function uuid() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  fallbackCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

export function randomId(prefix = "rift") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- async ---------- */

export function debounce(fn, wait = 250) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    timer = null;
    fn(...args);
  };
  return wrapped;
}

export function throttle(fn, wait = 250) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  return (...args) => {
    const now = Date.now();
    lastArgs = args;
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...lastArgs);
      }, remaining);
    }
  };
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

/** Retry helper with exponential backoff + full jitter. */
export async function withRetry(
  fn,
  { attempts = 3, baseDelay = 300, maxDelay = 8000, signal, shouldRetry = () => true, onRetry, delayFor } = {}
) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (err?.name === "AbortError" || signal?.aborted) throw err;
      if (attempt === attempts - 1 || !shouldRetry(err, attempt)) break;
      const exp = Math.min(maxDelay, baseDelay * 2 ** attempt);
      const delay =
        typeof delayFor === "function"
          ? Math.max(0, delayFor(err, attempt, exp))
          : Math.random() * exp;
      await onRetry?.(err, attempt + 1, delay);
      if (delay > 0) await sleep(delay, signal);
    }
  }
  throw lastError;
}

/* ---------- sorting ---------- */

export function sortRows(rows, key, direction = "asc", accessor) {
  const dir = direction === "desc" ? -1 : 1;
  const read = accessor || ((row) => row?.[key]);
  return [...(rows || [])].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
}

export function groupBy(rows, keyFn) {
  const out = new Map();
  for (const row of rows || []) {
    const key = typeof keyFn === "function" ? keyFn(row) : row?.[keyFn];
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  }
  return out;
}

/* ---------- browser helpers ---------- */

export function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  if (typeof document === "undefined") return false;
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function hexToRgb(hex) {
  const value = String(hex || "").replace(/^#/, "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function readableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#fff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#0b0c10" : "#ffffff";
}

/** Discord ids arrive as strings; keep precision and never render as 1.2e+17. */
export function discordId(value) {
  if (value == null || value === "") return "";
  const str = String(value);
  return /^\d+$/.test(str) ? str : str;
}

export function snowflakeCreatedAt(id) {
  try {
    const ms = Number(BigInt(id) >> 22n) + 1420070400000;
    return ms > 0 ? ms : null;
  } catch {
    return null;
  }
}
