/* Settings workspace — the part that must actually replace Discord commands.
 *
 * Design rules:
 *  - The form is generated from the live payload; unknown keys are never lost.
 *  - Only changed fields are marked dirty, and the payload is shaped per section
 *    (merge / keys / strict / socials) so strict `**kwargs` setters never see
 *    unexpected keys.
 *  - After a save the page re-fetches the section and compares it with what it
 *    sent. If the bot's database disagrees, that's surfaced loudly instead of
 *    pretending the save worked.
 *  - Leaving with unsaved edits is guarded, including browser navigation.
 */

import { h, mount, clear, uid } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  callout,
  card,
  colorInput,
  copyButton,
  emptyState,
  errorState,
  field,
  iconButton,
  jsonEditor,
  listTextEditor,
  numberInput,
  openModal,
  openPicker,
  pageHeader,
  segmentedControl,
  selectInput,
  skeleton,
  spinner,
  switchControl,
  tagListEditor,
  textInput,
  textareaInput,
  toast,
  confirmDialog,
} from "../ui/components.js";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  buildSettingsModel,
  buildSettingsPayload,
  coerceValue,
  getSection,
  prettyKey,
  validateField,
  validateSection,
} from "../data/settings-schema.js";
import { deepClone, deepEqual, diffObjects, fmtInt, fmtRelative, stableStringify } from "../core/format.js";
import { guildPath } from "../core/router.js";

const CHANNEL_TYPES = {
  text: ["0", "5", "15", "16"],
  voice: ["2", "13"],
  category: ["4"],
  forum: ["15"],
};

