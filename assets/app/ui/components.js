/* Reusable, accessible UI primitives. All rendering goes through dom.js, so
 * every user/Discord-provided string is inserted as text, never HTML. */

import { h, s, cx, clear, append, qs, uid, list } from "./dom.js";
import { icon } from "./icons.js";
import { fmtInt, fmtRelative, initials, titleCase, copyToClipboard } from "../core/format.js";
import { ApiError } from "../core/api.js";

/* ---------------- surfaces ---------------- */

export function card({ title, subtitle, actions, children, className = "", padding = "normal", footer = null, id } = {}) {
  return h(
    "section",
    { class: cx("card", `card--pad-${padding}`, className), id },
    (title || subtitle || actions) &&
      h(
        "header",
        { class: "card-head" },
        h(
          "div",
          { class: "card-title-wrap" },
          title && h("h2", { class: "card-title" }, title),
          subtitle && h("p", { class: "card-sub" }, subtitle)
        ),
        actions && h("div", { class: "card-actions" }, actions)
      ),
    h("div", { class: "card-body" }, children),
    footer && h("footer", { class: "card-foot" }, footer)
  );
}

export function pageHeader({ title, description, actions, icon: iconName, eyebrow, meta } = {}) {
  return h(
    "header",
    { class: "page-head" },
    h(
      "div",
      { class: "page-head-main" },
      eyebrow && h("div", { class: "eyebrow" }, eyebrow),
      h(
        "div",
        { class: "page-head-title" },
        iconName && h("span", { class: "page-head-icon" }, icon(iconName, { size: 20 })),
        h("h1", null, title)
      ),
      description && h("p", { class: "page-head-desc" }, description),
      meta && h("div", { class: "page-head-meta" }, meta)
    ),
    actions && h("div", { class: "page-head-actions" }, actions)
  );
}

export function section({ title, description, actions, children, className = "" } = {}) {
  return h(
    "section",
    { class: cx("stack", className) },
    (title || description || actions) &&
      h(
        "div",
        { class: "section-head" },
        h("div", null, title && h("h2", { class: "section-title" }, title), description && h("p", { class: "section-desc" }, description)),
        actions
      ),
    children
  );
}

export function stack(...children) {
  return h("div", { class: "stack" }, children);
}

export function grid(columns = 2, ...children) {
  return h("div", { class: cx("grid", `grid--${columns}`) }, children);
}

/* ---------------- buttons ---------------- */

export function button({
  label,
  children,
  variant = "secondary",
  size = "md",
  icon: iconName,
  iconRight,
  onClick,
  disabled = false,
  loading = false,
  type = "button",
  title,
  ariaLabel,
  className = "",
  href,
  external = false,
  full = false,
  id,
  ...rest
} = {}) {
  const content = [
    loading ? spinner({ size: 14 }) : iconName ? icon(iconName, { size: size === "sm" ? 13 : 15 }) : null,
    h("span", { class: "btn-label" }, children ?? label ?? ""),
    iconRight ? icon(iconRight, { size: size === "sm" ? 13 : 15 }) : null,
  ];
  const props = {
    class: cx("btn", `btn--${variant}`, `btn--${size}`, full && "btn--full", loading && "is-loading", className),
    type,
    disabled: disabled || loading,
    title,
    id,
    "aria-busy": loading ? "true" : undefined,
    "aria-label": ariaLabel,
    onClick,
    ...rest,
  };
  if (href) {
    return h("a", { ...props, href, class: cx(props.class, "btn--link"), target: external ? "_blank" : undefined, rel: external ? "noreferrer noopener" : undefined }, content);
  }
  return h("button", props, content);
}

export function iconButton({ icon: iconName, label, onClick, variant = "ghost", size = "md", disabled, title, className = "", ...rest } = {}) {
  return h(
    "button",
    {
      class: cx("btn", "btn--icon", `btn--${variant}`, `btn--${size}`, className),
      type: "button",
      "aria-label": label,
      title: title || label,
      disabled,
      onClick,
      ...rest,
    },
    icon(iconName, { size: size === "sm" ? 15 : 17, label: null })
  );
}

export function linkButton({ href, label, icon: iconName, external = false, className = "", onClick } = {}) {
  return h(
    "a",
    {
      class: cx("link", className),
      href,
      target: external ? "_blank" : undefined,
      rel: external ? "noreferrer noopener" : undefined,
      onClick,
    },
    iconName && icon(iconName, { size: 14 }),
    h("span", null, label),
    external && icon("external-link", { size: 12 })
  );
}

/* ---------------- indicators ---------------- */

const TONES = new Set(["neutral", "accent", "success", "warning", "danger", "info", "muted"]);

