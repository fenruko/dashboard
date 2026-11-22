/* Owner-only panel: choose who can see the Diagnostics tab.
 * Type a staff username, pick a suggestion (arrow keys + Enter work), done.
 * The bot is the source of truth; this panel only calls its endpoints. */

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { badge, button, callout, spinner } from "./components.js";

export function diagnosticsAccessPanel({ endpoints, toast, confirm }) {
  const host = h("div", { class: "stack", "data-diagnostics-access": "" });
  const listbox = h("ul", { class: "autocomplete-list", role: "listbox", id: "diag-access-suggestions", hidden: true });
  const input = h("input", {
    class: "input",
    type: "text",
    role: "combobox",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "Type a staff username, e.g. fenruko",
    "aria-label": "Add a person to Diagnostics",
    "aria-autocomplete": "list",
    "aria-controls": "diag-access-suggestions",
    "aria-expanded": "false",
  });
  const granted = h("div", { class: "stack-tight" });
  const status = h("div");

  let users = [];
  let suggestions = [];
  let active = -1;
  let timer = null;
  let seq = 0;
  let disposed = false;

  function closeList() {
    listbox.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function renderSuggestions() {
    clear(listbox);
    if (!suggestions.length) {
      const text = input.value.trim();
      if (!text) return closeList();
      listbox.append(h("li", { class: "autocomplete-empty small muted" }, `No staff account matches "${text}".`));
    }
    suggestions.forEach((user, index) => {
      listbox.append(
        h(
          "li",
          {
            role: "option",
            id: `diag-opt-${user.id}`,
            class: `autocomplete-option${index === active ? " is-active" : ""}`,
            "aria-selected": index === active ? "true" : "false",
            onMousedown: (event) => {
              event.preventDefault();
              grant(user);
            },
          },
          h("strong", null, user.username),
          h("span", { class: "small muted" }, user.role || "staff")
        )
      );
    });
    listbox.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0 && suggestions[active]) input.setAttribute("aria-activedescendant", `diag-opt-${suggestions[active].id}`);
  }

  function renderGranted() {
    clear(granted);
    const list = users.filter((u) => u.granted && !u.owner);
    if (!list.length) {
      granted.append(h("p", { class: "small muted" }, "Only you can see Diagnostics right now."));
      return;
    }
    for (const user of list) {
      granted.append(
        h(
          "div",
          { class: "row", style: "justify-content:space-between;gap:10px", "data-granted": user.username },
          h(
            "div",
            { class: "row", style: "gap:8px;flex-wrap:wrap" },
            h("strong", null, user.username),
            badge({ label: user.role || "staff", tone: "neutral" }),
            !user.linked && badge({ label: "No Discord ID linked", tone: "warning" })
          ),
          button({ label: "Remove", icon: "trash", variant: "ghost", size: "sm", onClick: () => revoke(user) })
        )
      );
    }
    if (list.some((u) => !u.linked)) {
      granted.append(
        callout({
          tone: "warning",
          children: "Accounts without a linked Discord ID can't see the tab yet. Link it from the staff portal and it appears on their next load.",
        })
      );
    }
  }

  async function fetchUsers(query) {
    const mine = ++seq;
    try {
      const data = await endpoints.diagnosticsUsers(query);
      if (disposed || mine !== seq) return null;
      return data?.users || [];
    } catch (err) {
      if (!disposed && mine === seq) {
        clear(status);
        status.append(callout({ tone: "danger", title: "Couldn't load staff accounts", children: err?.message || "Try again in a moment." }));
      }
      return null;
    }
  }

  async function refreshAll() {
    const list = await fetchUsers("");
    if (list) {
      clear(status);
      users = list;
      renderGranted();
    }
  }

  function onInput() {
    clearTimeout(timer);
    const query = input.value.trim();
    if (!query) {
      suggestions = [];
      return closeList();
    }
    timer = setTimeout(async () => {
      const list = await fetchUsers(query);
      if (!list) return;
      suggestions = list.filter((u) => !u.granted && !u.owner);
      active = suggestions.length ? 0 : -1;
      renderSuggestions();
    }, 150);
  }

  async function grant(user) {
    closeList();
    input.value = "";
    try {
      await endpoints.diagnosticsGrant(user.id);
      toast.success(`${user.username} can now see Diagnostics.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't add that account.");
    }
    await refreshAll();
  }

  async function revoke(user) {
    const ok = await confirm({
      title: `Remove ${user.username}?`,
      message: "They will no longer see the Diagnostics tab.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await endpoints.diagnosticsRevoke(user.id);
      toast.success(`${user.username} removed.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't remove that account.");
    }
    await refreshAll();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("blur", () => setTimeout(closeList, 120));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = (active + step + suggestions.length) % suggestions.length;
      renderSuggestions();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = suggestions[active] || suggestions[0];
      if (pick) grant(pick);
    } else if (event.key === "Escape") {
      closeList();
    }
  });

  host.append(
    h("p", { class: "small muted" }, "Diagnostics is hidden from everyone except you. Add staff accounts here to let them see it too."),
    h("div", { class: "autocomplete" }, input, listbox),
    status,
    h("div", { class: "nav-group-label", style: "margin-top:6px" }, "Can see Diagnostics"),
    granted
  );
  granted.append(h("div", { class: "row small muted" }, spinner({ size: 14 }), "Loading…"));
  refreshAll();

  host.dispose = () => {
    disposed = true;
    clearTimeout(timer);
  };
  return host;
}
