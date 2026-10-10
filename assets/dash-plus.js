/* Rift Dash Plus — Last.fm deep stats + now-playing fix, stock charts,
 * and overview analytics. Dependency-free, mounts beside the React pages.
 * P.P.S. charts so smooth you could skate on them. please don't. */
"use strict";

const API_BASE = (window.RIFT_API_BASE || "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api").replace(/\/$/, "");
const TOKEN_KEY = "rift_dashboard_token";
const TIMEOUT_MS = 12000;
const PALETTE = ["#00b8ff", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#eab308", "#f97316", "#8b5cf6", "#34d399"];

/* ---------------- helpers ---------------- */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function listFrom(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys || []) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (payload?.data && typeof payload.data === "object" && payload.data !== payload) return listFrom(payload.data, keys);
  return [];
}

function textOf(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return textOf(value.find((v) => textOf(v)));
  return String(value.name ?? value.title ?? value["#text"] ?? value.text ?? "");
}

function numOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n) {
  return Math.round(numOf(n)).toLocaleString("en-US");
}

function compact(n) {
  n = numOf(n);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 9950 ? 0 : 1)}k`;
  return `${Math.round(n * 100) / 100}`;
}

function fmtMoney(n) {
  n = numOf(n);
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function signed(n, digits) {
  n = numOf(n);
  const v = digits ? n.toFixed(digits) : fmtMoney(n);
  return `${n > 0 ? "+" : ""}${v}`;
}

function parseDay(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    let n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < 1e12) n *= 1000;
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(value) {
  const d = parseDay(value);
  if (!d) return String(value ?? "");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function clockNow() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function request(path, options) {
  options = options || {};
  let url = `${API_BASE}${path}`;
  if (options.params) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== "") sp.set(key, String(value));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeout || TIMEOUT_MS);
  const outer = options.signal;
  const onOuter = () => ctrl.abort();
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  try {
    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(options.body);
    }
    const res = await fetch(url, { method: options.method || "GET", headers, body: payload, signal: ctrl.signal });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const error = new Error(data?.error || data?.message || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener("abort", onOuter);
  }
}

/* Discord user id: parse from the dashboard header avatar first (free), else API. */
let cachedUser = null;
let userPromise = null;
function currentUser() {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (userPromise) return userPromise;
  userPromise = (async () => {
    try {
      const img = document.querySelector('header img[src*="cdn.discordapp.com/avatars/"], img[src*="cdn.discordapp.com/avatars/"]');
      const m = img?.src?.match(/\/avatars\/(\d+)\//);
      if (m) {
        const name = img.closest("div")?.parentElement?.querySelector("span")?.textContent?.trim() || "";
        cachedUser = { id: m[1], username: name };
        return cachedUser;
      }
    } catch { /* fall through */ }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const user = await res.json();
      cachedUser = { id: String(user?.id || ""), username: user?.username || "" };
      return cachedUser.id ? cachedUser : null;
    } catch {
      return null;
    }
  })();
  return userPromise;
}

/* ---------------- svg chart kit ---------------- */

const SVGNS = "http://www.w3.org/2000/svg";
let gradientSeq = 0;

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const key of Object.keys(attrs)) el.setAttribute(key, attrs[key]);
  if (parent) parent.appendChild(el);
  return el;
}

function text(parent, x, y, str, attrs) {
  const el = svgEl("text", { x, y, fill: "rgba(255,255,255,0.32)", "font-size": "10", "font-family": "inherit", ...(attrs || {}) }, parent);
  el.textContent = str;
  return el;
}

/* Catmull-Rom smoothing. Fancy math so the lines look expensive. */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function sparkSVG(values, color, w, h) {
  w = w || 96;
  h = h || 26;
  const vals = (values || []).map(numOf).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return `<span style="color:rgba(255,255,255,0.2)">—</span>`;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1];
  const first = vals[0];
  const c = color || (last > first ? "#22c55e" : last < first ? "#ef4444" : "rgba(255,255,255,0.35)");
  const lx = w.toFixed(1);
  const ly = (h - 3 - ((last - min) / span) * (h - 6)).toFixed(1);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly}" r="2.2" fill="${c}"/></svg>`;
}

/* Area / line chart with hover crosshair. values: number[], labels: string[]. */
function areaChart(wrap, opts) {
  const values = (opts.values || []).map(numOf);
  const labels = opts.labels || [];
  const color = opts.color || "#00b8ff";
  const W = 640;
  const H = opts.height || 190;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  wrap.innerHTML = "";
  if (values.length < 2) {
    wrap.innerHTML = `<div class="dp-empty">Not enough data yet.</div>`;
    return;
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const X = (i) => padL + (i / (values.length - 1)) * iw;
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * ih;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, wrap);
  const gid = `dpg${++gradientSeq}`;
  const defs = svgEl("defs", null, svg);
  const grad = svgEl("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
  svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.28" }, grad);
  svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }, grad);

  for (let g = 0; g <= 4; g++) {
    const v = min + ((max - min) * g) / 4;
    const y = Y(v);
    svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "rgba(255,255,255,0.06)", "stroke-width": "1" }, svg);
    text(svg, padL - 7, y + 3.5, compact(v), { "text-anchor": "end" });
  }
  const idx = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  idx.forEach((i) => {
    text(svg, X(i), H - 7, labels[i] ?? "", {
      "text-anchor": i === 0 ? "start" : i === values.length - 1 ? "end" : "middle",
    });
  });

  const pts = values.map((v, i) => [X(i), Y(v)]);
  const line = smoothPath(pts);
  svgEl("path", { d: `${line} L${X(values.length - 1)},${padT + ih} L${padL},${padT + ih} Z`, fill: `url(#${gid})` }, svg);
  svgEl("path", { d: line, fill: "none", stroke: color, "stroke-width": "2", "stroke-linecap": "round" }, svg);

  const cross = svgEl("line", { y1: padT, y2: padT + ih, stroke: "rgba(255,255,255,0.25)", "stroke-width": "1", visibility: "hidden" }, svg);
  const dot = svgEl("circle", { r: "3.5", fill: color, stroke: "#0d0e12", "stroke-width": "1.5", visibility: "hidden" }, svg);
  const tip = document.createElement("div");
  tip.className = "dp-tip";
  tip.style.display = "none";
  wrap.appendChild(tip);
  const hit = svgEl("rect", { x: padL, y: padT, width: iw, height: ih, fill: "transparent" }, svg);
  hit.style.cursor = "crosshair";
  hit.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const scale = W / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < values.length; i++) {
      const d = Math.abs(X(i) - mx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    cross.setAttribute("x1", X(best));
    cross.setAttribute("x2", X(best));
    cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", X(best));
    dot.setAttribute("cy", Y(values[best]));
    dot.setAttribute("visibility", "visible");
    const fmt = opts.formatTip || ((v) => `<strong>${esc(compact(v))}</strong>`);
    tip.innerHTML = `<div class="dp-tip-t">${esc(labels[best] ?? "")}</div>${fmt(values[best], best)}`;
    tip.style.display = "block";
    tip.style.left = `${(X(best) / W) * 100}%`;
    tip.style.top = `${(Y(values[best]) / H) * rect.height}px`;
  });
  hit.addEventListener("mouseleave", () => {
    cross.setAttribute("visibility", "hidden");
    dot.setAttribute("visibility", "hidden");
    tip.style.display = "none";
  });
}

