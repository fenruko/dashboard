/* Server picker: every guild the user can manage, with bot-presence state. */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { avatar, badge, button, card, emptyState, errorState, pageHeader, skeleton, toast } from "../ui/components.js";
import { buildInviteUrl } from "../config.js";
import { fmtInt } from "../core/format.js";
import { guildPath } from "../core/router.js";

export async function mountPage(ctx) {
  const { root, auth, router, prefs } = ctx;
  let search = "";
  let filter = "all";
  let refreshing = false;

  const page = h("div", { class: "page" });
  const header = pageHeader({
    eyebrow: "Workspace",
    title: "Your servers",
    description: "Servers where you have Manage Server or Administrator. Rift has to be in a server before its settings can be edited — if it isn't, add it here.",
    actions: [
      button({
        label: "Refresh account",
        icon: "refresh",
        loading: refreshing,
        onClick: async () => {
          refreshing = true;
          render();
          try {
            await auth.refresh();
            toast.success("Server list refreshed");
          } catch (err) {
            toast.error(err?.message || "Couldn't refresh your servers");
          } finally {
            refreshing = false;
            render();
          }
        },
      }),
      button({ label: "Account", icon: "user", onClick: () => router.navigate("/me") }),
    ],
  });

  const toolbar = h("div", { class: "row", style: "margin-bottom:16px" });
  const searchInput = h("input", {
    class: "input",
    type: "search",
    placeholder: "Search servers…",
    "aria-label": "Search servers",
    style: "max-width:340px",
    onInput: (event) => {
      search = event.target.value.trim().toLowerCase();
      renderList();
    },
  });
  const filterBar = h("div", { class: "segmented", role: "group", "aria-label": "Filter servers" });
  const content = h("div");

  function renderFilters() {
    clear(filterBar);
    const counts = {
      all: auth.get().guilds.length,
      present: auth.get().guilds.filter((guild) => guild.botPresent).length,
      missing: auth.get().guilds.filter((guild) => guild.botPresent === false).length,
    };
    for (const [id, label] of [
      ["all", `All ${counts.all}`],
      ["present", `Rift added ${counts.present}`],
      ["missing", `Needs Rift ${counts.missing}`],
    ]) {
      filterBar.append(
        h(
          "button",
          {
            type: "button",
            class: `segmented-btn${filter === id ? " is-active" : ""}`,
            "aria-pressed": filter === id ? "true" : "false",
            onClick: () => {
              filter = id;
              renderFilters();
              renderList();
            },
          },
          label
        )
      );
    }
  }

  function matches(guild) {
    if (search && !guild.name.toLowerCase().includes(search) && !guild.id.includes(search)) return false;
    if (filter === "present") return guild.botPresent === true;
    if (filter === "missing") return guild.botPresent === false;
    return true;
  }

  function guildCard(guild) {
    const lastId = prefs.get().lastGuildId;
    return h(
      "article",
      { class: "card card--interactive guild-card" },
      h(
        "div",
        { class: "guild-card-top" },
        guild.iconUrl
          ? h("img", { class: "guild-card-icon", src: guild.iconUrl, alt: "", width: 46, height: 46, loading: "lazy" })
          : h("span", { class: "guild-card-icon guild-card-icon--fallback" }, guild.name.slice(0, 1).toUpperCase()),
        h(
          "div",
          { class: "guild-card-title" },
          h("h3", { class: "truncate", title: guild.name }, guild.name),
          h(
            "div",
            { class: "guild-card-badges" },
            guild.owner ? badge({ label: "Owner", tone: "warning", icon: "crown" }) : badge({ label: "Manage Server", tone: "neutral", icon: "key" }),
            guild.botPresent === false ? badge({ label: "Rift not added", tone: "danger", dot: true }) : guild.botPresent ? badge({ label: "Live", tone: "success", dot: true }) : badge({ label: "Presence unknown", tone: "muted", dot: true }),
            String(lastId) === guild.id ? badge({ label: "Last opened", tone: "accent" }) : null
          )
        )
      ),
      h("div", { class: "guild-card-id mono" }, `ID ${guild.id}`),
      h(
        "div",
        { class: "guild-card-actions" },
        guild.botPresent === false
          ? h("a", { class: "btn btn--primary btn--sm", href: buildInviteUrl(guild.id), target: "_blank", rel: "noreferrer noopener" }, icon("plus", { size: 13 }), h("span", null, "Add Rift"))
          : button({ label: "Open dashboard", variant: "primary", size: "sm", icon: "arrow-right", onClick: () => router.navigate(guildPath(guild.id)) }),
        guild.botPresent !== false &&
          button({ label: "Settings", size: "sm", icon: "settings", onClick: () => router.navigate(guildPath(guild.id, "settings/automod")) })
      )
    );
  }

  function renderList() {
    clear(content);
    const session = auth.get();
    if (session.status === "booting" || session.status === "authenticating" || (session.status === "ready" && !session.guilds.length && !session.guildsLoaded)) {
      content.append(h("div", { class: "guild-grid" }, [1, 2, 3, 4].map(() => h("div", { class: "card" }, h("div", { class: "card-body" }, h("div", { class: "row", style: "gap:12px" }, skeleton({ w: 46, h: 46, radius: 12 }), h("div", { class: "stack-tight", style: "flex:1" }, skeleton({ w: "60%", h: 14 }), skeleton({ w: "35%", h: 11 }))))))));
      return;
    }
    if (session.status === "error") {
      content.append(errorState({ error: session.error, onRetry: () => auth.refresh() }));
      return;
    }
    const guilds = session.guilds.filter(matches);
    if (!session.guilds.length) {
      content.append(
        card({
          children: [
            emptyState({
              icon: "shield",
              title: "No manageable servers",
              message:
                "Rift only lists servers where your Discord roles include Manage Server or Administrator. If you're sure you have it, re-authorise the app (Discord caches app permissions) or check that the bot is in the server.",
              action: h(
                "div",
                { class: "row" },
                button({ label: "Sign in again", variant: "primary", icon: "refresh", onClick: () => auth.beginLogin({ returnTo: "/guilds" }) }),
                h("a", { class: "btn", href: buildInviteUrl(), target: "_blank", rel: "noreferrer noopener" }, "Invite Rift to a server")
              ),
            }),
          ],
        })
      );
      return;
    }
    if (!guilds.length) {
      content.append(emptyState({ icon: "search", title: "No servers match", message: "Try another search or filter.", compact: false }));
      return;
    }
    if (!session.botPresenceKnown) {
      content.append(
        h(
          "div",
          { class: "callout callout--warning", style: "margin-bottom:12px" },
          icon("alert-circle", { size: 16 }),
          h("div", { class: "callout-body" }, h("strong", { class: "callout-title" }, "Couldn't check which servers have Rift"), h("div", { class: "callout-text" }, "The bot's server list didn't load. Presence badges may be wrong until the API is reachable."))
        )
      );
    }
    content.append(h("div", { class: "guild-grid" }, guilds.map(guildCard)));
    content.append(h("p", { class: "small muted", style: "margin-top:14px" }, `${fmtInt(session.guilds.length)} manageable server${session.guilds.length === 1 ? "" : "s"} · ${fmtInt(session.guilds.filter((g) => g.botPresent).length)} with Rift installed`));
  }

  toolbar.append(searchInput, h("span", { class: "spacer" }), filterBar);
  mount(page, header, toolbar, content);
  mount(root, page);
  renderFilters();
  renderList();

  const unsubscribe = auth.subscribe(() => {
    renderFilters();
    renderList();
  });

  return () => {
    unsubscribe();
    clear(root);
  };
}
