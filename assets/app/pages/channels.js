/* Channels: a Discord-style channel manager.
 *
 * Browse every category and channel, drag (or use the arrows) to reorder or
 * move them between categories, open a channel to edit its settings and its
 * role/member permission overwrites, create new channels and delete old ones.
 *
 * Live sync: the bot pushes a `channels_snapshot` over the shared socket
 * whenever a channel or role changes — from this page, from Discord itself or
 * from another admin — so the tree always matches the server. Ordering rules
 * live in data/channel-layout.js (pure + unit-tested). */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  callout,
  card,
  confirmDialog,
  copyButton,
  emptyState,
  errorState,
  field,
  iconButton,
  numberInput,
  openModal,
  openPicker,
  pageHeader,
  segmentedControl,
  selectInput,
  skeleton,
  switchControl,
  textareaInput,
  textInput,
  toast as defaultToast,
} from "../ui/components.js";
import { channelTypeLabel } from "../data/channels.js";
import {
  applyLayout,
  buildLayout,
  groupsFor,
  indexById,
  isCategory,
  isVoice,
  layoutToItems,
  moveCategory,
  moveChannel,
  nudge,
  permissionLabel,
  sameLayout,
  stateOf,
  withState,
} from "../data/channel-layout.js";

const SLOWMODE = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];
const slowLabel = (s) => (s === 0 ? "Off" : s < 60 ? `${s} seconds` : s < 3600 ? `${s / 60} minute${s === 60 ? "" : "s"}` : `${s / 3600} hour${s === 3600 ? "" : "s"}`);

const KIND_ICON = { text: "hash", news: "bell", forum: "message-square", media: "image", voice: "volume-2", stage_voice: "mic", category: "chevron-down" };
function channelIcon(channel) {
  const raw = String(channel.type).toLowerCase();
  return KIND_ICON[{ 0: "text", 2: "voice", 4: "category", 5: "news", 13: "stage_voice", 15: "forum", 16: "media" }[raw] || raw] || "hash";
}

const CREATE_KINDS = [
  { value: "text", label: "Text", icon: "hash" },
  { value: "voice", label: "Voice", icon: "volume-2" },
  { value: "forum", label: "Forum", icon: "message-square" },
  { value: "stage_voice", label: "Stage", icon: "mic" },
  { value: "category", label: "Category", icon: "layers" },
];