/* Grouped vertical bars for two comparable series. */
function groupBars(wrap, opts) {
  const a = (opts.a.values || []).map(numOf);
  const b = (opts.b.values || []).map(numOf);
  const labels = opts.labels || [];
  const n = Math.min(a.length, b.length);
  const W = 640;
  const H = opts.height || 190;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  wrap.innerHTML = "";
  if (n < 1) {
    wrap.innerHTML = `<div class="dp-empty">Not enough data yet.</div>`;
    return;
  }
  const max = Math.max(1, ...a.slice(0, n), ...b.slice(0, n));
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, wrap);
  for (let g = 0; g <= 4; g++) {
    const v = (max * g) / 4;
    const y = padT + ih - (v / max) * ih;
    svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "rgba(255,255,255,0.06)", "stroke-width": "1" }, svg);
    text(svg, padL - 7, y + 3.5, compact(v), { "text-anchor": "end" });
  }
  const slot = iw / n;
  const bw = Math.min(22, Math.max(3, slot * 0.31));
  const gap = 2;
  const tip = document.createElement("div");
  tip.className = "dp-tip";
  tip.style.display = "none";
  wrap.appendChild(tip);
  for (let i = 0; i < n; i++) {
    const cx = padL + slot * i + slot / 2;
    const mkBar = (v, color, x) => {
      const h = Math.max(v <= 0 ? 0 : 2, (v / max) * ih);
      const r = svgEl("rect", {
        x, y: padT + ih - h, width: bw, height: h,
        rx: Math.min(3, bw / 3), fill: color, opacity: "0.85",
      }, svg);
      return r;
    };
    const r1 = mkBar(a[i], opts.a.color, cx - bw - gap / 2);
    const r2 = mkBar(b[i], opts.b.color, cx + gap / 2);
    const show = (e) => {
      tip.innerHTML = `<div class="dp-tip-t">${esc(labels[i] ?? "")}</div>`
        + `<div><span style="color:${opts.a.color}">●</span> ${esc(opts.a.name)} <strong>${esc(fmtInt(a[i]))}</strong></div>`
        + `<div><span style="color:${opts.b.color}">●</span> ${esc(opts.b.name)} <strong>${esc(fmtInt(b[i]))}</strong></div>`;
      tip.style.display = "block";
      const rect = svg.getBoundingClientRect();
      tip.style.left = `${((cx / W) * 100).toFixed(2)}%`;
      tip.style.top = `${(padT / H) * rect.height + 34}px`;
      void e;
    };
    const hide = () => { tip.style.display = "none"; };
    r1.addEventListener("mouseenter", show);
    r2.addEventListener("mouseenter", show);
    r1.addEventListener("mouseleave", hide);
    r2.addEventListener("mouseleave", hide);
  }
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
    const cx = padL + slot * i + slot / 2;
    text(svg, cx, H - 7, labels[i] ?? "", {
      "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
    });
  });
  const legend = document.createElement("div");
  legend.className = "dp-legend";
  legend.innerHTML = `<span><i style="background:${opts.a.color}"></i>${esc(opts.a.name)}</span><span><i style="background:${opts.b.color}"></i>${esc(opts.b.name)}</span>`;
  wrap.appendChild(legend);
}

/* Net bars (pos/neg around zero) + cumulative line. Bars go brr. Line goes whee. */
function comboChart(wrap, opts) {
  const bars = (opts.bars || []).map(numOf);
  const line = (opts.line || []).map(numOf);
  const labels = opts.labels || [];
  const n = Math.min(bars.length, line.length);
  const W = 640;
  const H = opts.height || 200;
  const padL = 46;
  const padR = 46;
  const padT = 12;
  const padB = 24;
  wrap.innerHTML = "";
  if (n < 2) {
    wrap.innerHTML = `<div class="dp-empty">Not enough data yet.</div>`;
    return;
  }
  const bMax = Math.max(1, ...bars.slice(0, n).map(Math.abs));
  let lMin = Math.min(...line.slice(0, n));
  let lMax = Math.max(...line.slice(0, n));
  if (lMin === lMax) { lMin -= 1; lMax += 1; }
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const zeroY = padT + ih / 2;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, wrap);
  [-1, -0.5, 0, 0.5, 1].forEach((f) => {
    const y = zeroY - f * (ih / 2);
    svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: f === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)", "stroke-width": "1" }, svg);
    text(svg, padL - 7, y + 3.5, signed(bMax * f), { "text-anchor": "end" });
  });
  for (let g = 0; g <= 3; g++) {
    const v = lMin + ((lMax - lMin) * g) / 3;
    const y = padT + ih - ((v - lMin) / (lMax - lMin)) * ih;
    text(svg, W - padR + 7, y + 3.5, compact(v), {});
  }
  const slot = iw / n;
  const bw = Math.min(26, Math.max(4, slot * 0.55));
  for (let i = 0; i < n; i++) {
    const v = bars[i];
    const h = Math.max(v === 0 ? 0 : 2, (Math.abs(v) / bMax) * (ih / 2));
    const cx = padL + slot * i + slot / 2;
    svgEl("rect", {
      x: cx - bw / 2, y: v >= 0 ? zeroY - h : zeroY, width: bw, height: h,
      rx: 2.5, fill: v >= 0 ? "#22c55e" : "#ef4444", opacity: "0.8",
    }, svg);
  }
  const LX = (i) => padL + slot * i + slot / 2;
  const LY = (v) => padT + ih - ((v - lMin) / (lMax - lMin)) * ih;
  const pts = line.slice(0, n).map((v, i) => [LX(i), LY(v)]);
  svgEl("path", { d: smoothPath(pts), fill: "none", stroke: "#00b8ff", "stroke-width": "2", "stroke-linecap": "round" }, svg);
  pts.forEach(([x, y]) => svgEl("circle", { cx: x, cy: y, r: "2", fill: "#00b8ff" }, svg));
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
    text(svg, LX(i), H - 7, labels[i] ?? "", {
      "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
    });
  });
  const tip = document.createElement("div");
  tip.className = "dp-tip";
  tip.style.display = "none";
  wrap.appendChild(tip);
  const hit = svgEl("rect", { x: padL, y: padT, width: iw, height: ih, fill: "transparent" }, svg);
  hit.style.cursor = "crosshair";
  hit.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(LX(i) - mx);
      if (d < bd) { bd = d; best = i; }
    }
    tip.innerHTML = `<div class="dp-tip-t">${esc(labels[best] ?? "")}</div>`
      + `<div>Net <strong class="${bars[best] >= 0 ? "dp-up" : "dp-down"}">${signed(bars[best])}</strong></div>`
      + `<div>Total <strong>${signed(line[best])}</strong></div>`;
    tip.style.display = "block";
    tip.style.left = `${(LX(best) / W) * 100}%`;
    tip.style.top = `${(LY(line[best]) / H) * rect.height}px`;
  });
  hit.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  const legend = document.createElement("div");
  legend.className = "dp-legend";
  legend.innerHTML = `<span><i style="background:#22c55e"></i>Daily net growth</span><span><i style="background:#00b8ff"></i>Running total</span>`;
  wrap.appendChild(legend);
}