export function badge({ label, tone = "neutral", dot = false, icon: iconName, className = "" } = {}) {
  return h(
    "span",
    { class: cx("badge", `badge--${TONES.has(tone) ? tone : "neutral"}`, className) },
    dot && h("span", { class: "badge-dot", "aria-hidden": "true" }),
    iconName && icon(iconName, { size: 12 }),
    label
  );
}

export function avatar({ name = "?", src = "", size = 32, className = "", ring = false } = {}) {
  const sizePx = typeof size === "number" ? size : 32;
  const style = { width: `${sizePx}px`, height: `${sizePx}px`, fontSize: `${Math.max(9, Math.round(sizePx * 0.36))}px` };
  const fallback = h("span", { class: "avatar-fallback", "aria-hidden": "true" }, initials(name));
  const img = src
    ? h("img", {
        class: "avatar-img",
        src,
        alt: "",
        width: sizePx,
        height: sizePx,
        loading: "lazy",
        decoding: "async",
        onError: () => {
          img.remove();
          fallback.removeAttribute("hidden");
        },
      })
    : null;
  if (!img) fallback.removeAttribute("hidden");
  else fallback.setAttribute("hidden", "");
  return h("span", { class: cx("avatar", src ? "avatar--image" : "avatar--fallback", ring && "avatar--ring", className), style }, img, fallback);
}

export function userChip({ name, avatarUrl, sub, size = 28, className = "", onClick, title } = {}) {
  const content = [
    avatar({ name, src: avatarUrl, size }),
    h("span", { class: "user-chip-text" }, h("span", { class: "user-chip-name" }, name || "Unknown"), sub && h("span", { class: "user-chip-sub" }, sub)),
  ];
  if (onClick) {
    return h("button", { class: cx("user-chip", "user-chip--button", className), type: "button", onClick, title: title || name }, content);
  }
  return h("span", { class: cx("user-chip", className), title: title || name }, content);
}

export function statCard({ label, value, hint, icon: iconName, tone = "accent", loading = false, trend = null, action = null } = {}) {
  return h(
    "div",
    { class: cx("stat", `stat--${tone}`) },
    h(
      "div",
      { class: "stat-top" },
      h("span", { class: "stat-icon" }, icon(iconName || "activity", { size: 16 })),
      action
    ),
    loading ? skeleton({ w: 76, h: 26, className: "stat-skel" }) : h("div", { class: "stat-value" }, value ?? "—"),
    h(
      "div",
      { class: "stat-label" },
      label,
      trend != null && h("span", { class: cx("stat-trend", trend >= 0 ? "is-up" : "is-down") }, `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}%`)
    ),
    hint && h("div", { class: "stat-hint" }, hint)
  );
}

export function progressBar({ value = 0, max = 100, tone = "accent", label, className = "" } = {}) {
  const pct = max ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
  return h(
    "div",
    {
      class: cx("progress", `progress--${tone}`, className),
      role: "progressbar",
      "aria-valuenow": Math.round(pct),
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-label": label || "Progress",
    },
    h("span", { class: "progress-fill", style: { width: `${pct}%` } })
  );
}

export function spinner({ size = 16, label = "Loading" } = {}) {
  return h("span", { class: "spinner", style: { width: `${size}px`, height: `${size}px` }, role: "status", "aria-label": label });
}

export function skeleton({ w = "100%", h: height = 14, radius = 6, className = "" } = {}) {
  return h("span", {
    class: cx("skeleton", className),
    style: { width: typeof w === "number" ? `${w}px` : w, height: typeof height === "number" ? `${height}px` : height, borderRadius: `${radius}px` },
    "aria-hidden": "true",
  });
}

export function skeletonRows(count = 4) {
  return h(
    "div",
    { class: "skeleton-stack", "aria-busy": "true", "aria-label": "Loading content" },
    list(Array.from({ length: count }), (_, i) => h("div", { class: "skeleton-row" }, skeleton({ w: "38%", h: 12 }), skeleton({ w: "22%", h: 12 }), skeleton({ w: "12%", h: 12 })))
  );
}

export function emptyState({ icon: iconName = "inbox", title = "Nothing here yet", message, action, compact = false } = {}) {
  return h(
    "div",
    { class: cx("empty", compact && "empty--compact") },
    h("span", { class: "empty-icon" }, icon(iconName, { size: 22 })),
    h("div", { class: "empty-title" }, title),
    message && h("p", { class: "empty-msg" }, message),
    action && h("div", { class: "empty-action" }, action)
  );
}

