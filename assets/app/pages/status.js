/* Diagnostics: what the dashboard is talking to, in real time. */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  badge,
  button,
  card,
  callout,
  copyButton,
  dataTable,
  errorState,
  field,
  grid,
  keyValueGrid,
  pageHeader,
  progressBar,
  spinner,
  statCard,
  statusDot,
  textInput,
  toast,
} from "../ui/components.js";
import { getConfig, setApiBase, clearOverrides, saveUiConfig } from "../config.js";
import { fmtDuration, fmtInt, fmtRelative, copyToClipboard } from "../core/format.js";

export async function mountPage(ctx) {
  const { root, api, auth, live, router, prefs } = ctx;
  const page = h("div", { class: "page" });
  const content = h("div", { class: "stack" });
  let timer = null;
  let probeResults = null;

  const header = pageHeader({
    eyebrow: "Troubleshooting",
    title: "Diagnostics",
    description: "Live status of the session, API, sockets and caches. Everything here is local to this browser; the report is safe to share.",
    actions: [
      copyButton({ text: () => buildReport(), label: "Copy report", successMessage: "Diagnostics copied" }),
      button({ label: "Refresh", icon: "refresh", onClick: () => render() }),
    ],
  });

  const apiBaseInput = textInput({ value: api.getBase(), className: "mono" });

  function probeSection() {
    const results = probeResults;
    return card({
      title: "Endpoint health",
      subtitle: "Runs unauthenticated/read-only probes against the API host.",
      actions: button({
        label: "Run probes",
        icon: "activity",
        size: "sm",
        loading: results === "running",
        onClick: async () => {
          probeResults = "running";
          render();
          const probes = await Promise.all([
            api.probe("/stats", { auth: false }),
            api.probe("/bot/guild-ids"),
            api.probe("/vc/guilds"),
          ]);
          probeResults = [
            { name: "/stats", ...probes[0] },
            { name: "/bot/guild-ids", ...probes[1] },
            { name: "/vc/guilds", ...probes[2] },
          ];
          render();
        },
      }),
      children:
        results && results !== "running"
          ? h(
              "div",
              { class: "stack-tight" },
              results.map((result) =>
                h(
                  "div",
                  { class: "row row--between", style: "padding:7px 0;border-bottom:1px solid var(--line)" },
                  h("span", { class: "mono" }, result.name),
                  h(
                    "span",
                    { class: "row", style: "gap:8px" },
                    badge({ label: result.ok ? "OK" : result.status ? `HTTP ${result.status}` : "Unreachable", tone: result.ok ? "success" : "danger", dot: true }),
                    h("span", { class: "small muted" }, `${result.ms}ms`),
                    !result.ok && result.error && h("span", { class: "small muted truncate", style: "max-width:320px", title: result.error.message }, result.error.message)
                  )
                )
              )
            )
          : results === "running"
            ? h("div", { class: "row" }, spinner({ size: 15 }), h("span", { class: "muted" }, "Probing…"))
            : h("p", { class: "muted small" }, "No probes run yet."),
    });
  }

  function buildReport() {
    return ctx.api && typeof window.__riftDiagnostics === "function" ? window.__riftDiagnostics() : "Diagnostics unavailable";
  }

  function render() {
    const session = auth.get();
    const metrics = api.getMetrics();
    const liveStatus = live.statusStore.get();
    const breaker = api.isBreakerOpen();
    const log = api.getLog();
    const config = getConfig();

    const cards = [
      grid(
        4,
        statCard({ label: "Session", value: session.status, icon: session.status === "ready" ? "user-check" : "user-x", tone: session.status === "ready" ? "success" : "danger" }),
        statCard({ label: "API base", value: config.isLocal ? "Local" : "Remote", hint: api.getBase().replace(/^https?:\/\//, ""), icon: "server", tone: "accent" }),
        statCard({ label: "Requests", value: fmtInt(metrics.requests), hint: `${fmtInt(metrics.failures)} failed · ${fmtInt(metrics.retries)} retried`, icon: "activity", tone: "violet" }),
        statCard({ label: "Cache", value: fmtInt(api.cacheSize()), hint: `${fmtInt(metrics.cacheHits)} hits`, icon: "database", tone: "success" })
      ),

      grid(
        2,
        card({
          title: "Session & identity",
          children: [
            keyValueGrid([
              { label: "Status", value: h("span", { class: "row", style: "gap:6px" }, statusDot(session.status === "ready" ? "open" : session.status === "expired" ? "error" : "connecting"), session.status) },
              { label: "Discord user", value: session.user ? `${session.user.username} (${session.user.id})` : "—", mono: Boolean(session.user) },
              { label: "Manageable servers", value: fmtInt(session.guilds.length) },
              { label: "Rift present", value: `${fmtInt(session.guilds.filter((g) => g.botPresent).length)} known`, mono: false },
              { label: "Token expires", value: session.expiresAt ? fmtRelative(session.expiresAt) : "unknown" },
              { label: "Demo mode", value: session.demo ? "on" : "off" },
              { label: "Live socket", value: `${liveStatus.stats} / vc ${liveStatus.vc}` },
              { label: "WebSocket queue", value: live.statusStore.get().stats === "open" ? "streaming" : "reconnecting" },
            ]),
            h(
              "div",
              { class: "row", style: "margin-top:12px" },
              button({ label: "Reconnect live feed", icon: "refresh", size: "sm", onClick: () => { live.reconnect(); toast.info("Reconnecting the live feed…"); } }),
              button({ label: "Re-authorise", icon: "key", size: "sm", onClick: () => auth.beginLogin({ returnTo: "/status" }) })
            ),
          ],
        }),
        card({
          title: "Resilience",
          subtitle: "What happens when the bot host sleeps or your network drops.",
          children: [
            h("div", { class: "stack-tight" },
              h("div", { class: "row row--between" }, h("span", { class: "muted small" }, "Circuit breaker"), badge({ label: breaker ? "OPEN" : "closed", tone: breaker ? "danger" : "success", dot: true })),
              breaker && progressBar({ value: api.breakerRemaining(), max: 60_000, tone: "danger", label: "Breaker cooldown" }),
              h("div", { class: "row row--between" }, h("span", { class: "muted small" }, "Unauthorised responses"), h("span", { class: "mono small" }, fmtInt(metrics.unauthorized))),
              h("div", { class: "row row--between" }, h("span", { class: "muted small" }, "Aborted requests"), h("span", { class: "mono small" }, fmtInt(metrics.aborts))),
              h("div", { class: "row row--between" }, h("span", { class: "muted small" }, "Navigator"), badge({ label: navigator.onLine ? "online" : "offline", tone: navigator.onLine ? "success" : "danger" }))
            ),
            config.isLocal
              ? callout({ tone: "info", title: "Local API", children: "You're pointed at a localhost/mock backend. Demo data is expected." })
              : callout({ tone: "info", title: "Automatic retries", children: "GETs retry 3× with jittered backoff; mutations never retry silently. A 401 raises a session-expired banner instead of logging you out mid-edit." }),
          ],
        })
      ),

      card({
        title: "API host",
        subtitle: "Point the dashboard at a different tunnel without a rebuild.",
        children: h(
          "div",
          { class: "stack-tight" },
          field({
            label: "Base URL",
            help: "Must include /api. Saved in this browser only.",
            children: h("div", { class: "row" }, apiBaseInput, button({ label: "Apply", variant: "primary", onClick: () => applyBase() }), button({ label: "Reset", variant: "ghost", onClick: () => { clearOverrides(); toast.info("Reset to defaults"); setTimeout(() => location.reload(), 400); } })),
          }),
          h("div", { class: "small muted mono" }, `candidates: ${api.getCandidates().join("  ·  ") || "none"}`),
          h("div", { class: "row", style: "margin-top:10px" }, button({ label: "What is this?", variant: "ghost", size: "sm", icon: "help", onClick: () => toast.info("If your bot runs behind Tailscale, ngrok or a Cloudflare tunnel, this is the /api URL the dashboard should call. Diagnostics will show a red banner when it's unreachable.") }))
        ),
      }),

      probeSection(),

      card({
        title: "Recent requests",
        subtitle: "Last 25 requests, newest first. Tokens are never logged.",
        actions: button({ label: "Clear log", variant: "ghost", size: "sm", onClick: () => { api.resetDiagnostics?.(); render(); } }),
        children: dataTable({
          dense: true,
          columns: [
            { key: "at", label: "Time", width: 92, render: (row) => new Date(row.at).toLocaleTimeString() },
            { key: "method", label: "Method", width: 62, render: (row) => h("span", { class: "mono small" }, row.method) },
            { key: "path", label: "Path", render: (row) => h("span", { class: "mono small" }, row.path) },
            { key: "status", label: "Status", width: 70, render: (row) => badge({ label: String(row.status || "ERR"), tone: row.status >= 200 && row.status < 300 ? "success" : row.status === 0 ? "danger" : "warning" }) },
            { key: "ms", label: "Time", width: 74, align: "right", render: (row) => `${row.ms}ms` },
            { key: "outcome", label: "Outcome", width: 90, render: (row) => h("span", { class: "small muted" }, row.outcome) },
          ],
          rows: log.slice(0, 25),
          empty: h("p", { class: "muted small" }, "No requests recorded yet."),
        }),
      }),

      card({
        title: "Client errors",
        subtitle: "Caught exceptions from this tab (also forwarded to the console).",
        children:
          ctx.store?.get().diagnostics?.length
            ? h("div", { class: "stack-tight" }, ctx.store.get().diagnostics.map((entry) => h("div", { class: "row", style: "align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)" }, badge({ label: entry.type, tone: "danger" }), h("span", { class: "small mono", style: "flex:1;overflow-wrap:anywhere" }, entry.message), h("span", { class: "small muted" }, fmtRelative(entry.at)))))
            : h("p", { class: "muted small" }, "No client errors in this session. 🎉"),
      }),
    ];

    clear(content);
    cards.forEach((node) => node && content.append(node));
  }

  function applyBase() {
    setApiBase(apiBaseInput.value);
    toast.success("API host saved. Reloading…");
    saveUiConfig({ lastBaseChange: Date.now() });
    setTimeout(() => location.reload(), 500);
  }

  render();
  mount(page, header, content);
  mount(root, page);

  timer = setInterval(() => {
    if (document.hidden) return;
    render();
  }, 2500);

  return () => {
    clearInterval(timer);
    clear(root);
  };
}