/* Donut with HTML legend. segments: [{label, value, color}]. Zero calories. Infinite insights. */
function donut(wrap, opts) {
  const segs = (opts.segments || []).filter((s) => numOf(s.value) > 0);
  const total = segs.reduce((a, s) => a + numOf(s.value), 0);
  wrap.innerHTML = "";
  if (!segs.length || total <= 0) {
    wrap.innerHTML = `<div class="dp-empty">Nothing to show yet.</div>`;
    return;
  }
  const size = 150;
  const R = 62;
  const C = 2 * Math.PI * R;
  const flex = document.createElement("div");
  flex.className = "dp-donut-flex";
  const box = document.createElement("div");
  box.className = "dp-donut-box";
  const svg = svgEl("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` }, box);
  svgEl("circle", { cx: size / 2, cy: size / 2, r: R, fill: "none", stroke: "rgba(255,255,255,0.07)", "stroke-width": "18" }, svg);
  let acc = 0;
  segs.forEach((s) => {
    const frac = numOf(s.value) / total;
    const c = svgEl("circle", {
      cx: size / 2, cy: size / 2, r: R, fill: "none",
      stroke: s.color || "#00b8ff", "stroke-width": "18",
      "stroke-dasharray": `${(frac * C).toFixed(1)} ${C.toFixed(1)}`,
      "stroke-dashoffset": `${(-acc * C).toFixed(1)}`,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
    }, svg);
    const title = document.createElementNS(SVGNS, "title");
    title.textContent = `${s.label}: ${fmtMoney(s.value)} (${(frac * 100).toFixed(1)}%)`;
    c.appendChild(title);
    acc += frac;
  });
  const center = document.createElement("div");
  center.className = "dp-donut-center";
  center.innerHTML = `<strong>${esc(opts.centerTop ?? compact(total))}</strong><span>${esc(opts.centerSub ?? "total")}</span>`;
  box.appendChild(center);
  const legend = document.createElement("div");
  legend.className = "dp-donut-legend";
  legend.innerHTML = segs.map((s) => {
    const frac = (numOf(s.value) / total) * 100;
    return `<div class="dp-leg-row"><i style="background:${esc(s.color || "#00b8ff")}"></i>`
      + `<span class="dp-leg-name" title="${esc(s.label)}">${esc(s.label)}</span>`
      + `<span class="dp-leg-val">${esc(fmtMoney(s.value))} · ${frac.toFixed(1)}%</span></div>`;
  }).join("");
  flex.appendChild(box);
  flex.appendChild(legend);
  wrap.appendChild(flex);
}

function rankRows(items, opts) {
  opts = opts || {};
  const max = Math.max(1, ...items.map((it) => numOf(it.value)));
  const color = opts.color || "#00b8ff";
  return `<div class="dp-rows">${items.map((it, i) => {
    const pct = Math.max(2, (numOf(it.value) / max) * 100);
    const art = it.art
      ? `<img class="dp-row-art" src="${esc(it.art)}" alt="" loading="lazy" style="grid-column:1">`
      : "";
    return `<div class="dp-row"${art ? ` style="grid-template-columns:26px 34px minmax(0,1fr) auto"` : ""}>`
      + `<span class="dp-rank">${i + 1}</span>${art}`
      + `<div class="dp-row-main"><div class="dp-row-name" title="${esc(it.name)}">${esc(it.name)}</div>`
      + (it.sub ? `<div class="dp-row-sub">${esc(it.sub)}</div>` : "")
      + `<div class="dp-bar"><i style="width:${pct.toFixed(1)}%;background:${color}"></i></div></div>`
      + `<span class="dp-row-val">${esc(it.display ?? fmtInt(it.value))}</span></div>`;
  }).join("")}</div>`;
}

function tile(value, label, sub) {
  return `<div class="dp-tile"><div class="dp-tile-v">${value}</div><div class="dp-tile-l">${esc(label)}</div>${sub ? `<div class="dp-tile-s">${sub}</div>` : ""}</div>`;
}

function trendText(cur, prev) {
  cur = numOf(cur);
  prev = numOf(prev);
  if (prev <= 0) return cur > 0 ? `<span class="dp-up">new</span>` : `<span class="dp-flat">—</span>`;
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return `<span class="dp-flat">0%</span>`;
  const cls = pct > 0 ? "dp-up" : "dp-down";
  return `<span class="${cls}">${pct > 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
}

/* ---------------- module base ---------------- */

class PlusModule {
  constructor(main, guildId) {
    this.main = main;
    this.guildId = guildId;
    this.ac = new AbortController();
    this.timers = [];
    this.disposed = false;
    this.section = document.createElement("div");
    this.section.className = "dp-section";
    this.main.appendChild(this.section);
  }
  get signal() { return this.ac.signal; }
  later(fn, ms) {
    const id = setTimeout(() => { if (!this.disposed) fn(); }, ms);
    this.timers.push(id);
    return id;
  }
  every(fn, ms) {
    const id = setInterval(() => { if (!this.disposed && !document.hidden) fn(); }, ms);
    this.timers.push(id);
    return id;
  }
  on(el, evt, fn) {
    el.addEventListener(evt, fn, { signal: this.signal });
  }
  dispose() {
    this.disposed = true;
    this.ac.abort();
    this.timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    this.section.remove();
  }
}

/* ================= Last.fm ================= */

const PERIODS = [
  ["7D", "7day"],
  ["1M", "1month"],
  ["3M", "3month"],
  ["6M", "6month"],
  ["1Y", "12month"],
  ["ALL", "overall"],
];

/* Unwrap every now-playing shape seen in the wild. Returns {track, artist, image, live, staleText} or null.
 * The backend wraps responses like they're fragile. They are not fragile. */
function parseNowPlaying(payload) {
  if (!payload || typeof payload !== "object") return null;
  // Last.fm native recenttracks shape
  const rt = payload.recenttracks ?? payload.recent_tracks ?? payload.recentTracks;
  if (rt) {
    const list = Array.isArray(rt.track) ? rt.track : Array.isArray(rt) ? rt : rt.track ? [rt.track] : [];
    const first = list[0];
    if (first && typeof first === "object") {
      const live = String(first["@attr"]?.nowplaying ?? first.nowplaying ?? "") === "true";
      const img = Array.isArray(first.image) ? first.image.map((i) => textOf(i)).filter(Boolean).pop() : textOf(first.image);
      if (textOf(first.name)) {
        return {
          track: textOf(first.name),
          artist: textOf(first.artist),
          image: img || "",
          live,
          when: first.date?.uts ? Number(first.date.uts) * 1000 : 0,
        };
      }
    }
    return null;
  }
  // Wrapped shapes — recurse one level
  for (const key of ["data", "now_playing", "nowplaying", "nowPlaying", "current", "track_info", "song_info"]) {
    const nested = payload[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = parseNowPlaying({ ...nested, __wrap: key });
      if (found) return found;
    }
  }
  const track = textOf(payload.track ?? payload.name ?? payload.title ?? payload.song);
  if (!track) return null;
  const artist = textOf(payload.artist ?? payload.artist_name ?? payload.author);
  const image = textOf(payload.image ?? payload.artwork ?? payload.album_art ?? payload.cover ?? payload.thumbnail)
    || (Array.isArray(payload.images) ? textOf(payload.images[0]) : "");
  const explicitFalse = payload.playing === false || payload.is_playing === false
    || payload.nowplaying === false || payload.now_playing === false || payload.live === false
    || payload.status === "stopped" || payload.status === "idle" || payload.status === "nothing";
  const explicitTrue = payload.playing === true || payload.is_playing === true
    || payload.nowplaying === true || payload.now_playing === true || payload.live === true
    || String(payload.nowplaying ?? "") === "true";
  const ts = Number(payload.uts ?? payload.timestamp ?? payload.scrobbled_at ?? payload.date?.uts ?? 0);
  const when = ts > 0 ? (ts < 1e12 ? ts * 1000 : ts) : 0;
  let live = explicitTrue ? true : explicitFalse ? false : true;
  if (!explicitTrue && !explicitFalse && when && Date.now() - when > 8 * 60 * 1000) live = false;
  return { track, artist: artist || "Unknown artist", image, live, when };
}

class LastFmPlus extends PlusModule {
  constructor(main, guildId) {
    super(main, guildId);
    this.period = "1month";
    this.emptyStreak = 0;
    this.lastKey = "";
    this.boot();
  }

  npCard() {
    const heads = [...this.main.querySelectorAll("h3")];
    const h = heads.find((el) => el.textContent.trim() === "Now playing");
    return h ? h.closest("div.rounded-xl") : null;
  }

  npBodyText(card) {
    if (!card) return "";
    const header = card.firstElementChild;
    let out = "";
    [...card.children].forEach((child) => {
      if (child !== header) out += child.textContent;
    });
    return out.trim();
  }

  setNpBody(card, html, key) {
    const header = card.firstElementChild;
    [...card.children].forEach((child) => {
      if (child !== header) child.remove();
    });
    const body = document.createElement("div");
    body.innerHTML = html;
    card.appendChild(body);
    card.dataset.dpNp = key;
  }

  async fixNowPlaying() {
    const user = await currentUser();
    if (!user || this.disposed) return;
    let parsed = null;
    let ok = false;
    try {
      const data = await request(`/lastfm/nowplaying/${encodeURIComponent(user.id)}`, { signal: this.signal });
      ok = true;
      parsed = parseNowPlaying(data);
    } catch {
      return; // offline — never touch the card on failure
    }
    if (this.disposed) return;
    const card = this.npCard();
    if (!card) return;
    if (parsed) {
      this.emptyStreak = 0;
      const key = `${parsed.track}|||${parsed.artist}|||${parsed.live ? "live" : "stale"}`;
      const bodyText = this.npBodyText(card);
      const needsFix = card.dataset.dpNp !== key
        && (bodyText === "" || /nothing scrobbling/i.test(bodyText) || !bodyText.includes(parsed.track));
      if (!needsFix) return;
      const art = parsed.image
        ? `<img src="${esc(parsed.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="dp-np-art-fb"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>`;
      const status = parsed.live
        ? `<span class="dp-live"><i></i>SCROBBLING NOW</span>`
        : `<div class="dp-np-stale">Last scrobbled${parsed.when ? ` · ${timeAgo(parsed.when)}` : ""}</div>`;
      this.setNpBody(card, `<div class="dp-np">${art}<div><div class="dp-np-track">${esc(parsed.track)}</div><div class="dp-np-artist">${esc(parsed.artist)}</div>${status}</div></div>`, key);
    } else {
      this.emptyStreak++;
      if (this.emptyStreak < 2) return;
      // Genuinely nothing playing — clear stale content so the card is truthful.
      const bodyText = this.npBodyText(card);
      if (bodyText !== "" && !/nothing scrobbling/i.test(bodyText)) {
        this.setNpBody(card, `<div class="text-center py-12 text-white/30 text-[13px]">Nothing scrobbling right now.</div>`, "empty");
      }
    }
  }

  async boot() {
    this.section.innerHTML = `<div class="dp-card"><div class="dp-loading"><span class="dp-spin"></span>Loading listening stats…</div></div>`;
    const user = await currentUser();
    if (this.disposed) return;
    if (!user) {
      this.section.innerHTML = `<div class="dp-card"><div class="dp-empty">Sign in to load listening stats.</div></div>`;
      return;
    }
    this.fixNowPlaying();
    // React's own fetch may land after ours and repaint the card — re-check soon, then poll.
    this.later(() => this.fixNowPlaying(), 3000);
    this.later(() => this.fixNowPlaying(), 8000);
    this.every(() => this.fixNowPlaying(), 20000);
    const [profile, artists, tracks, genres, albums, recent] = await Promise.all([
      request(`/lastfm/profile/${encodeURIComponent(user.id)}`, { signal: this.signal }).catch(() => null),
      request(`/lastfm/topartists/${encodeURIComponent(user.id)}`, { params: { period: this.period }, signal: this.signal }).catch(() => null),
      request(`/lastfm/toptracks/${encodeURIComponent(user.id)}`, { params: { period: this.period }, signal: this.signal }).catch(() => null),
      request(`/lastfm/genres/${encodeURIComponent(user.id)}`, { signal: this.signal }).catch(() => null),
      request(`/lastfm/topalbums/${encodeURIComponent(user.id)}`, { params: { period: this.period }, signal: this.signal }).catch(() => null),
      request(`/lastfm/recent/${encodeURIComponent(user.id)}`, { params: { limit: 12 }, signal: this.signal }).catch(() => null),
    ]);
    if (this.disposed) return;
    if (!profile) {
      this.section.innerHTML = "";
      return; // React already shows the link-account error; don't duplicate it.
    }
    this.profile = profile;
    this.genres = listFrom(genres, ["genres", "tags"]);
    this.albums = listFrom(albums, ["albums", "topalbums"]);
    this.recent = this.parseRecent(recent);
    this.renderShell();
    this.renderPeriod(artists, tracks);
    this.renderExtras();
  }

  parseRecent(payload) {
    const items = listFrom(payload, ["recent", "tracks", "items", "scrobbles"]);
    if (!items.length && payload?.recenttracks) {
      const t = payload.recenttracks.track;
      const arr = Array.isArray(t) ? t : t ? [t] : [];
      return arr.map((it) => ({
        track: textOf(it.name),
        artist: textOf(it.artist),
        when: it.date?.uts ? Number(it.date.uts) * 1000 : 0,
      })).filter((it) => it.track);
    }
    return items.map((it) => {
      if (typeof it === "string") return { track: it, artist: "", when: 0 };
      const ts = Number(it.uts ?? it.timestamp ?? it.played_at ?? it.date?.uts ?? it.scrobbled_at ?? 0);
      return {
        track: textOf(it.track ?? it.name ?? it.title),
        artist: textOf(it.artist ?? it.artist_name),
        when: ts > 0 ? (ts < 1e12 ? ts * 1000 : ts) : 0,
      };
    }).filter((it) => it.track);
  }

  profileTiles() {
    const p = this.profile || {};
    const scrobbles = numOf(p.playcount ?? p.scrobbles ?? p.total_scrobbles);
    const artists = numOf(p.artist_count ?? p.artists);
    const tracks = numOf(p.track_count ?? p.tracks);
    const tiles = [];
    if (scrobbles) tiles.push(tile(fmtInt(scrobbles), "Scrobbles", scrobbles === 6969 || scrobbles === 69 ? "nice." : ""));
    if (artists) tiles.push(tile(fmtInt(artists), "Artists"));
    if (tracks) tiles.push(tile(fmtInt(tracks), "Tracks"));
    const reg = Number(p.registered ?? p.registered_unix ?? p.member_since ?? 0);
    if (scrobbles && reg) {
      const days = Math.max(1, (Date.now() - (reg < 1e12 ? reg * 1000 : reg)) / 86400000);
      tiles.push(tile((scrobbles / days).toFixed(1), "Avg scrobbles / day"));
    }
    if (scrobbles && artists) tiles.push(tile((artists / (scrobbles / 100)).toFixed(1), "Artists per 100 scrobbles"));
    const topGenre = textOf(this.genres[0]?.name ?? this.genres[0]);
    if (topGenre) tiles.push(tile(esc(topGenre), "Top genre"));
    if (this.genres.length) tiles.push(tile(fmtInt(this.genres.length), "Genres seen"));
    const loved = numOf(p.loved_count ?? p.loved);
    if (loved) tiles.push(tile(fmtInt(loved), "Loved tracks"));
    return tiles.length ? `<div class="dp-grid-4">${tiles.join("")}</div>` : "";
  }

  renderShell() {
    const p = this.profile || {};
    const name = textOf(p.username ?? p.name) || "Your library";
    this.section.innerHTML = `
      <div class="dp-card">
        <div class="dp-card-head">
          <div><h3>Listening stats — ${esc(name)}</h3><p>Deeper cuts from your Last.fm library.</p></div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="dp-updated" data-dp="updated"></span>
            <button class="dp-btn" data-dp="refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>Refresh</button>
          </div>
        </div>
        ${this.profileTiles()}
      </div>
      <div class="dp-card">
        <div class="dp-card-head">
          <div><h3>Top of the period</h3><p>Ranked by scrobbles.</p></div>
          <div class="dp-tabs" data-dp="tabs">${PERIODS.map(([label, value]) => `<button class="dp-tab${value === this.period ? " on" : ""}" data-period="${value}">${label}</button>`).join("")}</div>
        </div>
        <div data-dp="period-body"><div class="dp-loading"><span class="dp-spin"></span>Loading…</div></div>
      </div>
      <div data-dp="extras"></div>`;
    this.on(this.section, "click", (e) => {
      const tab = e.target.closest("[data-period]");
      if (tab) {
        this.period = tab.dataset.period;
        this.section.querySelectorAll("[data-period]").forEach((b) => b.classList.toggle("on", b === tab));
        this.loadPeriod();
        return;
      }
      if (e.target.closest('[data-dp="refresh"]')) this.refreshAll();
    });
    this.stampUpdated();
  }

  stampUpdated() {
    const el = this.section.querySelector('[data-dp="updated"]');
    if (el) el.textContent = `Updated ${clockNow()}`;
  }

  parseTop(payload, keys, artistKey) {
    return listFrom(payload, keys).map((it) => {
      if (typeof it === "string") return { name: it, plays: 0, sub: "", art: "" };
      const plays = numOf(it.playcount ?? it.plays ?? it.count ?? it.scrobbles);
      const art = typeof it.image === "string" ? it.image : Array.isArray(it.image) ? textOf(it.image[it.image.length - 1]) : textOf(it.artwork ?? it.image);
      return {
        name: textOf(it.name ?? it.title ?? it.track) || "Unknown",
        sub: artistKey ? "" : textOf(it.artist ?? it.artist_name),
        plays,
        art: /^https?:\/\//.test(art) ? art : "",
      };
    }).filter((it) => it.name && it.name !== "Unknown");
  }

  periodSummary(list) {
    if (!list.length) return "";
    const total = list.reduce((a, it) => a + numOf(it.plays), 0);
    if (!total) return "";
    const share = ((numOf(list[0].plays) / total) * 100).toFixed(1);
    return `<div class="dp-note">${fmtInt(total)} plays across top ${list.length} · #1 holds ${share}%</div>`;
  }

  async loadPeriod() {
    const body = this.section.querySelector('[data-dp="period-body"]');
    if (body) body.innerHTML = `<div class="dp-loading"><span class="dp-spin"></span>Loading…</div>`;
    const user = await currentUser();
    if (!user || this.disposed) return;
    const [artists, tracks] = await Promise.all([
      request(`/lastfm/topartists/${encodeURIComponent(user.id)}`, { params: { period: this.period }, signal: this.signal }).catch(() => null),
      request(`/lastfm/toptracks/${encodeURIComponent(user.id)}`, { params: { period: this.period }, signal: this.signal }).catch(() => null),
    ]);
    if (this.disposed) return;
    this.renderPeriod(artists, tracks);
    this.stampUpdated();
  }

  renderPeriod(artistsPayload, tracksPayload) {
    const body = this.section.querySelector('[data-dp="period-body"]');
    if (!body) return;
    if (artistsPayload === null && tracksPayload === null) {
      body.innerHTML = `<div class="dp-err">Could not load this period. Try again.</div>`;
      return;
    }
    const artists = this.parseTop(artistsPayload, ["artists", "topartists"], true).slice(0, 15);
    const tracks = this.parseTop(tracksPayload, ["tracks", "toptracks"], false).slice(0, 15);
    body.innerHTML = `<div class="dp-grid-2">
      <div><h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Top artists</h3>
        ${artists.length ? rankRows(artists.map((a) => ({ name: a.name, value: a.plays, art: a.art })), { color: "#00b8ff" }) + this.periodSummary(artists) : `<div class="dp-empty">No artist data for this period.</div>`}</div>
      <div><h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Top tracks</h3>
        ${tracks.length ? rankRows(tracks.map((t) => ({ name: t.name, sub: t.sub, value: t.plays, art: t.art })), { color: "#a855f7" }) + this.periodSummary(tracks) : `<div class="dp-empty">No track data for this period.</div>`}</div>
    </div>`;
  }

  renderExtras() {
    const slot = this.section.querySelector('[data-dp="extras"]');
    if (!slot) return;
    let html = "";
    const genreItems = this.genres.map((g) => {
      if (typeof g === "string") return { name: g, plays: 0 };
      return { name: textOf(g.name ?? g.tag), plays: numOf(g.playcount ?? g.count ?? g.plays) };
    }).filter((g) => g.name);
    const withCounts = genreItems.filter((g) => g.plays > 0);
    if (withCounts.length >= 3) {
      html += `<div class="dp-card"><div class="dp-card-head"><div><h3>Genre mix</h3><p>Where your scrobbles go.</p></div></div>`
        + rankRows(withCounts.slice(0, 12).map((g) => ({ name: g.name, value: g.plays })), { color: "#22c55e" }) + `</div>`;
    }
    const albums = listFrom(this.albums, []).map((a) => {
      if (typeof a === "string") return { name: a, artist: "", plays: 0, art: "" };
      const art = typeof a.image === "string" ? a.image : Array.isArray(a.image) ? textOf(a.image[a.image.length - 1]) : "";
      return { name: textOf(a.name ?? a.title), artist: textOf(a.artist), plays: numOf(a.playcount ?? a.plays), art: /^https?:\/\//.test(art) ? art : "" };
    }).filter((a) => a.name).slice(0, 10);
    if (albums.length >= 3) {
      html += `<div class="dp-card"><div class="dp-card-head"><div><h3>Top albums</h3><p>Most played records this period.</p></div></div>`
        + `<div class="dp-albums">${albums.map((a) => `<div class="dp-album">${a.art ? `<img src="${esc(a.art)}" alt="" loading="lazy">` : `<div class="dp-album-fb">♫</div>`}<strong title="${esc(a.name)}">${esc(a.name)}</strong><span>${esc(a.artist)}${a.plays ? ` · ${fmtInt(a.plays)}` : ""}</span></div>`).join("")}</div></div>`;
    }
    if (this.recent.length) {
      html += `<div class="dp-card"><div class="dp-card-head"><div><h3>Recent scrobbles</h3><p>Latest activity.</p></div></div>`
        + `<div class="dp-rows">${this.recent.slice(0, 12).map((r) => `<div class="dp-row" style="grid-template-columns:minmax(0,1fr) auto"><div class="dp-row-main"><div class="dp-row-name">${esc(r.track)}</div>${r.artist ? `<div class="dp-row-sub">${esc(r.artist)}</div>` : ""}</div><span class="dp-row-val">${r.when ? timeAgo(r.when) : ""}</span></div>`).join("")}</div></div>`;
    }
    slot.innerHTML = html;
  }

  async refreshAll() {
    const user = await currentUser();
    if (!user || this.disposed) return;
    this.fixNowPlaying();
    await this.loadPeriod();
  }
}

