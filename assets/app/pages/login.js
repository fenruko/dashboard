/* Sign-in page: Discord OAuth and the optional local demo. */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { callout, button, toast } from "../ui/components.js";
import { getConfig } from "../config.js";

export async function mountPage(ctx) {
  const { root, auth, router, config } = ctx;
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
      h("img", { class: "brand-mark brand-logo brand-logo--lg", src: "/assets/riftlogo.jpg", alt: "Rift", width: 38, height: 38 }),
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
          : "Manage your servers with the same database the bot uses. No cached placeholder data, no waiting for a Discord command to apply a setting."
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
              toast.error(err?.message || "Demo login failed. Is the demo API running?");
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
      h("a", { href: "/appeals" }, "Appeal a blacklist")
    )
  );

  page.append(shell);
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
