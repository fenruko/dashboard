/* Moderation workspace: stats, logs, bans, member search, user dossier and the
 * full server-side action set (warn/timeout/kick/ban/notes/nick/roles). */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  avatar,
  badge,
  button,
  card,
  callout,
  confirmDialog,
  dataTable,
  emptyState,
  errorState,
  field,
  grid,
  iconButton,
  openModal,
  pageHeader,
  selectInput,
  skeleton,
  spinner,
  statCard,
  tabs,
  textInput,
  textareaInput,
  toast,
  userChip,
} from "../ui/components.js";
import { createQuery } from "../core/store.js";
import { barChart, donut, horizontalBars } from "../ui/charts.js";
import { debounce, downloadText, fmtDateTime, fmtInt, fmtRelative, titleCase, toCsv } from "../core/format.js";

const ACTION_LABELS = {
  ban: "Ban",
  unban: "Unban",
  kick: "Kick",
  warn: "Warn",
  delwarn: "Remove warning",
  clearwarns: "Clear warnings",
  timeout: "Timeout",
  untimeout: "Remove timeout",
  note: "Add note",
  nick: "Change nickname",
  forcenick: "Force nickname",
  forcenick_reset: "Release forced nickname",
  role_add: "Add role",
  role_remove: "Remove role",
};

const ACTION_STATUS_LABELS = {
  banned: "Member banned",
  unbanned: "Member unbanned",
  kicked: "Member kicked",
  warned: "Warning added",
  removed: "Warning removed",
  not_found: "Warning was already gone",
  cleared: "Warnings cleared",
  timed_out: "Timeout applied",
  untimeout: "Timeout removed",
  note_added: "Note saved",
  nick_changed: "Nickname changed",
  forcenick_set: "Force-nick applied",
  forcenick_released: "Force-nick released",
  role_added: "Role added",
  role_removed: "Role removed",
};

const ACTION_TONES = {
  ban: "danger",
  kick: "danger",
  timeout: "warning",
  warn: "warning",
  unban: "success",
  untimeout: "success",
  role_add: "accent",
  role_remove: "warning",
  note: "muted",
  nick: "muted",
  forcenick: "warning",
  forcenick_reset: "muted",
  clearwarns: "warning",
  delwarn: "muted",
};

const LOG_TYPES = ["ban", "unban", "kick", "warn", "delwarn", "clearwarns", "timeout", "untimeout", "note", "nick", "forcenick", "role_add", "role_remove", "jail", "unjail"];

const DURATIONS = [
  { value: "60s", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "28d", label: "28 days (max)" },
];