/* ================= Stocks ================= */

// localStorage: the diary where stock prices confess their secrets.
const HIST_KEY = "rift_stock_hist_v1";
const HIST_MAX_POINTS = 720;
const HIST_MAX_AGE = 60 * 86400000;

function loadHist() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIST_KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const cutoff = Date.now() - HIST_MAX_AGE;
    for (const sym of Object.keys(raw)) {
      if (!Array.isArray(raw[sym])) { delete raw[sym]; continue; }
      raw[sym] = raw[sym].filter((p) => Array.isArray(p) && p[1] > 0 && p[0] > cutoff).slice(-HIST_MAX_POINTS);
      if (!raw[sym].length) delete raw[sym];
    }
    return raw;
  } catch {
    return {};
  }
}

let histSaveTimer = 0;
function saveHist(hist) {
  clearTimeout(histSaveTimer);
  histSaveTimer = setTimeout(() => {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch { /* quota */ }
  }, 800);
}

class StocksPlus extends PlusModule {
  constructor(main, guildId) {
    super(main, guildId);
    this.hist = loadHist();
    this.market = [];
    this.portfolio = null;
    this.leaders = [];
    this.symbol = "";
    this.sortMode = "default";
    this.filter = "";
    this.boot();
  }

  snapshot(market) {
    const now = Date.now();
    let changed = false;
    for (const s of market) {
      const price = numOf(s.price);
      if (!s.symbol || price <= 0) continue;
      const arr = this.hist[s.symbol] || (this.hist[s.symbol] = []);
      const last = arr[arr.length - 1];
      if (!last || last[1] !== price || now - last[0] > 300000) {
        arr.push([now, price]);
        if (arr.length > HIST_MAX_POINTS) arr.splice(0, arr.length - HIST_MAX_POINTS);
        changed = true;
      }
    }
    if (changed) saveHist(this.hist);
  }

