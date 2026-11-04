/* Full editors for the three sections that used to be read-only mirrors:
 * giveaways, reaction-role panels and auto-responders.
 *
 * Unlike the form-based sections they act on individual records (create, edit,
 * end, delete) through dedicated bot routes, so each editor owns its own data,
 * busy state and refresh instead of using the settings save bar.
 *
 * Every editor is `create…({ guildId, guildInfo, endpoints, notify })` and
 * returns `{ el, refresh }`. `guildInfo` may arrive after the editor is built
 * (it is fetched alongside the section), so it is read through a getter. */

import { h, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  callout,
  confirmDialog,
  emptyState,
  errorState,
  field,
  iconButton,
  numberInput,
  openModal,
  relativeTime,
  segmentedControl,
  selectInput,
  skeleton,
  switchControl,
  textareaInput,
  textInput,
} from "../ui/components.js";
import { fmtInt } from "../core/format.js";
import { channelName, channelOptions, roleName, roleOptions } from "../data/channels.js";

const DURATION_PRESETS = ["10m", "1h", "6h", "1d", "3d", "7d"];
const EXTEND_OPTIONS = [
  { value: "", label: "Keep the current end time" },
  { value: "10m", label: "+10 minutes" },
  { value: "1h", label: "+1 hour" },
  { value: "6h", label: "+6 hours" },
  { value: "1d", label: "+1 day" },
  { value: "7d", label: "+7 days" },
];
const BUTTON_COLORS = [
  { value: "blurple", label: "Blurple" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Gray" },
];
const RESPONDER_VARIABLES = ["{user}", "{username}", "{server}", "{channel}", "{membercount}", "{user.id}", "{user.name}"];
const MAX_PANEL_OPTIONS = 25;

/* ---------------- shared helpers ---------------- */

function toolFrame({ title, description, actions, onRefresh }) {
  const head = h("div", { class: "tool-head" }, h("div", null, h("h3", { class: "tool-title" }, title), description && h("p", { class: "small muted" }, description)), h("span", { class: "spacer" }), actions);
  const meta = h("div", { class: "tool-meta small muted" });
  const list = h("div", { class: "tool-list" });
  const root = h("div", { class: "stack-tight tool" }, head, list, meta);

  let fetchedAt = null;
  function paintMeta() {
    clear(meta);
    meta.append(
      h("span", null, "Last fetched ", fetchedAt ? relativeTime(fetchedAt) : "—"),
      button({ label: "Refresh", icon: "refresh", size: "sm", variant: "ghost", onClick: () => onRefresh?.() })
    );
  }
  paintMeta();
  return {
    root,
    list,
    markFetched() {
      fetchedAt = Date.now();
      paintMeta();
    },
  };
}

function loadingRows(count = 3) {
  return h("div", { class: "stack-tight" }, Array.from({ length: count }, () => h("div", { class: "tool-item" }, skeleton({ w: "40%", h: 16 }), skeleton({ w: "70%", h: 12 }))));
}

function errMessage(err, fallback) {
  return err?.message || fallback;
}

/** `<select>` of channels/roles with a "Pick…" placeholder; keeps a stale id selectable. */
function idSelect({ options, value, placeholder, onChange, ariaLabel, disabled }) {
  const known = new Set(options.map((option) => option.value));
  const all = value && !known.has(String(value)) ? [{ value: String(value), label: `ID ${value} (not found)` }, ...options] : options;
  return selectInput({ value: value || "", options: all, placeholder, onChange, ariaLabel, disabled });
}

/** Run an API call with a busy flag, a toast either way, and an optional follow-up. */
async function act(notify, fn, { success, failure = "That didn't work.", after } = {}) {
  try {
    const result = await fn();
    if (success) notify.success(typeof success === "function" ? success(result) : success);
    await after?.(result);
    return { ok: true, result };
  } catch (err) {
    notify.error(errMessage(err, failure), { title: "Action failed" });
    return { ok: false, error: err };
  }
}

function formModal({ title, size = "md", body, submitLabel, onSubmit, extraFooter }) {
  let busy = false;
  const errorSlot = h("div", { role: "alert" });
  const submit = button({
    label: submitLabel,
    variant: "primary",
    icon: "check",
    onClick: async () => {
      if (busy) return;
      busy = true;
      submit.disabled = true;
      clear(errorSlot);
      try {
        const result = await onSubmit();
        if (result === false) return;
        modal.close();
      } catch (err) {
        errorSlot.append(callout({ tone: "danger", title: "Couldn't save", children: errMessage(err, "The bot rejected this request.") }));
      } finally {
        busy = false;
        submit.disabled = false;
      }
    },
  });
  const modal = openModal({
    title,
    size,
    body: h("div", { class: "stack-tight" }, body, errorSlot),
    footer: [extraFooter, h("span", { class: "spacer" }), button({ label: "Cancel", variant: "ghost", onClick: () => modal.close() }), submit],
  });
  return modal;
}

function statusBadge(status) {
  if (status === "active") return badge({ label: "Active", tone: "success", dot: true });
  if (status === "ended") return badge({ label: "Ended", tone: "muted" });
  return badge({ label: "Cancelled", tone: "danger" });
}

function jumpLink(url, label = "Open in Discord") {
  return url ? button({ label, icon: "external-link", size: "sm", variant: "ghost", href: url, external: true }) : null;
}

/* ====================================================================
 * Giveaways
 * ==================================================================== */

export function createGiveawaysEditor({ guildId, getGuildInfo, endpoints, notify }) {
  let items = null;
  let loadError = null;
  let busyId = null;

  const frame = toolFrame({
    title: "Giveaways",
    description: "Start, edit, end, cancel and reroll giveaways. They are posted by Rift and behave exactly like /giveaway setup.",
    actions: button({ label: "New giveaway", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }),
    onRefresh: () => refresh(),
  });

  async function refresh() {
    items = null;
    loadError = null;
    paint();
    try {
      const response = await endpoints.giveaways(guildId);
      items = response?.giveaways || [];
      frame.markFetched();
    } catch (err) {
      loadError = err;
    }
    paint();
  }

  async function run(giveaway, fn, options) {
    busyId = giveaway.message_id;
    paint();
    await act(notify, fn, { ...options, after: () => refresh() });
    busyId = null;
    paint();
  }

  function openForm(existing = null) {
    const guildInfo = getGuildInfo();
    const state = {
      prize: existing?.prize || "",
      channel_id: existing?.channel_id || "",
      duration: "1h",
      winner_count: existing?.winner_count || 1,
      extend: "",
      requirement_role_ids: [...(existing?.requirements?.roles || [])],
      reward_role_id: existing?.rewards?.role_id || "",
      reward_nickname: existing?.rewards?.new_nick || "",
    };
    const roles = roleOptions(guildInfo);
    const durationInput = textInput({ value: state.duration, placeholder: "e.g. 30m, 12h, 2d", onInput: (v) => (state.duration = v) });
    const requiredHost = h("div", { class: "chip-row" });
    function paintRequired() {
      clear(requiredHost);
      state.requirement_role_ids.forEach((id) =>
        requiredHost.append(
          h("span", { class: "chip" }, roleName(guildInfo, id), existing ? null : iconButton({ icon: "x", label: `Remove ${roleName(guildInfo, id)}`, size: "sm", onClick: () => ((state.requirement_role_ids = state.requirement_role_ids.filter((r) => r !== id)), paintRequired()) }))
        )
      );
      if (!state.requirement_role_ids.length) requiredHost.append(h("span", { class: "small muted" }, "Anyone can enter"));
    }
    paintRequired();

    const body = [
      field({ label: "Prize", required: true, children: textInput({ value: state.prize, maxLength: 100, placeholder: "e.g. Discord Nitro", onInput: (v) => (state.prize = v) }) }),
      existing
        ? field({ label: "Channel", children: h("div", { class: "small" }, channelName(guildInfo, existing.channel_id)) })
        : field({
            label: "Channel",
            required: true,
            help: "Rift needs View, Send Messages and Embed Links here.",
            children: idSelect({ options: channelOptions(guildInfo, "sendable"), value: state.channel_id, placeholder: "Pick a channel…", onChange: (v) => (state.channel_id = v), ariaLabel: "Channel" }),
          }),
      existing
        ? field({ label: "Extend the end time", help: `Currently ends ${new Date(existing.end_time * 1000).toLocaleString()}.`, children: selectInput({ value: "", options: EXTEND_OPTIONS, onChange: (v) => (state.extend = v), ariaLabel: "Extend" }) })
        : field({
            label: "Duration",
            required: true,
            help: "10 seconds to 30 days. Use s, m, h, d or w.",
            children: h(
              "div",
              { class: "stack-tight" },
              durationInput,
              h("div", { class: "chip-row" }, DURATION_PRESETS.map((preset) => button({ label: preset, size: "sm", variant: "ghost", onClick: () => ((state.duration = preset), (durationInput.value = preset)) })))
            ),
          }),
      field({ label: "Winners", children: numberInput({ value: state.winner_count, min: 1, max: 25, onInput: (v) => (state.winner_count = Number(v) || 1) }) }),
    ];
    if (!existing) {
      body.push(
        field({
          label: "Required roles",
          help: "Members need at least one of these to enter. Optional.",
          children: h(
            "div",
            { class: "stack-tight" },
            requiredHost,
            idSelect({
              options: roles.filter((role) => !state.requirement_role_ids.includes(role.value)),
              value: "",
              placeholder: "Add a required role…",
              ariaLabel: "Add a required role",
              onChange: (v, event) => {
                if (v && !state.requirement_role_ids.includes(v)) state.requirement_role_ids.push(v);
                if (event?.target) event.target.value = "";
                paintRequired();
              },
            })
          ),
        }),
        field({
          label: "Reward role",
          help: "Given to winners. Rift will refuse roles with moderation permissions or above its own top role.",
          children: idSelect({ options: roles, value: state.reward_role_id, placeholder: "No reward role", onChange: (v) => (state.reward_role_id = v), ariaLabel: "Reward role" }),
        }),
        field({ label: "Winner nickname", help: "Optional. Winners are renamed to this.", children: textInput({ value: state.reward_nickname, maxLength: 32, onInput: (v) => (state.reward_nickname = v) }) })
      );
    }

    formModal({
      title: existing ? "Edit giveaway" : "New giveaway",
      body,
      submitLabel: existing ? "Save changes" : "Start giveaway",
      onSubmit: async () => {
        if (!state.prize.trim()) throw new Error("Give the giveaway a prize.");
        if (existing) {
          await endpoints.giveawayEdit(guildId, existing.message_id, { prize: state.prize.trim(), winner_count: state.winner_count, ...(state.extend ? { extend: state.extend } : {}) });
          notify.success("Giveaway updated.");
        } else {
          if (!state.channel_id) throw new Error("Pick a channel to post it in.");
          await endpoints.giveawayCreate(guildId, {
            prize: state.prize.trim(),
            channel_id: state.channel_id,
            duration: state.duration.trim(),
            winner_count: state.winner_count,
            requirement_role_ids: state.requirement_role_ids,
            reward_role_id: state.reward_role_id || null,
            reward_nickname: state.reward_nickname.trim() || null,
          });
          notify.success("Giveaway started.");
        }
        await refresh();
      },
    });
  }

  function openReroll(giveaway) {
    const max = Math.max(1, giveaway.winner_count || 1);
    let count = 1;
    formModal({
      title: "Reroll winners",
      size: "sm",
      submitLabel: "Reroll",
      body: [
        h("p", { class: "small muted" }, `Picks new winners from the ${fmtInt(giveaway.entrants)} entries, skipping previous winners while others remain, and announces them in the channel.`),
        field({ label: "How many", children: numberInput({ value: 1, min: 1, max, onInput: (v) => (count = Math.min(max, Math.max(1, Number(v) || 1))) }) }),
      ],
      onSubmit: async () => {
        const response = await endpoints.giveawayReroll(guildId, giveaway.message_id, { count });
        notify.success(`Picked ${fmtInt(response?.winners?.length || 0)} new winner${response?.winners?.length === 1 ? "" : "s"}.`);
        await refresh();
      },
    });
  }

  function row(giveaway) {
    const busy = busyId === giveaway.message_id;
    const meta = [
      giveaway.status === "active" ? h("span", null, "Ends ", relativeTime(giveaway.end_time)) : h("span", null, "Ended ", relativeTime(giveaway.end_time)),
      h("span", null, `${fmtInt(giveaway.entrants)} ${giveaway.entrants === 1 ? "entry" : "entries"}`),
      h("span", null, `${fmtInt(giveaway.winner_count)} winner${giveaway.winner_count === 1 ? "" : "s"}`),
      h("span", null, channelName(getGuildInfo(), giveaway.channel_id)),
      giveaway.host_name && h("span", null, `by ${giveaway.host_name}`),
    ].filter(Boolean);

    const extras = [];
    if (giveaway.requirements.roles.length) extras.push(h("span", { class: "small muted" }, "Requires ", giveaway.requirements.roles.map((id) => roleName(getGuildInfo(), id)).join(", ")));
    if (giveaway.rewards.role_id) extras.push(h("span", { class: "small muted" }, "Reward ", roleName(getGuildInfo(), giveaway.rewards.role_id)));
    if (giveaway.winners.length) extras.push(h("span", { class: "small" }, "Winners: ", h("span", { class: "mono" }, giveaway.winners.join(", "))));

    const actions =
      giveaway.status === "active"
        ? [
            button({ label: "Edit", icon: "edit", size: "sm", disabled: busy, onClick: () => openForm(giveaway) }),
            button({ label: "End now", icon: "trophy", size: "sm", disabled: busy, onClick: () => run(giveaway, () => endpoints.giveawayEnd(guildId, giveaway.message_id), { success: "Giveaway ended and winners announced." }) }),
            button({
              label: "Cancel",
              icon: "x",
              size: "sm",
              variant: "ghost",
              disabled: busy,
              onClick: async () => {
                if (await confirmDialog({ title: "Cancel this giveaway?", message: "No winners will be picked and the message is closed. This can't be undone.", confirmLabel: "Cancel giveaway", cancelLabel: "Keep running", danger: true }))
                  run(giveaway, () => endpoints.giveawayCancel(guildId, giveaway.message_id), { success: "Giveaway cancelled." });
              },
            }),
          ]
        : [
            giveaway.status === "ended" && giveaway.entrants > 0 && button({ label: "Reroll", icon: "refresh", size: "sm", disabled: busy, onClick: () => openReroll(giveaway) }),
            button({
              label: "Delete",
              icon: "trash",
              size: "sm",
              variant: "ghost",
              disabled: busy,
              onClick: async () => {
                if (await confirmDialog({ title: "Delete this record?", message: "Removes it from the dashboard and the bot's database. The Discord message is left alone.", confirmLabel: "Delete", danger: true }))
                  run(giveaway, () => endpoints.giveawayDelete(guildId, giveaway.message_id), { success: "Giveaway removed." });
              },
            }),
          ];

    return h(
      "article",
      { class: "tool-item" },
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, icon("gift", { size: 15 }), h("strong", { class: "truncate" }, giveaway.prize), statusBadge(giveaway.status)),
      h("div", { class: "tool-sub small muted" }, meta.flatMap((node, index) => (index ? [h("span", { class: "dot-sep", "aria-hidden": "true" }, "·"), node] : [node]))),
      extras.length ? h("div", { class: "tool-sub" }, extras) : null,
      h("div", { class: "tool-actions" }, actions, jumpLink(giveaway.jump_url))
    );
  }

  function paint() {
    clear(frame.list);
    if (loadError) {
      frame.list.append(errorState({ error: loadError, onRetry: () => refresh(), compact: true }));
      return;
    }
    if (!items) {
      frame.list.append(loadingRows());
      return;
    }
    if (!items.length) {
      frame.list.append(emptyState({ icon: "gift", title: "No giveaways yet", message: "Start one and it is posted to the channel you pick.", compact: true, action: button({ label: "New giveaway", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }) }));
      return;
    }
    const active = items.filter((g) => g.status === "active");
    const past = items.filter((g) => g.status !== "active");
    if (active.length) frame.list.append(h("h4", { class: "tool-group" }, `Active · ${active.length}`), ...active.map(row));
    if (past.length) frame.list.append(h("h4", { class: "tool-group" }, `Past · ${past.length}`), ...past.map(row));
  }

  paint();
  refresh();
  return { el: frame.root, refresh, repaint: paint };
}