export async function mountPage(ctx) {
  const { root, endpoints, guildId, toast: notify, confirm, prefs, router } = ctx;
  const page = h("div", { class: "page" });
  const body = h("div", { class: "stack" });
  const queries = new Map();
  const cache = new Map();
  let lookupTarget = "";
  let logFilters = { type: "", user: "", limit: 200 };

  const header = pageHeader({
    eyebrow: "Server",
    title: "Moderation",
    description: "Every action here is written to the same mod-log table the bot uses, so Discord logs and the dashboard stay in sync.",
    actions: [
      button({ label: "Open user lookup", icon: "search", onClick: () => tabHandle.select("lookup") }),
      button({ label: "Refresh", icon: "refresh", onClick: () => refreshAll() }),
    ],
  });
  body.append(header);

  function query(key, fetcher, options = {}) {
    if (!queries.has(key)) {
      const q = createQuery(fetcher, {
        autoRefresh: prefs.get().autoRefresh ? options.autoRefresh ?? 0 : 0,
        cacheTtl: options.cacheTtl ?? 0,
      });
      queries.set(key, q);
    }
    return queries.get(key);
  }

  function refreshAll() {
    queries.forEach((q) => q.refresh());
    notify.info("Refreshing moderation data…");
  }

  /* ---------------- actions ---------------- */

  async function runAction({ action, target, targetName, reason, duration, extra, destructive = false, confirmText = "" }) {
    if (destructive && prefs.get().confirmDestructive) {
      const ok = await (confirm || confirmDialog)({
        title: `${ACTION_LABELS[action] || action} ${targetName || target}?`,
        message: `This runs immediately and is logged. ${action === "ban" ? "The member is banned from this server." : action === "kick" ? "The member is removed from this server." : ""}`,
        confirmLabel: ACTION_LABELS[action] || "Confirm",
        danger: true,
        requireText: confirmText && prefs.get().confirmDestructive ? confirmText : "",
      });
      if (!ok) return false;
    }
    try {
      const result = await endpoints.modAction({
        guild_id: guildId,
        action,
        target,
        reason: reason || "Action from dashboard",
        duration: duration || "1h",
        extra: extra || {},
      });
      notify.success(ACTION_STATUS_LABELS[result?.status] || (result?.status ? titleCase(String(result.status).replace(/_/g, " ")) : "Action applied"));
      queries.forEach((q) => q.refresh());
      return true;
    } catch (err) {
      notify.error(err?.message || "The action failed", { title: "Moderation action failed" });
      return false;
    }
  }

  function openActionForm({ action: initialAction = "warn", target = "", targetName = "", onDone } = {}) {
    let action = initialAction;
    const targetInput = textInput({ value: target, placeholder: "User ID, @mention or username" });
    const reasonInput = textareaInput({ rows: 3, placeholder: "Why? This is stored in the mod log and shown in Discord." });
    const durationSelect = selectInput({ value: "1h", options: DURATIONS });
    const warnIdInput = textInput({ placeholder: "Warning ID (from the user's dossier)" });
    const noteInput = textareaInput({ rows: 3, placeholder: "Internal staff note (never shown to the member)" });
    const nickInput = textInput({ placeholder: "Nickname (empty resets for /nick)" });
    const actionSelect = selectInput({
      value: action,
      options: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
      onChange: (value) => {
        action = value;
        paintExtra();
      },
    });

    const extraHost = h("div", { class: "stack-tight" });
    const rolesQ = query("roles", () => endpoints.modRoles(guildId), { cacheTtl: 60_000 });
    rolesQ.start();
    let roleSelect = null;

    function paintExtra() {
      clear(extraHost);
      if (["timeout"].includes(action)) extraHost.append(field({ label: "Duration", children: durationSelect }));
      if (["warn", "ban", "kick", "timeout", "note"].includes(action)) extraHost.append(field({ label: "Reason", required: action !== "note", children: reasonInput }));
      if (action === "note") extraHost.append(field({ label: "Note", children: noteInput }));
      if (["delwarn"].includes(action)) extraHost.append(field({ label: "Warning ID", help: "Find it in the user dossier.", required: true, children: warnIdInput }));
      if (["nick", "forcenick"].includes(action)) extraHost.append(field({ label: "Nickname", required: action === "forcenick", help: action === "forcenick" ? "Locks the nickname until released." : "Empty resets the nickname.", children: nickInput }));
      if (["role_add", "role_remove"].includes(action)) {
        const roles = rolesQ.get().data?.roles || [];
        roleSelect = selectInput({ options: roles.map((role) => ({ value: role.id, label: role.name })), placeholder: roles.length ? "Pick a role…" : "Loading roles…" });
        extraHost.append(field({ label: "Role", required: true, children: roleSelect }));
      }
      if (["ban", "kick", "clearwarns", "forcenick"].includes(action)) {
        extraHost.append(callout({ tone: "warning", children: "Destructive actions ask for confirmation before they run." }));
      }
    }

    const modal = openModal({
      title: `Moderation action`,
      size: "md",
      body: h(
        "div",
        { class: "stack-tight" },
        field({ label: "Action", children: actionSelect }),
        field({ label: "Target", help: targetName ? `Resolved as ${targetName}` : "Accepts an ID, mention or username.", children: targetInput }),
        extraHost
      ),
      footer: [
        button({ label: "Cancel", variant: "ghost", onClick: () => modal.close() }),
        h("span", { class: "spacer" }),
        button({
          label: "Apply action",
          variant: ["ban", "kick"].includes(action) ? "danger" : "primary",
          icon: "shield",
          onClick: async () => {
            const finalTarget = targetInput.value.trim() || target;
            if (!finalTarget) {
              targetInput.setAttribute("aria-invalid", "true");
              targetInput.focus();
              return;
            }
            if (["warn", "ban", "kick"].includes(action) && !reasonInput.value.trim()) {
              reasonInput.setAttribute("aria-invalid", "true");
              reasonInput.focus();
              return;
            }
            const extra = {};
            if (action === "delwarn") extra.warn_id = warnIdInput.value.trim();
            if (["nick", "forcenick"].includes(action)) extra.nick = nickInput.value;
            if (["role_add", "role_remove"].includes(action)) {
              if (!roleSelect?.value) {
                roleSelect?.focus();
                return;
              }
              extra.role_id = roleSelect.value;
            }
            if (action === "note") extra.note = noteInput.value.trim() || reasonInput.value.trim();
            const ok = await runAction({
              action,
              target: finalTarget,
              targetName,
              reason: reasonInput.value.trim(),
              duration: durationSelect.value,
              extra,
              destructive: ["ban", "kick", "clearwarns", "forcenick"].includes(action),
              confirmText: ["ban", "kick"].includes(action) ? finalTarget : "",
            });
            if (ok) {
              modal.close();
              onDone?.();
            }
          },
        }),
      ],
    });
    paintExtra();
    setTimeout(() => targetInput.focus(), 40);
    return modal;
  }

  /* ---------------- tabs ---------------- */

  const tabHandle = tabs({
    tabs: [
      { id: "stats", label: "Overview", icon: "chart", render: () => renderStatsTab() },
      { id: "logs", label: "Logs", icon: "file-text", render: () => renderLogsTab() },
      { id: "bans", label: "Bans", icon: "user-x", render: () => renderBansTab() },
      { id: "members", label: "Members", icon: "users", render: () => renderMembersTab() },
      { id: "lookup", label: "User lookup", icon: "search", render: () => renderLookupTab() },
      { id: "actions", label: "Actions", icon: "shield", render: () => renderActionsTab() },
    ],
    active: ctx.ctx.query?.tab || "stats",
  });
  body.append(tabHandle.el);

  /* ---- stats ---- */

  function renderStatsTab() {
    const q = query("stats", () => endpoints.modStats(guildId), { autoRefresh: prefs.get().autoRefresh ? 60_000 : 0 });
    q.start();
    const host = h("div", { class: "stack" });
    q.subscribe((state) => {
      clear(host);
      if (state.data == null && state.status === "loading") {
        host.append(grid(2, card({ children: skeleton({ h: 140 }) }), card({ children: skeleton({ h: 140 }) })));
        return;
      }
      if (state.error && !state.data) {
        host.append(card({ children: errorState({ error: state.error, onRetry: () => q.refresh() }) }));
        return;
      }
      const data = state.data || { total: 0, by_action: {}, top_mods: [], activity_7d: {} };
      const byAction = data.by_action || {};
      const segments = Object.entries(byAction)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([label, value]) => ({ label: titleCase(label), value }));
      host.append(
        h(
          "div",
          { class: "stats-grid" },
          statCard({ label: "Actions logged", value: fmtInt(data.total), icon: "shield", tone: "accent" }),
          statCard({ label: "Distinct action types", value: fmtInt(Object.keys(byAction).length), icon: "list", tone: "violet" }),
          statCard({ label: "Most active moderator", value: data.top_mods?.[0]?.name || "—", hint: data.top_mods?.[0] ? `${fmtInt(data.top_mods[0].count)} actions` : "", icon: "crown", tone: "warning" }),
          statCard({ label: "Actions · 7d", value: fmtInt(Object.values(data.activity_7d || {}).reduce((sum, n) => sum + n, 0)), icon: "activity", tone: "success" })
        ),
        grid(
          2,
          card({
            title: "Action mix",
            children: segments.length ? donut({ segments, centerLabel: "actions", centerValue: fmtInt(data.total), label: "Moderation action mix" }) : emptyState({ icon: "shield", title: "No actions yet", message: "Warnings, kicks and bans will appear here.", compact: true }),
          }),
          card({
            title: "Most active moderators",
            children: data.top_mods?.length
              ? horizontalBars({ items: data.top_mods.map((mod) => ({ label: mod.name, value: mod.count })), label: "Top moderators", color: "#fbbf24" })
              : emptyState({ icon: "users", title: "No moderators logged", compact: true }),
          })
        ),
        card({
          title: "Last 7 days",
          children: data.activity_7d
            ? barChart({ labels: Object.keys(data.activity_7d), series: [{ label: "Actions", values: Object.values(data.activity_7d), color: "#fbbf24" }], height: 180, showLegend: false, label: "Moderation actions in the last 7 days" })
            : h("p", { class: "small muted" }, "No activity data."),
        })
      );
    });
    return host;
  }

  /* ---- logs ---- */

  function renderLogsTab() {
    const q = query("logs", () => endpoints.modLogs(guildId, { limit: logFilters.limit, type: logFilters.type || undefined, user: logFilters.user || undefined }));
    q.start();
    const host = h("div", { class: "stack" });
    let pageNumber = 1;
    let sort = { key: "timestamp", direction: "desc" };

    const typeSelect = selectInput({
      value: logFilters.type,
      options: LOG_TYPES.map((type) => ({ value: type, label: titleCase(type) })),
      placeholder: "All action types",
      onChange: (value) => {
        logFilters.type = value;
        pageNumber = 1;
        q.refresh();
      },
    });
    const userInput = textInput({
      placeholder: "Filter by user (ID, name or @mention)",
      onInput: debounce((value) => {
        logFilters.user = value.trim();
        pageNumber = 1;
        q.refresh();
      }, 450),
    });
    const limitSelect = selectInput({ value: String(logFilters.limit), options: [50, 100, 200].map((n) => ({ value: String(n), label: `${n} rows` })), onChange: (value) => { logFilters.limit = Number(value); pageNumber = 1; q.refresh(); } });

    const tableHost = h("div");
    host.append(
      card({
        title: "Moderation log",
        subtitle: "Newest first. Filtering re-queries the bot so you see exactly its stored rows.",
        actions: [
          button({
            label: "Export CSV",
            icon: "download",
            size: "sm",
            variant: "ghost",
            onClick: () => {
              const logs = q.get().data?.logs || [];
              if (!logs.length) return notify.info("Nothing to export.");
              downloadText(`rift-modlogs-${guildId}.csv`, toCsv(logs.map((entry) => ({
                action: entry.action,
                target: entry.target?.name,
                target_id: entry.target?.id,
                moderator: entry.moderator?.name,
                reason: entry.reason,
                timestamp: entry.timestamp ? new Date(entry.timestamp * 1000).toISOString() : "",
              }))));
            },
          }),
          button({ label: "Refresh", icon: "refresh", size: "sm", onClick: () => q.refresh() }),
        ],
        children: [
          h("div", { class: "row", style: "margin-bottom:12px" }, typeSelect, userInput, h("span", { class: "spacer" }), limitSelect),
          tableHost,
        ],
      })
    );

    function paint(state) {
      clear(tableHost);
      const logs = state.data?.logs || [];
      const sorted = [...logs].sort((a, b) => {
        if (sort.key === "timestamp") return sort.direction === "desc" ? (b.timestamp || 0) - (a.timestamp || 0) : (a.timestamp || 0) - (b.timestamp || 0);
        return String(a[sort.key] || "").localeCompare(String(b[sort.key] || "")) * (sort.direction === "asc" ? 1 : -1);
      });
      tableHost.append(
        dataTable({
          rows: sorted,
          loading: state.status === "loading",
          error: state.error && !logs.length ? state.error : null,
          onRetry: () => q.refresh(),
          pageSize: 20,
          page: pageNumber,
          onPageChange: (next) => {
            pageNumber = next;
            paint(q.get());
          },
          sort,
          onSortChange: (key, direction) => {
            sort = { key, direction };
            paint(q.get());
          },
          empty: emptyState({ icon: "file-text", title: "No matching log entries", compact: true }),
          columns: [
            { key: "action", label: "Action", width: 118, render: (row) => badge({ label: titleCase(row.action || "?"), tone: ACTION_TONES[row.action] || "muted" }) },
            { key: "target", label: "Target", render: (row) => userChip({ name: row.target?.name || "Unknown", avatarUrl: row.target?.avatar, sub: row.target?.id, size: 24 }) },
            { key: "moderator", label: "Moderator", render: (row) => userChip({ name: row.moderator?.name || "System", avatarUrl: row.moderator?.avatar, size: 24 }) },
            { key: "reason", label: "Reason", render: (row) => h("span", { class: "truncate", style: "max-width:280px;display:inline-block", title: row.reason }, row.reason || "—") },
            { key: "timestamp", label: "When", align: "right", width: 120, render: (row) => h("span", { class: "small muted", title: fmtDateTime(row.timestamp) }, fmtRelative(row.timestamp)) },
          ],
          onRowClick: (row) => showLogDetail(row),
        })
      );
    }

    q.subscribe(paint);
    paint(q.get());
    return host;
  }

  function showLogDetail(row) {
    openModal({
      title: `${titleCase(row.action || "log")} · ${row.target?.name || "unknown"}`,
      size: "md",
      body: h(
        "div",
        { class: "stack-tight" },
        h("div", { class: "row" }, badge({ label: titleCase(row.action || "?"), tone: ACTION_TONES[row.action] || "muted" }), h("span", { class: "small muted" }, fmtDateTime(row.timestamp))),
        h("div", { class: "row" }, userChip({ name: row.target?.name, avatarUrl: row.target?.avatar, sub: row.target?.id }), h("span", { class: "muted small" }, "← by"), userChip({ name: row.moderator?.name, avatarUrl: row.moderator?.avatar, sub: row.moderator?.id })),
        field({ label: "Reason", children: h("p", { class: "muted" }, row.reason || "No reason recorded.") }),
        row.extra && Object.keys(row.extra).length ? field({ label: "Extra data", children: h("pre", { class: "code-block" }, JSON.stringify(row.extra, null, 2)) }) : null
      ),
      footer: [button({ label: "Close", variant: "primary", onClick: () => document.querySelector(".overlay:last-of-type")?.remove() })],
    });
  }

  /* ---- bans ---- */

  function renderBansTab() {
    const q = query("bans", () => endpoints.modBans(guildId), { cacheTtl: 15_000 });
    q.start();
    const host = h("div");
    const tableHost = h("div");
    host.append(
      card({
        title: "Banned members",
        subtitle: "Up to 100 bans from Discord. Unbanning here also logs the action.",
        actions: button({ label: "Refresh", icon: "refresh", size: "sm", onClick: () => q.refresh() }),
        children: tableHost,
      })
    );
    q.subscribe((state) => {
      clear(tableHost);
      const bans = state.data?.bans || [];
      tableHost.append(
        dataTable({
          rows: bans,
          loading: state.status === "loading",
          error: state.error && !bans.length ? state.error : null,
          onRetry: () => q.refresh(),
          empty: emptyState({ icon: "user-check", title: "No bans", message: "Nobody is banned from this server.", compact: true }),
          columns: [
            { key: "name", label: "Member", render: (row) => userChip({ name: row.name, avatarUrl: row.avatar, sub: row.id }) },
            { key: "reason", label: "Reason", render: (row) => h("span", { class: "truncate", style: "max-width:420px;display:inline-block", title: row.reason }, row.reason) },
            {
              key: "actions",
              label: "",
              align: "right",
              width: 90,
              render: (row) =>
                button({
                  label: "Unban",
                  size: "sm",
                  variant: "ghost",
                  icon: "user-check",
                  onClick: async () => {
                    const ok = await confirm({ title: `Unban ${row.name}?`, message: "They'll be able to rejoin with any valid invite.", confirmLabel: "Unban", danger: false });
                    if (!ok) return;
                    await runAction({ action: "unban", target: row.id, targetName: row.name, reason: "Unbanned from dashboard" });
                    q.refresh();
                  },
                }),
            },
          ],
        })
      );
    });
    return host;
  }

  /* ---- members ---- */

  function renderMembersTab() {
    const host = h("div", { class: "stack" });
    let search = "";
    const q = query("members", () => endpoints.modMembers(guildId, search));
    q.start();
    const tableHost = h("div");
    const input = textInput({
      placeholder: "Search by name, display name or ID…",
      onInput: debounce((value) => {
        search = value.trim();
        q.refresh();
      }, 300),
    });
    host.append(
      card({
        title: "Member search",
        subtitle: "Returns at most 25 matches from the bot's cache. Use User lookup for a full dossier.",
        children: [h("div", { class: "row", style: "margin-bottom:12px" }, input), tableHost],
      })
    );
    q.subscribe((state) => {
      clear(tableHost);
      const members = state.data?.members || [];
      tableHost.append(
        dataTable({
          rows: members,
          loading: state.status === "loading",
          error: state.error && !members.length ? state.error : null,
          onRetry: () => q.refresh(),
          empty: emptyState({ icon: "users", title: search ? "No members match" : "Start typing", message: search ? "Try a different name or ID." : "Search for a member to see their quick profile.", compact: true }),
          columns: [
            { key: "name", label: "Member", render: (row) => userChip({ name: row.name, avatarUrl: row.avatar, sub: `@${row.username}${row.bot ? " · bot" : ""}` }) },
            { key: "id", label: "ID", render: (row) => h("span", { class: "mono small muted" }, row.id) },
            { key: "timed_out", label: "Status", render: (row) => (row.timed_out ? badge({ label: "Timed out", tone: "warning" }) : badge({ label: "Active", tone: "muted" })) },
            {
              key: "go",
              label: "",
              align: "right",
              render: (row) =>
                h(
                  "div",
                  { class: "row", style: "justify-content:flex-end;gap:4px" },
                  button({ label: "Look up", size: "sm", variant: "ghost", icon: "search", onClick: () => { lookupTarget = row.id; tabHandle.select("lookup"); } }),
                  iconButton({ icon: "shield", label: `Moderate ${row.name}`, size: "sm", onClick: () => openActionForm({ target: row.id, targetName: row.name, onDone: () => q.refresh() }) })
                ),
            },
          ],
        })
      );
    });
    return host;
  }

  /* ---- lookup ---- */

  function renderLookupTab() {
    const host = h("div", { class: "stack" });
    const resultHost = h("div");
    let currentQuery = lookupTarget;
    const input = textInput({ value: lookupTarget, placeholder: "User ID, @mention or username" });
    const search = async () => {
      const value = input.value.trim();
      if (!value) {
        clear(resultHost);
        resultHost.append(emptyState({ icon: "search", title: "Look someone up", message: "Search by ID, @mention or username. The dossier includes warnings, notes, roles and recent history.", compact: false }));
        return;
      }
      lookupTarget = value;
      currentQuery = value;
      clear(resultHost);
      resultHost.append(h("div", { class: "row", style: "padding:18px" }, spinner({ size: 16 }), h("span", { class: "muted" }, "Building dossier…")));
      try {
        const data = await endpoints.modUser(guildId, value);
        clear(resultHost);
        resultHost.append(renderDossier(data, value));
      } catch (err) {
        clear(resultHost);
        resultHost.append(errorState({ error: err, onRetry: search }));
      }
    };

    host.append(
      card({
        title: "User lookup",
        subtitle: "One request returns warnings, notes, moderation history and guild roles.",
        children: h("div", { class: "row", style: "margin-bottom:14px" }, input, button({ label: "Look up", variant: "primary", icon: "search", onClick: search }), button({ label: "Moderate", icon: "shield", variant: "ghost", onClick: () => openActionForm({ target: input.value.trim(), onDone: search }) })),
      }),
      resultHost
    );
    if (currentQuery) setTimeout(search, 30);
    else resultHost.append(emptyState({ icon: "search", title: "Look someone up", message: "Search by ID, @mention or username. The dossier includes warnings, notes, roles and recent history." }));

    return host;
  }

  function renderDossier(data, searched) {
    const user = data.user || {};
    const warnings = data.warnings || [];
    const notes = data.notes || [];
    const history = data.history || [];
    return h(
      "div",
      { class: "stack" },
      card({
        children: h(
          "div",
          { class: "dossier" },
          avatar({ name: user.name || searched, src: user.avatar, size: 64, ring: true }),
          h(
            "div",
            { class: "dossier-main" },
            h("div", { class: "row", style: "gap:8px" }, h("h2", { style: "font-size:18px" }, user.name || "Unknown user"), user.bot && badge({ label: "Bot", tone: "info" }), user.in_guild ? badge({ label: "In server", tone: "success", dot: true }) : badge({ label: "Not in server", tone: "muted" }), user.is_banned && badge({ label: "Banned", tone: "danger" }), user.timed_out && badge({ label: "Timed out", tone: "warning" })),
            h("div", { class: "row", style: "gap:10px;margin-top:4px" }, h("span", { class: "small muted mono" }, user.id || searched), user.username && h("span", { class: "small muted" }, `@${user.username}`)),
            h(
              "div",
              { class: "row", style: "gap:14px;margin-top:8px;flex-wrap:wrap" },
              h("span", { class: "small muted" }, `Created ${fmtRelative(user.created_at)}`),
              user.joined_at && h("span", { class: "small muted" }, `Joined ${fmtRelative(user.joined_at)}`),
              badge({ label: `${fmtInt(data.warn_count ?? warnings.length)} warnings`, tone: warnings.length ? "warning" : "muted" })
            ),
            data.roles?.length
              ? h("div", { class: "row", style: "gap:5px;margin-top:10px;flex-wrap:wrap;max-height:78px;overflow:auto" }, data.roles.map((role) => badge({ label: role.name, tone: "neutral" })))
              : h("p", { class: "small muted", style: "margin-top:8px" }, "No roles in this server.")
          ),
          h(
            "div",
            { class: "dossier-actions" },
            button({ label: "Warn", icon: "alert", size: "sm", onClick: () => openActionForm({ action: "warn", target: user.id || searched, targetName: user.name, onDone: () => tabHandle.select("lookup") }) }),
            button({ label: "Timeout", icon: "clock", size: "sm", onClick: () => openActionForm({ action: "timeout", target: user.id || searched, targetName: user.name, onDone: () => tabHandle.select("lookup") }) }),
            button({ label: "Nickname", icon: "edit", size: "sm", variant: "ghost", onClick: () => openActionForm({ action: "nick", target: user.id || searched, targetName: user.name }) }),
            button({ label: "Roles", icon: "key", size: "sm", variant: "ghost", onClick: () => openActionForm({ action: "role_add", target: user.id || searched, targetName: user.name }) }),
            button({ label: user.is_banned ? "Unban" : "Ban", icon: user.is_banned ? "user-check" : "user-x", size: "sm", variant: user.is_banned ? "ghost" : "danger", onClick: () => openActionForm({ action: user.is_banned ? "unban" : "ban", target: user.id || searched, targetName: user.name, onDone: () => tabHandle.select("lookup") }) }),
            button({ label: "More…", icon: "more-horizontal", size: "sm", variant: "ghost", onClick: () => openActionForm({ action: "note", target: user.id || searched, targetName: user.name, onDone: () => tabHandle.select("lookup") }) })
          )
        ),
      }),
      grid(
        2,
        card({
          title: `Warnings (${warnings.length})`,
          actions: warnings.length ? button({ label: "Clear all", size: "sm", variant: "ghost", onClick: async () => {
            const ok = await confirm({ title: "Clear all warnings?", message: `This removes ${warnings.length} warning(s) for ${user.name}.`, confirmLabel: "Clear warnings", danger: true, requireText: "CLEAR" });
            if (ok) {
              await runAction({ action: "clearwarns", target: user.id || searched, targetName: user.name, reason: "Cleared from dashboard" });
              tabHandle.select("lookup");
            }
          } }) : null,
          children: warnings.length
            ? h("div", { class: "stack-tight" }, warnings.map((warning) => h("div", { class: "row", style: "align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line)" }, h("div", { style: "flex:1" }, h("div", { class: "small" }, warning.reason || "No reason"), h("div", { class: "small muted" }, `${warning.moderator?.name || "Unknown"} · ${fmtRelative(warning.timestamp)}`)), button({ label: "Remove", size: "sm", variant: "ghost", onClick: async () => {
              const ok = await confirm({ title: "Remove this warning?", message: warning.reason || "No reason recorded.", confirmLabel: "Remove", danger: true });
              if (ok) {
                await runAction({ action: "delwarn", target: user.id || searched, targetName: user.name, extra: { warn_id: warning.id }, reason: "Warning removed from dashboard" });
                tabHandle.select("lookup");
              }
            } }))))
            : emptyState({ icon: "check-circle", title: "Clean record", message: "No warnings in this server.", compact: true }),
        }),
        card({
          title: `Moderation history (${history.length})`,
          children: history.length
            ? h("div", { class: "timeline" }, history.map((entry) => h("div", { class: "timeline-item" }, h("span", { class: "timeline-dot" }), h("div", { class: "timeline-body" }, h("div", { class: "row", style: "gap:7px" }, badge({ label: titleCase(entry.action || "?"), tone: ACTION_TONES[entry.action] || "muted" }), h("span", { class: "small muted" }, fmtRelative(entry.timestamp))), h("div", { class: "small" }, entry.reason || "No reason"), h("div", { class: "small muted" }, `by ${entry.moderator?.name || "Unknown"}`)))))
            : emptyState({ icon: "file-text", title: "No history", compact: true }),
        })
      ),
      notes.length &&
        card({
          title: `Staff notes (${notes.length})`,
          children: h("div", { class: "stack-tight" }, notes.map((note) => h("div", { class: "row", style: "align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)" }, icon("file-text", { size: 14 }), h("div", { style: "flex:1" }, h("div", { class: "small" }, note.reason), h("div", { class: "small muted" }, `${note.moderator?.name || "Unknown"} · ${fmtRelative(note.timestamp)}`))))),
        })
    );
  }

  /* ---- actions ---- */

  function renderActionsTab() {
    const host = h("div", { class: "stack" });
    const target = textInput({ placeholder: "User ID, @mention or username" });
    const action = selectInput({ value: "warn", options: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })) });
    host.append(
      card({
        title: "Quick action",
        subtitle: "Resolve a target then choose an action. Everything is written to the mod log with your Discord ID.",
        children: [
          h("div", { class: "field-grid" }, field({ label: "Target", children: target }), field({ label: "Action", children: action })),
          h("div", { class: "form-actions" }, h("span", { class: "spacer" }), button({ label: "Continue", variant: "primary", icon: "arrow-right", onClick: () => {
            if (!target.value.trim()) {
              target.setAttribute("aria-invalid", "true");
              target.focus();
              notify.error("Enter a user to moderate.");
              return;
            }
            openActionForm({ action: action.value, target: target.value.trim(), onDone: () => tabHandle.select("stats") });
          } })),
        ],
      }),
      callout({
        tone: "info",
        title: "Discord parity",
        children: "The dashboard uses the same `_run_mod_action` dispatcher as the bot's slash commands, so hierarchy checks, DM notices and log entries behave identically.",
      })
    );
    return host;
  }

  mount(page, body);
  mount(root, page);
  return () => {
    queries.forEach((q) => q.dispose());
    tabHandle.el.remove();
    clear(root);
  };
}
