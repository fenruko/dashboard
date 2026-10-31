/* Application shell: auth gate, layout, navigation, live connection state,
 * command palette, global shortcuts and error safety nets. */

import { h, mount, clear, qs, on, cx } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import {
  avatar,
  badge,
  button,
  card,
  callout,
  iconButton,
  kbd,
  openModal,
  spinner,
  statusDot,
  toast,
  errorState,
  confirmDialog,
} from "./ui/components.js";
import { createApiClient } from "./core/api.js";
import { createAuth, guildIconUrl } from "./core/auth.js";
import { createLiveHub } from "./core/ws.js";
import { createRouter, guildPath } from "./core/router.js";
import { createStore } from "./core/store.js";
import { createPreferences } from "./core/prefs.js";
import { createEndpoints } from "./data/endpoints.js";
import { SETTINGS_SECTIONS, SETTINGS_GROUPS } from "./data/settings-schema.js";
import { getConfig, buildInviteUrl } from "./config.js";
import { copyToClipboard, fmtInt, titleCase } from "./core/format.js";

import * as loginPage from "./pages/login.js";
import * as guildsPage from "./pages/guilds.js";
import * as overviewPage from "./pages/overview.js";
import * as settingsPage from "./pages/settings.js";
import * as moderationPage from "./pages/moderation.js";
import * as musicPage from "./pages/music.js";
import * as lastfmPage from "./pages/lastfm.js";
import * as stocksPage from "./pages/stocks.js";
import * as voicePage from "./pages/voice.js";
import * as verificationPage from "./pages/verification.js";
import * as analyticsPage from "./pages/analytics.js";
import * as mePage from "./pages/me.js";
import * as statusPage from "./pages/status.js";
import * as verifyPage from "./pages/verify.js";
import * as appealsPage from "./pages/appeals.js";
import * as bugReportPage from "./pages/bugreport.js";
import * as notFoundPage from "./pages/notfound.js";

const PUBLIC_ROUTES = new Set(["/login", "/verify", "/appeals", "/bugreport"]);

export const NAV_MAIN = [
  { path: "", label: "Overview", icon: "grid" },
  { path: "analytics", label: "Analytics", icon: "chart" },
  { path: "moderation", label: "Moderation", icon: "shield" },
  { path: "music", label: "Music", icon: "music" },
  { path: "lastfm", label: "Last.fm", icon: "activity" },
  { path: "stocks", label: "Stocks", icon: "coins" },
  { path: "voice-call", label: "Voice call", icon: "phone" },
  { path: "verification-activity", label: "Verification", icon: "user-check" },
];

export function settingsNav() {
  return SETTINGS_GROUPS.map((group) => ({
    label: group.label,
    items: SETTINGS_SECTIONS.filter((section) => section.group === group.id).map((section) => ({
      path: `settings/${section.key}`,
      label: section.title,
      icon: section.icon,
    })),
  }));
}

const ROUTES = [
  { path: "/login", page: loginPage, public: true, title: "Sign in" },
  { path: "/verify", page: verifyPage, public: true, title: "Verify" },
  { path: "/appeals", page: appealsPage, public: true, title: "Ban appeal" },
  { path: "/appeals/thread/:token", page: appealsPage, public: true, title: "Appeal thread" },
  { path: "/bugreport", page: bugReportPage, public: true, title: "Report a bug" },
  { path: "/guilds", page: guildsPage, title: "Your servers" },
  { path: "/g/:guildId", page: overviewPage, guild: true, title: "Overview" },
  { path: "/g/:guildId/analytics", page: analyticsPage, guild: true, title: "Analytics" },
  { path: "/g/:guildId/moderation", page: moderationPage, guild: true, title: "Moderation" },
  { path: "/g/:guildId/music", page: musicPage, guild: true, title: "Music" },
  { path: "/g/:guildId/lastfm", page: lastfmPage, guild: true, title: "Last.fm" },
  { path: "/g/:guildId/stocks", page: stocksPage, guild: true, title: "Stocks" },
  { path: "/g/:guildId/voice-call", page: voicePage, guild: true, title: "Voice call" },
  { path: "/g/:guildId/verification-activity", page: verificationPage, guild: true, title: "Verification activity" },
  { path: "/g/:guildId/settings", page: settingsPage, guild: true, title: "Settings" },
  { path: "/g/:guildId/settings/:section", page: settingsPage, guild: true, title: "Settings" },
  { path: "/me", page: mePage, title: "Account & preferences" },
  { path: "/status", page: statusPage, title: "Diagnostics" },
  { path: "/diagnostics", page: statusPage, title: "Diagnostics" },
];