export function errorState({ error, onRetry, title, compact = false } = {}) {
  const isApi = error instanceof ApiError;
  const offline = isApi && error.network;
  const status = isApi ? error.status : 0;
  const headline =
    title ||
    (offline
      ? "Rift's backend is unreachable"
      : status === 401
        ? "Your session expired"
        : status === 403
          ? "You don't have access to this"
          : status === 404
            ? "Not found"
            : status === 429
              ? "Slow down for a second"
              : "Something went wrong");
  const message =
    error?.message ||
    (offline
      ? "This usually means the bot host is asleep or the tunnel is down. Requests retry automatically."
      : "Try again. If it keeps happening, open Diagnostics and copy the report.");
  return h(
    "div",
    { class: cx("error-state", compact && "error-state--compact"), role: "alert" },
    h("span", { class: "error-icon" }, icon(offline ? "wifi-off" : "alert-circle", { size: 22 })),
    h("div", { class: "error-body" },
      h("div", { class: "error-title" }, headline),
      h("p", { class: "error-msg" }, message),
      isApi && status ? h("div", { class: "error-meta" }, `HTTP ${status}${error.requestId ? ` · request ${error.requestId}` : ""}`) : null,
      error?.retryAfter ? h("div", { class: "error-meta" }, `Retry in ${Math.ceil(error.retryAfter / 1000)}s`) : null
    ),
    onRetry ? button({ label: "Try again", icon: "refresh", onClick: onRetry, size: "sm" }) : null
  );
}

export function callout({ tone = "info", title, children, icon: iconName, action } = {}) {
  return h(
    "div",
    { class: cx("callout", `callout--${tone}`) },
    icon(iconName || (tone === "danger" ? "alert" : tone === "warning" ? "alert-circle" : tone === "success" ? "check-circle" : "info"), { size: 17 }),
    h("div", { class: "callout-body" }, title && h("strong", { class: "callout-title" }, title), h("div", { class: "callout-text" }, children)),
    action
  );
}

/* ---------------- form controls ---------------- */

export function field({ label, help, error = "", required = false, children, htmlFor, className = "", inline = false, action } = {}) {
  return h(
    "div",
    { class: cx("field", inline && "field--inline", error && "has-error", className) },
    h(
      "div",
      { class: "field-label-row" },
      label && h("label", { class: "field-label", for: htmlFor }, label, required && h("span", { class: "req", "aria-hidden": "true" }, "*")),
      action
    ),
    children,
    help && h("p", { class: "field-help" }, help),
    error && h("p", { class: "field-error", role: "alert" }, error)
  );
}

export function textInput({ value = "", onInput, onChange, placeholder = "", type = "text", id, name, autocomplete = "off", spellcheck = false, disabled, maxLength, min, max, step, required, className = "", ariaLabel } = {}) {
  return h("input", {
    class: cx("input", className),
    type,
    id,
    name,
    value: value ?? "",
    placeholder,
    autocomplete,
    spellcheck,
    disabled,
    maxlength: maxLength,
    min,
    max,
    step,
    required,
    "aria-label": ariaLabel,
    onInput: (event) => {
      onInput?.(event.target.value, event);
      onChange?.(event.target.value, event);
    },
  });
}

export function textareaInput({ value = "", onInput, onChange, placeholder = "", rows = 4, id, maxLength, disabled, className = "", ariaLabel } = {}) {
  return h("textarea", {
    class: cx("input", "textarea", className),
    id,
    rows,
    value: value ?? "",
    placeholder,
    maxlength: maxLength,
    disabled,
    "aria-label": ariaLabel,
    onInput: (event) => {
      onInput?.(event.target.value, event);
      onChange?.(event.target.value, event);
    },
  });
}

export function numberInput({ value = "", onInput, onChange, min, max, step = 1, id, placeholder, disabled, className = "", ariaLabel } = {}) {
  return h("input", {
    class: cx("input", className),
    type: "number",
    inputmode: "numeric",
    id,
    value: value ?? "",
    placeholder,
    min,
    max,
    step,
    disabled,
    "aria-label": ariaLabel,
    onInput: (event) => {
      const raw = event.target.value;
      onInput?.(raw === "" ? "" : Number(raw), event);
      onChange?.(raw === "" ? "" : Number(raw), event);
    },
  });
}

export function selectInput({ value = "", options = [], onChange, id, disabled, className = "", ariaLabel, placeholder } = {}) {
  const select = h(
    "select",
    {
      class: cx("input", "select", className),
      id,
      disabled,
      "aria-label": ariaLabel,
      onChange: (event) => onChange?.(event.target.value, event),
    },
    placeholder && h("option", { value: "" }, placeholder),
    options.map((option) => {
      const normalized = typeof option === "object" ? option : { value: option, label: titleCase(option) };
      return h("option", { value: String(normalized.value) }, normalized.label);
    })
  );
  select.value = value == null ? "" : String(value);
  return select;
}