  series(sym) {
    return (this.hist[sym] || []).filter((p) => p[1] > 0);
  }

  changeOf(sym) {
    const pts = this.series(sym);
    if (pts.length < 2) return null;
    const first = pts[0][1];
    const last = pts[pts.length - 1][1];
    return { abs: last - first, pct: first ? ((last - first) / first) * 100 : 0, first, last };
  }

  async boot() {
    this.section.innerHTML = `<div class="dp-card"><div class="dp-loading"><span class="dp-spin"></span>Loading market data…</div></div>`;
    await this.loadAll();
    if (this.disposed) return;
    this.render();
    this.every(async () => {
      try {
        const m = await request("/stocks/market", { signal: this.signal });
        const market = listFrom(m, ["stocks", "market"]);
        if (market.length && !this.disposed) {
          this.market = market.map((s) => ({ symbol: String(s.symbol || ""), name: textOf(s.name), price: numOf(s.price) })).filter((s) => s.symbol);
          this.snapshot(this.market);
          this.updateAll();
        }
      } catch { /* keep last snapshot on failure */ }
    }, 30000);
  }

  async loadAll() {
    const user = await currentUser();
    const [m, p, l] = await Promise.all([
      request("/stocks/market", { signal: this.signal }).catch(() => null),
      user ? request(`/stocks/portfolio/${encodeURIComponent(user.id)}`, { signal: this.signal }).catch(() => null) : null,
      request("/stocks/leaderboard", { signal: this.signal }).catch(() => null),
    ]);
    if (this.disposed) return;
    this.market = listFrom(m, ["stocks", "market"]).map((s) => ({
      symbol: String(s.symbol || ""), name: textOf(s.name), price: numOf(s.price),
    })).filter((s) => s.symbol);
    this.portfolio = p;
    this.leaders = listFrom(l, ["leaderboard", "traders", "users"]);
    this.snapshot(this.market);
    if (!this.symbol || !this.market.some((s) => s.symbol === this.symbol)) {
      const holding = (this.portfolio?.holdings || []).find((h) => this.market.some((s) => s.symbol === h.symbol))?.symbol;
      this.symbol = holding || this.market[0]?.symbol || "";
    }
  }