export async function mountPage(ctx) {
  const { root, endpoints, guildId, router, toast: notify, api, prefs } = ctx;
  const section = getSection(ctx.ctx.params.section || "automod");
  if (!section) {
    router.replace(guildPath(guildId, "settings/automod"));
    return null;
  }

  const controller = new AbortController();
  const page = h("div", { class: "page" });
  const body = h("div", { class: "stack" });

  let raw = null;
  let model = null;
  let values = {};
  let baseline = {};
  let touched = new Set();
  let loading = true;
  let loadError = null;
  let saving = false;
  let lastSavedAt = 0;
  let syncWarning = null;
  let guildInfo = null;
  let advancedOpen = false;
  let dirty = () => touched.size > 0 || !deepEqual(buildPayload(), buildBaselinePayload());
  let sectionSearch = "";

  /* ---------------- data ---------------- */

  async function load({ preserveDraft = false } = {}) {
    loading = true;
    loadError = null;
    renderAll();
    try {
      const [response, info] = await Promise.all([
        endpoints.settingsGet(guildId, section.key),
        endpoints.guildInfo(guildId).catch(() => null),
      ]);
      if (controller.signal.aborted) return;
      raw = response?.data ?? {};
      guildInfo = info;
      model = buildSettingsModel(section, raw);
      if (!preserveDraft) {
        values = {};
        touched = new Set();
        for (const fieldDef of section.fields) values[fieldDef.key] = defaultFor(fieldDef, raw[fieldDef.key]);
        for (const extra of model.extras) values[extra.key] = deepClone(raw[extra.key]);
        baseline = deepClone(raw);
        syncWarning = null;
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      loadError = err;
    } finally {
      loading = false;
      renderAll();
    }
  }

  function defaultFor(fieldDef, value) {
    if (value !== undefined) return deepClone(value);
    switch (fieldDef.type) {
      case "boolean":
        return false;
      case "number":
        return "";
      case "tags":
        return [];
      case "socials":
        return [];
      case "json":
        return {};
      default:
        return "";
    }
  }

  function currentSections() {
    const term = sectionSearch.trim().toLowerCase();
    return SETTINGS_GROUPS.map((group) => ({
      group,
      items: SETTINGS_SECTIONS.filter(
        (candidate) =>
          candidate.group === group.id &&
          (!term || `${candidate.title} ${candidate.key} ${candidate.description}`.toLowerCase().includes(term))
      ),
    })).filter((entry) => entry.items.length);
  }

  /* ---------------- payload ---------------- */

  function buildPayload() {
    if (!section) return {};
    const extras = model?.extras || [];
    try {
      return buildSettingsPayload(section, raw || {}, values, touched, extras);
    } catch {
      return {};
    }
  }

  function buildBaselinePayload() {
    const extras = model?.extras || [];
    return buildSettingsPayload(section, baseline || {}, {}, new Set(), extras);
  }

  function changedFields() {
    const before = buildBaselinePayload();
    const after = buildPayload();
    const diff = diffObjects(before, after);
    return diff;
  }

  /* ---------------- validation ---------------- */

  function setInlineError(host, message) {
    if (!host) return;
    let node = host.querySelector(".field-error");
    if (message) {
      if (!node) {
        node = h("p", { class: "field-error", role: "alert" });
        host.append(node);
      }
      node.textContent = message;
      host.classList.add("has-error");
    } else {
      node?.remove();
      host.classList.remove("has-error");
    }
  }

  function validateAll() {
    const errors = validateSection(section, values, touched);
    return errors;
  }

  /* ---------------- field rendering ---------------- */

  function channelLabel(id) {
    if (!id) return "Not set";
    const channel = guildInfo?.channels?.find((entry) => String(entry.id) === String(id));
    return channel ? `#${channel.name}` : `ID ${id}`;
  }

  function roleLabel(id) {
    if (!id) return "Not set";
    const role = guildInfo?.roles?.find((entry) => String(entry.id) === String(id));
    return role ? `@${role.name}` : `ID ${id}`;
  }

  function pickerControl(fieldDef, { type, onChange }) {
    const buttonEl = h(
      "button",
      {
        type: "button",
        class: "input picker-button",
        onClick: () => {
          const options =
            type === "channel"
              ? (guildInfo?.channels || [])
                  .filter((channel) => !fieldDef.channelTypes || fieldDef.channelTypes.some((kind) => (CHANNEL_TYPES[kind] || []).includes(String(channel.type))))
                  .map((channel) => ({ value: channel.id, label: `#${channel.name}`, sub: `type ${channel.type}` }))
              : (guildInfo?.roles || []).map((role) => ({ value: role.id, label: `@${role.name}`, sub: role.id }));
          openPicker({
            title: type === "channel" ? "Choose a channel" : "Choose a role",
            options,
            value: values[fieldDef.key],
            allowNone: true,
            noneLabel: "Not set",
            onSelect: (value) => {
              values[fieldDef.key] = value || "";
              touched.add(fieldDef.key);
              buttonEl.querySelector(".picker-value").textContent = type === "channel" ? channelLabel(value) : roleLabel(value);
              buttonEl.classList.toggle("is-empty", !value);
              setInlineError(buttonEl.closest(".field"), validateField(fieldDef, value));
              markDirty();
            },
          });
        },
      },
      h("span", { class: `picker-value${fieldDef.type === "channel" || fieldDef.type === "role" ? "" : ""}` }, type === "channel" ? channelLabel(values[fieldDef.key]) : roleLabel(values[fieldDef.key])),
      icon("chevron-down", { size: 13 })
    );
    buttonEl.classList.add("picker-control");
    if (!values[fieldDef.key]) buttonEl.classList.add("is-empty");
    return buttonEl;
  }

  function renderControl(fieldDef) {
    const id = uid(`field-${section.key}-${fieldDef.key}`);
    const key = fieldDef.key;
    const commit = (value) => {
      values[key] = value;
      touched.add(key);
      setInlineError(controlHost, validateField(fieldDef, value));
      markDirty();
    };
    let control;
    let controlHost;

    switch (fieldDef.type) {
      case "boolean": {
        control = switchControl({ id, label: fieldDef.label, description: fieldDef.help, checked: Boolean(values[key]), onChange: commit });
        const wrap = h("div", { class: "field", "data-field": fieldDef.key, id: `${id}-wrap` }, control);
        controlHost = wrap;
        return wrap;
      }
      case "number":
        control = numberInput({ id, value: values[key] ?? "", min: fieldDef.min, max: fieldDef.max, step: fieldDef.step, placeholder: fieldDef.placeholder, onInput: commit });
        break;
      case "textarea":
        control = textareaInput({ id, value: values[key] ?? "", rows: fieldDef.rows || 4, placeholder: fieldDef.placeholder, onInput: commit });
        break;
      case "select": {
        const options = (fieldDef.options || []).map((option) => (typeof option === "object" ? option : { value: option, label: prettyKey(option) }));
        control = selectInput({ id, value: values[key] ?? "", options, placeholder: "Not set", onChange: commit });
        break;
      }
      case "channel":
      case "role":
        control = pickerControl({ ...fieldDef, type: fieldDef.type }, { type: fieldDef.type, onChange: commit });
        break;
      case "tags":
        control = tagListEditor({
          values: Array.isArray(values[key]) ? values[key] : [],
          onChange: commit,
          placeholder: fieldDef.placeholder || "Add an entry…",
          typeLabel: key.includes("role") ? "roles" : key.includes("channel") ? "channels" : "entries",
          validate: (value) => {
            if ((key === "roles_to_remove" || key.endsWith("_ids")) && !/^\d+$/.test(value)) return "Use numeric Discord IDs.";
            return "";
          },
        });
        break;
      case "color":
        control = colorInput({ id, value: values[key] ?? "", onChange: commit });
        break;
      case "json":
        control = jsonEditor({ value: values[key] ?? {}, onChange: commit, rows: fieldDef.rows || 6 });
        break;
      case "password":
        control = h("div", { class: "row" }, textInput({ id, type: "password", autocomplete: "new-password", placeholder: fieldDef.placeholder || "Leave blank to keep the current password", onInput: commit }));
        break;
      default:
        control = textInput({ id, value: values[key] ?? "", placeholder: fieldDef.placeholder, maxLength: fieldDef.maxLength, onInput: commit });
    }

    controlHost = h(
      "div",
      { class: "field", id: `${id}-wrap`, "data-field": fieldDef.key },
      h("div", { class: "field-label-row" }, h("label", { class: "field-label", for: id }, fieldDef.label), fieldDef.required && h("span", { class: "req" }, "required")),
      control,
      fieldDef.help && h("p", { class: "field-help" }, fieldDef.help)
    );
    return controlHost;
  }

  /* ---------------- special editors ---------------- */

  function socialsEditor() {
    const rows = (values.subscriptions || []).map((entry) => ({ ...entry }));
    const host = h("div", { class: "stack-tight" });

    function commit() {
      values.subscriptions = rows.map((row) => ({ ...row }));
      touched.add("subscriptions");
      markDirty();
    }

    function paint() {
      clear(host);
      if (!rows.length) host.append(h("p", { class: "small muted" }, "No feeds yet. Add one below."));
      rows.forEach((row, index) => {
        const channelBtn = h(
          "button",
          {
            type: "button",
            class: "input picker-button picker-control",
            onClick: () =>
              openPicker({
                title: "Notification channel",
                options: (guildInfo?.channels || []).filter((c) => ["0", "5", "15", "16"].includes(String(c.type))).map((c) => ({ value: c.id, label: `#${c.name}` })),
                value: row.channel_id,
                onSelect: (value) => {
                  row.channel_id = value;
                  channelBtn.querySelector(".picker-value").textContent = channelLabel(value);
                  commit();
                },
              }),
          },
          h("span", { class: "picker-value" }, channelLabel(row.channel_id)),
          icon("chevron-down", { size: 13 })
        );
        host.append(
          h(
            "div",
            { class: "social-row" },
            selectInput({
              value: row.platform,
              options: ["youtube", "twitch", "tiktok", "kick"].map((platform) => ({ value: platform, label: prettyKey(platform) })),
              onChange: (value) => {
                row.platform = value;
                commit();
              },
            }),
            textInput({
              value: row.username,
              placeholder: "Channel / username",
              onInput: (value) => {
                row.username = value;
                commit();
              },
            }),
            channelBtn,
            iconButton({
              icon: "trash",
              label: "Remove feed",
              size: "sm",
              onClick: () => {
                rows.splice(index, 1);
                commit();
                paint();
              },
            })
          )
        );
      });
      host.append(
        button({
          label: "Add feed",
          icon: "plus",
          size: "sm",
          variant: "ghost",
          onClick: () => {
            rows.push({ platform: "youtube", username: "", channel_id: "" });
            commit();
            paint();
          },
        })
      );
    }
    paint();
    return field({ label: "Social feeds", help: "New uploads post to the selected channel. Last-seen IDs are preserved by the bot when you save.", children: host });
  }

  /* ---------------- rendering ---------------- */

  const layoutHost = h("div", { class: "settings-layout" });
  const navHost = h("aside", { class: "settings-nav", "aria-label": "Settings sections" });
  const formHost = h("div", { class: "settings-form" });
  layoutHost.append(navHost, formHost);
  body.append(layoutHost);
  mount(page, body);
  mount(root, page);

  function renderNav() {
    clear(navHost);
    const search = textInput({
      value: sectionSearch,
      placeholder: "Filter settings…",
      ariaLabel: "Filter settings",
      onInput: (value) => {
        sectionSearch = value;
        renderNav();
        // Keep focus in the search box after the list re-renders.
        const input = navHost.querySelector("input");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      },
    });
    navHost.append(h("div", { class: "settings-nav-search" }, search));
    for (const entry of currentSections()) {
      navHost.append(h("div", { class: "nav-group-label" }, entry.group.label));
      for (const candidate of entry.items) {
        navHost.append(
          h(
            "a",
            {
              href: guildPath(guildId, `settings/${candidate.key}`),
              class: `settings-nav-item${candidate.key === section.key ? " is-active" : ""}`,
              "aria-current": candidate.key === section.key ? "page" : undefined,
            },
            icon(candidate.icon, { size: 14 }),
            h("span", null, candidate.title),
            candidate.mode === "readonly" && h("span", { class: "nav-badge" }, "read"),
          )
        );
      }
    }
  }

  function markDirty() {
    // Update the pending-changes indicator without re-rendering the whole form.
    const bar = formHost.querySelector("[data-savebar]");
    if (!bar) return;
    const diff = changedFields();
    const count = Object.keys(diff).length;
    const label = bar.querySelector("[data-dirty-label]");
    if (label) {
      label.textContent = count ? `${count} pending change${count === 1 ? "" : "s"}` : "No changes";
      label.classList.toggle("is-dirty", count > 0);
    }
    const saveBtn = bar.querySelector("[data-save]");
    if (saveBtn) saveBtn.disabled = count === 0 || saving;
    const discardBtn = bar.querySelector("[data-discard]");
    if (discardBtn) discardBtn.disabled = count === 0 || saving;
    updateBeforeUnload(count > 0);
  }

  function renderForm() {
    clear(formHost);
    if (loading) {
      formHost.append(
        card({
          children: h("div", { class: "stack-tight" }, skeleton({ w: "45%", h: 22 }), skeleton({ h: 16 }), h("div", { style: "height:6px" }), skeleton({ h: 38 }), skeleton({ h: 38 }), skeleton({ h: 38 })),
        })
      );
      return;
    }
    if (loadError) {
      formHost.append(card({ children: errorState({ error: loadError, onRetry: () => load() }) }));
      return;
    }

    const missing = model?.missing || [];
    const configured = raw && Object.values(raw).some((value) => value !== null && value !== "" && value !== false && (!Array.isArray(value) || value.length));

    formHost.append(
      h(
        "div",
        { class: "settings-head" },
        h(
          "div",
          null,
          h("div", { class: "row", style: "gap:8px" }, h("h2", { style: "font-size:19px" }, section.title), section.mode === "readonly" ? badge({ label: "Read-only", tone: "muted", icon: "lock" }) : badge({ label: "Live", tone: "success", dot: true }), configured ? badge({ label: "Configured", tone: "accent" }) : badge({ label: "Not configured", tone: "warning" })),
          h("p", { class: "page-head-desc" }, section.description)
        ),
        h(
          "div",
          { class: "row" },
          copyButton({ text: () => JSON.stringify(raw, null, 2), label: "Copy JSON", successMessage: "Section JSON copied" }),
          button({ label: "Refresh", icon: "refresh", size: "sm", variant: "ghost", onClick: () => load({ preserveDraft: touched.size > 0 ? true : false }) })
        )
      )
    );

    if (section.notes?.length) {
      formHost.append(callout({ tone: "info", icon: "info", children: h("ul", { class: "note-list" }, section.notes.map((note) => h("li", null, note))) }));
    }
    if (missing.length) {
      formHost.append(callout({ tone: "warning", title: "Required settings are missing", children: `Set ${missing.map(prettyKey).join(", ")} so the feature can run. Saving without them is blocked.` }));
    }
    if (section.key === "verification" && model?.passwordConfigured) {
      formHost.append(callout({ tone: "success", title: "Password is configured", children: "The bot never returns the hash. Leave the password field blank to keep the existing one." }));
    }
    if (syncWarning) {
      formHost.append(syncWarning);
    }

    const form = h("div", { class: "settings-fields" });
    if (section.mode === "socials") {
      form.append(socialsEditor());
    } else if (section.mode === "readonly") {
      form.append(renderReadonly());
    } else {
      for (const fieldDef of section.fields) {
        if (section.mode === "detected" && !(fieldDef.key in (raw || {}))) continue;
        form.append(renderControl(fieldDef));
      }
      if (model?.extras?.length) {
        form.append(
          h(
            "details",
            { class: "extras", open: advancedOpen },
            h("summary", null, `Detected fields (${model.extras.length})`, h("span", { class: "small muted" }, " — returned by the bot, editable here")),
            h(
              "div",
              { class: "settings-fields", style: "margin-top:12px" },
              model.extras.map((extra) => renderExtra(extra))
            )
          )
        );
      }
    }

    if (section.mode !== "readonly") {
      formHost.append(
        card({
          padding: "none",
          children: [
            form,
            h(
              "div",
              { class: "savebar", "data-savebar": "" },
              h("span", { class: "save-state", "data-dirty-label": "" }, "No changes"),
              h("span", { class: "spacer" }),
              button({ label: "Discard", icon: "refresh", variant: "ghost", "data-discard": "", onClick: () => discardChanges() }),
              button({ label: "Save changes", icon: "save", variant: "primary", "data-save": "", disabled: true, onClick: () => save() })
            ),
          ],
        })
      );
      formHost.append(
        h(
          "div",
          { class: "row", style: "margin-top:10px;gap:10px;flex-wrap:wrap" },
          h("span", { class: "small muted" }, `Fetched ${raw ? fmtRelative(Date.now()) : "—"} · values are read from the bot's database, not a cached copy.`),
          h("span", { class: "spacer" }),
          button({
            label: "Advanced: edit payload JSON",
            icon: "terminal",
            size: "sm",
            variant: "ghost",
            onClick: () => openAdvancedEditor(),
          })
        )
      );
    }

    const footer = renderFooter();
    if (footer) formHost.append(footer);
    markDirty();
  }

  function renderExtra(extra) {
    const fieldDef = {
      key: extra.key,
      label: extra.label,
      type: extra.type === "json" ? "json" : extra.type,
      help: "Detected from the bot payload. Edits are sent back as-is.",
    };
    return renderControl(fieldDef);
  }

  function renderReadonly() {
    const host = h("div", { class: "stack-tight" });
    const dataArray = Object.values(raw || {}).find((value) => Array.isArray(value));
    if (section.key === "giveaways" && Array.isArray(raw?.giveaways)) {
      host.append(
        raw.giveaways.length
          ? h("div", { class: "stack-tight" }, raw.giveaways.map((giveaway) => h("div", { class: "row", style: "align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)" }, icon("gift", { size: 15 }), h("div", { style: "flex:1" }, h("div", { style: "font-weight:600" }, giveaway.prize || giveaway.name || "Giveaway"), h("div", { class: "small muted" }, `${giveaway.entries ?? "?"} entries · ends ${giveaway.ends_at ? fmtRelative(giveaway.ends_at) : "unknown"}`)), badge({ label: giveaway.ended ? "Ended" : "Active", tone: giveaway.ended ? "muted" : "success" }))))
          : emptyState({ icon: "gift", title: "No active giveaways", compact: true })
      );
    } else if (Array.isArray(dataArray)) {
      host.append(
        dataArray.length
          ? h("div", { class: "stack-tight" }, dataArray.map((entry) => h("pre", { class: "code-block" }, JSON.stringify(entry, null, 2))))
          : emptyState({ icon: "inbox", title: "Nothing configured", compact: true })
      );
    } else {
      host.append(h("pre", { class: "code-block" }, JSON.stringify(raw || {}, null, 2)));
    }
    return host;
  }

  function renderFooter() {
    return section.mode === "readonly"
      ? callout({
          tone: "info",
          title: "This section is a live mirror",
          children: "Changes happen through the bot's own commands; the dashboard shows the current database state so you always know what's active.",
        })
      : null;
  }

  function renderPageHeader() {
    // The page title is handled by the section header; the global header gives
    // context and the section switcher on mobile.
    body.prepend(
      pageHeader({
        eyebrow: "Server settings",
        title: "Server configuration",
        description: "Every section maps 1:1 to `/api/guild/{id}/settings/{section}` — the exact data the bot reads during runtime.",
        actions: [
          button({
            label: "Section",
            icon: "menu",
            size: "sm",
            className: "settings-mobile-picker",
            onClick: () => openSectionPicker(),
          }),
          button({ label: "Diagnostics", icon: "terminal", size: "sm", variant: "ghost", onClick: () => router.navigate("/status") }),
        ],
      })
    );
  }

  function openSectionPicker() {
    openPicker({
      title: "Settings sections",
      options: SETTINGS_SECTIONS.map((candidate) => ({ value: candidate.key, label: candidate.title, sub: candidate.group })),
      value: section.key,
      allowNone: false,
      onSelect: (value) => router.navigate(guildPath(guildId, `settings/${value}`)),
    });
  }

  async function openAdvancedEditor() {
    if (touched.size && !(await confirmDiscard())) return;
    const draft = textInput({ value: "", className: "mono" });
    const area = textareaInput({ rows: 14, value: JSON.stringify(buildPayload(), null, 2), className: "mono" });
    const errorHost = h("div");
    const modal = openModal({
      title: "Edit payload as JSON",
      size: "lg",
      body: h(
        "div",
        { class: "stack-tight" },
        h("p", { class: "small muted" }, "This is the exact object sent to the API. Useful for bot features the schema doesn't know about yet."),
        area,
        errorHost
      ),
      footer: [
        button({ label: "Cancel", variant: "ghost", onClick: () => modal.close() }),
        h("span", { class: "spacer" }),
        button({
          label: "Apply to form",
          variant: "primary",
          icon: "check",
          onClick: () => {
            try {
              const parsed = JSON.parse(area.value);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
              for (const [key, value] of Object.entries(parsed)) {
                values[key] = value;
                touched.add(key);
              }
              modal.close();
              renderForm();
              notify.success("Payload applied. Review, then save.");
            } catch (err) {
              clear(errorHost);
              errorHost.append(callout({ tone: "danger", children: `Invalid JSON: ${err.message}` }));
            }
          },
        }),
      ],
    });
  }

  function updateBeforeUnload(hasChanges) {
    if (typeof window === "undefined") return;
    if (hasChanges && !window.__riftUnsavedBound) {
      window.__riftUnsavedBound = (event) => {
        event.preventDefault();
        event.returnValue = "You have unsaved settings.";
        return "You have unsaved settings.";
      };
      window.addEventListener("beforeunload", window.__riftUnsavedBound);
    }
    if (!hasChanges && window.__riftUnsavedBound) {
      window.removeEventListener("beforeunload", window.__riftUnsavedBound);
      window.__riftUnsavedBound = null;
    }
  }

  function confirmDiscard() {
    return confirmDialog({
      title: "Discard unsaved changes?",
      message: "Your edits haven't been sent to the bot yet.",
      confirmLabel: "Discard",
      danger: true,
    });
  }

  async function discardChanges() {
    if (!touched.size) return;
    if (!(await confirmDiscard())) return;
    for (const fieldDef of section.fields) values[fieldDef.key] = defaultFor(fieldDef, raw?.[fieldDef.key]);
    for (const extra of model?.extras || []) values[extra.key] = deepClone(raw?.[extra.key]);
    touched = new Set();
    syncWarning = null;
    renderForm();
    notify.info("Changes discarded.");
  }

  async function save() {
    if (section.mode === "readonly" || saving) return;
    const errors = validateAll();
    if (Object.keys(errors).length) {
      renderForm();
      const firstKey = Object.keys(errors)[0];
      const target = formHost.querySelector(`[data-field="${firstKey}"]`);
      (target || formHost).scrollIntoView({ block: "center", behavior: "smooth" });
      notify.error(`${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? "" : "s"} need attention before saving.`, { title: "Check the form" });
      Object.entries(errors).forEach(([key, message]) => {
        const wrap = formHost.querySelector(`#field-${section.key}-${key}-wrap, [data-field="${key}"]`);
        if (wrap) setInlineError(wrap, message);
      });
      return;
    }
    const payload = buildPayload();
    const diff = diffObjects(buildBaselinePayload(), payload);
    if (!Object.keys(diff).length) {
      notify.info("Nothing changed.");
      return;
    }
    saving = true;
    renderForm();
    try {
      await endpoints.settingsSave(guildId, section.key, payload);
      lastSavedAt = Date.now();
      // Read-after-write: prove the bot stored what we sent.
      let verification = null;
      try {
        verification = await endpoints.settingsGet(guildId, section.key);
      } catch {
        verification = null;
      }
      if (verification?.data && typeof verification.data === "object") {
        const saved = verification.data;
        const mismatches = [];
        for (const key of Object.keys(payload)) {
          if (key === "password") continue;
          if (!deepEqual(saved[key], payload[key])) mismatches.push(key);
        }
        if (mismatches.length) {
          syncWarning = callout({
            tone: "warning",
            title: "Saved, but the bot reports different values",
            children: `These keys came back different: ${mismatches.map(prettyKey).join(", ")}. Different shapes can be normal (e.g. IDs stored as numbers), otherwise the bot may clamp or derive these values.`,
          });
          notify.warning("Saved, but some values were normalised by the bot — check the warning above.", { title: "Saved with differences" });
        } else {
          syncWarning = null;
          notify.success(`${section.title} saved and verified against the bot.`);
        }
        raw = saved;
        model = buildSettingsModel(section, raw);
      } else {
        notify.success(`${section.title} saved.`);
        raw = { ...(raw || {}), ...payload };
      }
      values = {};
      for (const fieldDef of section.fields) values[fieldDef.key] = defaultFor(fieldDef, raw[fieldDef.key]);
      for (const extra of model?.extras || []) values[extra.key] = deepClone(raw[extra.key]);
      baseline = deepClone(raw);
      touched = new Set();
    } catch (err) {
      notify.error(err?.message || "The settings didn't save.", { title: "Save failed" });
      if (err?.status === 403) syncWarning = callout({ tone: "danger", title: "Missing permission", children: "The bot returned 403. You need Manage Server in this guild, and the bot must share it with your account." });
      else if (err?.status === 400) syncWarning = callout({ tone: "danger", title: "The bot rejected these values", children: err?.message || "Check required fields and value ranges." });
      else if (err?.network) syncWarning = callout({ tone: "warning", title: "The request may or may not have landed", children: "The connection dropped while saving. Refresh this section to see the stored state before retrying." });
    } finally {
      saving = false;
      renderForm();
      updateBeforeUnload(false);
    }
  }

  /* ---------------- events ---------------- */

  const saveHandler = () => {
    if (!saving && section.mode !== "readonly" && touched.size) save();
  };
  window.addEventListener("rift:save", saveHandler);

  const unregisterGuard = router.beforeLeave?.(async () => {
    if (!touched.size) return true;
    const ok = await confirmDiscard();
    return ok ? true : false;
  });

  // React to section changes in-place when navigating between settings pages.
  const rerender = () => {
    // Navigation to another settings section is handled by the router; nothing
    // else to do here besides clearing guards/unload state on unmount.
  };

  renderPageHeader();
  renderNav();
  renderForm();
  load();

  return () => {
    controller.abort();
    window.removeEventListener("rift:save", saveHandler);
    unregisterGuard?.();
    updateBeforeUnload(false);
    clear(root);
  };

  function renderAll() {
    renderNav();
    renderForm();
  }
}