export function switchControl({ checked = false, onChange, label, description, id, disabled = false } = {}) {
  const inputId = id || uid("switch");
  return h(
    "div",
    { class: cx("switch-row", disabled && "is-disabled") },
    h(
      "div",
      { class: "switch-text" },
      h("label", { class: "switch-label", for: inputId }, label),
      description && h("p", { class: "switch-desc" }, description)
    ),
    h(
      "label",
      { class: "switch" },
      h("input", {
        id: inputId,
        type: "checkbox",
        role: "switch",
        checked: Boolean(checked),
        disabled,
        "aria-checked": checked ? "true" : "false",
        onChange: (event) => onChange?.(event.target.checked, event),
      }),
      h("span", { class: "switch-track", "aria-hidden": "true" }, h("span", { class: "switch-thumb" }))
    )
  );
}

export function checkboxControl({ checked = false, onChange, label, id, disabled } = {}) {
  const inputId = id || uid("check");
  return h(
    "label",
    { class: cx("checkbox", disabled && "is-disabled"), for: inputId },
    h("input", { id: inputId, type: "checkbox", checked: Boolean(checked), disabled, onChange: (event) => onChange?.(event.target.checked, event) }),
    h("span", { class: "checkbox-box", "aria-hidden": "true" }, icon("check", { size: 12 })),
    h("span", null, label)
  );
}

export function segmentedControl({ options = [], value, onChange, label, size = "md" } = {}) {
  return h(
    "div",
    { class: cx("segmented", `segmented--${size}`), role: "group", "aria-label": label },
    options.map((option) =>
      h(
        "button",
        {
          type: "button",
          class: cx("segmented-btn", String(option.value) === String(value) && "is-active"),
          "aria-pressed": String(option.value) === String(value) ? "true" : "false",
          onClick: () => onChange?.(option.value),
        },
        option.icon && icon(option.icon, { size: 14 }),
        h("span", null, option.label)
      )
    )
  );
}