  symTabsHTML() {
    return this.market.map((s) => `<button class="dp-tab${s.symbol === this.symbol ? " on" : ""}" data-sym="${esc(s.symbol)}">${esc(s.symbol)}</button>`).join("");
  }

  bindOnce() {
    if (this.bound) return;
    this.bound = true;
    this.on(this.section, "click", (e) => {
      const b = e.target.closest("[data-sym]");
      if (!b) return;
      this.symbol = b.dataset.sym;
      this.section.querySelectorAll('[data-dp="syms"] [data-sym]').forEach((x) => x.classList.toggle("on", x.dataset.sym === this.symbol));
      this.renderBig();
      if (b.closest('[data-dp="table"]')) {
        this.section.querySelector('[data-dp="bigchart"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    this.on(this.section, "input", (e) => {
      if (e.target.matches('[data-dp="filter"]')) {
        this.filter = e.target.value;
        this.renderTable();
        const eggs = window.__riftEggs;
        if (eggs) {
          const q = this.filter.trim().toLowerCase();
          if (q === "stonks") eggs.toast("stonks.");
          else if (q === "moon" || q === "to the moon") eggs.toast("to the moon. (source: trust me)");
          else if (q === "lambo") eggs.toast("when lambo");
        }
      }
    });
    this.on(this.section, "change", (e) => {
      if (e.target.matches('[data-dp="sort"]')) {
        this.sortMode = e.target.value;
        this.renderTable();
      }
    });
  }

  updateAll() {
    const syms = this.section.querySelector('[data-dp="syms"]');
    if (syms) syms.innerHTML = this.symTabsHTML();
    const clock = this.section.querySelector('[data-dp="clock"]');
    if (clock) clock.textContent = `Updated ${clockNow()}`;
    this.renderBig();
    this.renderStats();
    this.renderLeaders();
    this.renderTable();
    this.renderMix();
  }

  render() {
    if (!this.market.length && !this.portfolio && !this.leaders.length) {
      this.section.innerHTML = `<div class="dp-card"><div class="dp-empty">Market data is unavailable right now.</div></div>`;
      return;
    }
    // Shell is built once; polls only refresh the panels (keeps input focus).
    this.section.innerHTML = `
      <div class="dp-card">
        <div class="dp-card-head">
          <div><h3>Price chart</h3><p>Collected from live market snapshots.</p></div>
          <span class="dp-updated" data-dp="clock">Updated ${clockNow()}</span>
        </div>
        <div class="dp-tabs" data-dp="syms" style="margin-bottom:14px;max-height:76px;overflow-y:auto"></div>
        <div data-dp="bigstats"></div>
        <div class="dp-chart-wrap" data-dp="bigchart" style="margin-top:8px"></div>
        <div class="dp-note" data-dp="bignote"></div>
      </div>
      <div class="dp-grid-2">
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Market stats</h3></div></div>
          <div data-dp="mstats"></div>
        </div>
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Top traders</h3><p>By net worth.</p></div></div>
          <div data-dp="leaders"></div>
        </div>
      </div>
      <div class="dp-card">
        <div class="dp-card-head">
          <div><h3>All listings</h3><p>Every stock with its trend.</p></div>
          <div style="display:flex;gap:8px">
            <input class="dp-input" data-dp="filter" placeholder="Filter" value="${esc(this.filter)}" style="width:130px">
            <select class="dp-select" data-dp="sort">
              <option value="default"${this.sortMode === "default" ? " selected" : ""}>Listed order</option>
              <option value="price"${this.sortMode === "price" ? " selected" : ""}>Price ↓</option>
              <option value="change"${this.sortMode === "change" ? " selected" : ""}>Change ↓</option>
            </select>
          </div>
        </div>
        <div data-dp="table"></div>
        <div class="dp-note">Change is measured from your first collected snapshot for each stock. History grows the more you visit.</div>
      </div>
      <div class="dp-card">
        <div class="dp-card-head"><div><h3>Portfolio mix</h3><p>How your net worth is split.</p></div></div>
        <div data-dp="mix"></div>
      </div>`;
    this.bindOnce();
    this.updateAll();
  }

  renderBig() {
    const wrap = this.section.querySelector('[data-dp="bigchart"]');
    const stats = this.section.querySelector('[data-dp="bigstats"]');
    const note = this.section.querySelector('[data-dp="bignote"]');
    if (!wrap) return;
    const pts = this.series(this.symbol);
    const live = this.market.find((s) => s.symbol === this.symbol);
    if (!this.symbol) {
      if (stats) stats.innerHTML = "";
      wrap.innerHTML = `<div class="dp-empty">No market listings right now.</div>`;
      if (note) note.textContent = "";
      return;
    }
    if (pts.length < 2) {
      if (stats) stats.innerHTML = `<div class="dp-grid-4">${tile(live ? fmtMoney(live.price) : "—", `${this.symbol} · live price`)}</div>`;
      wrap.innerHTML = `<div class="dp-empty">Collecting history for ${esc(this.symbol)} — the chart appears after a few snapshots.</div>`;
      if (note) note.textContent = "";
      return;
    }
    const values = pts.map((p) => p[1]);
    const labels = pts.map((p) => {
      const d = new Date(p[0]);
      return `${MONTHS[d.getMonth()]} ${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const first = values[0];
    const last = values[values.length - 1];
    const chg = this.changeOf(this.symbol);
    const color = chg && chg.abs > 0 ? "#22c55e" : chg && chg.abs < 0 ? "#ef4444" : "#00b8ff";
    if (stats) {
      stats.innerHTML = `<div class="dp-grid-4">`
        + tile(fmtMoney(last), "Live price", chg ? `<span class="${chg.abs > 0 ? "dp-up" : chg.abs < 0 ? "dp-down" : "dp-flat"}">${signed(chg.abs)} (${signed(chg.pct.toFixed(2))}%)</span>` : "")
        + tile(fmtMoney(Math.max(...values)), "High")
        + tile(fmtMoney(Math.min(...values)), "Low")
        + tile(fmtMoney(values.reduce((a, v) => a + v, 0) / values.length), "Average")
        + `</div>`;
    }
    areaChart(wrap, {
      values, labels, color, height: 210,
      formatTip: (v) => `<strong>${esc(fmtMoney(v))}</strong>`,
    });
    if (note) note.textContent = `Tracking since ${labels[0]} · ${pts.length} snapshots.`;
    void first;
  }

  renderStats() {
    const slot = this.section.querySelector('[data-dp="mstats"]');
    if (!slot) return;
    const prices = this.market.map((s) => s.price).filter((p) => p > 0);
    if (!prices.length) {
      slot.innerHTML = `<div class="dp-empty">No listings.</div>`;
      return;
    }
    const sorted = [...this.market].sort((a, b) => b.price - a.price);
    const movers = this.market.map((s) => ({ s, c: this.changeOf(s.symbol) })).filter((x) => x.c).sort((a, b) => b.c.pct - a.c.pct);
    const top = movers[0];
    const flop = movers[movers.length - 1];
    slot.innerHTML = `<div class="dp-grid-2" style="grid-template-columns:repeat(2,minmax(0,1fr))">`
      + tile(fmtInt(this.market.length), "Listings")
      + tile(fmtMoney(prices.reduce((a, v) => a + v, 0) / prices.length), "Average price")
      + tile(esc(sorted[0].symbol), "Highest", fmtMoney(sorted[0].price))
      + tile(esc(sorted[sorted.length - 1].symbol), "Lowest", fmtMoney(sorted[sorted.length - 1].price))
      + tile(top ? esc(top.s.symbol) : "—", "Biggest gainer", top ? `<span class="dp-up">+${top.c.pct.toFixed(1)}%</span>` : "collecting")
      + tile(flop && movers.length > 1 ? esc(flop.s.symbol) : "—", "Biggest loser", flop && movers.length > 1 ? `<span class="dp-down">${flop.c.pct.toFixed(1)}%</span>` : "collecting")
      + `</div>`;
  }

  renderLeaders() {
    const slot = this.section.querySelector('[data-dp="leaders"]');
    if (!slot) return;
    const rows = this.leaders.map((l) => ({
      name: textOf(l.username ?? l.name ?? l.user) || "Unknown",
      value: numOf(l.net_worth ?? l.balance ?? l.worth),
    })).filter((r) => r.name !== "Unknown").slice(0, 12);
    if (!rows.length) {
      slot.innerHTML = `<div class="dp-empty">No traders yet.</div>`;
      return;
    }
    const me = (cachedUser?.username || "").toLowerCase();
    const max = Math.max(1, ...rows.map((r) => r.value));
    slot.innerHTML = `<div class="dp-rows">${rows.map((r, i) => {
      const isMe = me && r.name.toLowerCase() === me;
      const pct = Math.max(2, (r.value / max) * 100);
      return `<div class="dp-row"><span class="dp-rank">${i + 1}</span><div class="dp-row-main">`
        + `<div class="dp-row-name">${esc(r.name)}${isMe ? ` <span style="color:#00b8ff;font-size:10px">· you</span>` : ""}</div>`
        + `<div class="dp-bar"><i style="width:${pct.toFixed(1)}%;background:${isMe ? "#00b8ff" : "rgba(255,255,255,0.35)"}"></i></div></div>`
        + `<span class="dp-row-val">${fmtMoney(r.value)}</span></div>`;
    }).join("")}</div>`;
  }

  renderTable() {
    const slot = this.section.querySelector('[data-dp="table"]');
    if (!slot) return;
    let rows = [...this.market];
    if (this.filter.trim()) {
      const q = this.filter.trim().toLowerCase();
      rows = rows.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (this.sortMode === "price") rows.sort((a, b) => b.price - a.price);
    else if (this.sortMode === "change") {
      rows.sort((a, b) => (this.changeOf(b.symbol)?.pct ?? -Infinity) - (this.changeOf(a.symbol)?.pct ?? -Infinity));
    }
    if (!rows.length) {
      slot.innerHTML = `<div class="dp-empty">No stocks match.</div>`;
      return;
    }
    slot.innerHTML = `<table class="dp-table"><thead><tr><th>Symbol</th><th>Name</th><th style="text-align:right">Price</th><th style="text-align:right">Change</th><th>Trend</th><th></th></tr></thead><tbody>`
      + rows.map((s) => {
        const c = this.changeOf(s.symbol);
        const chg = c ? `<span class="${c.abs > 0 ? "dp-up" : c.abs < 0 ? "dp-down" : "dp-flat"}">${signed(c.pct.toFixed(1))}%</span>` : `<span class="dp-flat">—</span>`;
        const spark = sparkSVG(this.series(s.symbol).map((p) => p[1]));
        return `<tr><td class="dp-sym">${esc(s.symbol)}</td><td class="dp-muted">${esc(s.name || "—")}</td>`
          + `<td class="dp-num">${fmtMoney(s.price)}</td><td class="dp-num">${chg}</td><td>${spark}</td>`
          + `<td style="text-align:right"><button class="dp-btn" data-sym="${esc(s.symbol)}" style="min-height:26px">Chart</button></td></tr>`;
      }).join("") + `</tbody></table>`;
  }

  renderMix() {
    const slot = this.section.querySelector('[data-dp="mix"]');
    if (!slot) return;
    const p = this.portfolio;
    if (!p) {
      slot.innerHTML = `<div class="dp-empty">Sign in to see your portfolio mix.</div>`;
      return;
    }
    const holdings = (p.holdings || []).map((h) => ({
      label: String(h.symbol || "?"),
      value: numOf(h.value ?? h.worth ?? (numOf(h.qty) * (this.market.find((s) => s.symbol === h.symbol)?.price || 0))),
    })).filter((h) => h.value > 0);
    const cash = numOf(p.cash);
    const segs = [...holdings.map((h, i) => ({ ...h, color: PALETTE[i % PALETTE.length] }))];
    if (cash > 0) segs.push({ label: "Cash", value: cash, color: "rgba(255,255,255,0.35)" });
    const net = numOf(p.net_worth ?? p.netWorth);
    donut(slot, { segments: segs, centerTop: compact(net || segs.reduce((a, s) => a + s.value, 0)), centerSub: "net worth" });
  }
}

/* ================= Overview ================= */

class OverviewPlus extends PlusModule {
  constructor(main, guildId) {
    super(main, guildId);
    this.boot();
  }

  seriesOf(a, key) {
    const raw = a?.[key];
    if (!Array.isArray(raw)) return [];
    return raw.map(numOf).filter((v) => Number.isFinite(v));
  }

  sumTail(values, n) {
    return values.slice(-n).reduce((a, v) => a + v, 0);
  }

  peak(values, dates) {
    if (!values.length) return null;
    let bi = 0;
    values.forEach((v, i) => { if (v > values[bi]) bi = i; });
    return { i: bi, value: values[bi], label: fmtDay(dates[bi]) };
  }

  async boot() {
    this.section.innerHTML = `<div class="dp-card"><div class="dp-loading"><span class="dp-spin"></span>Crunching server activity…</div></div>`;
    const [a, info] = await Promise.all([
      request(`/analytics/${encodeURIComponent(this.guildId)}`, { signal: this.signal }).catch(() => null),
      request(`/guild/${encodeURIComponent(this.guildId)}/info`, { signal: this.signal }).catch(() => null),
    ]);
    if (this.disposed) return;
    const dates = Array.isArray(a?.dates) ? a.dates : [];
    const joins = this.seriesOf(a, "joins");
    const leaves = this.seriesOf(a, "leaves");
    const messages = this.seriesOf(a, "messages");
    const voice = this.seriesOf(a, "voice");
    if (!dates.length || (!joins.length && !messages.length && !voice.length)) {
      this.section.innerHTML = `<div class="dp-card"><div class="dp-empty">No analytics data for this server yet.</div></div>`;
      return;
    }
    const labels = dates.map(fmtDay);
    const net = joins.map((j, i) => j - (leaves[i] || 0));
    const cum = [];
    net.forEach((v, i) => cum.push((cum[i - 1] || 0) + v));
    const tot = (arr) => arr.reduce((x, y) => x + y, 0);
    const avg = (arr) => arr.length ? (tot(arr) / arr.length) : 0;
    const trend = (arr) => trendText(this.sumTail(arr, 7), tot(arr.slice(-14, -7)));
    const peakMsg = this.peak(messages, dates);
    const peakNet = this.peak(net, dates);
    const channels = listFrom(info, ["channels"]);
    const textCh = channels.filter((c) => String(c.type) === "0" || c.type === "text").length;
    const voiceCh = channels.filter((c) => String(c.type) === "2" || c.type === "voice").length;
    const roles = listFrom(info, ["roles"]).length;

    this.section.innerHTML = `
      <div class="dp-card">
        <div class="dp-card-head">
          <div><h3>Activity deep dive</h3><p>${esc(a.guild_name || "This server")} · last ${dates.length} days · <span class="dp-updated">7-day trend vs prior 7 days</span></p></div>
        </div>
        <div class="dp-grid-4">
          ${tile(signed(tot(net)), "Net growth", trend(net) + (tot(net) === 69 ? ' \u00b7 <span>nice.</span>' : ""))}
          ${tile(fmtInt(tot(joins)), "Joins", `${avg(joins).toFixed(1)}/day · ${trend(joins)}`)}
          ${tile(fmtInt(tot(leaves)), "Leaves", `${avg(leaves).toFixed(1)}/day · ${trend(leaves)}`)}
          ${tile(compact(tot(messages)), "Messages", `${compact(avg(messages))}/day · ${trend(messages)}`)}
          ${tile(compact(tot(voice)), "Voice minutes", `${compact(avg(voice))}/day · ${trend(voice)}`)}
          ${tile(peakMsg ? fmtInt(peakMsg.value) : "—", "Peak messages", peakMsg ? esc(peakMsg.label) : "")}
          ${tile(peakNet ? signed(peakNet.value) : "—", "Best growth day", peakNet ? esc(peakNet.label) : "")}
          ${tile(channels.length ? fmtInt(channels.length) : (textCh || voiceCh ? fmtInt(textCh + voiceCh) : "—"), "Channels", (textCh || voiceCh) ? `${textCh} text · ${voiceCh} voice` : (roles ? `${roles} roles` : ""))}
        </div>
      </div>
      <div class="dp-card">
        <div class="dp-card-head"><div><h3>Member growth</h3><p>Daily net change with running total.</p></div></div>
        <div class="dp-chart-wrap" data-dp="combo"></div>
      </div>
      <div class="dp-grid-2">
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Joins vs leaves</h3></div></div>
          <div class="dp-chart-wrap" data-dp="jl"></div>
        </div>
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Engagement mix</h3><p>Share of total activity.</p></div></div>
          <div data-dp="mix"></div>
        </div>
      </div>
      <div class="dp-grid-2">
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Messages</h3><p>${peakMsg ? `Peak ${esc(peakMsg.label)} · ${fmtInt(peakMsg.value)}` : ""}</p></div></div>
          <div class="dp-chart-wrap" data-dp="msgs"></div>
        </div>
        <div class="dp-card" style="margin-top:0">
          <div class="dp-card-head"><div><h3>Voice minutes</h3></div></div>
          <div class="dp-chart-wrap" data-dp="voice"></div>
        </div>
      </div>`;
    comboChart(this.section.querySelector('[data-dp="combo"]'), { bars: net, line: cum, labels, height: 210 });
    groupBars(this.section.querySelector('[data-dp="jl"]'), {
      labels, height: 210,
      a: { name: "Joins", color: "#22c55e", values: joins },
      b: { name: "Leaves", color: "#ef4444", values: leaves },
    });
    areaChart(this.section.querySelector('[data-dp="msgs"]'), {
      values: messages, labels, color: "#00b8ff", height: 180,
      formatTip: (v) => `<strong>${esc(fmtInt(v))}</strong> messages`,
    });
    areaChart(this.section.querySelector('[data-dp="voice"]'), {
      values: voice, labels, color: "#a855f7", height: 180,
      formatTip: (v) => `<strong>${esc(fmtInt(v))}</strong> minutes`,
    });
    donut(this.section.querySelector('[data-dp="mix"]'), {
      centerTop: compact(tot(messages) + tot(voice)),
      centerSub: "total activity",
      segments: [
        { label: "Messages", value: tot(messages), color: "#00b8ff" },
        { label: "Voice minutes", value: tot(voice), color: "#a855f7" },
      ],
    });
  }
}

/* ---------------- route sync ---------------- */

let active = null;

function detectRoute() {
  const m = window.location.pathname.match(/^\/g\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const sub = m[2] || "";
  if (sub === "" || sub === "lastfm" || sub === "stocks") {
    return { guildId: decodeURIComponent(m[1]), page: sub === "" ? "overview" : sub };
  }
  return null;
}

function pageReady(page) {
  const main = document.querySelector("main");
  if (!main) return null;
  const h1 = main.querySelector(":scope > div > h1, h1");
  if (!h1) return null;
  const title = h1.textContent.trim().toLowerCase();
  const want = page === "overview" ? "overview" : page === "lastfm" ? "last.fm" : "stocks";
  if (title !== want) return null;
  if (main.querySelector(":scope > .dp-section")) return null; // already mounted
  return main;
}

function sync() {
  const route = detectRoute();
  if (!route) {
    if (active) { active.dispose(); active = null; }
    return;
  }
  if (active && active.key === `${route.page}:${route.guildId}` && active.main.isConnected) return;
  if (active) { active.dispose(); active = null; }
  // React may still be rendering — retry briefly until the page header exists.
  let tries = 0;
  const attempt = () => {
    if (active) return;
    const still = detectRoute();
    if (!still || still.page !== route.page || still.guildId !== route.guildId) return;
    const main = pageReady(route.page);
    if (!main) {
      if (++tries < 25) setTimeout(attempt, 200);
      return;
    }
    const Cls = route.page === "lastfm" ? LastFmPlus : route.page === "stocks" ? StocksPlus : OverviewPlus;
    active = new Cls(main, route.guildId);
    active.key = `${route.page}:${route.guildId}`;
    active.main = main;
  };
  attempt();
}

function install() {
  console.log("dash plus loaded. charts charts charts.");
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const result = origPush.apply(this, args);
    window.dispatchEvent(new Event("dp:route"));
    return result;
  };
  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const result = origReplace.apply(this, args);
    window.dispatchEvent(new Event("dp:route"));
    return result;
  };
  let t = 0;
  const debounced = () => { clearTimeout(t); t = setTimeout(sync, 200); };
  window.addEventListener("popstate", debounced);
  window.addEventListener("dp:route", debounced);
  const observer = new MutationObserver(debounced);
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
  sync();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();