/* ====================================================================
 * Reaction-role panels
 * ==================================================================== */

export function createReactionRolesEditor({ guildId, getGuildInfo, endpoints, notify }) {
  let items = null;
  let loadError = null;
  let busyId = null;

  const frame = toolFrame({
    title: "Reaction-role panels",
    description: "Self-assign role panels with a dropdown or buttons. Needs the Administrator permission, like /reactionrole. Panels made with /reactionrole keep working but are not listed here.",
    actions: button({ label: "New panel", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }),
    onRefresh: () => refresh(),
  });

  async function refresh() {
    items = null;
    loadError = null;
    paint();
    try {
      items = (await endpoints.reactionPanels(guildId))?.panels || [];
      frame.markFetched();
    } catch (err) {
      loadError = err;
    }
    paint();
  }

  function openForm(existing = null) {
    const guildInfo = getGuildInfo();
    const roles = roleOptions(guildInfo);
    const state = {
      channel_id: existing?.channel_id || "",
      title: existing?.title || "Self Roles",
      description: existing?.description ?? "Select your roles!",
      style: existing?.style || "dropdown",
      options: (existing?.options || []).map((option) => ({ ...option })),
    };
    if (!state.options.length) state.options.push({ role_id: "", label: "", emoji: "", desc: "", color: "blurple" });

    const optionsHost = h("div", { class: "stack-tight" });
    function paintOptions() {
      clear(optionsHost);
      state.options.forEach((option, index) => {
        optionsHost.append(
          h(
            "div",
            { class: "panel-option" },
            idSelect({
              options: roles,
              value: option.role_id,
              placeholder: "Choose a role…",
              ariaLabel: `Role for option ${index + 1}`,
              onChange: (v) => {
                option.role_id = v;
                if (!option.label) {
                  option.label = (roles.find((r) => r.value === v)?.label || "").replace(/^@/, "");
                  paintOptions();
                }
              },
            }),
            textInput({ value: option.label, maxLength: 50, placeholder: "Label", ariaLabel: "Label", onInput: (v) => (option.label = v) }),
            textInput({ value: option.emoji, maxLength: 64, placeholder: "Emoji", ariaLabel: "Emoji", className: "panel-emoji", onInput: (v) => (option.emoji = v) }),
            state.style === "buttons"
              ? selectInput({ value: option.color || "blurple", options: BUTTON_COLORS, ariaLabel: "Button colour", onChange: (v) => (option.color = v) })
              : textInput({ value: option.desc, maxLength: 100, placeholder: "Description (optional)", ariaLabel: "Description", onInput: (v) => (option.desc = v) }),
            iconButton({
              icon: "trash",
              label: "Remove option",
              size: "sm",
              disabled: state.options.length === 1,
              onClick: () => {
                state.options.splice(index, 1);
                paintOptions();
              },
            })
          )
        );
      });
      optionsHost.append(
        button({ label: "Add role", icon: "plus", size: "sm", variant: "ghost", disabled: state.options.length >= MAX_PANEL_OPTIONS, onClick: () => (state.options.push({ role_id: "", label: "", emoji: "", desc: "", color: "blurple" }), paintOptions()) })
      );
    }
    paintOptions();

    const styleHost = h("div");
    function paintStyle() {
      clear(styleHost);
      styleHost.append(
        segmentedControl({
          label: "Panel style",
          value: state.style,
          options: [
            { value: "dropdown", label: "Dropdown" },
            { value: "buttons", label: "Buttons" },
          ],
          onChange: (value) => {
            state.style = value;
            paintStyle();
            paintOptions();
          },
        })
      );
    }
    paintStyle();

    formModal({
      title: existing ? "Edit panel" : "New reaction-role panel",
      size: "lg",
      submitLabel: existing ? "Save and update message" : "Post panel",
      body: [
        existing
          ? field({ label: "Channel", children: h("div", { class: "small" }, channelName(guildInfo, existing.channel_id)) })
          : field({ label: "Channel", required: true, children: idSelect({ options: channelOptions(guildInfo, "sendable"), value: state.channel_id, placeholder: "Pick a channel…", ariaLabel: "Channel", onChange: (v) => (state.channel_id = v) }) }),
        field({ label: "Title", required: true, children: textInput({ value: state.title, maxLength: 256, onInput: (v) => (state.title = v) }) }),
        field({ label: "Description", children: textareaInput({ value: state.description, rows: 2, maxLength: 2000, onInput: (v) => (state.description = v) }) }),
        field({
          label: "Style",
          help: "Dropdown fits many roles and lets people pick several at once. Buttons toggle one role each.",
          children: styleHost,
        }),
        field({ label: `Roles (${state.options.length}/${MAX_PANEL_OPTIONS})`, help: "Rift only hands out roles below its own top role without moderation permissions.", children: optionsHost }),
      ],
      onSubmit: async () => {
        if (!state.title.trim()) throw new Error("Give the panel a title.");
        if (!existing && !state.channel_id) throw new Error("Pick a channel to post it in.");
        const chosen = state.options.filter((option) => option.role_id);
        if (!chosen.length) throw new Error("Choose at least one role.");
        if (new Set(chosen.map((o) => o.role_id)).size !== chosen.length) throw new Error("Each role can only appear once.");
        const payload = {
          title: state.title.trim(),
          description: state.description.trim(),
          style: state.style,
          options: chosen.map((o) => ({ role_id: o.role_id, label: o.label.trim() || undefined, emoji: o.emoji.trim() || undefined, desc: (o.desc || "").trim() || undefined, color: o.color || "blurple" })),
        };
        if (existing) await endpoints.reactionPanelUpdate(guildId, existing.message_id, payload);
        else await endpoints.reactionPanelCreate(guildId, { ...payload, channel_id: state.channel_id });
        notify.success(existing ? "Panel updated in Discord." : "Panel posted.");
        await refresh();
      },
    });
  }

  function row(panel) {
    const busy = busyId === panel.message_id;
    return h(
      "article",
      { class: "tool-item" },
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, icon("sparkles", { size: 15 }), h("strong", { class: "truncate" }, panel.title || "Untitled panel"), badge({ label: panel.style === "buttons" ? "Buttons" : "Dropdown", tone: "accent" })),
      h("div", { class: "tool-sub small muted" }, channelName(getGuildInfo(), panel.channel_id), " · ", `${panel.options.length} role${panel.options.length === 1 ? "" : "s"}`),
      h("div", { class: "chip-row tool-sub" }, panel.options.map((option) => h("span", { class: "chip" }, option.emoji ? `${option.emoji} ` : "", option.label || roleName(getGuildInfo(), option.role_id), h("span", { class: "muted" }, ` → ${roleName(getGuildInfo(), option.role_id)}`)))),
      h(
        "div",
        { class: "tool-actions" },
        button({ label: "Edit", icon: "edit", size: "sm", disabled: busy, onClick: () => openForm(panel) }),
        button({
          label: "Delete",
          icon: "trash",
          size: "sm",
          variant: "ghost",
          disabled: busy,
          onClick: async () => {
            if (!(await confirmDialog({ title: "Delete this panel?", message: "The panel message is removed from Discord and people can no longer use it. Roles they already have stay.", confirmLabel: "Delete panel", danger: true }))) return;
            busyId = panel.message_id;
            paint();
            await act(notify, () => endpoints.reactionPanelDelete(guildId, panel.message_id), { success: "Panel deleted.", after: () => refresh() });
            busyId = null;
            paint();
          },
        }),
        jumpLink(panel.jump_url)
      )
    );
  }

  function paint() {
    clear(frame.list);
    if (loadError) {
      frame.list.append(errorState({ error: loadError, onRetry: () => refresh(), compact: true }));
      return;
    }
    if (!items) {
      frame.list.append(loadingRows());
      return;
    }
    if (!items.length) {
      frame.list.append(emptyState({ icon: "sparkles", title: "No panels yet", message: "Create one and Rift posts it with a dropdown or buttons.", compact: true, action: button({ label: "New panel", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }) }));
      return;
    }
    frame.list.append(...items.map(row));
  }

  paint();
  refresh();
  return { el: frame.root, refresh, repaint: paint };
}