export function colorInput({ value = "", onChange, id, disabled } = {}) {
  const safe = /^#?[0-9a-f]{6}$/i.test(String(value || "")) ? `#${String(value).replace(/^#/, "")}` : "#00b8ff";
  return h(
    "div",
    { class: "color-input" },
    h("input", { type: "color", class: "color-swatch", value: safe, disabled, "aria-label": "Pick a colour", onInput: (e) => onChange?.(e.target.value.replace(/^#/, "")) }),
    h("input", {
      class: "input mono",
      id,
      value: value ?? "",
      placeholder: "00b8ff",
      disabled,
      maxlength: 6,
      onInput: (e) => onChange?.(e.target.value.replace(/^#/, "").slice(0, 6)),
    })
  );
}

export function tagListEditor({ values = [], onChange, placeholder = "Add an item and press Enter", validate, typeLabel = "items" } = {}) {
  const tags = [...values];
  const wrap = h("div", { class: "tag-editor" });
  const input = h("input", {
    class: "input tag-editor-input",
    placeholder,
    "aria-label": placeholder,
    onKeydown: (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        add(input.value);
      } else if (event.key === "Backspace" && !input.value && tags.length) {
        tags.pop();
        render();
        onChange?.([...tags]);
      }
    },
    onBlur: () => {
      if (input.value.trim()) add(input.value);
    },
  });

  function add(raw) {
    const value = String(raw || "").trim();
    if (!value) return;
    const error = validate?.(value);
    if (error) {
      input.setAttribute("aria-invalid", "true");
      input.title = error;
      return;
    }
    input.removeAttribute("aria-invalid");
    input.title = "";
    if (!tags.some((tag) => String(tag).toLowerCase() === value.toLowerCase())) tags.push(value);
    input.value = "";
    render();
    onChange?.([...tags]);
  }

  function render() {
    clear(wrap);
    if (!tags.length) append(wrap, h("span", { class: "tag-editor-empty" }, `No ${typeLabel} yet.`));
    for (const tag of tags) {
      append(
        wrap,
        h(
          "span",
          { class: "tag" },
          h("span", null, String(tag)),
          h(
            "button",
            {
              type: "button",
              class: "tag-remove",
              "aria-label": `Remove ${tag}`,
              onClick: () => {
                const index = tags.indexOf(tag);
                if (index >= 0) tags.splice(index, 1);
                render();
                onChange?.([...tags]);
              },
            },
            icon("x", { size: 11 })
          )
        )
      );
    }
    append(wrap, input);
    input.focus();
  }

  render();
  return wrap;
}

export function listTextEditor({ values = [], onChange, rows = 4, placeholder = "One per line" } = {}) {
  const area = h("textarea", {
    class: "input textarea mono",
    rows,
    placeholder,
    value: (values || []).join("\n"),
    onInput: (event) => {
      const lines = event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      onChange?.(lines);
    },
  });
  return area;
}

export function jsonEditor({ value = {}, onChange, rows = 10, label = "JSON" } = {}) {
  const status = h("p", { class: "field-help", role: "status" });
  const textarea = h("textarea", {
    class: "input textarea mono",
    rows,
    spellcheck: false,
    "aria-label": label,
    value: JSON.stringify(value ?? {}, null, 2),
  });
  function validate() {
    try {
      const parsed = JSON.parse(textarea.value);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        status.textContent = "Expected a JSON object.";
        status.className = "field-error";
        textarea.setAttribute("aria-invalid", "true");
        return null;
      }
      status.textContent = "Valid JSON object.";
      status.className = "field-help is-valid";
      textarea.removeAttribute("aria-invalid");
      return parsed;
    } catch (err) {
      status.textContent = `Invalid JSON: ${err.message}`;
      status.className = "field-error";
      textarea.setAttribute("aria-invalid", "true");
      return null;
    }
  }
  textarea.addEventListener("input", () => {
    const parsed = validate();
    if (parsed) onChange?.(parsed);
  });
  validate();
  const format = button({
    label: "Format",
    size: "sm",
    variant: "ghost",
    icon: "list",
    onClick: () => {
      const parsed = validate();
      if (parsed) textarea.value = JSON.stringify(parsed, null, 2);
    },
  });
  return h("div", { class: "json-editor" }, h("div", { class: "json-toolbar" }, format), textarea, status);
}

/* ---------------- picker modal ---------------- */

export function openPicker({
  title = "Select an item",
  options = [],
  value,
  multi = false,
  onSelect,
  allowNone = true,
  noneLabel = "None",
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing matches that search.",
} = {}) {
  const selected = new Set(multi ? (Array.isArray(value) ? value.map(String) : value ? [String(value)] : []) : []);
  const listWrap = h("div", { class: "picker-list", role: "listbox", "aria-multiselectable": multi ? "true" : "false" });
  const search = h("input", {
    class: "input picker-search",
    placeholder: searchPlaceholder,
    type: "search",
    "aria-label": searchPlaceholder,
    onInput: (event) => render(event.target.value.toLowerCase()),
  });

  function render(filter = "") {
    clear(listWrap);
    const filtered = options.filter((option) => {
      const label = `${option.label || ""} ${option.sub || ""} ${option.id || ""}`.toLowerCase();
      return !filter || label.includes(filter);
    });
    if (!filtered.length) {
      append(listWrap, h("p", { class: "picker-empty" }, emptyLabel));
      return;
    }
    for (const option of filtered.slice(0, 400)) {
      const isSelected = selected.has(String(option.value));
      const row = h(
        "button",
        {
          type: "button",
          class: cx("picker-row", isSelected && "is-selected"),
          role: "option",
          "aria-selected": isSelected ? "true" : "false",
          onClick: () => {
            if (multi) {
              if (selected.has(String(option.value))) selected.delete(String(option.value));
              else selected.add(String(option.value));
              render(search.value.toLowerCase());
            } else {
              onSelect?.(option.value, option);
              close();
            }
          },
        },
        h("span", { class: "picker-label" }, option.label || String(option.value)),
        option.sub && h("span", { class: "picker-sub" }, option.sub),
        isSelected && icon("check", { size: 14 })
      );
      append(listWrap, row);
    }
  }

  render();
  const footer = [
    allowNone && !multi
      ? button({
          label: noneLabel,
          variant: "ghost",
          onClick: () => {
            onSelect?.("", { value: "", label: noneLabel });
            close();
          },
        })
      : null,
    h("span", { class: "spacer" }),
    button({ label: "Cancel", variant: "ghost", onClick: () => close() }),
    multi
      ? button({
          label: "Apply",
          variant: "primary",
          onClick: () => {
            onSelect?.([...selected]);
            close();
          },
        })
      : null,
  ];

  const modal = openModal({ title, body: h("div", { class: "picker" }, search, listWrap), footer, size: "md" });
  const close = () => modal.close();
  setTimeout(() => search.focus(), 30);
  return modal;
}

/* ---------------- data table ---------------- */

export function dataTable({
  columns = [],
  rows = [],
  rowKey = (row, i) => row?.id != null ? String(row.id) : String(i),
  loading = false,
  error = null,
  onRetry,
  empty = null,
  sort,
  onSortChange,
  pageSize = 0,
  page = 1,
  onPageChange,
  onRowClick,
  caption,
  dense = false,
  className = "",
} = {}) {
  const wrap = h("div", { class: cx("table-wrap", dense && "table-wrap--dense", className) });

  if (error) {
    append(wrap, errorState({ error, onRetry, compact: true }));
    return wrap;
  }

  const body = h("tbody");
  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = pageSize ? rows.slice((safePage - 1) * pageSize, safePage * pageSize) : rows;

  const thead = h(
    "thead",
    null,
    h(
      "tr",
      null,
      columns.map((column) => {
        const sortable = column.sortable !== false && onSortChange;
        const active = sort?.key === column.key;
        return h(
          "th",
          {
            scope: "col",
            class: cx(column.align && `align-${column.align}`, column.className, sortable && "th-sortable", active && "is-sorted"),
            "aria-sort": active ? (sort.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined,
            style: column.width ? { width: column.width } : undefined,
          },
          sortable
            ? h(
                "button",
                {
                  type: "button",
                  class: "th-btn",
                  onClick: () => onSortChange(column.key, active && sort.direction === "asc" ? "desc" : "asc"),
                },
                column.label,
                h("span", { class: cx("sort-arrow", active && sort.direction) }, icon(active && sort.direction === "desc" ? "chevron-down" : "chevron-up", { size: 12 }))
              )
            : column.label
        );
      })
    )
  );

  if (loading && !rows.length) {
    for (let i = 0; i < 5; i += 1) {
      append(body, h("tr", { class: "is-loading" }, columns.map(() => h("td", null, skeleton({ h: 12 })))));
    }
  } else if (!visible.length) {
    append(body, h("tr", null, h("td", { colspan: columns.length }, empty || emptyState({ title: "Nothing to show", compact: true }))));
  } else {
    for (const [index, row] of visible.entries()) {
      const tr = h(
        "tr",
        {
          class: cx(onRowClick && "tr-clickable"),
          tabindex: onRowClick ? "0" : undefined,
          onClick: onRowClick ? (event) => onRowClick(row, event) : undefined,
          onKeydown: onRowClick
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row, event);
                }
              }
            : undefined,
          "data-key": rowKey(row, index),
        },
        columns.map((column) => h("td", { class: cx(column.align && `align-${column.align}`, column.cellClass) }, column.render ? column.render(row, index) : row?.[column.key] ?? "—"))
      );
      append(body, tr);
    }
  }

  append(wrap, h("table", { class: "data-table" }, caption && h("caption", { class: "sr-only" }, caption), thead, body));
  if (loading && rows.length) append(wrap, h("div", { class: "table-loading" }, spinner({ size: 14 }), "Refreshing…"));
  if (pageSize && rows.length > pageSize) {
    append(
      wrap,
      h(
        "div",
        { class: "table-foot" },
        h("span", { class: "table-count" }, `${fmtInt(rows.length)} rows · page ${safePage} of ${totalPages}`),
        pagination({ page: safePage, totalPages, onChange: onPageChange })
      )
    );
  }
  return wrap;
}

export function pagination({ page = 1, totalPages = 1, onChange } = {}) {
  if (totalPages <= 1) return null;
  return h(
    "div",
    { class: "pagination", role: "navigation", "aria-label": "Pagination" },
    iconButton({ icon: "chevron-left", label: "Previous page", size: "sm", disabled: page <= 1, onClick: () => onChange?.(page - 1) }),
    h("span", { class: "pagination-label" }, `${page} / ${totalPages}`),
    iconButton({ icon: "chevron-right", label: "Next page", size: "sm", disabled: page >= totalPages, onClick: () => onChange?.(page + 1) })
  );
}

/* ---------------- tabs ---------------- */

export function tabs({ tabs: definitions = [], active, change = null, onChange, className = "" } = {}) {
  let current = active || definitions[0]?.id;
  const content = h("div", { class: "tab-content", role: "tabpanel", tabindex: "0" });
  const listEl = h("div", { class: "tabs", role: "tablist" });

  function renderTabs() {
    clear(listEl);
    for (const tab of definitions) {
      append(
        listEl,
        h(
          "button",
          {
            type: "button",
            role: "tab",
            id: `tab-${tab.id}`,
            "aria-controls": `panel-${tab.id}`,
            "aria-selected": tab.id === current ? "true" : "false",
            class: cx("tab", tab.id === current && "is-active"),
            onClick: () => select(tab.id),
            onKeydown: (event) => {
              const index = definitions.findIndex((t) => t.id === current);
              if (event.key === "ArrowRight") select(definitions[(index + 1) % definitions.length].id);
              if (event.key === "ArrowLeft") select(definitions[(index - 1 + definitions.length) % definitions.length].id);
            },
          },
          tab.icon && icon(tab.icon, { size: 14 }),
          h("span", null, tab.label),
          tab.count != null && h("span", { class: "tab-count" }, fmtInt(tab.count))
        )
      );
    }
  }

  function select(id) {
    current = id;
    renderTabs();
    content.id = `panel-${id}`;
    content.setAttribute("aria-labelledby", `tab-${id}`);
    clear(content);
    const tab = definitions.find((t) => t.id === id);
    if (tab) {
      try {
        append(content, tab.render ? tab.render() : null);
      } catch (err) {
        append(content, errorState({ error: err }));
      }
    }
    onChange?.(id);
  }

  renderTabs();
  const el = h("div", { class: cx("tab-group", className) }, listEl, content);
  select(current);
  return {
    el,
    select,
    setCount(id, count) {
      const tab = definitions.find((t) => t.id === id);
      if (tab) {
        tab.count = count;
        renderTabs();
      }
    },
    get active() {
      return current;
    },
  };
}

/* ---------------- overlay: modal ---------------- */

let modalCounter = 0;

export function openModal({ title, body, footer = null, size = "md", onClose, labelledBy, className = "", dismissible = true, initialFocus } = {}) {
  const root = (typeof document !== "undefined" && document.getElementById("overlay-root")) || document.body;
  const id = `modal-${++modalCounter}`;
  const titleId = labelledBy || `${id}-title`;
  const previousFocus = document.activeElement;
  let closed = false;

  const dialog = h(
    "div",
    {
      class: cx("modal", `modal--${size}`, className),
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": title ? titleId : undefined,
      "aria-label": title ? undefined : "Dialog",
      tabindex: "-1",
    },
    (title || dismissible) &&
      h(
        "header",
        { class: "modal-head" },
        title && h("h2", { id: titleId, class: "modal-title" }, title),
        dismissible && iconButton({ icon: "x", label: "Close dialog", onClick: () => close(), size: "sm" })
      ),
    h("div", { class: "modal-body" }, body),
    footer && h("footer", { class: "modal-foot" }, footer)
  );
  const overlay = h("div", {
    class: "overlay",
    onMousedown: (event) => {
      if (dismissible && event.target === overlay) close();
    },
  }, dialog);

  function onKeydown(event) {
    if (event.key === "Escape" && dismissible) {
      event.stopPropagation();
      close();
    }
    if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown, true);
    overlay.classList.add("is-closing");
    setTimeout(() => overlay.remove(), 120);
    document.body.classList.remove("no-scroll");
    try {
      previousFocus?.focus?.();
    } catch {
      /* ignore */
    }
    onClose?.(result);
  }

  root.appendChild(overlay);
  document.body.classList.add("no-scroll");
  document.addEventListener("keydown", onKeydown, true);
  requestAnimationFrame(() => {
    const target = initialFocus || dialog.querySelector("input, textarea, select, button");
    (target || dialog).focus?.();
  });
  return { el: overlay, close, dialog };
}

export function confirmDialog({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  requireText = "",
  details = null,
} = {}) {
  return new Promise((resolve) => {
    let confirmed = false;
    let input = null;
    const body = h(
      "div",
      { class: "confirm-body" },
      message && h("p", { class: "confirm-message" }, message),
      details,
      requireText &&
        field({
          label: `Type “${requireText}” to confirm`,
          children: (input = textInput({ placeholder: requireText, autocomplete: "off" })),
        })
    );
    const modal = openModal({
      title,
      body,
      size: "sm",
      onClose: () => resolve(confirmed),
      footer: [
        button({ label: cancelLabel, variant: "ghost", onClick: () => modal.close() }),
        button({
          label: confirmLabel,
          variant: danger ? "danger" : "primary",
          icon: danger ? "alert" : "check",
          onClick: () => {
            if (requireText && input.value.trim() !== requireText) {
              input.setAttribute("aria-invalid", "true");
              input.focus();
              return;
            }
            confirmed = true;
            modal.close();
          },
        }),
      ],
    });
    if (requireText) setTimeout(() => input?.focus(), 50);
  });
}

/* ---------------- toasts ---------------- */

const TOAST_ICONS = { success: "check-circle", error: "x-circle", warning: "alert", info: "info" };
let toastCounter = 0;
const activeToasts = new Set();

function toastHost() {
  let host = typeof document !== "undefined" ? document.getElementById("toast-root") : null;
  if (!host && typeof document !== "undefined") {
    host = h("div", { id: "toast-root", class: "toast-root", role: "region", "aria-label": "Notifications", "aria-live": "polite" });
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, { type = "info", title = "", duration = 4200, action = null, id = "" } = {}) {
  if (typeof document === "undefined") return { close() {} };
  const host = toastHost();
  const key = id || `${type}:${title}:${message}`;
  for (const existing of activeToasts) {
    if (existing.key === key && Date.now() - existing.at < 4000) return existing.handle;
  }
  if (activeToasts.size >= 5) {
    const oldest = [...activeToasts][0];
    oldest?.handle?.close?.();
  }

  const node = h(
    "div",
    { class: cx("toast", `toast--${type}`), role: type === "error" ? "alert" : "status" },
    icon(TOAST_ICONS[type] || "info", { size: 17 }),
    h("div", { class: "toast-text" }, title && h("strong", { class: "toast-title" }, title), h("span", { class: "toast-message" }, message)),
    action && h("div", { class: "toast-action" }, action),
    h("button", { type: "button", class: "toast-close", "aria-label": "Dismiss notification", onClick: () => handle.close() }, icon("x", { size: 13 }))
  );

  let timer = null;
  const handle = {
    key,
    at: Date.now(),
    close() {
      if (!node.isConnected) return;
      node.classList.add("is-leaving");
      setTimeout(() => {
        node.remove();
        activeToasts.delete(handle);
      }, 160);
      clearTimeout(timer);
    },
    node,
  };
  activeToasts.add(handle);
  host.appendChild(node);
  if (duration > 0) timer = setTimeout(() => handle.close(), Math.max(1200, duration));
  return handle;
}

toast.success = (message, options = {}) => toast(message, { ...options, type: "success" });
toast.error = (message, options = {}) => toast(message, { ...options, type: "error", duration: options.duration ?? 6000 });
toast.warning = (message, options = {}) => toast(message, { ...options, type: "warning" });
toast.info = (message, options = {}) => toast(message, { ...options, type: "info" });
toast.dismissAll = () => [...activeToasts].forEach((handle) => handle.close());

/* ---------------- misc ---------------- */

export function kbd(keys) {
  const parts = Array.isArray(keys) ? keys : String(keys).split("+");
  return h("span", { class: "kbd-group" }, parts.map((part) => h("kbd", { class: "kbd" }, part)));
}

export function copyButton({ text, label = "Copy", successMessage = "Copied to clipboard", size = "sm", variant = "ghost" } = {}) {
  return button({
    label,
    size,
    variant,
    icon: "copy",
    onClick: async () => {
      const ok = await copyToClipboard(typeof text === "function" ? text() : text);
      if (ok) toast.success(successMessage);
      else toast.error("Couldn't copy — your browser blocked clipboard access.");
    },
  });
}

export function keyValueGrid(items = [], { columns = 2 } = {}) {
  return h(
    "dl",
    { class: cx("kv-grid", `kv-grid--${columns}`) },
    items.filter(Boolean).map((item) =>
      h(
        "div",
        { class: "kv" },
        h("dt", { class: "kv-key" }, item.label),
        h("dd", { class: cx("kv-value", item.mono && "mono") }, item.value ?? "—")
      )
    )
  );
}

export function breadcrumbs(items = []) {
  return h(
    "nav",
    { class: "breadcrumbs", "aria-label": "Breadcrumb" },
    items.map((item, index) => [
      index > 0 && h("span", { class: "crumb-sep", "aria-hidden": "true" }, "/"),
      item.href ? h("a", { href: item.href, class: "crumb" }, item.label) : h("span", { class: "crumb is-current", "aria-current": "page" }, item.label),
    ])
  );
}

export function fieldError(container, message) {
  const existing = qs(".field-error", container);
  if (existing) existing.remove();
  if (message) append(container, h("p", { class: "field-error", role: "alert" }, message));
  container.classList.toggle("has-error", Boolean(message));
}

export function relativeTime(value) {
  const time = h("time", { datetime: new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value).toISOString() });
  const update = () => {
    time.textContent = fmtRelative(value);
  };
  update();
  const id = setInterval(update, 30_000);
  time.addEventListener("DOMNodeRemovedFromDocument", () => clearInterval(id), { once: true });
  return time;
}

export function statusDot(state) {
  const tone = {
    open: "success",
    ready: "success",
    connected: "success",
    connecting: "warning",
    reconnecting: "warning",
    paused: "muted",
    idle: "muted",
    closed: "danger",
    error: "danger",
    unauthorized: "danger",
  }[state] || "neutral";
  return h("span", { class: `status-dot status-dot--${tone}`, title: state, "aria-label": state });
}