export async function mountPage(ctx) {
  const { root, guildId, endpoints, live } = ctx;
  const toast = ctx.toast || defaultToast;
  let disposed = false;

  const state = {
    status: "loading",
    error: null,
    channels: [],
    roles: [],
    permissions: [],
    selectedId: null,
    tab: "overview",
    collapsed: new Set(),
    draft: null, // overview form
    targetId: null, // selected permission overwrite
    ow: null, // draft overwrite { id, allow, deny }
    dirty: false,
    pending: 0,
  };

  let dragId = null;

  const treeCard = card({ title: "Channels", padding: "none", className: "ch-tree-card" });
  const detailCard = card({ className: "ch-detail-card" });
  const header = pageHeader({
    eyebrow: "Server",
    title: "Channels",
    description: "Reorder, edit and delete channels like in Discord. Changes made in Discord itself show up here instantly.",
    icon: "hash",
    actions: h("div", { class: "row", style: "gap:6px;align-items:center" }),
  });
  const actions = header.querySelector(".page-head-actions");

  const page = h("div", { class: "page" }, header, h("div", { class: "ch-layout" }, treeCard, detailCard));
  mount(root, page);

  /* ------------------------------ data ------------------------------ */

  const byId = () => indexById(state.channels);
  const selected = () => byId().get(state.selectedId) || null;
  const roleById = (id) => state.roles.find((role) => role.id === String(id));

  function applyData(data) {
    state.channels = data.channels || [];
    state.roles = data.roles || [];
    state.permissions = data.permissions || [];
  }

  async function load(quiet = false) {
    if (!quiet) {
      state.status = "loading";
      renderTree();
    }
    try {
      applyData(await endpoints.channels(guildId));
      state.status = "ready";
      state.error = null;
      if (!selected()) state.selectedId = null;
      if (!quiet || !state.dirty) resetDraft();
    } catch (err) {
      if (disposed) return;
      if (!quiet || state.status !== "ready") {
        state.status = "error";
        state.error = err;
      }
    }
    renderAll();
  }

  /** Called for every live snapshot (our own changes included). */
  function onSnapshot(data) {
    if (disposed || !data || String(data.guild_id) !== String(guildId)) return;
    const before = selected();
    const beforeJson = before ? JSON.stringify(before) : "";
    applyData(data);
    state.status = "ready";
    const after = selected();
    if (state.selectedId && !after) {
      toast.info(`#${before?.name || "That channel"} was deleted.`);
      state.selectedId = null;
      resetDraft();
      renderAll();
      return;
    }
    renderTree();
    renderHeaderActions();
    if (!after) return renderDetail();
    if (JSON.stringify(after) === beforeJson) return;
    if (state.dirty) {
      toast.info(`#${after.name} was changed elsewhere. Your unsaved edits are kept — save to overwrite or discard to refresh.`);
      return;
    }
    resetDraft();
    renderDetail();
  }

  function replaceChannel(channel) {
    if (!channel) return;
    const index = state.channels.findIndex((entry) => entry.id === channel.id);
    if (index >= 0) state.channels[index] = channel;
    else state.channels.push(channel);
  }

  function resetDraft() {
    const channel = selected();
    state.dirty = false;
    state.draft = channel
      ? {
          name: channel.name,
          topic: channel.topic ?? "",
          nsfw: Boolean(channel.nsfw),
          slowmode: channel.slowmode ?? 0,
          user_limit: channel.user_limit ?? 0,
          bitrate: Math.round((channel.bitrate ?? 64000) / 1000),
          parent_id: channel.parent_id || "",
        }
      : null;
    const overwrites = channel?.overwrites || [];
    const keep = overwrites.find((entry) => entry.id === state.targetId) || overwrites[0] || null;
    state.targetId = keep ? keep.id : null;
    state.ow = keep ? { id: keep.id, allow: [...keep.allow], deny: [...keep.deny] } : null;
  }

  function select(id, tab) {
    if (state.dirty && id !== state.selectedId && !window.confirm("Discard your unsaved changes to this channel?")) return;
    state.selectedId = id;
    if (tab) state.tab = tab;
    state.targetId = null;
    resetDraft();
    renderTree();
    renderDetail();
  }

  /* ----------------------------- reorder ---------------------------- */

  async function commit(layout, previous) {
    const items = layoutToItems(layout);
    state.channels = applyLayout(state.channels, layout);
    renderTree();
    state.pending += 1;
    try {
      await endpoints.channelsReorder(guildId, items);
    } catch (err) {
      state.channels = applyLayout(state.channels, previous);
      renderTree();
      toast.error(err?.message || "Couldn't reorder channels.");
    } finally {
      state.pending -= 1;
    }
  }

  function currentLayout() {
    return buildLayout(state.channels);
  }

  function reorder(next) {
    const previous = currentLayout();
    if (!next || sameLayout(previous, next)) return;
    commit(next, previous);
  }

  function dropOn(targetId, where) {
    const moving = byId().get(dragId);
    const target = byId().get(targetId);
    dragId = null;
    if (!moving || !target || moving.id === target.id) return renderTree();
    const layout = currentLayout();
    if (isCategory(moving)) {
      if (!isCategory(target)) return renderTree();
      const cats = layout.cats.map((cat) => cat.id);
      const before = where === "before" ? target.id : cats[cats.indexOf(target.id) + 1] || null;
      return reorder(moveCategory(layout, moving.id, before));
    }
    if (isCategory(target)) {
      // Dropping a channel on a category header files it at the end of that category.
      return reorder(moveChannel(layout, byId(), moving.id, { parentId: target.id }));
    }
    const parentId = layout.cats.find((cat) => cat.children.includes(target.id))?.id || null;
    const list = parentId ? layout.cats.find((cat) => cat.id === parentId).children : layout.top;
    const before = where === "before" ? target.id : list[list.indexOf(target.id) + 1] || null;
    reorder(moveChannel(layout, byId(), moving.id, { parentId, beforeId: before }));
  }

  /* ------------------------------ render ---------------------------- */

  function renderHeaderActions() {
    const socket = live?.statusStore?.get?.()?.stats;
    const isLive = socket === "open";
    mount(
      actions,
      h(
        "div",
        { class: "row", style: "gap:6px;align-items:center" },
        badge({ label: isLive ? "Live" : socket === "connecting" || socket === "reconnecting" ? "Reconnecting…" : "Not live", tone: isLive ? "success" : "warning", dot: true }),
        button({ label: "New channel", icon: "plus", variant: "primary", size: "sm", onClick: () => openCreate({}) }),
        iconButton({ icon: "refresh", label: "Reload channels", onClick: () => load(false) })
      )
    );
  }

  function row(channel, { depth = 0, siblings = [] } = {}) {
    const category = isCategory(channel);
    const isSelected = state.selectedId === channel.id;
    const at = siblings.indexOf(channel.id);
    const node = h(
      "div",
      {
        class: ["ch-row", category && "ch-row--category", depth && "ch-row--child", isSelected && "is-selected"],
        draggable: "true",
        role: "treeitem",
        "aria-selected": isSelected ? "true" : "false",
        dataset: { id: channel.id },
        onDragstart: (event) => {
          dragId = channel.id;
          event.dataTransfer?.setData("text/plain", channel.id);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          node.classList.add("is-dragging");
        },
        onDragend: () => {
          dragId = null;
          document.querySelectorAll(".ch-row.drop-before, .ch-row.drop-after, .ch-row.drop-into").forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-into"));
          node.classList.remove("is-dragging");
        },
        onDragover: (event) => {
          if (!dragId || dragId === channel.id) return;
          const moving = byId().get(dragId);
          if (isCategory(moving) && !category) return;
          event.preventDefault();
          const rect = node.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          const into = category && !isCategory(moving);
          node.classList.toggle("drop-into", into);
          node.classList.toggle("drop-before", !into && before);
          node.classList.toggle("drop-after", !into && !before);
        },
        onDragleave: () => node.classList.remove("drop-before", "drop-after", "drop-into"),
        onDrop: (event) => {
          if (!dragId) return;
          event.preventDefault();
          const rect = node.getBoundingClientRect();
          const where = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
          dropOn(channel.id, where);
        },
      },
      category
        ? iconButton({
            icon: state.collapsed.has(channel.id) ? "chevron-right" : "chevron-down",
            label: state.collapsed.has(channel.id) ? `Expand ${channel.name}` : `Collapse ${channel.name}`,
            size: "sm",
            onClick: () => {
              if (state.collapsed.has(channel.id)) state.collapsed.delete(channel.id);
              else state.collapsed.add(channel.id);
              renderTree();
            },
          })
        : h("span", { class: "ch-icon" }, icon(channelIcon(channel), { size: 15 })),
      h(
        "button",
        { type: "button", class: "ch-name", onClick: () => select(channel.id) },
        h("span", { class: "ch-name-text" }, category ? channel.name.toUpperCase() : channel.name),
        channel.nsfw ? badge({ label: "NSFW", tone: "danger" }) : null,
        (channel.overwrites || []).length && !category ? h("span", { class: "ch-lock", title: `${channel.overwrites.length} permission overwrite${channel.overwrites.length === 1 ? "" : "s"}` }, icon("lock", { size: 12 })) : null
      ),
      h(
        "span",
        { class: "ch-row-actions" },
        category ? iconButton({ icon: "plus", label: `New channel in ${channel.name}`, size: "sm", onClick: () => openCreate({ parentId: channel.id }) }) : null,
        iconButton({ icon: "chevron-up", label: `Move ${channel.name} up`, size: "sm", disabled: at === 0, onClick: () => reorder(nudge(currentLayout(), byId(), channel.id, -1)) }),
        iconButton({ icon: "chevron-down", label: `Move ${channel.name} down`, size: "sm", disabled: at === siblings.length - 1, onClick: () => reorder(nudge(currentLayout(), byId(), channel.id, 1)) })
      )
    );
    return node;
  }

  function renderTree() {
    const body = treeCard.querySelector(".card-body");
    clear(body);
    if (state.status === "loading") {
      body.append(h("div", { class: "stack-tight", style: "padding:14px" }, ...Array.from({ length: 8 }, () => skeleton({ h: 30 }))));
      return;
    }
    if (state.status === "error") {
      body.append(errorState({ error: state.error, onRetry: () => load(false), compact: true }));
      return;
    }
    if (!state.channels.length) {
      body.append(emptyState({ icon: "hash", title: "No channels", message: "This server has no channels yet.", compact: true }));
      return;
    }
    const map = byId();
    const layout = currentLayout();
    const tree = h("div", { class: "ch-tree", role: "tree", "aria-label": "Channels" });
    // Dropping on empty tree space (below the last row) moves a channel out of its category.
    tree.addEventListener("dragover", (event) => {
      if (event.target === tree && dragId) event.preventDefault();
    });
    tree.addEventListener("drop", (event) => {
      if (event.target !== tree || !dragId) return;
      event.preventDefault();
      const moving = map.get(dragId);
      dragId = null;
      if (moving && !isCategory(moving)) reorder(moveChannel(layout, map, moving.id, { parentId: null }));
    });
    for (const id of layout.top) tree.append(row(map.get(id), { siblings: layout.top }));
    for (const cat of layout.cats) {
      tree.append(row(map.get(cat.id), { siblings: layout.cats.map((c) => c.id) }));
      if (!state.collapsed.has(cat.id)) for (const id of cat.children) tree.append(row(map.get(id), { depth: 1, siblings: cat.children }));
    }
    body.append(tree, h("p", { class: "ch-hint" }, "Drag to reorder or drop a channel on a category. Use the arrows for keyboard control."));
  }

  function renderDetail() {
    const body = detailCard.querySelector(".card-body");
    clear(body);
    const channel = selected();
    if (state.status !== "ready") return;
    if (!channel) {
      body.append(emptyState({ icon: "hash", title: "Pick a channel", message: "Select a channel on the left to edit its settings and permissions.", compact: true }));
      return;
    }
    const category = isCategory(channel);
    body.append(
      h(
        "div",
        { class: "ch-detail-head" },
        h("span", { class: "ch-detail-icon" }, icon(channelIcon(channel), { size: 18 })),
        h("div", { class: "ch-detail-title" }, h("h2", null, category ? channel.name : `#${channel.name}`), h("div", { class: "muted", style: "font-size:12px" }, `${channelTypeLabel(channel)} · ID ${channel.id}`)),
        h(
          "div",
          { class: "row", style: "gap:6px" },
          copyButton({ text: channel.id, label: "Copy ID", successMessage: "Channel ID copied" }),
          button({ label: "Delete", icon: "trash", variant: "danger", size: "sm", onClick: () => remove(channel) })
        )
      ),
      segmentedControl({
        options: [{ value: "overview", label: "Overview" }, { value: "permissions", label: `Permissions (${(channel.overwrites || []).length})` }],
        value: state.tab,
        label: "Channel sections",
        onChange: (value) => {
          state.tab = value;
          renderDetail();
        },
      }),
      state.tab === "overview" ? overviewPanel(channel) : permissionsPanel(channel)
    );
  }

  /* ----------------------------- overview --------------------------- */

  function touch() {
    state.dirty = true;
    const bar = detailCard.querySelector(".ch-savebar");
    if (bar) bar.classList.add("is-dirty");
    detailCard.querySelectorAll("[data-save]").forEach((el) => el.removeAttribute("disabled"));
    detailCard.querySelectorAll("[data-discard]").forEach((el) => el.removeAttribute("disabled"));
  }

  function overviewPanel(channel) {
    const d = state.draft;
    const category = isCategory(channel);
    const voice = isVoice(channel);
    const textLike = !category && !voice;
    const parentOptions = [{ value: "", label: "No category" }, ...state.channels.filter(isCategory).sort((a, b) => a.position - b.position).map((c) => ({ value: c.id, label: c.name }))];
    return h(
      "div",
      { class: "stack ch-panel" },
      field({ label: "Name", children: textInput({ value: d.name, maxLength: 100, onInput: (v) => { d.name = v; touch(); } }) }),
      !category ? field({ label: "Category", children: selectInput({ value: d.parent_id, options: parentOptions, onChange: (v) => { d.parent_id = v; touch(); } }) }) : null,
      textLike || channel.type === "forum"
        ? field({ label: "Topic", help: "Shown under the channel name.", children: textareaInput({ value: d.topic, rows: 3, maxLength: 1024, onInput: (v) => { d.topic = v; touch(); } }) })
        : null,
      textLike || channel.type === "forum"
        ? field({ label: "Slowmode", children: selectInput({ value: String(d.slowmode), options: SLOWMODE.map((s) => ({ value: String(s), label: slowLabel(s) })), onChange: (v) => { d.slowmode = Number(v); touch(); } }) })
        : null,
      textLike || channel.type === "forum" ? switchControl({ checked: d.nsfw, label: "Age-restricted (NSFW)", description: "Members must confirm they are 18+ to view this channel.", onChange: (v) => { d.nsfw = v; touch(); } }) : null,
      voice && channel.type !== "stage_voice" ? field({ label: "User limit", help: "0 means unlimited.", children: numberInput({ value: d.user_limit, min: 0, max: 99, onInput: (v) => { d.user_limit = v; touch(); } }) }) : null,
      voice && channel.type !== "stage_voice" ? field({ label: "Bitrate (kbps)", children: numberInput({ value: d.bitrate, min: 8, max: 384, onInput: (v) => { d.bitrate = v; touch(); } }) }) : null,
      h(
        "div",
        { class: ["ch-savebar", state.dirty && "is-dirty"] },
        button({ label: "Discard", variant: "ghost", disabled: !state.dirty, "data-discard": "1", onClick: () => { resetDraft(); renderDetail(); } }),
        button({ label: "Save changes", variant: "primary", icon: "save", disabled: !state.dirty, "data-save": "1", onClick: () => saveOverview(channel) })
      )
    );
  }

  async function saveOverview(channel) {
    const d = state.draft;
    const name = String(d.name || "").trim();
    if (!name) return toast.error("A channel needs a name.");
    const payload = { name };
    if (!isCategory(channel)) {
      if ((channel.topic ?? "") !== d.topic && "topic" in channel) payload.topic = d.topic;
      if ("nsfw" in channel && Boolean(channel.nsfw) !== d.nsfw) payload.nsfw = d.nsfw;
      if ("slowmode" in channel && (channel.slowmode ?? 0) !== d.slowmode) payload.slowmode = d.slowmode;
      if ("user_limit" in channel && Number(channel.user_limit ?? 0) !== Number(d.user_limit) && channel.type !== "stage_voice") payload.user_limit = Number(d.user_limit) || 0;
      if ("bitrate" in channel && channel.type !== "stage_voice" && Math.round((channel.bitrate ?? 0) / 1000) !== Number(d.bitrate)) payload.bitrate = Math.round(Number(d.bitrate) * 1000);
    }
    try {
      const fieldsChanged = Object.keys(payload).some((key) => key !== "name") || payload.name !== channel.name;
      if (fieldsChanged) replaceChannel((await endpoints.channelEdit(guildId, channel.id, payload)).channel);
      if (!isCategory(channel) && (d.parent_id || "") !== (channel.parent_id || "")) {
        const layout = currentLayout();
        const moved = moveChannel(layout, byId(), channel.id, { parentId: d.parent_id || null });
        state.channels = applyLayout(state.channels, moved);
        await endpoints.channelsReorder(guildId, layoutToItems(moved));
      }
      toast.success("Channel updated.");
      resetDraft();
      renderAll();
    } catch (err) {
      toast.error(err?.message || "Couldn't save the channel.");
    }
  }

  async function remove(channel) {
    const category = isCategory(channel);
    const ok = await confirmDialog({
      title: category ? "Delete category?" : "Delete channel?",
      message: category
        ? `“${channel.name}” will be deleted. Its channels are not deleted — they move out of the category. This can't be undone.`
        : `“#${channel.name}” and its message history will be permanently deleted. This can't be undone.`,
      confirmLabel: category ? "Delete category" : "Delete channel",
      danger: true,
      requireText: channel.name,
    });
    if (!ok) return;
    try {
      await endpoints.channelDelete(guildId, channel.id);
      state.channels = state.channels.filter((entry) => entry.id !== channel.id);
      state.selectedId = null;
      resetDraft();
      toast.success(`${category ? "Category" : "#"}${channel.name} deleted.`);
      renderAll();
    } catch (err) {
      toast.error(err?.message || "Couldn't delete that channel.");
    }
  }

  /* --------------------------- permissions -------------------------- */

  function targetLabel(overwrite) {
    if (overwrite.type === "member") return overwrite.name;
    const name = roleById(overwrite.id)?.name || overwrite.name;
    return name.startsWith("@") ? name : `@${name}`;
  }

  function permissionsPanel(channel) {
    const overwrites = channel.overwrites || [];
    const list = h(
      "div",
      { class: "ch-targets" },
      ...overwrites.map((entry) =>
        h(
          "button",
          {
            type: "button",
            class: ["ch-target", entry.id === state.targetId && "is-active"],
            onClick: () => {
              if (state.dirty && entry.id !== state.targetId && !window.confirm("Discard your unsaved permission changes?")) return;
              state.targetId = entry.id;
              state.ow = { id: entry.id, allow: [...entry.allow], deny: [...entry.deny] };
              state.dirty = false;
              renderDetail();
            },
          },
          icon(entry.type === "role" ? "users" : "user", { size: 14 }),
          h("span", { class: "ch-target-name" }, targetLabel(entry)),
          h("span", { class: "ch-target-count muted" }, `${entry.allow.length}✓ ${entry.deny.length}✗`)
        )
      ),
      button({ label: "Add role", icon: "plus", variant: "outline", size: "sm", onClick: () => addTarget(channel) })
    );
    const active = overwrites.find((entry) => entry.id === state.targetId);
    return h(
      "div",
      { class: "stack ch-panel" },
      channel.synced ? callout({ tone: "info", children: "Permissions are synced with the category. Editing here will detach this channel from it." }) : null,
      h("div", { class: "ch-perm-layout" }, list, active && state.ow ? permissionGrid(channel, active) : h("div", { class: "muted ch-perm-empty" }, overwrites.length ? "Select a role to edit its permissions." : "No overwrites yet — everyone follows the server-wide role permissions. Add a role to customise this channel."))
    );
  }

  function addTarget(channel) {
    const present = new Set((channel.overwrites || []).map((entry) => entry.id));
    const options = state.roles.filter((role) => !present.has(role.id)).map((role) => ({ value: role.id, label: role.name.startsWith("@") ? role.name : `@${role.name}`, sub: role.id }));
    openPicker({
      title: "Add a role",
      options,
      allowNone: false,
      emptyLabel: "Every role already has an overwrite here.",
      onSelect: (id) => {
        const entry = { id, type: "role", name: roleById(id)?.name || id, allow: [], deny: [], __local: true };
        channel.overwrites = [...(channel.overwrites || []), entry];
        state.targetId = id;
        state.ow = { id, allow: [], deny: [] };
        state.dirty = true;
        renderDetail();
      },
    });
  }

  function permissionGrid(channel, overwrite) {
    const groups = groupsFor(channel, state.permissions);
    const ow = state.ow;
    const setState = (name, value, cell) => {
      Object.assign(ow, withState(ow, name, value));
      state.dirty = true;
      cell.querySelectorAll("button").forEach((btn) => btn.classList.toggle("is-on", btn.dataset.state === value));
      cell.dataset.state = value;
      detailCard.querySelectorAll("[data-save]").forEach((el) => el.removeAttribute("disabled"));
      detailCard.querySelectorAll("[data-discard]").forEach((el) => el.removeAttribute("disabled"));
    };
    const tri = (name) => {
      const current = stateOf(ow, name);
      const cell = h("div", { class: "tri", role: "group", "aria-label": permissionLabel(name), dataset: { state: current } });
      for (const [value, glyph, label] of [["deny", "✕", "Deny"], ["inherit", "/", "Inherit"], ["allow", "✓", "Allow"]]) {
        cell.append(
          h("button", { type: "button", class: ["tri-btn", `tri-btn--${value}`, current === value && "is-on"], dataset: { state: value }, title: label, "aria-label": `${label} ${permissionLabel(name)}`, onClick: () => setState(name, value, cell) }, glyph)
        );
      }
      return cell;
    };
    return h(
      "div",
      { class: "ch-perm-grid" },
      h(
        "div",
        { class: "ch-perm-head" },
        h("strong", null, targetLabel(overwrite)),
        h(
          "div",
          { class: "row", style: "gap:6px" },
          button({ label: "Remove overwrite", icon: "trash", variant: "ghost", size: "sm", onClick: () => removeOverwrite(channel, overwrite) }),
          button({ label: "Reset", variant: "ghost", size: "sm", disabled: !state.dirty, "data-discard": "1", onClick: () => { resetDraft(); renderDetail(); } }),
          button({ label: "Save permissions", icon: "save", variant: "primary", size: "sm", disabled: !state.dirty, "data-save": "1", onClick: () => saveOverwrite(channel, overwrite) })
        )
      ),
      ...groups.map((group) =>
        h(
          "section",
          { class: "ch-perm-group" },
          h("h3", null, group.label),
          ...group.names.map((name) => h("div", { class: "ch-perm-row" }, h("span", null, permissionLabel(name)), tri(name)))
        )
      )
    );
  }

  async function saveOverwrite(channel, overwrite) {
    try {
      const result = await endpoints.channelOverwriteSet(guildId, channel.id, overwrite.id, { allow: state.ow.allow, deny: state.ow.deny });
      replaceChannel(result.channel);
      state.targetId = overwrite.id;
      toast.success("Permissions saved.");
      resetDraft();
      renderAll();
    } catch (err) {
      toast.error(err?.message || "Couldn't save permissions.");
    }
  }

  async function removeOverwrite(channel, overwrite) {
    const persisted = !overwrite.__local;
    try {
      if (persisted) {
        const result = await endpoints.channelOverwriteDelete(guildId, channel.id, overwrite.id);
        replaceChannel(result.channel);
      } else {
        channel.overwrites = (channel.overwrites || []).filter((entry) => entry.id !== overwrite.id);
      }
      state.targetId = null;
      resetDraft();
      toast.success("Overwrite removed.");
      renderAll();
    } catch (err) {
      toast.error(err?.message || "Couldn't remove that overwrite.");
    }
  }

  /* ------------------------------ create ---------------------------- */

  function openCreate({ parentId = "" }) {
    const form = { name: "", type: "text", parent_id: parentId || "" };
    const typeHost = h("div");
    const parentHost = h("div");
    const renderType = () =>
      mount(typeHost, field({ label: "Type", children: segmentedControl({ options: CREATE_KINDS, value: form.type, label: "Channel type", onChange: (v) => { form.type = v; renderType(); renderParent(); } }) }));
    const renderParent = () => {
      if (form.type === "category") return mount(parentHost);
      const options = [{ value: "", label: "No category" }, ...state.channels.filter(isCategory).map((c) => ({ value: c.id, label: c.name }))];
      mount(parentHost, field({ label: "Category", children: selectInput({ value: form.parent_id, options, onChange: (v) => { form.parent_id = v; } }) }));
    };
    renderType();
    renderParent();
    const submit = async () => {
      const name = form.name.trim();
      if (!name) return toast.error("Give the channel a name.");
      try {
        const result = await endpoints.channelCreate(guildId, { name, type: form.type, parent_id: form.type === "category" ? null : form.parent_id || null });
        modal.close();
        replaceChannel(result.channel);
        state.selectedId = result.channel.id;
        state.tab = "overview";
        resetDraft();
        renderAll();
        toast.success(`${result.channel.name} created.`);
      } catch (err) {
        toast.error(err?.message || "Couldn't create the channel.");
      }
    };
    const modal = openModal({
      title: "Create channel",
      body: h("div", { class: "stack" }, field({ label: "Name", children: textInput({ placeholder: "new-channel", maxLength: 100, onInput: (v) => { form.name = v; } }) }), typeHost, parentHost),
      footer: [button({ label: "Cancel", variant: "ghost", onClick: () => modal.close() }), button({ label: "Create", variant: "primary", icon: "plus", onClick: submit })],
      size: "sm",
    });
  }

  function renderAll() {
    if (disposed) return;
    renderHeaderActions();
    renderTree();
    renderDetail();
  }

  /* ------------------------------ live ------------------------------ */

  const unsubscribers = [];
  if (live) {
    unsubscribers.push(live.subscribe("channels_snapshot", onSnapshot));
    unsubscribers.push(
      live.subscribe("status", ({ channel, status }) => {
        if (disposed || channel !== "stats") return;
        renderHeaderActions();
        // Anything pushed while the socket was down is lost, so resync on reconnect.
        if (status === "open" && state.status === "ready") load(true);
      })
    );
  }

  renderHeaderActions();
  renderDetail();
  await load(false);

  return () => {
    disposed = true;
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    }
  };
}
