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
  toast,
  keyValueGrid,
} from "../ui/components.js";
import { fmtInt, fmtRelative } from "../core/format.js";

export async function mountPage(ctx) {
  const { root, auth, prefs, router, endpoints, api } = ctx;
  const session = auth.get();
  const page = h("div", { class: "page" });
  const content = h("div", { class: "stack" });
  let saving = false;
  let lastSync = { at: 0, ok: null, error: null };

  const header = pageHeader({
    eyebrow: "Account",
    title: "Account & preferences",
    description: "Your Discord identity and how this dashboard behaves. UI preferences are stored locally and mirrored to the bot so they follow you between browsers.",
    actions: [button({ label: "Back to servers", icon: "grid", onClick: () => router.navigate("/guilds") })],
  });

  function render() {
    const p = prefs.get();
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
              { label: "API host", value: api.getBase().replace(/^https?:\/\//, ""), mono: true },
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
            button({ label: "Open diagnostics", icon: "terminal", onClick: () => router.navigate("/status") }),
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
            h("a", { class: "btn btn--ghost btn--sm", href: "/status" }, icon("shield", { size: 13 }), "Privacy details")
          ),
        ],
      })
    );
  }

  render();
  mount(page, header, content);
  mount(root, page);
  return () => clear(root);
}