/* ====================================================================
 * Auto-responders
 * ==================================================================== */

export function createAutorespondersEditor({ guildId, getGuildInfo, endpoints, notify }) {
  let items = null;
  let loadError = null;
  let query = "";

  const search = textInput({ placeholder: "Search triggers and replies…", ariaLabel: "Search auto-responders", className: "tool-search", onInput: (v) => ((query = v.trim().toLowerCase()), paint()) });
  const frame = toolFrame({
    title: "Auto-responders",
    description: "Reply automatically when a message contains a trigger phrase.",
    actions: button({ label: "New responder", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }),
    onRefresh: () => refresh(),
  });
  frame.root.insertBefore(search, frame.list);

  async function refresh() {
    items = null;
    loadError = null;
    paint();
    try {
      items = (await endpoints.autoresponders(guildId))?.responders || [];
      frame.markFetched();
    } catch (err) {
      loadError = err;
    }
    paint();
  }

  function openForm(existing = null) {
    const guildInfo = getGuildInfo();
    const state = { trigger: existing?.trigger || "", response: existing?.response || "", role_id: existing?.role_id || "", exclusive: Boolean(existing?.exclusive) };
    const responseInput = textareaInput({ value: state.response, rows: 4, maxLength: 2000, placeholder: "What Rift should say", onInput: (v) => (state.response = v) });
    const insert = (token) => {
      const start = responseInput.selectionStart ?? responseInput.value.length;
      const end = responseInput.selectionEnd ?? start;
      responseInput.value = responseInput.value.slice(0, start) + token + responseInput.value.slice(end);
      state.response = responseInput.value;
      responseInput.focus();
      responseInput.setSelectionRange(start + token.length, start + token.length);
    };

    formModal({
      title: existing ? `Edit “${existing.trigger}”` : "New auto-responder",
      submitLabel: existing ? "Save changes" : "Add responder",
      body: [
        existing
          ? field({ label: "Trigger", children: h("code", { class: "mono" }, existing.trigger) })
          : field({ label: "Trigger", required: true, help: "Not case sensitive. Matches when a message contains this phrase.", children: textInput({ value: state.trigger, maxLength: 100, placeholder: "e.g. rules", onInput: (v) => (state.trigger = v) }) }),
        field({
          label: "Reply",
          required: true,
          help: "Insert a variable:",
          children: h("div", { class: "stack-tight" }, responseInput, h("div", { class: "chip-row" }, RESPONDER_VARIABLES.map((token) => h("button", { type: "button", class: "chip chip--button mono", onClick: () => insert(token) }, token)))),
        }),
        field({ label: "Only for members with role", help: "Leave empty to answer everyone.", children: idSelect({ options: roleOptions(guildInfo), value: state.role_id, placeholder: "Everyone", ariaLabel: "Role restriction", onChange: (v) => (state.role_id = v) }) }),
        switchControl({ label: "Exclusive", description: "Only reply when the trigger is the whole message, not just part of it.", checked: state.exclusive, onChange: (v) => (state.exclusive = v) }),
      ],
      onSubmit: async () => {
        if (!state.response.trim()) throw new Error("Write a reply.");
        if (!existing && !state.trigger.trim()) throw new Error("Add a trigger phrase.");
        const payload = { response: state.response, role_id: state.role_id || null, exclusive: state.exclusive };
        if (existing) await endpoints.autoresponderUpdate(guildId, existing.trigger, payload);
        else await endpoints.autoresponderCreate(guildId, { ...payload, trigger: state.trigger.trim() });
        notify.success(existing ? "Auto-responder updated." : "Auto-responder added.");
        await refresh();
      },
    });
  }

  function row(responder) {
    const guildInfo = getGuildInfo();
    return h(
      "article",
      { class: "tool-item" },
      h(
        "div",
        { class: "row", style: "gap:8px;flex-wrap:wrap" },
        icon("message-square", { size: 15 }),
        h("code", { class: "mono tool-trigger" }, responder.trigger),
        responder.exclusive ? badge({ label: "Exclusive", tone: "accent" }) : null,
        responder.role_id ? badge({ label: roleName(guildInfo, responder.role_id), tone: "neutral", icon: "key" }) : null
      ),
      h("p", { class: "tool-reply small" }, responder.response),
      h(
        "div",
        { class: "tool-actions" },
        button({ label: "Edit", icon: "edit", size: "sm", onClick: () => openForm(responder) }),
        button({
          label: "Delete",
          icon: "trash",
          size: "sm",
          variant: "ghost",
          onClick: async () => {
            if (!(await confirmDialog({ title: `Delete “${responder.trigger}”?`, message: "Rift stops replying to this trigger immediately.", confirmLabel: "Delete", danger: true }))) return;
            await act(notify, () => endpoints.autoresponderDelete(guildId, responder.trigger), { success: "Auto-responder deleted.", after: () => refresh() });
          },
        })
      )
    );
  }

  function paint() {
    clear(frame.list);
    search.hidden = !items || items.length < 6;
    if (loadError) {
      frame.list.append(errorState({ error: loadError, onRetry: () => refresh(), compact: true }));
      return;
    }
    if (!items) {
      frame.list.append(loadingRows());
      return;
    }
    if (!items.length) {
      frame.list.append(emptyState({ icon: "message-square", title: "No auto-responders yet", message: "Add a trigger and a reply and Rift answers automatically.", compact: true, action: button({ label: "New responder", icon: "plus", variant: "primary", size: "sm", onClick: () => openForm() }) }));
      return;
    }
    const shown = query ? items.filter((r) => `${r.trigger} ${r.response}`.toLowerCase().includes(query)) : items;
    if (!shown.length) {
      frame.list.append(h("p", { class: "small muted" }, "Nothing matches that search."));
      return;
    }
    frame.list.append(...shown.map(row), h("p", { class: "small muted" }, `${fmtInt(items.length)} of 100 used`));
  }

  paint();
  refresh();
  return { el: frame.root, refresh, repaint: paint };
}

export const TOOL_EDITORS = {
  giveaways: createGiveawaysEditor,
  reaction_roles: createReactionRolesEditor,
  autoresponder: createAutorespondersEditor,
};
