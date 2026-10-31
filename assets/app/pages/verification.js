/* Verification activity: the security side of the verification gate.
 *
 * Flags are created when the bot recognises a banned member's browser
 * fingerprint on a new account. Fingerprints are one-way SHA-256 hashes; the
 * page never has access to anything that could be replayed. */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  callout,
  card,
  copyButton,
  dataTable,
  emptyState,
  errorState,
  field,
  iconButton,
  keyValueGrid,
  openModal,
  pageHeader,
  statCard,
  tabs,
  toast,
  userChip,
} from "../ui/components.js";
import { asList } from "../data/endpoints.js";
import { fmtDateTime, fmtInt, fmtRelative, safeJsonParse, truncate } from "../core/format.js";

function pick(object, keys, fallback = "") {
  for (const key of keys) {
    const value = object?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function normalizeFlag(raw) {
  const user = pick(raw, ["user_id", "userId", "flagged_user_id", "offender_id"]);
  const matched = pick(raw, ["matched_user_id", "matched_id", "banned_user_id", "target_id"]);
  return {
    id: pick(raw, ["id", "flag_id", "row_id"], `${user}-${matched}-${pick(raw, ["created_at", "timestamp"])}`),
    userId: String(user || ""),
    matchedId: String(matched || ""),
    reason: pick(raw, ["reason", "details", "note"], "Fingerprint match"),
    hash: pick(raw, ["fingerprint_hash", "fp_hash", "hash", "fingerprint"]),
    createdAt: pick(raw, ["created_at", "created", "timestamp", "flagged_at"]),
    guildId: pick(raw, ["guild_id"]),
    raw,
  };
}

function normalizeFingerprint(raw) {
  const user = pick(raw, ["user_id", "userId"]);
  return {
    id: pick(raw, ["id", "fingerprint_id", "row_id"], `${user}-${pick(raw, ["fingerprint_hash", "fp_hash", "hash"])}-${pick(raw, ["created_at", "timestamp"])}`),
    userId: String(user || ""),
    hash: pick(raw, ["fingerprint_hash", "fp_hash", "hash", "fingerprint"]),
    createdAt: pick(raw, ["created_at", "created", "timestamp", "last_seen", "updated_at"]),
    metadata: raw?.metadata ?? raw?.meta ?? null,
    raw,
  };
}

function discordUserLink(id) {
  return id ? `https://discord.com/users/${id}` : "";
}

function timeNode(value) {
  if (!value) return h("span", { class: "muted" }, "—");
  return h("span", { title: fmtDateTime(value) }, fmtRelative(value));
}

export async function mountPage(ctx) {
  const { root, guildId, endpoints, toast: notify, router, signal } = ctx;

  let disposed = false;
  const state = {
    flags: { status: "loading", items: [], error: null },
    fingerprints: { status: "loading", items: [], error: null },
    config: { status: "loading", data: null, error: null },
    tab: "flags",
    query: "",
  };

  const page = h("div", { class: "page" });
  const header = pageHeader({
    eyebrow: "Security",
    title: "Verification activity",
    description: "Fingerprint matches, banned-user flags and the lane the verification gate is configured with. Hashes are one-way — treat them as sensitive anyway.",
    actions: h("div", { class: "row" }),
  });
  const headerActions = header.querySelector(".page-head-actions") || header;
  mount(headerActions, h("div", { class: "row", style: "gap:6px" }, button({ label: "Verification settings", icon: "settings", variant: "outline", size: "sm", onClick: () => router.navigate(`/g/${guildId}/settings/verification`) }), iconButton({ icon: "refresh", label: "Refresh activity", onClick: () => loadAll(true) })));

  const content = h("div", { class: "stack" });
  mount(page, header, content);
  mount(root, page);

  const summary = h("div", { class: "stats-grid" });
  const configCard = card({ title: "Verification gate", subtitle: "Current configuration for this server." });
  const activityCard = card({ title: "Activity", actions: h("div", { id: "activity-actions" }) });
  mount(content, summary, configCard, activityCard);

  const tabsHost = h("div");
  const tableHost = h("div");
  const body = activityCard.querySelector(".card-body");
  mount(body, h("div", { class: "stack-tight" }, tabsHost));
  let tabsBuilt = false;

  const activityActions = activityCard.querySelector("#activity-actions");

  /* ----------------------------- summary ----------------------------- */

  function visibleFlags() {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.flags.items;
    return state.flags.items.filter((flag) => `${flag.userId} ${flag.matchedId} ${flag.reason} ${flag.hash}`.toLowerCase().includes(query));
  }

  function renderSummary() {
    clear(summary);
    const flags = state.flags.items;
    const prints = state.fingerprints.items;
    const uniqueUsers = new Set(flags.map((flag) => flag.userId).filter(Boolean)).size;
    const newest = flags
      .map((flag) => flag.createdAt)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    const printsLoaded = state.fingerprints.status === "ready";
    const flagsLoaded = state.flags.status === "ready";
    summary.append(
      statCard({ label: "Fingerprint flags", value: flagsLoaded ? fmtInt(flags.length) : "—", hint: "Banned-user matches", icon: "shield-alert", tone: flags.length ? "danger" : "success", loading: state.flags.status === "loading" }),
      statCard({ label: "Flagged accounts", value: flagsLoaded ? fmtInt(uniqueUsers) : "—", hint: "Unique Discord users", icon: "users", loading: state.flags.status === "loading" }),
      statCard({ label: "Stored fingerprints", value: printsLoaded ? fmtInt(prints.length) : "—", hint: "Successful verifications", icon: "fingerprint", tone: "violet", loading: state.fingerprints.status === "loading" }),
      statCard({ label: "Most recent flag", value: newest ? fmtRelative(newest) : "None", hint: newest ? fmtDateTime(newest) : "No flagged verifications", icon: "clock", tone: newest ? "warning" : "neutral", loading: state.flags.status === "loading" })
    );
  }

  /* ------------------------------ config ------------------------------ */

  function renderConfig() {
    const bodyEl = configCard.querySelector(".card-body");
    clear(bodyEl);
    const cfg = state.config;
    if (cfg.status === "loading") {
      bodyEl.append(h("div", { class: "stack-tight" }, ...Array.from({ length: 4 }, () => h("div", { class: "skeleton", style: "height:14px;border-radius:6px" }))));
      return;
    }
    if (cfg.status === "error") {
      bodyEl.append(errorState({ error: cfg.error, compact: true, onRetry: () => loadConfig(true) }));
      return;
    }
    const data = cfg.data || {};
    const enabled = data.enabled === undefined ? null : Boolean(data.enabled);
    const type = pick(data, ["type", "verification_type", "mode"], "button");
    const roles = asList(data, ["roles_to_remove"]);
    bodyEl.append(
      h(
        "div",
        { class: "stack" },
        h(
          "div",
          { class: "row", style: "gap:6px;flex-wrap:wrap" },
          enabled == null ? badge({ label: "Not configured", tone: "neutral" }) : badge({ label: enabled ? "Enabled" : "Disabled", tone: enabled ? "success" : "neutral", dot: true }),
          badge({ label: type === "password" ? "Password" : type === "button" ? "Button" : String(type), tone: "accent" }),
          data.password_configured ? badge({ label: "Password set", tone: "violet" }) : null
        ),
        keyValueGrid(
          [
            { label: "Verified role", value: data.role_id ? `@${data.role_name || data.role_id}` : "—" },
            { label: "Remove roles", value: roles.length ? `${roles.length} role${roles.length === 1 ? "" : "s"}` : "None" },
            { label: "Role ID", value: data.role_id ? h("span", { class: "mono", style: "font-size:11px" }, String(data.role_id)) : "—" },
            { label: "Config keys", value: `${Object.keys(data).length} fields` },
          ],
          { columns: 2 }
        ),
        h("p", { class: "muted", style: "font-size:11.5px" }, "Change any of this in Settings → Verification.")
      )
    );
  }

  /* ------------------------------ activity ------------------------------ */

  function mountTabs() {
    if (tabsBuilt) return;
    tabsBuilt = true;
    const flagCount = state.flags.items.length;
    const printCount = state.fingerprints.items.length;
    const handle = tabs({
        tabs: [
          { id: "flags", label: `Flags${flagCount ? ` (${flagCount})` : ""}`, render: () => tableHost },
          { id: "fingerprints", label: `Fingerprints${printCount ? ` (${printCount})` : ""}`, render: () => tableHost },
        ],
        active: state.tab,
        onChange: (id) => {
          state.tab = id;
          renderActivity();
        },
      });
    tabsHost.append(handle.el);
    if (activityActions) {
      clear(activityActions);
      activityActions.append(
        state.tab === "flags"
          ? h("span", { class: "muted", style: "font-size:11px" }, "Newest first")
          : h("span", { class: "muted", style: "font-size:11px" }, "Newest first")
      );
    }
  }

  function renderActivity() {
    mountTabs();
    clear(tableHost);
    if (state.tab === "flags") renderFlags();
    else renderFingerprints();
    renderSummary();
  }

  function renderFlags() {
    const data = state.flags;
    if (data.status === "error") {
      tableHost.append(errorState({ error: data.error, onRetry: () => loadFlags(true) }));
      return;
    }
    const rows = visibleFlags();
    tableHost.append(
      dataTable({
        columns: [
          {
            key: "userId",
            label: "Account",
            render: (row) => h("div", null, userChip({ name: `User ${row.userId}`, avatarUrl: "", sub: row.userId }), h("div", { class: "row", style: "gap:4px;margin-top:3px" }, row.userId ? h("a", { class: "btn btn--ghost btn--sm", href: discordUserLink(row.userId), target: "_blank", rel: "noreferrer" }, "Discord") : null)),
          },
          { key: "matchedId", label: "Matched banned user", render: (row) => (row.matchedId ? h("div", null, h("span", { class: "mono" }, row.matchedId), h("div", null, h("a", { class: "btn btn--ghost btn--sm", href: discordUserLink(row.matchedId), target: "_blank", rel: "noreferrer" }, "Open profile"))) : h("span", { class: "muted" }, "—")) },
          { key: "reason", label: "Reason", render: (row) => h("span", { title: row.reason }, truncate(row.reason, 60)) },
          { key: "hash", label: "Fingerprint", render: (row) => (row.hash ? copyButton({ text: row.hash, label: `${String(row.hash).slice(0, 10)}…`, size: "sm", variant: "ghost", successMessage: "Fingerprint hash copied" }) : h("span", { class: "muted" }, "—")) },
          { key: "createdAt", label: "When", align: "right", render: (row) => timeNode(row.createdAt) },
          {
            key: "actions",
            label: "",
            sortable: false,
            render: (row) =>
              iconButton({
                icon: "braces",
                label: "Raw flag payload",
                onClick: () => openModal({ title: "Flag details", body: h("pre", { class: "code-block" }, JSON.stringify(row.raw, null, 2)), footer: copyButton({ text: JSON.stringify(row.raw, null, 2), label: "Copy JSON" }) }),
              }),
          },
        ],
        rows,
        rowKey: (row) => row.id,
        loading: data.status === "loading",
        onRetry: () => loadFlags(true),
        error: data.status === "error" ? data.error : null,
        empty: emptyState({ icon: "shield-check", title: "No fingerprint flags", message: "When a banned member tries to verify with a new account, the match shows up here.", compact: true }),
        dense: true,
        caption: "Verification flags",
      })
    );
  }

  function renderFingerprints() {
    const data = state.fingerprints;
    if (data.status === "error") {
      tableHost.append(errorState({ error: data.error, onRetry: () => loadFingerprints(true) }));
      return;
    }
    tableHost.append(
      dataTable({
        columns: [
          { key: "userId", label: "Account", render: (row) => h("div", null, userChip({ name: `User ${row.userId}`, avatarUrl: "", sub: row.userId }), row.userId ? h("a", { class: "btn btn--ghost btn--sm", href: discordUserLink(row.userId), target: "_blank", rel: "noreferrer" }, "Discord") : null) },
          { key: "hash", label: "Hash", render: (row) => (row.hash ? h("span", { class: "mono", style: "font-size:11px", title: row.hash }, `${String(row.hash).slice(0, 20)}…`) : h("span", { class: "muted" }, "—")) },
          {
            key: "metadata",
            label: "Metadata",
            render: (row) => {
              const metadata = row.metadata;
              const entries = metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
              return entries.length ? h("span", { class: "muted", style: "font-size:11px" }, entries.slice(0, 3).join(", ") + (entries.length > 3 ? ` +${entries.length - 3}` : "")) : h("span", { class: "muted" }, "—");
            },
          },
          { key: "createdAt", label: "Verified", align: "right", render: (row) => timeNode(row.createdAt) },
          {
            key: "actions",
            label: "",
            sortable: false,
            render: (row) => iconButton({ icon: "braces", label: "Fingerprint details", onClick: () => openModal({ title: "Fingerprint details", body: h("pre", { class: "code-block" }, JSON.stringify({ ...row.raw, fingerprint: row.hash ? `${String(row.hash).slice(0, 12)}… (truncated in UI)` : null }, null, 2)), footer: copyButton({ text: JSON.stringify(row.raw, null, 2), label: "Copy JSON" }) }) }),
          },
        ],
        rows: data.items,
        rowKey: (row) => row.id,
        loading: data.status === "loading",
        error: data.status === "error" ? data.error : null,
        onRetry: () => loadFingerprints(true),
        empty: emptyState({ icon: "fingerprint", title: "No fingerprints stored", message: "Every successful web verification stores a one-way browser fingerprint here.", compact: true }),
        dense: true,
        caption: "Stored fingerprints",
      })
    );
  }

  /* ------------------------------- loads ------------------------------- */

  async function loadFlags(force = false) {
    if (!force && state.flags.status === "ready") return;
    if (!state.flags.items.length) state.flags.status = "loading";
    renderActivity();
    try {
      const payload = await endpoints.verificationFlags(guildId);
      state.flags = { status: "ready", items: asList(payload, ["flags"]).map(normalizeFlag), error: null };
    } catch (error) {
      state.flags = { status: "error", items: [], error };
    }
    renderActivity();
  }

  async function loadFingerprints(force = false) {
    if (!force && state.fingerprints.status === "ready") return;
    if (!state.fingerprints.items.length) state.fingerprints.status = "loading";
    try {
      const payload = await endpoints.verificationFingerprints(guildId);
      state.fingerprints = { status: "ready", items: asList(payload, ["fingerprints"]).map(normalizeFingerprint), error: null };
    } catch (error) {
      state.fingerprints = { status: "error", items: [], error };
    }
    renderActivity();
  }

  async function loadConfig(force = false) {
    if (!force && state.config.status === "ready") return;
    try {
      const payload = await endpoints.settingsGet(guildId, "verification");
      state.config = { status: "ready", data: payload, error: null };
    } catch (error) {
      state.config = { status: "error", data: null, error };
    }
    renderConfig();
  }

  async function loadAll(force = false) {
    if (force) {
      state.flags.status = "loading";
      state.fingerprints.status = "loading";
    }
    renderSummary();
    renderConfig();
    renderActivity();
    await Promise.allSettled([loadFlags(force), loadFingerprints(force), loadConfig(force)]);
    renderSummary();
    renderConfig();
    renderActivity();
  }

  renderSummary();
  renderActivity();
  renderConfig();

  await loadAll();

  return () => {
    disposed = true;
  };
}
