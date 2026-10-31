/* Account + dashboard preferences (local UI prefs, synced to the bot when it
 * accepts /api/prefs). */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  avatar,
  badge,
  button,
  card,
  callout,
  confirmDialog,
  field,
  grid,
  pageHeader,
  segmentedControl,
  selectInput,
  switchControl,
  textInput,
  toast,
  keyValueGrid,
} from "../ui/components.js";
import { fmtInt, fmtRelative } from "../core/format.js";
import { getConfig, normalizeBase, setApiBase, clearApiBaseOverride, isDeveloperUserId } from "../config.js";

export async function mountPage(ctx) {
  const { root, auth, prefs, router, endpoints, api } = ctx;
  const session = auth.get();
  const page = h("div", { class: "page" });
  const content = h("div", { class: "stack" });
  let saving = false;
  let lastSync = { at: 0, ok: null, error: null };
  let apiDraft = getConfig().apiBase;

  const header = pageHeader({
    eyebrow: "Account",
    title: "Account & preferences",
    description: "Your Discord identity and how this dashboard behaves. UI preferences are stored locally and mirrored to the bot so they follow you between browsers.",
    actions: [button({ label: "Back to servers", icon: "grid", onClick: () => router.navigate("/guilds") })],
  });

  function developerCard() {
    const owner = isDeveloperUserId(session.user?.id);
    const result = h("div");
    const input = textInput({
      value: apiDraft,
      className: "mono",
      onInput: (event) => {
        apiDraft = event.target.value;
      },
    });

    async function testHost() {
      const base = normalizeBase(owner ? apiDraft : getConfig().apiBase);
      clear(result);
      if (!base) {
        result.append(callout({ tone: "danger", children: "Enter an API URL first." }));
        return;
      }
      result.append(h("p", { class: "small muted" }, "Testing…"));
      const started = performance.now();
      try {
        const response = await fetch(`${base}/stats`, { headers: { Accept: "application/json" }, cache: "no-store" });
        const elapsed = Math.round(performance.now() - started);
        const payload = await response.json().catch(() => ({}));
        clear(result);
        result.append(
          response.ok
            ? callout({
                tone: "success",
                title: `Reachable in ${elapsed}ms`,
                children: `${fmtInt(payload.servers ?? 0)} servers · ${fmtInt(payload.users ?? 0)} users`,
              })
            : callout({ tone: "warning", title: `HTTP ${response.status}`, children: "The host answered, but not with the Rift API." })
        );
      } catch {
        clear(result);
        result.append(
          callout({
            tone: "danger",
            title: "Couldn't reach that host",
            children: "Check the tunnel, the HTTPS certificate, and WEB_ALLOWED_ORIGINS on the bot.",
          })
        );
      }
    }

    function saveHost() {
      if (!isDeveloperUserId(session.user?.id)) {
        toast.error("Only Rift developers can change the API host.");
        return;
      }
      const next = normalizeBase(apiDraft);
      if (!next) {
        toast.error("Enter a valid API URL.");
        return;
      }
      setApiBase(next, session.user.id);
      toast.success("API host saved for this browser. Reloading…");
      setTimeout(() => location.reload(), 500);
    }

    function resetHost() {
      clearApiBaseOverride();
      toast.info("API host reset to the Rift default.");
      setTimeout(() => location.reload(), 400);
    }

    const enabled = Boolean(prefs.get().showDeveloperTools);
    return card({
      title: "Developer tools",
      subtitle: "Optional diagnostics and connection tools for this device.",
      children: [
        switchControl({
          label: "Enable developer tools",
          description: "Reveal Diagnostics and connection checks in this browser. Available to every account.",
          checked: enabled,
          onChange: (value) => {
            prefs.set({ showDeveloperTools: value });
            render();
          },
        }),
        enabled &&
          callout(
            owner
              ? {
                  tone: "warning",
                  title: "Changing the API host is restricted",
                  children: "Only fenruko and any IDs added to developerUserIds in config.js can point this browser at another bot API. The host is never shown on Diagnostics.",
                }
              : {
                  tone: "info",
                  title: "API host changes are restricted",
                  children: "The bot API host is managed by fenruko. Developer tools give you Diagnostics and connection checks; the host itself stays unchanged.",
                }
          ),
        enabled &&
          owner &&
          field({
            label: "API base URL",
            help: "Include /api. Stored in this browser only and tied to your Discord account.",
            children: h(
              "div",
              { class: "row", style: "flex-wrap:wrap" },
              input,
              button({ label: "Test", icon: "activity", onClick: testHost }),
              button({ label: "Save", variant: "primary", onClick: saveHost }),
              button({ label: "Reset", variant: "ghost", onClick: resetHost })
            ),
          }),
        enabled &&
          !owner &&
          h(
            "div",
            { class: "row", style: "margin-top:10px" },
            button({ label: "Test connection", icon: "activity", onClick: testHost })
          ),
        enabled && result,
        enabled &&
          h(
            "div",
            { class: "row", style: "margin-top:10px" },
            button({ label: "Open diagnostics", icon: "terminal", onClick: () => router.navigate("/status") })
          ),
      ],
    });
  }

  function render() {
    const p = prefs.get();
    const developer = isDeveloperUserId(session.user?.id);
    const developerTools = Boolean(p.showDeveloperTools);
    clear(content);
    content.append(
      grid(
        2,
        card({
          title: "Discord account",
          children: [
            h(
              "div",
              { class: "row", style: "gap:12px;margin-bottom:12px" },
              avatar({ name: session.user?.globalName || session.user?.username, src: session.user?.avatarUrl, size: 52, ring: true }),
              h(
                "div",
                { class: "stack-tight" },
                h("div", { style: "font-size:16px;font-weight:800" }, session.user?.globalName || session.user?.username || "Unknown"),
                h("div", { class: "small muted" }, session.user ? `@${session.user.username}` : ""),
                h("div", { class: "row" }, badge({ label: session.demo ? "Demo session" : "OAuth2 · identify guilds", tone: session.demo ? "warning" : "success", dot: true }))
              )
            ),
            keyValueGrid([
              { label: "User ID", value: session.user?.id || "—", mono: true },
              { label: "Manageable servers", value: fmtInt(session.guilds.length) },
              { label: "Token expires", value: session.expiresAt ? fmtRelative(session.expiresAt) : "unknown" },
              ...(developer ? [{ label: "Access", value: "Rift developer", mono: false }] : []),
            ]),
            h(
              "div",
              { class: "row", style: "margin-top:14px" },
              button({ label: "Re-authorise", icon: "refresh", size: "sm", onClick: () => auth.beginLogin({ returnTo: "/me" }) }),
              button({ label: "Sign out", icon: "log-out", size: "sm", variant: "danger", onClick: () => auth.logout() })
            ),
          ],
        }),
        card({
          title: "Appearance & behaviour",
          subtitle: "Applied instantly, no save button needed.",
          children: h(
            "div",
            { class: "stack-tight" },
            field({
              label: "Theme",
              children: segmentedControl({
                label: "Theme",
                value: p.theme,
                onChange: (value) => {
                  prefs.set({ theme: value });
                  render();
                },
                options: [
                  { value: "dark", label: "Dark", icon: "moon" },
                  { value: "light", label: "Light", icon: "sun" },
                  { value: "system", label: "System", icon: "monitor" },
                ],
              }),
            }),
            field({
              label: "Density",
              children: segmentedControl({
                label: "Density",
                value: p.density,
                onChange: (value) => {
                  prefs.set({ density: value });
                  render();
                },
                options: [
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ],
              }),
            }),
            switchControl({ label: "Auto-refresh live pages", description: "Pauses while the tab is hidden.", checked: p.autoRefresh, onChange: (value) => prefs.set({ autoRefresh: value }) }),
            switchControl({ label: "Reduce motion", description: "Also honours your OS setting.", checked: p.reducedMotion, onChange: (value) => prefs.set({ reducedMotion: value }) }),
            switchControl({ label: "Confirm destructive actions", description: "Ask before bans, kicks, deletes and bulk changes.", checked: p.confirmDestructive, onChange: (value) => prefs.set({ confirmDestructive: value }) }),
            switchControl({ label: "Show exact timestamps", description: "Adds local time alongside relative times.", checked: p.showTimestamps, onChange: (value) => prefs.set({ showTimestamps: value }) }),
            field({
              label: "Background refresh interval",
              help: "How often list pages revalidate while visible.",
              children: selectInput({
                value: String(p.refreshInterval),
                onChange: (value) => prefs.set({ refreshInterval: Number(value) }),
                options: [
                  { value: "15000", label: "Every 15 seconds" },
                  { value: "30000", label: "Every 30 seconds" },
                  { value: "60000", label: "Every minute" },
                  { value: "120000", label: "Every 2 minutes" },
                ],
              }),
            }),
            h(
              "div",
              { class: "row", style: "margin-top:6px" },
              button({
                label: "Save to account",
                icon: "save",
                variant: "primary",
                loading: saving,
                onClick: async () => {
                  saving = true;
                  render();
                  try {
                    const p2 = prefs.get();
                    await endpoints.prefsSet(session.user.id, {
                      theme: p2.theme,
                      density: p2.density,
                      reducedMotion: p2.reducedMotion,
                      autoRefresh: p2.autoRefresh,
                      refreshInterval: p2.refreshInterval,
                      sidebarCompact: p2.sidebarCompact,
                      confirmDestructive: p2.confirmDestructive,
                      showTimestamps: p2.showTimestamps,
                    });
                    lastSync = { at: Date.now(), ok: true, error: null };
                    toast.success("Preferences saved to your account.");
                  } catch (err) {
                    lastSync = { at: Date.now(), ok: false, error: err };
                    toast.error(err?.message || "Couldn't save preferences to the bot.");
                  } finally {
                    saving = false;
                    render();
                  }
                },
              }),
              button({
                label: "Reset",
                icon: "refresh",
                variant: "ghost",
                onClick: async () => {
                  if (await confirmDialog({ title: "Reset preferences?", message: "Theme, density and behaviour go back to defaults. This won't touch bot settings.", confirmLabel: "Reset", danger: true })) {
                    prefs.reset();
                    render();
                    toast.info("Preferences reset.");
                  }
                },
              })
            ),
            lastSync.at &&
              h("p", { class: `small ${lastSync.ok ? "muted" : "field-error"}` }, lastSync.ok ? `Last account sync ${fmtRelative(lastSync.at)}` : `Sync failed: ${lastSync.error?.message || "unknown error"}`)
          ),
        })
      ),
      card({
        title: "Data & privacy",
        children: [
          callout({
            tone: "info",
            title: "What leaves your browser",
            children: "Only your Discord bearer token (to the bot API you configured) and the settings you explicitly save. The dashboard has no analytics, no third-party scripts and no server of its own.",
          }),
          h(
            "div",
            { class: "row", style: "margin-top:12px;flex-wrap:wrap" },
            developerTools && button({ label: "Open diagnostics", icon: "terminal", onClick: () => router.navigate("/status") }),
            button({
              label: "Clear local caches",
              icon: "trash",
              variant: "ghost",
              onClick: async () => {
                if (await confirmDialog({ title: "Clear local caches?", message: "Clears cached API responses and the request log in this browser. You stay signed in.", confirmLabel: "Clear", danger: true })) {
                  localStorage.removeItem("rift_dashboard_prefs");
                  api.clearCache();
                  toast.success("Local caches cleared.");
                }
              },
            }),
          ),
        ],
      }),
      developerCard()
    );
  }

  render();
  mount(page, header, content);
  mount(root, page);
  return () => clear(root);
}
