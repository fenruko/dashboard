/* Commands reference: a searchable view of every command the bot has loaded.
 *
 * Reads the bot's public command catalogue (GET /api/public/commands, ETag +
 * 5 minute cache), so a command added to a cog shows up here with no dashboard
 * change. Roughly 600 commands exist, so nothing is rendered until needed:
 * results are capped and grow with "Show more". */

import { h, mount, clear } from "../ui/dom.js";
import { badge, button, card, copyButton, emptyState, errorState, pageHeader, selectInput, statCard, textInput } from "../ui/components.js";
import { fmtInt, titleCase } from "../core/format.js";

const PAGE_SIZE = 60;

/** Flatten categories -> commands -> subcommands into searchable rows. */
export function flattenCatalog(payload) {
  const rows = [];
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const walk = (command, category) => {
    if (!command || typeof command !== "object") return;
    const path = String(command.path || command.name || "");
    if (!path) return;
    const aliases = Array.isArray(command.aliases) ? command.aliases.map(String) : [];
    rows.push({
      path,
      type: command.type === "group" ? "group" : "command",
      description: String(command.description || ""),
      usage: String(command.usage || path),
      kinds: Array.isArray(command.kinds) ? command.kinds.map(String) : [],
      aliases,
      permissions: Array.isArray(command.permissions) ? command.permissions.map(String) : [],
      parameters: Array.isArray(command.parameters) ? command.parameters : [],
      categoryId: category.id,
      categoryName: category.name,
      haystack: `${path} ${aliases.join(" ")} ${command.description || ""} ${command.usage || ""}`.toLowerCase(),
    });
    for (const sub of Array.isArray(command.subcommands) ? command.subcommands : []) walk(sub, category);
  };
  for (const category of categories) {
    const meta = { id: String(category?.id ?? ""), name: String(category?.name ?? "Other") };
    for (const command of Array.isArray(category?.commands) ? category.commands : []) walk(command, meta);
  }
  return rows;
}

/** Filter rows by free text (every word must match) and category. */
export function filterCommands(rows, { query = "", categoryId = "" } = {}) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => (!categoryId || row.categoryId === categoryId) && words.every((word) => row.haystack.includes(word)));
}

export async function mountPage(ctx) {
  const { root, endpoints, signal } = ctx;
  let disposed = false;
  let timer = null;
  const state = { status: "loading", rows: [], categories: [], stats: null, defaultPrefix: "!", query: "", categoryId: "", shown: PAGE_SIZE, error: null };

  const page = h("div", { class: "page" });
  mount(page, pageHeader({ eyebrow: "Reference", title: "Commands", description: "Every command Rift has loaded right now, straight from the bot. Search by name, alias, description or permission." }));
  const stats = h("div", { class: "stats-grid" });
  const controls = h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" });
  const results = h("div", { class: "stack-tight" });
  mount(page, stats, card({ children: [controls, results] }));
  mount(root, page);

  function renderStats() {
    clear(stats);
    if (state.status !== "ready") return;
    const s = state.stats || {};
    stats.append(
      statCard({ label: "Commands", value: fmtInt(s.commands ?? state.rows.length), icon: "terminal", hint: "Including subcommands" }),
      statCard({ label: "Categories", value: fmtInt(s.categories ?? state.categories.length), icon: "layers", tone: "violet" }),
      statCard({ label: "Slash", value: fmtInt(s.slash ?? 0), icon: "command", hint: "Run with /" }),
      statCard({ label: "Prefix", value: fmtInt(s.prefix ?? 0), icon: "hash", hint: `Default prefix ${state.defaultPrefix}` })
    );
  }

  function renderRow(row) {
    const display = row.kinds.includes("prefix") && !row.kinds.includes("slash") ? `${state.defaultPrefix}${row.usage}` : row.kinds.includes("slash") ? `/${row.usage}` : row.usage;
    return h(
      "div",
      { class: "list-row", style: "padding:10px 0;border-bottom:1px solid var(--line);content-visibility:auto;contain-intrinsic-size:auto 64px" },
      h(
        "div",
        { class: "row row--between", style: "gap:8px;align-items:flex-start" },
        h("div", { class: "stack-tight", style: "min-width:0" },
          h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" },
            h("strong", null, row.path),
            row.type === "group" ? badge({ label: "group", tone: "violet" }) : null,
            ...row.kinds.map((kind) => badge({ label: kind })),
            badge({ label: row.categoryName, tone: "info" })
          ),
          row.description ? h("span", { class: "muted" }, row.description) : null,
          h("code", { style: "overflow-wrap:anywhere" }, display),
          row.aliases.length ? h("span", { class: "muted" }, `Aliases: ${row.aliases.join(", ")}`) : null,
          row.permissions.length ? h("div", { class: "row", style: "gap:4px;flex-wrap:wrap" }, ...row.permissions.map((perm) => badge({ label: titleCase(perm), tone: "warning" }))) : null
        ),
        copyButton({ text: display, label: "Copy", successMessage: "Command copied" })
      )
    );
  }

  function renderResults() {
    clear(results);
    if (state.status === "loading") {
      results.append(...Array.from({ length: 6 }, () => h("div", { class: "skeleton", style: "height:44px;border-radius:8px" })));
      return;
    }
    if (state.status === "error") {
      results.append(errorState({ error: state.error, onRetry: () => load() }));
      return;
    }
    const matches = filterCommands(state.rows, { query: state.query, categoryId: state.categoryId });
    if (!matches.length) {
      results.append(emptyState({ icon: "search", title: "No commands match", message: "Try a shorter search or pick All categories.", compact: true }));
      return;
    }
    const visible = matches.slice(0, state.shown);
    results.append(h("p", { class: "muted", role: "status" }, `${fmtInt(matches.length)} command${matches.length === 1 ? "" : "s"}`));
    results.append(...visible.map(renderRow));
    if (matches.length > visible.length) {
      results.append(button({ label: `Show more (${fmtInt(matches.length - visible.length)} left)`, variant: "outline", onClick: () => { state.shown += PAGE_SIZE; renderResults(); } }));
    }
  }

  function renderControls() {
    clear(controls);
    controls.append(
      textInput({
        value: state.query,
        placeholder: "Search commands, aliases, descriptions…",
        ariaLabel: "Search commands",
        className: "input--grow",
        onInput: (value) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (disposed) return;
            state.query = value;
            state.shown = PAGE_SIZE;
            renderResults();
          }, 120);
        },
      }),
      selectInput({
        value: state.categoryId,
        ariaLabel: "Category",
        placeholder: "All categories",
        options: state.categories.map((category) => ({ value: category.id, label: `${category.name} (${category.count})` })),
        onChange: (value) => {
          state.categoryId = value;
          state.shown = PAGE_SIZE;
          renderResults();
        },
      })
    );
  }

  async function load() {
    state.status = "loading";
    renderResults();
    try {
      const payload = await endpoints.publicCommands({ signal });
      if (disposed) return;
      state.rows = flattenCatalog(payload);
      state.categories = (Array.isArray(payload?.categories) ? payload.categories : []).map((c) => ({ id: String(c.id ?? ""), name: String(c.name ?? "Other"), count: Number(c.count ?? c.commands?.length ?? 0) }));
      state.stats = payload?.stats || null;
      state.defaultPrefix = payload?.bot?.default_prefix || "!";
      state.status = "ready";
      renderStats();
      renderControls();
    } catch (err) {
      if (disposed || err?.name === "AbortError") return;
      state.status = "error";
      state.error = err;
    }
    renderResults();
  }

  renderControls();
  await load();

  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}
