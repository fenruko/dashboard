/* Deep analytics: 14-day server growth, messages, voice and exportable data. */

import { h, mount, clear } from "../ui/dom.js";
import {
  badge,
  button,
  card,
  checkboxControl,
  dataTable,
  errorState,
  grid,
  pageHeader,
  skeleton,
  statCard,
} from "../ui/components.js";
import { createQuery } from "../core/store.js";
import { lineChart, barChart } from "../ui/charts.js";
import { downloadText, fmtCompact, fmtInt, fmtPercent, toCsv } from "../core/format.js";
import { toast } from "../ui/components.js";

export async function mountPage(ctx) {
  const { root, endpoints, guildId, router, prefs } = ctx;
  const page = h("div", { class: "page" });
  const body = h("div", { class: "stack" });
  const visible = { joins: true, leaves: true, messages: true, voice: true };

  const analyticsQ = createQuery(() => endpoints.analytics(guildId), {
    autoRefresh: prefs.get().autoRefresh ? prefs.get().refreshInterval : 0,
    cacheTtl: 15_000,
  });
  const infoQ = createQuery(() => endpoints.guildInfo(guildId), { cacheTtl: 30_000 });

  const headerHost = h("div");
  body.append(headerHost);

  function renderHeader() {
    clear(headerHost);
    const info = infoQ.get().data;
    const analytics = analyticsQ.get().data;
    headerHost.append(
      pageHeader({
        eyebrow: "Insights",
        title: `${info?.name || "Server"} analytics`,
        description: "Fourteen days of joins, leaves, messages and voice activity straight from the bot's database — the same numbers its own stats commands use.",
        meta: analytics
          ? [
              badge({ label: `${fmtInt(analytics.member_count)} members`, tone: "accent" }),
              badge({ label: `${fmtInt(analytics.online_count)} online`, tone: "muted" }),
            ]
          : null,
        actions: [
          button({
            label: "Export CSV",
            icon: "download",
            disabled: !analytics,
            onClick: () => {
              if (!analytics) return;
              const rows = (analytics.dates || []).map((date, index) => ({
                date,
                joins: analytics.joins?.[index] ?? 0,
                leaves: analytics.leaves?.[index] ?? 0,
                messages: analytics.messages?.[index] ?? 0,
                voice_minutes: analytics.voice?.[index] ?? 0,
              }));
              downloadText(`rift-analytics-${guildId}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
              toast.success("Analytics exported");
            },
          }),
          button({ label: "Refresh", icon: "refresh", onClick: () => { analyticsQ.refresh(); infoQ.refresh(); } }),
        ],
      })
    );
  }
  infoQ.subscribe(renderHeader);
  analyticsQ.subscribe(renderHeader);
  renderHeader();

  const statsHost = h("div", { class: "stats-grid" });
  const chartHost = h("div");
  const tableHost = h("div");
  body.append(statsHost, chartHost, tableHost);

  function totals(data) {
    const sum = (rows) => (rows || []).reduce((total, value) => total + (Number(value) || 0), 0);
    return {
      joins: sum(data?.joins),
      leaves: sum(data?.leaves),
      messages: sum(data?.messages),
      voice: sum(data?.voice),
    };
  }

  function renderStats() {
    const data = analyticsQ.get().data;
    clear(statsHost);
    if (!data) {
      for (let i = 0; i < 4; i += 1) statsHost.append(h("div", { class: "stat" }, skeleton({ h: 40 })));
      return;
    }
    const t = totals(data);
    const net = t.joins - t.leaves;
    const peakMessages = Math.max(0, ...(data.messages || []));
    const peakDay = data.dates?.[(data.messages || []).indexOf(peakMessages)] || "—";
    statsHost.append(
      statCard({ label: "Net growth · 14d", value: `${net >= 0 ? "+" : ""}${fmtInt(net)}`, hint: `${fmtInt(t.joins)} joined · ${fmtInt(t.leaves)} left`, icon: net >= 0 ? "trending-up" : "trending-down", tone: net >= 0 ? "success" : "danger" }),
      statCard({ label: "Messages · 14d", value: fmtCompact(t.messages), hint: `peak ${fmtInt(peakMessages)} on ${peakDay}`, icon: "activity", tone: "accent" }),
      statCard({ label: "Voice minutes · 14d", value: fmtCompact(t.voice), hint: t.messages ? `${fmtPercent((t.voice / Math.max(1, t.messages)) * 100, 0)} of message volume` : "", icon: "mic", tone: "violet" }),
      statCard({ label: "Online ratio", value: data.member_count ? fmtPercent((data.online_count / data.member_count) * 100) : "—", hint: `${fmtInt(data.online_count)} of ${fmtInt(data.member_count)} members`, icon: "wifi", tone: "warning" })
    );
  }

  function renderChart() {
    clear(chartHost);
    const data = analyticsQ.get().data;
    if (!data) {
      if (analyticsQ.get().status === "error") chartHost.append(card({ children: errorState({ error: analyticsQ.get().error, onRetry: () => analyticsQ.refresh() }) }));
      else chartHost.append(card({ children: skeleton({ h: 240 }) }));
      return;
    }
    const labels = (data.dates || []).map((date) => date.slice(5));
    const series = [
      visible.joins && { label: "Joins", values: data.joins || [], color: "#34d399" },
      visible.leaves && { label: "Leaves", values: data.leaves || [], color: "#f87171" },
      visible.messages && { label: "Messages", values: data.messages || [], color: "#00b8ff" },
      visible.voice && { label: "Voice minutes", values: data.voice || [], color: "#a78bfa" },
    ].filter(Boolean);

    chartHost.append(
      card({
        title: "Activity",
        subtitle: `Toggling series only changes the view — the data is always the full 14 days.`,
        actions: h(
          "div",
          { class: "row", style: "gap:14px" },
          ["joins", "leaves", "messages", "voice"].map((key) =>
            checkboxControl({
              label: key[0].toUpperCase() + key.slice(1),
              checked: visible[key],
              onChange: (value) => {
                visible[key] = value;
                renderChart();
              },
            })
          )
        ),
        children: series.length
          ? lineChart({ labels, series, height: 280, label: "Server activity over 14 days" })
          : h("p", { class: "muted" }, "Select at least one series."),
      }),
      h("div", { style: "height:14px" }),
      grid(
        2,
        card({ title: "Messages per day", children: barChart({ labels, series: [{ label: "Messages", values: data.messages || [], color: "#00b8ff" }], height: 190, showLegend: false, label: "Messages per day" }) }),
        card({ title: "Joins vs leaves", children: barChart({ labels, series: [{ label: "Joins", values: data.joins || [], color: "#34d399" }, { label: "Leaves", values: data.leaves || [], color: "#f87171" }], height: 190, label: "Joins and leaves per day" }) })
      )
    );
  }

  function renderTable() {
    clear(tableHost);
    const data = analyticsQ.get().data;
    const rows = (data?.dates || []).map((date, index) => ({
      date,
      joins: data.joins?.[index] ?? 0,
      leaves: data.leaves?.[index] ?? 0,
      messages: data.messages?.[index] ?? 0,
      voice: data.voice?.[index] ?? 0,
      net: (data.joins?.[index] ?? 0) - (data.leaves?.[index] ?? 0),
    }));
    tableHost.append(
      card({
        title: "Daily breakdown",
        children: dataTable({
          rows,
          rowKey: (row) => row.date,
          columns: [
            { key: "date", label: "Date" },
            { key: "joins", label: "Joins", align: "right", render: (row) => fmtInt(row.joins) },
            { key: "leaves", label: "Leaves", align: "right", render: (row) => fmtInt(row.leaves) },
            { key: "net", label: "Net", align: "right", render: (row) => h("span", { style: row.net > 0 ? "color:var(--success)" : row.net < 0 ? "color:var(--danger)" : "" }, `${row.net > 0 ? "+" : ""}${fmtInt(row.net)}`) },
            { key: "messages", label: "Messages", align: "right", render: (row) => fmtCompact(row.messages) },
            { key: "voice", label: "Voice min", align: "right", render: (row) => fmtCompact(row.voice) },
          ],
          empty: h("p", { class: "muted small" }, "No daily rows yet."),
        }),
      })
    );
  }

  analyticsQ.subscribe(() => {
    renderStats();
    renderChart();
    renderTable();
  });
  renderStats();
  renderChart();
  renderTable();
  analyticsQ.start();
  infoQ.start();

  mount(page, body);
  mount(root, page);
  return () => {
    analyticsQ.dispose();
    infoQ.dispose();
    clear(root);
  };
}
