/* The blog popup: shown once per post, safe with odd input, and the catch-up
 * check only surfaces recent published posts. */

import test from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./harness.mjs";

installDom();
const { showBlogNotification, checkLatestBlogPost, blogPostUrl, blogImageUrl } = await import("../../assets/app/ui/blog-notify.js");

const API = "https://api.test/api";
const post = (over = {}) => ({ id: 7, slug: "hello-world", title: "Hello world", excerpt: "A short summary.", banner_id: 3, status: "published", published_at: 1000, ...over });

function reset() {
  document.getElementById("blog-notice-root")?.remove();
  localStorage.clear();
}

test("shows title, summary, thumbnail and a link to the post", () => {
  reset();
  const node = showBlogNotification(post(), { apiBase: API });
  assert.ok(node);
  assert.match(node.textContent, /Hello world/);
  assert.match(node.textContent, /A short summary\./);
  assert.equal(node.querySelector("img").getAttribute("src"), `${API}/blog/images/3`);
  assert.equal(node.querySelector("a").getAttribute("href"), "https://rift.cool/blog/hello-world");
});

test("falls back to an icon when the post has no banner", () => {
  reset();
  const node = showBlogNotification(post({ banner_id: null }), { apiBase: API });
  assert.equal(node.querySelector("img"), null);
  assert.ok(node.querySelector(".blog-notice-thumb--empty"));
});

test("the same post is only announced once", () => {
  reset();
  assert.ok(showBlogNotification(post(), { apiBase: API }));
  assert.equal(showBlogNotification(post(), { apiBase: API }), null);
  assert.ok(showBlogNotification(post({ id: 8, slug: "second" }), { apiBase: API }));
});

test("titles are text, never markup", () => {
  reset();
  const node = showBlogNotification(post({ title: "<img src=x onerror=alert(1)>" }), { apiBase: API });
  assert.equal(node.querySelector(".blog-notice-title img"), null);
  assert.match(node.querySelector(".blog-notice-title").textContent, /<img/);
});

test("ignores incomplete payloads and the dismiss button removes the popup", async () => {
  reset();
  assert.equal(showBlogNotification(null, { apiBase: API }), null);
  assert.equal(showBlogNotification({ id: 1 }, { apiBase: API }), null);
  const node = showBlogNotification(post(), { apiBase: API });
  node.querySelector(".blog-notice-close").click();
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(document.querySelector(".blog-notice"), null);
});

test("catch-up check shows only a fresh, published, unseen post", async () => {
  const reply = (posts, ok = true) => async () => ({ ok, json: async () => ({ posts }) });
  reset();
  assert.ok(await checkLatestBlogPost({ apiBase: API, fetchImpl: reply([post()]), now: () => 1000 + 3600 }));
  reset();
  assert.equal(await checkLatestBlogPost({ apiBase: API, fetchImpl: reply([post()]), now: () => 1000 + 30 * 86400 }), null);
  reset();
  assert.equal(await checkLatestBlogPost({ apiBase: API, fetchImpl: reply([post({ status: "draft" })]), now: () => 1100 }), null);
  reset();
  assert.equal(await checkLatestBlogPost({ apiBase: API, fetchImpl: reply([], false), now: () => 1100 }), null);
  reset();
  assert.equal(await checkLatestBlogPost({ apiBase: API, fetchImpl: async () => { throw new Error("offline"); } }), null);
});

test("url helpers", () => {
  assert.equal(blogPostUrl({ slug: "a b" }), "https://rift.cool/blog/a%20b");
  assert.equal(blogImageUrl(`${API}/`, 5), `${API}/blog/images/5`);
});
