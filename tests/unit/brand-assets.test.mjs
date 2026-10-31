import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const index = readFileSync("index.html", "utf8");
const css = readFileSync("assets/app/app.css", "utf8");
const app = readFileSync("assets/app/app.js", "utf8");
const login = readFileSync("assets/app/pages/login.js", "utf8");

test("the dashboard ships the real Rift logo as its brand mark", () => {
  assert.match(app, /brand-mark brand-logo[^>]*riftlogo\.jpg/, "shell uses the logo image");
  assert.match(login, /brand-mark brand-logo[^>]*riftlogo\.jpg/, "sign-in uses the logo image");
  assert.match(index, /rel="icon"[^>]+riftlogo\.jpg/, "favicon uses the logo");
  assert.equal(existsSync("assets/riftlogo.jpg"), true);
  assert.ok(statSync("assets/riftlogo.jpg").size > 1000);
});

test("fonts are self-hosted and never loaded from a broken CDN", () => {
  assert.equal(/fontshare|satoshi/i.test(index), false, "no fontshare stylesheet or preconnect");
  assert.equal(/fontshare/i.test(css), false);
  assert.match(css, /@font-face\s*\{[^}]*font-family:\s*"InterVariable"[^}]*font-weight:\s*100 900/);
  assert.match(css, /url\("\/assets\/fonts\/inter-latin-variable\.woff2"\)/);
  assert.match(css, /--font:\s*"InterVariable"/);
  assert.equal(existsSync("assets/fonts/inter-latin-variable.woff2"), true);
  assert.ok(statSync("assets/fonts/inter-latin-variable.woff2").size > 20_000);
  assert.equal(existsSync("assets/fonts/Inter-LICENSE.txt"), true);
});
