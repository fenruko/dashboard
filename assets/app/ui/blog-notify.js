/* "New on the Rift blog" popup.
 *
 * Two ways a post reaches it:
 *   - live: the bot pushes {type: "blog_post", data: <post>} on the shared socket
 *   - catch-up: when the dashboard opens, the newest post is fetched once so
 *     people who weren't online at publish time still see it
 * Each post id is shown at most once per browser (rift_blog_seen). */

import { h } from "./dom.js";
import { icon } from "./icons.js";

const SEEN_KEY = "rift_blog_seen";
const SEEN_LIMIT = 30;
const SITE = "https://rift.cool";
const FRESH_SECONDS = 7 * 86400;
const AUTO_CLOSE_MS = 16_000;

function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markSeen(id) {
  try {
    const next = [id, ...readSeen().filter((x) => x !== id)].slice(0, SEEN_LIMIT);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* private mode: it may show again next visit, which is harmless */
  }
}

export function blogPostUrl(post) {
  return `${SITE}/blog/${encodeURIComponent(post.slug)}`;
}

export function blogImageUrl(apiBase, bannerId) {
  return `${String(apiBase).replace(/\/+$/, "")}/blog/images/${encodeURIComponent(bannerId)}`;
}

function host() {
  let node = document.getElementById("blog-notice-root");
  if (!node) {
    node = h("div", { id: "blog-notice-root", class: "blog-notice-root", role: "region", "aria-label": "Blog updates", "aria-live": "polite" });
    document.body.appendChild(node);
  }
  return node;
}

/** Show the popup for a post. Returns the element, or null when it was already seen / is invalid. */
export function showBlogNotification(post, { apiBase, force = false } = {}) {
  if (!post || typeof document === "undefined" || !post.id || !post.slug || !post.title) return null;
  if (!force && readSeen().includes(post.id)) return null;
  markSeen(post.id);

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 160);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(close, AUTO_CLOSE_MS);
  };

  const node = h(
    "div",
    { class: "blog-notice", role: "status", onMouseenter: () => clearTimeout(timer), onMouseleave: arm },
    post.banner_id
      ? h("img", { class: "blog-notice-thumb", src: blogImageUrl(apiBase, post.banner_id), alt: "", loading: "lazy", width: 72, height: 72 })
      : h("div", { class: "blog-notice-thumb blog-notice-thumb--empty", "aria-hidden": "true" }, icon("file-text", { size: 22 })),
    h(
      "div",
      { class: "blog-notice-text" },
      h("span", { class: "blog-notice-kicker" }, "New on the Rift blog"),
      h("strong", { class: "blog-notice-title" }, post.title),
      post.excerpt ? h("span", { class: "blog-notice-excerpt" }, post.excerpt) : null,
      h("a", { class: "blog-notice-link", href: blogPostUrl(post), target: "_blank", rel: "noopener", onClick: close }, "Read the post")
    ),
    h("button", { type: "button", class: "blog-notice-close", "aria-label": "Dismiss", onClick: close }, icon("x", { size: 13 }))
  );

  const root = host();
  while (root.children.length >= 3) root.firstElementChild.remove();
  root.appendChild(node);
  arm();
  return node;
}

/** Catch-up check on open. Never throws: a notification is never worth an error. */
export async function checkLatestBlogPost({ apiBase, fetchImpl = (...a) => fetch(...a), now = () => Date.now() / 1000 } = {}) {
  try {
    const res = await fetchImpl(`${String(apiBase).replace(/\/+$/, "")}/blog/posts?limit=1`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const { posts } = await res.json();
    const post = posts?.[0];
    if (!post || post.status !== "published") return null;
    if (now() - (post.published_at || post.created_at || 0) > FRESH_SECONDS) return null;
    return showBlogNotification(post, { apiBase });
  } catch {
    return null;
  }
}
