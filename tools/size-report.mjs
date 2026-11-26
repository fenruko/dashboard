#!/usr/bin/env node
/* Dev-only size report. Walks the STATIC import graph from index.html
 * (scripts, stylesheets, modulepreload, static `import`/`export … from`) and
 * prints request count, raw and gzip bytes and module count. Dynamic
 * `import()` targets are listed separately as lazy chunks.
 *
 *   node tools/size-report.mjs                 # working tree
 *   node tools/size-report.mjs --ref master    # a git ref (before/after compare)
 *   node tools/size-report.mjs --json
 *
 * Not needed to deploy: the site is served straight from the repo root. */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = posix.join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const refIdx = args.indexOf("--ref");
const ref = refIdx >= 0 ? args[refIdx + 1] : null;
const asJson = args.includes("--json");

function read(path) {
  if (ref) {
    try {
      return execFileSync("git", ["-C", root, "show", `${ref}:${path}`], { maxBuffer: 1 << 26 });
    } catch {
      return null;
    }
  }
  const full = posix.join(root, path);
  return existsSync(full) ? readFileSync(full) : null;
}

const resolveRef = (from, spec) => {
  if (/^(https?:)?\/\//.test(spec) || spec.startsWith("data:")) return null;
  const clean = spec.split(/[?#]/)[0];
  return clean.startsWith("/") ? clean.slice(1) : posix.join(posix.dirname(from), clean);
};

function scanJs(text) {
  const stat = new Set();
  const dyn = new Set();
  const noStrings = text; // specifiers are string literals; comments rarely contain import lines
  for (const m of noStrings.matchAll(/(?:^|[;\n}])\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?["']([^"']+)["']/g)) stat.add(m[1]);
  for (const m of noStrings.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) dyn.add(m[1]);
  for (const m of noStrings.matchAll(/\bimport\(\s*(?:\/\*[^*]*\*\/\s*)?`?\.?\/?[^)]*\)/g)) void m;
  return { stat, dyn };
}

const files = new Map(); // path -> { raw, gzip, kind }
const lazy = new Set();
function add(path, kind) {
  if (files.has(path)) return false;
  const buf = read(path);
  if (!buf) return false;
  files.set(path, { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length, kind });
  return buf;
}
function walkJs(path) {
  const buf = add(path, "js");
  if (!buf) return;
  const { stat, dyn } = scanJs(buf.toString("utf8"));
  for (const spec of stat) {
    const p = resolveRef(path, spec);
    if (p) walkJs(p);
  }
  for (const spec of dyn) {
    const p = resolveRef(path, spec);
    if (p) lazy.add(p);
  }
}
function walkCss(path) {
  const buf = add(path, "css");
  if (!buf) return;
  const text = buf.toString("utf8");
  for (const m of text.matchAll(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?/g)) {
    const p = resolveRef(path, m[1]);
    if (p) walkCss(p);
  }
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
    const p = resolveRef(path, m[1]);
    if (p) add(p, "font");
  }
}

const html = read("index.html")?.toString("utf8");
if (!html) throw new Error("index.html not found");
add("index.html", "html");
for (const m of html.matchAll(/<link\b[^>]*>/g)) {
  const tag = m[0];
  const href = /href="([^"]+)"/.exec(tag)?.[1];
  if (!href) continue;
  const p = resolveRef("index.html", href);
  if (!p) continue;
  if (/rel="stylesheet"/.test(tag)) walkCss(p);
  else if (/rel="modulepreload"/.test(tag)) walkJs(p);
  else if (/rel="preload"/.test(tag)) add(p, /as="font"/.test(tag) ? "font" : "other");
}
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
  const p = resolveRef("index.html", m[1]);
  if (p && /\.m?js$/.test(p)) {
    if (/type="module"/.test(m[0])) walkJs(p);
    else add(p, "js");
  }
}
// Inline <style> counts toward bytes of the HTML already.
for (const m of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
  const p = resolveRef("index.html", m[1]);
  if (p) add(p, "img");
}

const sum = (pred = () => true) => {
  const rows = [...files].filter(([p, v]) => pred(v, p));
  return { requests: rows.length, raw: rows.reduce((a, [, v]) => a + v.raw, 0), gzip: rows.reduce((a, [, v]) => a + v.gzip, 0) };
};
const result = {
  ref: ref || "working tree",
  total: sum(),
  js: sum((v) => v.kind === "js"),
  css: sum((v) => v.kind === "css"),
  modules: [...files.values()].filter((v) => v.kind === "js").length,
  lazyChunks: [...lazy].filter((p) => !files.has(p)).sort(),
  files: Object.fromEntries([...files].map(([p, v]) => [p, v])),
};
// first-load graph WITH the default signed-in route (/guilds)
for (const entry of ["assets/app/pages/guilds.js"]) {
  if (!files.has(entry)) {
    const before = new Set(files.keys());
    walkJs(entry);
    const added = [...files.keys()].filter((k) => !before.has(k));
    for (const k of added) if (files.get(k).kind === "js") lazy.delete(k);
    result.withGuildsRoute = { ...sum(), extraRequests: added.length };
  }
}

if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  const kb = (n) => (n / 1024).toFixed(1).padStart(7) + " KB";
  console.log(`Static first-load graph (${result.ref})`);
  console.log(`  requests : ${result.total.requests}   JS modules: ${result.modules}`);
  console.log(`  raw      :${kb(result.total.raw)}   (JS${kb(result.js.raw)}, CSS${kb(result.css.raw)})`);
  console.log(`  gzip     :${kb(result.total.gzip)}   (JS${kb(result.js.gzip)}, CSS${kb(result.css.gzip)})`);
  if (result.withGuildsRoute) console.log(`  + default route (/guilds) lazy chunk(s): ${result.withGuildsRoute.requests} requests, ${kb(result.withGuildsRoute.raw)} raw, ${kb(result.withGuildsRoute.gzip)} gzip`);
  console.log(`  lazy chunks not in first load: ${result.lazyChunks.length}`);
  for (const [p, v] of Object.entries(result.files).sort((a, b) => b[1].raw - a[1].raw).slice(0, 12)) console.log(`    ${p.padEnd(42)} ${kb(v.raw)} ${kb(v.gzip)} gz`);
}
