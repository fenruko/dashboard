/* Sign-in page: Discord OAuth, demo mode, API host diagnostics. */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { callout, button, field, textInput, toast, spinner } from "../ui/components.js";
import { getConfig, setApiBase, clearOverrides } from "../config.js";
import { normalizeBase } from "../config.js";

export async function mountPage(ctx) {
  const { root, auth, router, api, config } = ctx;
  const session = auth.get();
  if (session.status === "ready" && ctx.ctx.path === "/login") {
    router.replace(session.guilds.length ? `/g/${encodeURIComponent(prefsGuild(session, ctx))}` : "/guilds");
    return null;
  }

  const cfg = config || getConfig();
  const demoAvailable = cfg.demo || cfg.isLocal || /localhost|127\.0\.0\.1/.test(location.hostname);

  const page = h("div", { class: "auth-page" });
  const shell = h(
    "div",
    { class: "auth-shell" },
    h(
      "div",
      { class: "auth-brand" },
      h("span", { class: "brand-mark", style: "width:38px;height:38px;font-size:18px" }, "R"),
      h("div", { class: "brand-text" }, h("span", { class: "brand-name", style: "font-size:16px" }, cfg.siteName), h("span", { class: "brand-sub" }, "Dashboard"))
    ),
    h(
      "div",
      { class: "auth-hero" },
      h("h1", null, session.status === "expired" ? "Your session expired" : "Welcome back."),
      h(
        "p",
        { class: "auth-sub" },
        session.status === "expired"
          ? "Discord tokens last about seven days. Sign in again — your bot settings are untouched."
          : "Manage your servers with the same database the bot uses. No cached mock data, no waiting for a Discord command to apply a setting."
      )
    ),
    (session.error || ctx.error) &&
      callout({
        tone: "danger",
        title: session.status === "expired" ? "Session expired" : "Sign-in failed",
        children: session.error?.message || ctx.error?.message || "Discord rejected the login. Please try again.",
      }),
    h(
      "div",
      { class: "auth-actions" },
      button({
        label: "Continue with Discord",
        icon: "discord",
        variant: "primary",
        size: "lg",
        full: true,
        onClick: () => auth.beginLogin({ returnTo: ctx.ctx.query?.next || "/guilds" }),
      }),
      demoAvailable &&
        button({
          label: "Explore the demo (no Discord login)",
          icon: "sparkles",
          variant: "ghost",
          full: true,
          onClick: async () => {
            try {
              await auth.loginWithToken("demo-token", { expiresInSeconds: 86_400 });
              router.navigate("/guilds");
            } catch (err) {
              toast.error(err?.message || "Demo login failed. Is the mock API running?");
            }
          },
        })
    ),
    h(
      "p",
      { class: "auth-scopes" },
      "Rift asks for ",
      h("code", null, "identify guilds"),
      " — enough to list servers where you have Manage Server. It never asks for your password and never stores your token on our servers."
    ),
    h(
      "div",
      { class: "auth-links" },
      h("a", { href: "/verify" }, "Verification problem?"),
      h("span", { class: "muted" }, "·"),
      h("a", { href: "/appeals" }, "Appeal a blacklist"),
      h("span", { class: "muted" }, "·"),
      h("a", { href: "/status" }, "Diagnostics")
    )
  );

  let apiInput = textInput({ value: api.getBase(), placeholder: "https://host.tailnet.ts.net/api", className: "mono" });

  const advanced = h("details", { class: "auth-advanced" });
  advanced.append(
    h("summary", null, "Advanced: API host & troubleshooting"),
    h(
      "div",
      { class: "stack-tight", style: "padding-top:12px" },
      callout({
        tone: "info",
        children: [
          h("p", null, "The dashboard talks directly to the bot's Quart API. Leave this alone unless the host was pointed somewhere else."),
        ],
      }),
      field({
        label: "API base URL",
        help: "Include /api. Stored only in this browser.",
        children: h("div", { class: "row" }, apiInput, button({ label: "Test", icon: "activity", onClick: testApi }), button({ label: "Save", variant: "primary", onClick: saveApi }), button({ label: "Reset", variant: "ghost", onClick: resetApi })),
      }),
      h("div", { id: "api-test-result" }),
      button({ label: "Open full diagnostics", icon: "terminal", variant: "ghost", onClick: () => router.navigate("/status") })
    )
  );

  const resultHost = () => advanced.querySelector("#api-test-result");

  async function testApi() {
    const host = resultHost();
    clear(host);
    host.append(h("div", { class: "row", style: "padding-top:8px" }, spinner({ size: 14 }), h("span", { class: "muted" }, "Testing…")));
    const base = normalizeBase(apiInput.value);
    if (!base) {
      clear(host);
      host.append(callout({ tone: "danger", children: "Enter a URL first." }));
      return;
    }
    const started = performance.now();
    try {
      const response = await fetch(`${base}/stats`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const ms = Math.round(performance.now() - started);
      clear(host);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        host.append(
          callout({
            tone: "success",
            title: `Reachable in ${ms}ms (HTTP ${response.status})`,
            children: `${data.servers ?? "?"} servers · ${data.users ?? "?"} users${data.latency != null ? ` · gateway ${data.latency}ms` : ""}`,
          })
        );
      } else {
        const text = await response.text().catch(() => "");
        host.append(callout({ tone: "warning", title: `Responded with HTTP ${response.status}`, children: text.slice(0, 240) || "The host answered, but not with the Rift API." }));
      }
    } catch (err) {
      clear(host);
      host.append(
        callout({
          tone: "danger",
          title: "Couldn't reach that host",
          children:
            "The browser blocked the request or the host is down. Common causes: the tunnel is asleep, the host isn't in WEB_ALLOWED_ORIGINS, or this page isn't served over HTTPS while the API is HTTP.",
        })
      );
    }
  }

  function saveApi() {
    const next = normalizeBase(apiInput.value);
    if (!next) {
      toast.error("Enter a valid URL.");
      return;
    }
    setApiBase(next);
    toast.success("API host saved. Reloading…");
    setTimeout(() => location.reload(), 500);
  }

  function resetApi() {
    clearOverrides();
    toast.info("API host reset to the built-in default.");
    setTimeout(() => location.reload(), 400);
  }

  page.append(shell, advanced);
  mount(root, page);
  return () => clear(root);
}

function prefsGuild(session) {
  try {
    const raw = JSON.parse(localStorage.getItem("rift_dashboard_prefs") || "{}");
    const found = session.guilds.find((guild) => guild.id === raw.lastGuildId);
    if (found) return found.id;
  } catch {
    /* ignore */
  }
  return session.guilds[0]?.id || "";
}
