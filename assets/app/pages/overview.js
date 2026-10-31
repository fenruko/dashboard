/* Server overview: live health, growth, activity, moderation pulse and quick actions. */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  avatar,
  badge,
  button,
  card,
  callout,
  errorState,
  grid,
  pageHeader,
  progressBar,
  skeleton,
  statCard,
  statusDot,
  userChip,
} from "../ui/components.js";
import { createQuery } from "../core/store.js";
import { lineChart, barChart } from "../ui/charts.js";
import { fmtCompact, fmtDuration, fmtInt, fmtRelative, titleCase } from "../core/format.js";
import { buildInviteUrl } from "../config.js";
import { guildPath } from "../core/router.js";

export async function mountPage(ctx) {
  const { root, endpoints, guild, guildId, router, live, prefs, auth, openInvite } = ctx;
  const page = h("div", { class: "page" });
  const headerHost = h("div");
  const body = h("div", { class: "stack" });
  const disposers = [];
  const queries = [];

  const liveStats = { value: null };

  function q(fetcher, options = {}) {
    const query = createQuery(fetcher, {
      autoRefresh: prefs.get().autoRefresh ? options.autoRefresh ?? prefs.get().refreshInterval : 0,
      ...options,
    });
    queries.push(query);
    return query;
  }

  const infoQ = q(() => endpoints.guildInfo(guildId), { cacheTtl: 30_000, autoRefresh: prefs.get().autoRefresh ? 60_000 : 0 });
  const analyticsQ = q(() => endpoints.analytics(guildId), { cacheTtl: 15_000 });
  const modStatsQ = q(() => endpoints.modStats(guildId), { cacheTtl: 30_000 });
  const logsQ = q(() => endpoints.modLogs(guildId, { limit: 6 }), { cacheTtl: 20_000 });
  const flagsQ = q(() => endpoints.verificationFlags(guildId), { cacheTtl: 60_000 });
  const statsQ = q(() => endpoints.stats(), { cacheTtl: 5_000 });
  const automodQ = q(() => endpoints.settingsGet(guildId, "automod"), { cacheTtl: 60_000 });
  const musicQ = q(() => endpoints.musicState(guildId), { cacheTtl: 10_000, autoRefresh: prefs.get().autoRefresh ? 20_000 : 0 });

  function paint(query, host, render, { skeleton: sk = null, error = null } = {}) {
    const state = query.get();
    clear(host);
    if (state.status === "loading" || (state.data == null && state.fetching)) {
      host.append(sk || h("div", { class: "stack-tight" }, skeleton({ h: 16 }), skeleton({ h: 16, w: "72%" })));
      return;
    }
    if (state.status === "error" && state.data == null) {
      host.append(error ? error(state.error) : errorState({ error: state.error, onRetry: () => query.refresh(), compact: true }));
      return;
    }
    const node = render(state.data);
    if (node) host.append(node);
  }

  function renderHeader() {
    clear(headerHost);
    const info = infoQ.get().data;
    const analytics = analyticsQ.get().data;
    const name = info?.name || guild.name;
    headerHost.append(
      pageHeader({
        eyebrow: "Server overview",
        title: name,
        description: info ? `${fmtInt(info.member_count ?? analytics?.member_count)} members · prefix ${info.prefix || "!"} · ${guild.owner ? "you own this server" : "Manage Server access"}` : "Connecting to Rift…",
        actions: [
          button({ label: "Open Discord settings", icon: "settings", onClick: () => router.navigate(guildPath(guildId, "settings/automod")) }),
          guild.botPresent === false
            ? h("a", { class: "btn btn--primary", href: buildInviteUrl(guildId), target: "_blank", rel: "noreferrer noopener" }, icon("plus", { size: 14 }), "Add Rift")
            : button({ label: "Moderation", icon: "shield", onClick: () => router.navigate(guildPath(guildId, "moderation")) }),
        ],
        meta: [
          badge({ label: guild.botPresent === false ? "Rift missing" : "Rift connected", tone: guild.botPresent === false ? "danger" : "success", dot: true }),
          analytics?.online_count != null && badge({ label: `${fmtInt(analytics.online_count)} online`, tone: "muted" }),
          info?.id && h("span", { class: "mono small muted" }, `ID ${info.id}`),
        ],
      })
    );
  }

  // Header
  body.append(headerHost);
  renderHeader();
  infoQ.subscribe(renderHeader);
  analyticsQ.subscribe(renderHeader);

  if (guild.botPresent === false) {
    body.append(
      card({
        children: [
          callout({
            tone: "warning",
            title: "Rift isn't in this server",
            children: "Settings, moderation and music endpoints all require the bot to be present. Add it to unlock the full dashboard.",
            action: h("a", { class: "btn btn--primary btn--sm", href: buildInviteUrl(guildId), target: "_blank", rel: "noreferrer noopener" }, "Add Rift"),
          }),
          h(
            "div",
            { class: "row", style: "margin-top:12px" },
            button({ label: "All servers", icon: "grid", onClick: () => router.navigate("/guilds") }),
            button({ label: "Diagnostics", icon: "terminal", onClick: () => router.navigate("/status") })
          ),
        ],
      })
    );
    mount(page, body);
    mount(root, page);
    return () => {
      queries.forEach((query) => query.dispose());
      clear(root);
    };
  }

  /* ---------------- top stats ---------------- */

  const statsHost = h("div", { class: "stats-grid" });
  body.append(statsHost);

  function renderStats() {
    const analytics = analyticsQ.get().data;
    const info = infoQ.get().data;
    const mod = modStatsQ.get().data;
    const flags = Array.isArray(flagsQ.get().data) ? flagsQ.get().data : null;
    const joins = analytics?.joins || [];
    const leaves = analytics?.leaves || [];
    const messages = analytics?.messages || [];
    const sum = (rows) => rows.reduce((total, value) => total + (Number(value) || 0), 0);
    const firstHalf = (rows) => sum(rows.slice(0, Math.floor(rows.length / 2)));
    const secondHalf = (rows) => sum(rows.slice(Math.floor(rows.length / 2)));
    const messageTrend = firstHalf(messages) ? ((secondHalf(messages) - firstHalf(messages)) / firstHalf(messages)) * 100 : null;
    clear(statsHost);
    statsHost.append(
      statCard({
        label: "Members",
        value: fmtInt(info?.member_count ?? analytics?.member_count ?? 0),
        hint: analytics ? `${fmtInt(analytics.online_count)} online now` : "Loading presence…",
        icon: "users",
        tone: "accent",
        loading: infoQ.get().status === "loading" && !info,
      }),
      statCard({
        label: "Messages · 14d",
        value: fmtCompact(sum(messages)),
        hint: `${fmtCompact(sum(joins))} joins · ${fmtCompact(sum(leaves))} leaves`,
        icon: "activity",
        tone: "violet",
        trend: messageTrend,
        loading: analyticsQ.get().status === "loading" && !analytics,
      }),
      statCard({
        label: "Mod actions",
        value: mod ? fmtInt(mod.total) : "—",
        hint: mod?.top_mods?.[0] ? `Top: ${mod.top_mods[0].name} (${fmtInt(mod.top_mods[0].count)})` : "No logged actions",
        icon: "shield",
        tone: "warning",
        loading: modStatsQ.get().status === "loading" && !mod,
      }),
      statCard({
        label: "Verification flags",
        value: flags ? fmtInt(flags.length) : "—",
        hint: flags?.length ? "Review in Verification" : "No recent flags",
        icon: "user-check",
        tone: flags?.length ? "danger" : "success",
        loading: flagsQ.get().status === "loading" && flags == null,
      })
    );
  }
  [analyticsQ, infoQ, modStatsQ, flagsQ].forEach((query) => query.subscribe(renderStats));
  renderStats();

  /* ---------------- charts ---------------- */

  const chartCard = card({
    title: "Member flow",
    subtitle: "Joins vs leaves across the last 14 days (UTC).",
    children: h("div", { id: "member-chart" }),
    actions: button({ label: "Analytics", size: "sm", variant: "ghost", icon: "chart", onClick: () => router.navigate(guildPath(guildId, "analytics")) }),
  });
  const messagesCard = card({
    title: "Messages & voice",
    subtitle: "Daily message count with voice minutes overlaid.",
    children: h("div", { id: "activity-chart" }),
  });
  body.append(grid(2, chartCard, messagesCard));

  function renderCharts() {
    const analytics = analyticsQ.get().data;
    const memberHost = chartCard.querySelector("#member-chart");
    const activityHost = messagesCard.querySelector("#activity-chart");
    clear(memberHost);
    clear(activityHost);
    if (!analytics && analyticsQ.get().status === "loading") {
      memberHost.append(h("div", { class: "stack-tight" }, skeleton({ h: 150 })));
      activityHost.append(skeleton({ h: 150 }));
      return;
    }
    if (!analytics) {
      memberHost.append(errorState({ error: analyticsQ.get().error, onRetry: () => analyticsQ.refresh(), compact: true }));
      activityHost.append(errorState({ error: analyticsQ.get().error, onRetry: () => analyticsQ.refresh(), compact: true }));
      return;
    }
    const labels = (analytics.dates || []).map((date) => date.slice(5));
    memberHost.append(
      lineChart({
        labels,
        series: [
          { label: "Joins", values: analytics.joins || [], color: "#34d399" },
          { label: "Leaves", values: analytics.leaves || [], color: "#f87171" },
        ],
        height: 210,
        label: "Member joins and leaves over 14 days",
      })
    );
    activityHost.append(
      lineChart({
        labels,
        series: [
          { label: "Messages", values: analytics.messages || [], color: "#00b8ff" },
          { label: "Voice (min)", values: analytics.voice || [], color: "#a78bfa", area: false },
        ],
        height: 210,
        label: "Messages and voice activity over 14 days",
      })
    );
  }
  analyticsQ.subscribe(renderCharts);
  renderCharts();

  /* ---------------- live platform + moderation ---------------- */

  const platformHost = h("div");
  const modHost = h("div");
  body.append(grid(2, platformHost, modHost));

  function renderPlatform() {
    clear(platformHost);
    const stats = liveStats.value || statsQ.get().data || {};
    const loading = !liveStats.value && statsQ.get().status === "loading";
    if (statsQ.get().error && !stats) {
      platformHost.append(card({ title: "Bot platform", children: errorState({ error: statsQ.get().error, onRetry: () => statsQ.refresh(), compact: true }) }));
      return;
    }
    platformHost.append(
      card({
        title: "Bot platform",
        subtitle: "Live heartbeat from the running bot process.",
        actions: [
          h("span", { class: "row", style: "gap:5px" }, statusDot(live.statusStore.get().stats === "open" ? "open" : "connecting"), h("span", { class: "small muted" }, live.statusStore.get().stats === "open" ? "live" : "polling")),
          button({ label: "Refresh", icon: "refresh", size: "sm", variant: "ghost", onClick: () => statsQ.refresh() }),
        ],
        children: loading
          ? h("div", { class: "stack-tight" }, skeleton({ h: 14 }), skeleton({ h: 14 }), skeleton({ h: 14 }))
          : h(
              "div",
              { class: "stack-tight" },
              h(
                "div",
                { class: "stats-grid", style: "grid-template-columns:repeat(2,minmax(0,1fr))" },
                statCard({ label: "Gateway latency", value: `${fmtInt(stats.latency)}ms`, icon: "zap", tone: stats.latency > 250 ? "warning" : "success" }),
                statCard({ label: "Uptime", value: fmtDuration(stats.uptime), icon: "clock", tone: "accent" })
              ),
              stats.cpu != null
                ? h(
                    "div",
                    { class: "stack-tight" },
                    h("div", { class: "row row--between" }, h("span", { class: "small muted" }, "CPU"), h("span", { class: "small mono" }, `${stats.cpu}%`)),
                    progressBar({ value: stats.cpu, tone: stats.cpu > 80 ? "danger" : "accent", label: "CPU usage" }),
                    h("div", { class: "row row--between" }, h("span", { class: "small muted" }, "Memory"), h("span", { class: "small mono" }, `${stats.ram_percent}% · ${fmtCompact(stats.ram_used)}MB / ${fmtCompact(stats.ram_total)}MB`)),
                    progressBar({ value: stats.ram_percent, tone: stats.ram_percent > 85 ? "danger" : "success", label: "Memory usage" })
                  )
                : h("p", { class: "small muted" }, "Resource metrics are hidden for anonymous API calls."),
              h(
                "div",
                { class: "row", style: "flex-wrap:wrap;gap:6px" },
                badge({ label: `${fmtInt(stats.servers)} servers`, tone: "muted" }),
                badge({ label: `${fmtCompact(stats.users)} users`, tone: "muted" }),
                badge({ label: `${fmtInt(stats.shards || 1)} shard${(stats.shards || 1) === 1 ? "" : "s"}`, tone: "muted" })
              )
            ),
      })
    );
  }

  function renderModeration() {
    clear(modHost);
    const logs = logsQ.get().data;
    const mod = modStatsQ.get().data;
    modHost.append(
      card({
        title: "Moderation pulse",
        subtitle: mod ? `${fmtInt(mod.total)} actions logged · last 7 days charted` : "Recent actions in this server",
        actions: button({ label: "Open", size: "sm", variant: "ghost", icon: "arrow-right", onClick: () => router.navigate(guildPath(guildId, "moderation")) }),
        children: [
          mod?.activity_7d && h("div", { style: "margin-bottom:12px" }, barChart({ labels: Object.keys(mod.activity_7d), series: [{ label: "Actions", values: Object.values(mod.activity_7d), color: "#fbbf24" }], height: 130, showLegend: false, label: "Moderation actions in the last 7 days" })),
          logsQ.get().status === "loading" && !logs
            ? h("div", { class: "stack-tight" }, skeleton({ h: 36 }), skeleton({ h: 36 }), skeleton({ h: 36 }))
            : logs?.logs?.length
              ? h(
                  "div",
                  { class: "stack-tight" },
                  logs.logs.slice(0, 5).map((entry) =>
                    h(
                      "div",
                      { class: "row", style: "padding:6px 0;border-bottom:1px solid var(--line);gap:8px" },
                      badge({ label: titleCase(entry.action), tone: ["ban", "kick", "timeout"].includes(entry.action) ? "danger" : entry.action === "warn" ? "warning" : "muted" }),
                      userChip({ name: entry.target?.name, avatarUrl: entry.target?.avatar, size: 22 }),
                      h("span", { class: "small muted truncate", style: "flex:1", title: entry.reason }, entry.reason || "No reason"),
                      h("span", { class: "small muted nowrap" }, fmtRelative(entry.timestamp))
                    )
                  )
                )
              : h("p", { class: "small muted" }, "No moderation actions have been logged yet. Nice."),
          flagsQ.get().data?.length ? callout({ tone: "warning", title: `${flagsQ.get().data.length} verification flag(s)`, children: h("a", { href: guildPath(guildId, "verification-activity") }, "Review flagged verification attempts") }) : null,
        ],
      })
    );
  }
  [logsQ, modStatsQ, flagsQ, statsQ].forEach((query) => query.subscribe(() => { renderModeration(); renderStats(); }));
  statsQ.subscribe(renderPlatform);
  renderPlatform();
  renderModeration();

  const unsubscribeStats = live.subscribe("stats", (stats) => {
    liveStats.value = stats;
    renderPlatform();
  });
  disposers.push(unsubscribeStats);

  /* ---------------- music + security + shortcuts ---------------- */

  const extrasHost = h("div");
  body.append(extrasHost);

  function renderExtras() {
    clear(extrasHost);
    const automod = automodQ.get().data?.data || null;
    const music = musicQ.get().data || live.getMusicState(guildId) || null;
    const track = music?.current && (music.current.title || music.current.name) ? music.current : null;
    extrasHost.append(
      grid(
        3,
        card({
          title: "Security snapshot",
          children: automod
            ? h(
                "div",
                { class: "stack-tight" },
                h(
                  "div",
                  { class: "row row--between" },
                  h("span", { class: "muted small" }, "AutoMod"),
                  badge({ label: automod.enabled ? "enabled" : "disabled", tone: automod.enabled ? "success" : "muted", dot: true })
                ),
                automod.punishment && h("div", { class: "row row--between" }, h("span", { class: "muted small" }, "Punishment"), h("span", { class: "small" }, titleCase(automod.punishment))),
                h(
                  "div",
                  { class: "row", style: "margin-top:6px" },
                  button({ label: "AutoMod settings", size: "sm", icon: "bot", onClick: () => router.navigate(guildPath(guildId, "settings/automod")) }),
                  button({ label: "Anti-nuke", size: "sm", variant: "ghost", icon: "shield-alert", onClick: () => router.navigate(guildPath(guildId, "settings/antinuke")) })
                )
              )
            : automodQ.get().status === "loading"
              ? skeleton({ h: 40 })
              : h("p", { class: "small muted" }, "AutoMod configuration unavailable. Open settings to inspect it."),
        }),
        card({
          title: "Now playing",
          actions: button({ label: "Music", size: "sm", variant: "ghost", icon: "music", onClick: () => router.navigate(guildPath(guildId, "music")) }),
          children: track
            ? h(
                "div",
                { class: "mini-player" },
                track.artwork ? h("img", { src: track.artwork, alt: "", class: "mini-player-art", loading: "lazy" }) : h("span", { class: "mini-player-art mini-player-art--fallback" }, icon("music", { size: 18 })),
                h(
                  "div",
                  { class: "mini-player-text" },
                  h("div", { class: "mini-player-title truncate", title: track.title }, track.title),
                  h("div", { class: "mini-player-sub truncate" }, `${track.author || "Unknown artist"}${music.paused ? " · paused" : ""}`),
                  h("div", { class: "row", style: "gap:5px;margin-top:4px" }, badge({ label: `${music.queue?.length || 0} queued`, tone: "muted" }))
                )
              )
            : musicQ.get().status === "loading"
              ? skeleton({ h: 40 })
              : h("p", { class: "small muted" }, "Nothing is playing. The bot will show up here as soon as it joins a voice channel."),
        }),
        card({
          title: "Quick actions",
          children: h(
            "div",
            { class: "quick-grid" },
            [
              { label: "Leveling", icon: "trending-up", to: "settings/leveling" },
              { label: "Welcome", icon: "users", to: "settings/welcome" },
              { label: "Logging", icon: "file-text", to: "settings/logging" },
              { label: "Starboard", icon: "star", to: "settings/starboard" },
              { label: "Stocks", icon: "coins", to: "stocks" },
              { label: "Last.fm", icon: "activity", to: "lastfm" },
            ].map((action) => button({ label: action.label, icon: action.icon, size: "sm", variant: "ghost", onClick: () => router.navigate(guildPath(guildId, action.to)) }))
          ),
        })
      )
    );
  }
  automodQ.subscribe(renderExtras);
  musicQ.subscribe(renderExtras);
  renderExtras();
  disposers.push(live.subscribe("music_state", ({ guildId: id }) => {
    if (String(id) === String(guildId)) renderExtras();
  }));

  queries.forEach((query) => query.start());
  mount(page, body);
  mount(root, page);

  return () => {
    disposers.forEach((off) => off?.());
    queries.forEach((query) => query.dispose());
    live.subscribe; // no-op reference keeps bundlers honest
    clear(root);
  };
}