export function createApp({ root, fetchImpl, WebSocketImpl, config: configOverride } = {}) {
  const config = { ...getConfig(), ...(configOverride || {}) };
  const appStore = createStore(
    {
      ready: false,
      sidebarOpen: false,
      connection: "idle",
      lastRoute: null,
      fatal: null,
      paletteOpen: false,
      diagnostics: [],
    },
    { name: "app" }
  );

  let unauthorizedHandler = () => {};
  const api = createApiClient({
    fetchImpl,
    getToken: () => {
      try {
        return localStorage.getItem("rift_dashboard_token") || "";
      } catch {
        return "";
      }
    },
    onUnauthorized: () => unauthorizedHandler(),
    onEvent: (event) => {
      if (event.type === "network-error" || event.type === "breaker-open") {
        appStore.set({ connection: "down" });
      }
      if (event.type === "failover") {
        appStore.set({ connection: "connecting" });
      }
    },
  });
  const endpoints = createEndpoints(api);
  const auth = createAuth({ api, config, fetchImpl });
  unauthorizedHandler = () => auth.markUnauthorized();

  const prefs = createPreferences({ api, getUserId: () => auth.get().user?.id });
  const live = createLiveHub({
    getToken: () => auth.get().token,
    getApiBase: () => api.getBase(),
    WebSocketImpl,
    onEvent: (event) => {
      if (event.type === "status" && event.channel === "stats") {
        appStore.set({ connection: event.status === "open" ? "live" : event.status === "reconnecting" ? "connecting" : "offline" });
      }
    },
  });

  const router = createRouter({
    routes: ROUTES,
    fallback: "/guilds",
    onChange: (ctx) => renderRoute(ctx).catch((err) => renderFatal(err)),
  });

  let currentCleanup = null;
  let currentController = null;
  let shellEls = null;
  let pageRoot = null;
  let scrollPositions = new Map();

  const paletteActions = [
    { id: "refresh", label: "Refresh this page", icon: "refresh", run: () => refreshPage() },
    { id: "guilds", label: "Switch server", icon: "server", run: () => router.navigate("/guilds") },
    { id: "status", label: "Open diagnostics", icon: "terminal", run: () => router.navigate("/status") },
    { id: "me", label: "Account & preferences", icon: "settings", run: () => router.navigate("/me") },
    { id: "bugreport", label: "Report a bug", icon: "bug", run: () => router.navigate("/bugreport") },
    {
      id: "copy-diag",
      label: "Copy diagnostics report",
      icon: "copy",
      run: async () => {
        const ok = await copyToClipboard(diagnosticsReport());
        toast[ok ? "success" : "error"](ok ? "Diagnostics copied" : "Couldn't copy diagnostics");
      },
    },
    { id: "theme", label: "Toggle light / dark theme", icon: "sun", run: () => prefs.set({ theme: prefs.get().theme === "light" ? "dark" : "light" }) },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: "command", run: () => openShortcuts() },
    { id: "logout", label: "Sign out", icon: "log-out", run: () => auth.logout() },
  ];

  /* ---------------- diagnostics ---------------- */

  function recordDiagnostic(entry) {
    const items = [{ at: Date.now(), ...entry }, ...appStore.get().diagnostics].slice(0, 40);
    appStore.set({ diagnostics: items });
  }

  function diagnosticsReport() {
    const session = auth.get();
    return [
      `Rift Dashboard diagnostics — ${new Date().toISOString()}`,
      `URL: ${location.href}`,
      `API base: ${api.getBase()}`,
      `API candidates: ${api.getCandidates().join(", ")}`,
      `Demo mode: ${session.demo}`,
      `Session: ${session.status} (expires ${session.expiresAt ? new Date(session.expiresAt).toISOString() : "unknown"})`,
      `User: ${session.user ? `${session.user.username} (${session.user.id})` : "anonymous"}`,
      `Guilds: ${session.guilds.length}`,
      `Live socket: ${live.statusStore.get().stats} / vc ${live.statusStore.get().vc}`,
      `Breaker open: ${api.isBreakerOpen()}`,
      `Cache entries: ${api.cacheSize()}`,
      `Metrics: ${JSON.stringify(api.getMetrics())}`,
      `User agent: ${navigator.userAgent}`,
      `Viewport: ${innerWidth}x${innerHeight}`,
      "",
      "Recent requests:",
      ...api.getLog().slice(0, 25).map((row) => `${new Date(row.at).toISOString()} ${row.method} ${row.path} → ${row.status} (${row.ms}ms, ${row.outcome})`),
      "",
      "Recent client errors:",
      ...appStore.get().diagnostics.map((row) => `${new Date(row.at).toISOString()} ${row.type}: ${row.message}`),
    ].join("\n");
  }

  if (typeof window !== "undefined") {
    window.__riftDiagnostics = diagnosticsReport;
    window.addEventListener("error", (event) => {
      recordDiagnostic({ type: "error", message: event.message || String(event.error || "Unknown error") });
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      recordDiagnostic({ type: "unhandledrejection", message: reason?.message || String(reason) });
      if (reason?.name !== "AbortError") {
        toast.error(reason?.message || "Something went wrong in the background.", { title: "Unexpected error" });
      }
    });
    window.addEventListener("offline", () => {
      appStore.set({ connection: "offline" });
      toast.warning("You're offline. Rift will reconnect automatically.");
    });
    window.addEventListener("online", () => {
      appStore.set({ connection: "connecting" });
      auth.refresh();
      live.reconnect();
    });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && auth.get().status === "ready") api.resetDiagnostics?.();
      });
    }
  }

  /* ---------------- layout ---------------- */

  function buildShell(ctx) {
    const session = auth.get();
    const guild = ctx?.params?.guildId ? auth.guildById(ctx.params.guildId) : null;
    const navItems = guild ? NAV_MAIN.map((item) => ({ ...item, href: guildPath(guild.id, item.path) })) : [];
    const settingsGroups = guild ? settingsNav() : [];

    const searchTrigger = h(
      "button",
      { class: "search-trigger", type: "button", onClick: () => openPalette(), "aria-label": "Open command palette" },
      icon("search", { size: 14 }),
      h("span", null, "Search or jump to…"),
      kbd(["⌘", "K"])
    );

    const connectionPill = h("span", { class: "connection-pill" });
    function updateConnection() {
      const state = appStore.get().connection;
      const liveStatus = live.statusStore.get().stats;
      const isLive = liveStatus === "open";
      const down = state === "down" || state === "offline" || liveStatus === "reconnecting" || liveStatus === "closed";
      clear(connectionPill);
      connectionPill.className = cx("connection-pill", isLive ? "is-live" : down ? "is-down" : "");
      connectionPill.append(
        statusDot(isLive ? "open" : down ? "error" : "connecting"),
        h("span", null, isLive ? "Live" : state === "offline" ? "Offline" : down ? "Reconnecting" : "Connecting")
      );
      connectionPill.title = `Live socket: ${liveStatus}`;
    }

    const sidebar = h(
      "aside",
      { class: cx("sidebar", appStore.get().sidebarOpen && "is-open"), id: "sidebar" },
      h(
        "div",
        { class: "sidebar-brand" },
        h("span", { class: "brand-mark" }, "R"),
        h("div", { class: "brand-text" }, h("span", { class: "brand-name" }, config.siteName), h("span", { class: "brand-sub" }, "Dashboard"))
      ),
      guild
        ? h(
            "a",
            { class: "guild-switch", href: "/guilds", title: "Switch server" },
            guild.iconUrl
              ? h("img", { src: guild.iconUrl, alt: "", width: 32, height: 32, style: "border-radius:9px", loading: "lazy" })
              : h("span", { class: "brand-mark", style: "width:32px;height:32px;font-size:14px" }, guild.name.slice(0, 1).toUpperCase()),
            h("span", { class: "guild-switch-text" }, h("span", { class: "guild-switch-name" }, guild.name), h("span", { class: "guild-switch-sub" }, guild.botPresent === false ? "Rift not added" : "Manage server")),
            icon("chevron-down", { size: 14 })
          )
        : h(
            "a",
            { class: "guild-switch", href: "/guilds" },
            h("span", { class: "brand-mark", style: "width:32px;height:32px;font-size:14px" }, "◇"),
            h("span", { class: "guild-switch-text" }, h("span", { class: "guild-switch-name" }, "Your servers"), h("span", { class: "guild-switch-sub" }, `${fmtInt(session.guilds.length)} available`)),
            icon("chevron-down", { size: 14 })
          ),
      h(
        "nav",
        { class: "sidebar-nav", "aria-label": "Main navigation" },
        guild
          ? h(
              "div",
              null,
              h("div", { class: "nav-group-label" }, "Server"),
              navItems.map((item) => navLink(item, ctx))
            )
          : h(
              "div",
              null,
              h("div", { class: "nav-group-label" }, "General"),
              navLink({ href: "/guilds", label: "Servers", icon: "server" }, ctx),
              navLink({ href: "/me", label: "Account", icon: "user" }, ctx),
              navLink({ href: "/status", label: "Diagnostics", icon: "terminal" }, ctx),
              navLink({ href: "/bugreport", label: "Report a bug", icon: "bug" }, ctx)
            ),
        ...settingsGroups.map((group) =>
          h(
            "div",
            null,
            h("div", { class: "nav-group-label" }, group.label),
            group.items.map((item) => navLink({ href: guildPath(guild.id, item.path), label: item.label, icon: item.icon }, ctx))
          )
        ),
        guild &&
          h(
            "div",
            null,
            h("div", { class: "nav-group-label" }, "More"),
            navLink({ href: "/guilds", label: "All servers", icon: "grid" }, ctx),
            navLink({ href: "/status", label: "Diagnostics", icon: "terminal" }, ctx),
            navLink({ href: "/me", label: "Account", icon: "user" }, ctx),
            navLink({ href: "/bugreport", label: "Report a bug", icon: "bug" }, ctx)
          )
      ),
      h(
        "div",
        { class: "sidebar-foot" },
        h(
          "div",
          { class: "sidebar-user" },
          avatar({ name: session.user?.globalName || session.user?.username, src: session.user?.avatarUrl, size: 28 }),
          h(
            "span",
            { class: "sidebar-user-text" },
            h("span", { class: "sidebar-user-name" }, session.user?.globalName || session.user?.username || "Signed in"),
            h("span", { class: "sidebar-user-sub" }, session.demo ? "Demo session" : "Discord account")
          ),
          iconButton({ icon: "settings", label: "Account & preferences", size: "sm", onClick: () => router.navigate("/me") }),
          iconButton({ icon: "log-out", label: "Sign out", size: "sm", onClick: () => auth.logout() })
        ),
        h("div", { class: "row", style: "padding:0 6px;font-size:10.5px;color:var(--text-mute);gap:6px" }, button({ label: "Shortcuts", variant: "ghost", size: "sm", icon: "command", onClick: () => openShortcuts() }))
      )
    );

    const topbar = h(
      "header",
      { class: "topbar" },
      iconButton({ icon: "menu", label: "Toggle navigation", className: "topbar-menu", onClick: () => appStore.set({ sidebarOpen: !appStore.get().sidebarOpen }) }),
      searchTrigger,
      h(
        "div",
        { class: "topbar-actions" },
        session.demo && badge({ label: "Demo data", tone: "warning" }),
        connectionPill,
        iconButton({ icon: "refresh", label: "Refresh page", onClick: () => refreshPage() }),
        iconButton({ icon: "help", label: "Keyboard shortcuts", onClick: () => openShortcuts() })
      )
    );

    const bannerHost = h("div", { id: "banner-host" });
    pageRoot = h("div", { class: "main-scroll", id: "main" });
    const main = h("div", { class: "main" }, topbar, bannerHost, pageRoot);
    const scrim = h("div", {
      class: "sidebar-scrim",
      onClick: () => appStore.set({ sidebarOpen: false }),
    });

    root.replaceChildren(h("div", { class: "app" }, sidebar, main, appStore.get().sidebarOpen ? scrim : null));
    shellEls = { sidebar, main, topbar, pageRoot, bannerHost, connectionPill };
    updateConnection();
    return { guild };
  }

  function navLink(item, ctx) {
    const current = ctx?.path || "";
    const active = item.href === "/guilds" ? current === "/guilds" : current === item.href || (item.href.endsWith("/settings") && current.startsWith(`${item.href}/`));
    return h(
      "a",
      { class: cx("nav-item", active && "is-active"), href: item.href, "aria-current": active ? "page" : undefined },
      icon(item.icon, { size: 15 }),
      h("span", null, item.label)
    );
  }

  function renderBanners(ctx, guild) {
    if (!shellEls) return;
    const host = shellEls.bannerHost;
    clear(host);
    const session = auth.get();

    if (session.status === "expired") {
      host.append(
        h(
          "div",
          { class: "banner banner--danger", role: "alert" },
          icon("alert", { size: 15 }),
          h("span", null, "Your Discord session expired. Sign in again to keep making changes."),
          button({ label: "Sign in", size: "sm", variant: "primary", onClick: () => auth.beginLogin({ returnTo: location.pathname + location.search }) })
        )
      );
      return;
    }
    if (appStore.get().connection === "down" || appStore.get().connection === "offline") {
      host.append(
        h(
          "div",
          { class: "banner", role: "status" },
          icon("wifi-off", { size: 15 }),
          h("span", null, appStore.get().connection === "offline" ? "You're offline. Changes will be retried when the connection returns." : "Can't reach Rift's backend. Requests retry automatically."),
          button({ label: "Retry now", size: "sm", variant: "ghost", onClick: () => { api.resetDiagnostics?.(); refreshPage(); } })
        )
      );
    }
    if (guild && guild.botPresent === false) {
      host.append(
        h(
          "div",
          { class: "banner banner--info", role: "status" },
          icon("bot", { size: 15 }),
          h("span", null, `Rift isn't in ${guild.name} yet. Add it to manage this server.`),
          h("a", { class: "btn btn--sm btn--primary", href: buildInviteUrl(guild.id), target: "_blank", rel: "noreferrer noopener" }, "Add Rift")
        )
      );
    }
    if (session.demo) {
      host.append(
        h(
          "div",
          { class: "banner banner--info", role: "status" },
          icon("sparkles", { size: 15 }),
          h("span", null, "Demo mode is on — you're exploring an in-memory demo of the bot API. Nothing is written to Discord."),
          button({ label: "Leave demo", size: "sm", variant: "ghost", onClick: () => {
            const url = new URL(location.href);
            url.searchParams.set("demo", "0");
            location.href = url.toString();
          } })
        )
      );
    }
  }

  /* ---------------- routing ---------------- */

  async function renderRoute(ctx) {
    if (!ctx) return;
    const route = ctx.route;
    const isPublic = route?.public || PUBLIC_ROUTES.has(ctx.path.split("/").slice(0, 2).join("/"));
    const session = auth.get();
    if (ctx.path === "/") {
      router.replace("/guilds");
      return;
    }

    // Preserve scroll position per path.
    if (appStore.get().lastRoute && pageRoot) scrollPositions.set(appStore.get().lastRoute, window.scrollY);

    if (currentCleanup) {
      try {
        currentCleanup();
      } catch (err) {
        console.error("page cleanup failed", err);
      }
      currentCleanup = null;
    }
    currentController?.abort();
    currentController = new AbortController();

    appStore.set({ lastRoute: ctx.fullPath, sidebarOpen: false, ready: true });

    if (!isPublic) {
      if (session.status === "booting" || session.status === "authenticating") {
        renderBootstrap();
        return;
      }
      if (session.status !== "ready") {
        await loginPage.mountPage({
          root,
          ctx,
          auth,
          config,
          router,
          endpoints,
          api,
          mode: "gate",
          error: session.error,
        });
        return;
      }
    }

    if (isPublic) {
      const page = route?.page || notFoundPage;
      const cleanup = await page.mountPage({
        root,
        ctx,
        auth,
        config,
        router,
        endpoints,
        api,
        prefs,
        live,
        store: appStore,
        diagnosticsReport,
        toast,
        confirm: confirmDialog,
      });
      currentCleanup = typeof cleanup === "function" ? cleanup : cleanup?.dispose;
      document.title = `${route?.title || "Rift"} · ${config.siteName}`;
      return;
    }

    const guild = ctx.params.guildId ? auth.guildById(ctx.params.guildId) : null;
    if (ctx.params.guildId && !guild) {
      buildShell(ctx);
      clear(pageRoot);
      pageRoot.append(
        card({
          title: "Server not found",
          subtitle: "This server isn't in your manageable list (you need Manage Server) or the list hasn't loaded yet.",
          children: [
            h(
              "div",
              { class: "row" },
              button({ label: "Back to servers", variant: "primary", icon: "arrow-left", onClick: () => router.navigate("/guilds") }),
              button({ label: "Refresh account", icon: "refresh", onClick: async () => { await auth.refresh(); router.replace(ctx.fullPath); } })
            ),
          ],
        })
      );
      return;
    }

    const layout = buildShell(ctx);
    renderBanners(ctx, guild);

    if (guild) prefs.set({ lastGuildId: guild.id });

    const pageCtx = {
      root: pageRoot,
      ctx,
      api,
      endpoints,
      auth,
      live,
      prefs,
      config,
      router,
      toast,
      confirm: confirmDialog,
      guild,
      guildId: guild?.id || null,
      user: session.user,
      store: appStore,
      diagnosticsReport,
      signal: currentController.signal,
      setTitle: (title) => {
        document.title = `${title} · ${guild?.name || config.siteName}`;
      },
      refreshShell: () => {
        const scroll = window.scrollY;
        buildShell(router.getCurrent());
        renderBanners(router.getCurrent(), guild);
        pageCtx.root = pageRoot;
        // Re-mount the current page content into the new container.
        renderRoute(router.getCurrent());
        requestAnimationFrame(() => window.scrollTo(0, scroll));
      },
      setBanner: (node) => {
        const host = qs("#banner-host");
        if (host) {
          clear(host);
          if (node) host.append(node);
        }
      },
    };

    const page = route?.page || notFoundPage;
    let result;
    try {
      result = await page.mountPage(pageCtx);
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error(err);
      recordDiagnostic({ type: "page", message: err?.message || String(err) });
      clear(pageRoot);
      pageRoot.append(
        card({
          title: `${route?.title || "Page"} failed to load`,
          children: errorState({ error: err, onRetry: () => renderRoute(ctx) }),
        })
      );
      return;
    }
    currentCleanup = typeof result === "function" ? result : result?.dispose || null;
    document.title = `${route?.title || "Rift"} · ${guild?.name || config.siteName}`;
    const target = scrollPositions.get(ctx.fullPath);
    if (target) requestAnimationFrame(() => window.scrollTo(0, target));
  }

  function renderBootstrap() {
    root.replaceChildren(
      h(
        "div",
        { class: "boot", role: "status", "aria-live": "polite" },
        h("div", { class: "boot-mark", "aria-hidden": "true" }, "R"),
        h("p", null, "Restoring your session…"),
        spinner({ size: 18 })
      )
    );
  }

  function renderFatal(err) {
    recordDiagnostic({ type: "fatal", message: err?.message || String(err) });
    root.replaceChildren(
      h(
        "div",
        { class: "main-scroll", style: "max-width:720px;margin:10vh auto" },
        card({
          title: "The dashboard hit a wall",
          subtitle: err?.message || String(err),
          children: [
            h("p", { class: "muted", style: "margin-bottom:12px" }, "Your settings are safe. Reload; if this keeps happening, copy the diagnostics report and send it over."),
            h(
              "div",
              { class: "row" },
              button({ label: "Reload", variant: "primary", icon: "refresh", onClick: () => location.reload() }),
              button({ label: "Copy diagnostics", icon: "copy", onClick: () => copyToClipboard(diagnosticsReport()) }),
              button({ label: "Servers", icon: "grid", onClick: () => router.navigate("/guilds") })
            ),
          ],
        })
      )
    );
  }

  function refreshPage() {
    const ctx = router.getCurrent();
    if (ctx) renderRoute(ctx);
  }

  /* ---------------- command palette ---------------- */

  function paletteItems() {
    const session = auth.get();
    const current = router.getCurrent();
    const guild = current?.params?.guildId ? auth.guildById(current.params.guildId) : null;
    const items = [];
    if (guild) {
      for (const item of NAV_MAIN) {
        items.push({ group: "Go to", label: item.label, icon: item.icon, run: () => router.navigate(guildPath(guild.id, item.path)) });
      }
      for (const section of SETTINGS_SECTIONS) {
        items.push({ group: `Settings · ${titleCase(section.group)}`, label: section.title, icon: section.icon, sub: section.key, run: () => router.navigate(guildPath(guild.id, `settings/${section.key}`)) });
      }
    }
    for (const action of paletteActions) items.push({ group: "Actions", ...action });
    for (const other of session.guilds) {
      items.push({ group: "Servers", label: other.name, icon: "server", sub: other.botPresent === false ? "Rift not added" : "", run: () => router.navigate(guildPath(other.id)) });
    }
    return items;
  }

  function openPalette() {
    const overlay = h("div", { class: "overlay palette-overlay" });
    const input = h("input", { class: "palette-input", placeholder: "Jump to a page, server, setting or action…", "aria-label": "Command palette", autocomplete: "off" });
    const results = h("div", { class: "palette-results", role: "listbox" });
    const items = paletteItems();
    let activeIndex = 0;
    let filtered = items;

    function render() {
      clear(results);
      const grouped = new Map();
      for (const item of filtered.slice(0, 60)) {
        if (!grouped.has(item.group)) grouped.set(item.group, []);
        grouped.get(item.group).push(item);
      }
      let index = 0;
      for (const [group, groupItems] of grouped) {
        results.append(h("div", { class: "palette-group" }, group));
        for (const item of groupItems) {
          const itemIndex = index;
          const btn = h(
            "button",
            {
              type: "button",
              role: "option",
              class: cx("palette-item", itemIndex === activeIndex && "is-active"),
              "aria-selected": itemIndex === activeIndex ? "true" : "false",
              onMousemove: () => {
                if (activeIndex !== itemIndex) {
                  activeIndex = itemIndex;
                  highlight();
                }
              },
              onClick: () => choose(item),
            },
            icon(item.icon || "arrow-right", { size: 14 }),
            h("span", null, item.label),
            item.sub && h("span", { class: "palette-item-sub" }, item.sub)
          );
          results.append(btn);
          index += 1;
          if (itemIndex === activeIndex) requestAnimationFrame(() => btn.scrollIntoView({ block: "nearest" }));
        }
      }
      if (!filtered.length) results.append(h("div", { class: "palette-group" }, "No matches"));
    }

    function highlight() {
      const buttons = [...results.querySelectorAll(".palette-item")];
      buttons.forEach((btn, i) => {
        btn.classList.toggle("is-active", i === activeIndex);
        btn.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
        if (i === activeIndex) btn.scrollIntoView({ block: "nearest" });
      });
    }

    function choose(item) {
      close();
      setTimeout(() => item.run(), 0);
    }

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      appStore.set({ paletteOpen: false });
      shellEls?.topbar?.querySelector(".search-trigger")?.focus?.();
    }

    function filter(value) {
      const term = value.trim().toLowerCase();
      filtered = !term
        ? items
        : items.filter((item) => `${item.label} ${item.sub || ""} ${item.group}`.toLowerCase().includes(term));
      activeIndex = 0;
      render();
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
        highlight();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        highlight();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) choose(item);
      }
    }

    input.addEventListener("input", () => filter(input.value));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });
    overlay.append(
      h(
        "div",
        { class: "palette", role: "dialog", "aria-modal": "true", "aria-label": "Command palette" },
        input,
        results,
        h(
          "div",
          { class: "palette-foot" },
          h("span", null, kbd(["↑", "↓"]), " navigate"),
          h("span", null, kbd(["↵"]), " open"),
          h("span", null, kbd(["Esc"]), " close")
        )
      )
    );
    document.body.append(overlay);
    document.addEventListener("keydown", onKey, true);
    appStore.set({ paletteOpen: true });
    render();
    input.focus();
  }

  function openShortcuts() {
    const rows = [
      ["⌘/Ctrl + K", "Command palette"],
      ["⌘/Ctrl + S", "Save the current settings form"],
      ["?", "This shortcut sheet"],
      ["G then S", "Jump to settings"],
      ["G then M", "Jump to moderation"],
      ["Esc", "Close dialogs and the palette"],
      ["Shift + click", "Open servers in a new tab"],
    ];
    openModal({
      title: "Keyboard shortcuts",
      size: "sm",
      body: h(
        "div",
        { class: "stack-tight" },
        rows.map(([keys, label]) =>
          h("div", { class: "row row--between", style: "padding:6px 0;border-bottom:1px solid var(--line)" }, h("span", { class: "muted" }, label), kbd(keys.split(" + ")))
        )
      ),
      footer: [button({ label: "Got it", variant: "primary", onClick: () => document.querySelector(".overlay:last-child")?.remove() })],
    });
    prefs.set({ seenShortcuts: true });
  }

  /* ---------------- shortcuts ---------------- */

  if (typeof window !== "undefined") {
    let pendingG = false;
    let gTimer = null;
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target?.isContentEditable;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        if (typing) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("rift:save"));
        }
        return;
      }
      if (typing) return;
      if (event.key === "?") {
        event.preventDefault();
        openShortcuts();
        return;
      }
      if (event.key.toLowerCase() === "g") {
        if (pendingG) {
          pendingG = false;
          clearTimeout(gTimer);
          router.navigate("/guilds");
        } else {
          pendingG = true;
          gTimer = setTimeout(() => (pendingG = false), 900);
        }
        return;
      }
      if (pendingG) {
        const current = router.getCurrent();
        const guildId = current?.params?.guildId;
        if (!guildId) return;
        if (event.key.toLowerCase() === "s") router.navigate(guildPath(guildId, "settings/automod"));
        else if (event.key.toLowerCase() === "m") router.navigate(guildPath(guildId, "moderation"));
        else if (event.key.toLowerCase() === "o") router.navigate(guildPath(guildId));
        else if (event.key.toLowerCase() === "u") router.navigate(guildPath(guildId, "music"));
        pendingG = false;
        clearTimeout(gTimer);
      }
    });
  }

  /* ---------------- session wiring ---------------- */

  let lastStatus = "";
  auth.subscribe((session) => {
    const changed = session.status !== lastStatus;
    lastStatus = session.status;
    if (session.status === "ready") {
      live.start();
      prefs.hydrateFromServer();
      if (changed) {
        const returnTo = auth.consumeReturnTo?.();
        if (returnTo && location.pathname === "/login") router.navigate(returnTo, { replace: true });
      }
    }
    if (session.status === "expired" || session.status === "anonymous") {
      live.stop();
    }
    if (changed && session.status === "expired") {
      toast.warning("Your Discord session expired. Sign in again to keep managing your servers.", { title: "Session expired" });
    }
    if (changed && appStore.get().ready) {
      renderBanners(router.getCurrent(), router.getCurrent()?.params?.guildId ? auth.guildById(router.getCurrent().params.guildId) : null);
    }
  });

  appStore.subscribe((state, meta) => {
    if (!shellEls) return;
    if ("sidebarOpen" in meta.changed) {
      shellEls.sidebar.classList.toggle("is-open", state.sidebarOpen);
      const existing = qs(".sidebar-scrim");
      if (state.sidebarOpen && !existing) root.querySelector(".app")?.append(h("div", { class: "sidebar-scrim", onClick: () => appStore.set({ sidebarOpen: false }) }));
      if (!state.sidebarOpen) existing?.remove();
    }
    if ("connection" in meta.changed || "diagnostics" in meta.changed) {
      renderBanners(router.getCurrent(), router.getCurrent()?.params?.guildId ? auth.guildById(router.getCurrent().params.guildId) : null);
    }
  });

  // Re-render the connection pill independently of route changes.
  const pillTimer = setInterval(() => {
    if (!shellEls) return;
    const state = appStore.get().connection;
    const liveStatus = live.statusStore.get().stats;
    const pill = shellEls.connectionPill;
    if (!pill) return;
    const isLive = liveStatus === "open";
    const down = state === "down" || state === "offline" || liveStatus === "reconnecting" || liveStatus === "closed";
    pill.className = cx("connection-pill", isLive ? "is-live" : down ? "is-down" : "");
    if (pill.dataset.state !== `${liveStatus}:${state}`) {
      pill.dataset.state = `${liveStatus}:${state}`;
      clear(pill);
      pill.append(statusDot(isLive ? "open" : down ? "error" : "connecting"), h("span", null, isLive ? "Live" : state === "offline" ? "Offline" : down ? "Reconnecting" : "Connecting"));
    }
  }, 1500);

  async function start() {
    if (typeof location !== "undefined" && /access_token=|error=/.test(location.hash)) {
      const next = await auth.handleCallback(location.hash);
      if (next) {
        await router.start();
        router.replace(next);
        return;
      }
    }
    await auth.loadSession();
    await router.start();
  }

  return {
    start,
    stop() {
      clearInterval(pillTimer);
      currentCleanup?.();
      currentController?.abort();
      live.dispose();
      auth.dispose();
      router.stop();
    },
    api,
    endpoints,
    auth,
    live,
    prefs,
    router,
    store: appStore,
    diagnosticsReport,
    refreshPage,
    openPalette,
    openShortcuts,
    renderFatal,
  };
}
