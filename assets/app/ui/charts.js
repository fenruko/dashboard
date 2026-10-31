/* Hand-rolled SVG charts — no charting dependency, fully themable, keyboard
 * and screen-reader friendly (each chart exposes a text summary). */

import { h, s, cx } from "./dom.js";
import { fmtCompact, fmtInt, fmtPercent } from "../core/format.js";

export const CHART_COLORS = ["#00b8ff", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#22d3ee", "#fb923c", "#60a5fa", "#4ade80", "#facc15"];

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const fraction = value / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

function frame({ width = 720, height = 200, children = [], label = "", className = "" }) {
  return s(
    "svg",
    {
      class: cx("chart-svg", className),
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "none",
      role: "img",
      "aria-label": label,
    },
    children
  );
}

function axisLabels(labels = [], x, width, count = 6) {
  if (!labels.length) return [];
  const step = Math.max(1, Math.ceil(labels.length / count));
  return labels
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => index % step === 0 || index === labels.length - 1)
    .map(({ label, index }) =>
      s("text", { x: x(index), y: 0, class: "chart-tick", "text-anchor": "middle" }, String(label))
    );
}

export function sparkline({ values = [], width = 120, height = 32, color = "#00b8ff", fill = true, label = "Trend" } = {}) {
  const data = (values || []).map(Number).filter(Number.isFinite);
  if (data.length < 2) return s("svg", { class: "chart-svg sparkline", viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true" });
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((value, index) => [index * stepX, height - 2 - ((value - min) / span) * (height - 4)]);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return frame({
    width,
    height,
    label,
    className: "sparkline",
    children: [
      fill &&
        s("defs", null, s("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, s("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.35 }), s("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }))),
      fill && s("path", { d: `${d} L${width},${height} L0,${height} Z`, fill: `url(#${id})`, stroke: "none" }),
      s("path", { d, fill: "none", stroke: color, "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    ],
  });
}

export function lineChart({
  series = [],
  labels = [],
  height = 220,
  yFormat = fmtCompact,
  showLegend = true,
  area = true,
  label = "Line chart",
  className = "",
} = {}) {
  const width = 720;
  const pad = { top: 14, right: 12, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((serie) => (serie.values || []).map(Number)).filter(Number.isFinite);
  const max = niceMax(Math.max(1, ...all));
  const count = Math.max(...series.map((serie) => serie.values?.length || 0), labels.length, 1);
  const x = (index) => pad.left + (count <= 1 ? plotW / 2 : (index / (count - 1)) * plotW);
  const y = (value) => pad.top + plotH - (Math.max(0, value) / max) * plotH;

  const grid = [];
  for (let i = 0; i <= 3; i += 1) {
    const value = (max / 3) * i;
    grid.push(s("line", { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), class: "chart-grid" }));
    grid.push(s("text", { x: pad.left - 8, y: y(value) + 3, class: "chart-tick", "text-anchor": "end" }, yFormat(value)));
  }

  const paths = series.map((serie, index) => {
    const color = serie.color || CHART_COLORS[index % CHART_COLORS.length];
    const values = (serie.values || []).map((v) => Number(v) || 0);
    const points = values.map((value, i) => [x(i), y(value)]);
    const d = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
    const gid = `area-${Math.random().toString(36).slice(2, 8)}`;
    return s(
      "g",
      null,
      area &&
        values.length > 1 &&
        s(
          "defs",
          null,
          s("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, s("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.22 }), s("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }))
        ),
      area && values.length > 1 && s("path", { d: `${d} L${x(values.length - 1)},${pad.top + plotH} L${x(0)},${pad.top + plotH} Z`, fill: `url(#${gid})`, stroke: "none" }),
      values.length > 1 && s("path", { d, fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }),
      values.map((value, i) => s("circle", { cx: x(i), cy: y(value), r: 2.4, fill: color, class: "chart-dot" }, s("title", null, `${labels[i] || `#${i + 1}`}: ${fmtInt(value)}`)))
    );
  });

  const xLabels = axisLabels(labels, x, plotW, 6).map((node) => {
    const currentY = node.getAttribute("y");
    node.setAttribute("y", String(pad.top + plotH + 18 + Number(currentY || 0)));
    return node;
  });

  return s(
    "div",
    { class: cx("chart", className) },
    showLegend &&
      series.length > 1 &&
      s(
        "div",
        { class: "chart-legend" },
        series.map((serie, index) =>
          s(
            "span",
            { class: "legend-item" },
            h("span", { class: "legend-swatch", style: `background:${serie.color || CHART_COLORS[index % CHART_COLORS.length]}` }),
            serie.label
          )
        )
      ),
    frame({ width, height, label: `${label}: ${series.map((serie) => `${serie.label} ${fmtInt(serie.values?.reduce?.((a, b) => a + (Number(b) || 0), 0) || 0)} total`).join(", ")}`, children: [s("g", null, grid), ...paths, s("g", null, xLabels)] })
  );
}

export function barChart({
  labels = [],
  series = [],
  height = 200,
  stacked = false,
  yFormat = fmtCompact,
  label = "Bar chart",
  showLegend = true,
  horizontal = false,
} = {}) {
  const width = 720;
  const pad = { top: 12, right: 12, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const totals = labels.map((_, index) => series.reduce((sum, serie) => sum + (Number(serie.values?.[index]) || 0), 0));
  const allValues = series.flatMap((serie) => (serie.values || []).map(Number).filter(Number.isFinite));
  const max = niceMax(Math.max(1, stacked ? Math.max(0, ...totals) : Math.max(0, ...allValues)));
  const groupW = plotW / Math.max(1, labels.length);
  const barW = Math.max(2, stacked ? groupW * 0.62 : (groupW * 0.72) / Math.max(1, series.length));

  const grid = [];
  for (let i = 0; i <= 3; i += 1) {
    const value = (max / 3) * i;
    const y = pad.top + plotH - (value / max) * plotH;
    grid.push(s("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: "chart-grid" }));
    grid.push(s("text", { x: pad.left - 8, y: y + 3, class: "chart-tick", "text-anchor": "end" }, yFormat(value)));
  }

  const bars = [];
  labels.forEach((labelText, index) => {
    let stackY = pad.top + plotH;
    series.forEach((serie, serieIndex) => {
      const value = Number(serie.values?.[index]) || 0;
      if (!value) return;
      const hgt = (value / max) * plotH;
      const x = stacked
        ? pad.left + index * groupW + (groupW - barW) / 2
        : pad.left + index * groupW + groupW * 0.14 + serieIndex * barW;
      const yPos = stacked ? stackY - hgt : pad.top + plotH - hgt;
      stackY -= hgt;
      bars.push(
        s("rect", {
          x: x.toFixed(2),
          y: yPos.toFixed(2),
          width: barW.toFixed(2),
          height: hgt.toFixed(2),
          rx: 2,
          fill: serie.color || CHART_COLORS[serieIndex % CHART_COLORS.length],
          class: "chart-bar",
        }, s("title", null, `${labelText} · ${serie.label}: ${fmtInt(value)}`))
      );
    });
  });

  const xLabels = [];
  const step = Math.max(1, Math.ceil(labels.length / 8));
  labels.forEach((labelText, index) => {
    if (index % step !== 0 && index !== labels.length - 1) return;
    xLabels.push(s("text", { x: pad.left + index * groupW + groupW / 2, y: height - 8, class: "chart-tick", "text-anchor": "middle" }, String(labelText).slice(0, 8)));
  });

  return s(
    "div",
    { class: cx("chart", horizontal && "chart--horizontal") },
    showLegend &&
      series.length > 1 &&
      s(
        "div",
        { class: "chart-legend" },
        series.map((serie, index) =>
          h("span", { class: "legend-item" }, h("span", { class: "legend-swatch", style: `background:${serie.color || CHART_COLORS[index % CHART_COLORS.length]}` }), serie.label)
        )
      ),
    frame({ width, height, label, children: [s("g", null, grid), s("g", null, bars), s("g", null, xLabels)] })
  );
}

export function donut({ segments = [], size = 168, thickness = 18, centerLabel = "", centerValue = "", label = "Distribution" } = {}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const rings = segments.map((segment, index) => {
    const value = Math.max(0, Number(segment.value) || 0);
    const fraction = total ? value / total : 0;
    const dash = circumference * fraction;
    const ring = s("circle", {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: "none",
      stroke: segment.color || CHART_COLORS[index % CHART_COLORS.length],
      "stroke-width": thickness,
      "stroke-dasharray": `${dash} ${circumference - dash}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      "stroke-linecap": "butt",
    }, s("title", null, `${segment.label}: ${fmtInt(value)} (${fmtPercent(fraction * 100)})`));
    offset += dash;
    return ring;
  });

  return s(
    "div",
    { class: "donut-wrap" },
    s(
      "svg",
      { viewBox: `0 0 ${size} ${size}`, class: "chart-svg donut", role: "img", "aria-label": `${label}: ${segments.map((seg) => `${seg.label} ${fmtInt(seg.value)}`).join(", ")}` },
      s("circle", { cx: size / 2, cy: size / 2, r: radius, fill: "none", stroke: "rgba(255,255,255,0.06)", "stroke-width": thickness }),
      rings,
      centerValue &&
        s("text", { x: "50%", y: "47%", class: "donut-value", "text-anchor": "middle", "dominant-baseline": "middle" }, centerValue),
      centerLabel && s("text", { x: "50%", y: "59%", class: "donut-label", "text-anchor": "middle", "dominant-baseline": "middle" }, centerLabel)
    ),
    s(
      "ul",
      { class: "donut-legend" },
      segments.map((segment, index) =>
        s(
          "li",
          null,
          h("span", { class: "legend-swatch", style: `background:${segment.color || CHART_COLORS[index % CHART_COLORS.length]}` }),
          h("span", { class: "donut-label-text" }, segment.label),
          h("span", { class: "donut-value-text" }, fmtInt(segment.value))
        )
      )
    )
  );
}

export function horizontalBars({ items = [], label = "Ranking", valueFormat = fmtInt, color = "#00b8ff" } = {}) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return s(
    "ul",
    { class: "hbars", "aria-label": label },
    items.map((item, index) =>
      s(
        "li",
        { class: "hbar" },
        h("span", { class: "hbar-rank" }, String(index + 1).padStart(2, "0")),
        s(
          "span",
          { class: "hbar-main" },
          h("span", { class: "hbar-label" }, item.label),
          h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: `width:${((Number(item.value) || 0) / max) * 100}%;background:${item.color || color}` }))
        ),
        h("span", { class: "hbar-value" }, valueFormat(item.value))
      )
    )
  );
}

export function heatmap({ values = [], label = "Activity heatmap", color = "#34d399" } = {}) {
  const data = values.map((entry) => (typeof entry === "object" ? entry : { count: entry, label: "" }));
  const max = Math.max(1, ...data.map((entry) => Number(entry.count) || 0));
  return s(
    "div",
    { class: "heatmap", role: "img", "aria-label": `${label}: ${data.length} periods, peak ${max}` },
    s(
      "div",
      { class: "heatmap-grid" },
      data.map((entry) =>
        h("span", {
          class: "heat-cell",
          style: `--heat:${Math.max(0.08, (Number(entry.count) || 0) / max)};--heat-color:${color}`,
          title: `${entry.label || ""}${entry.count != null ? `: ${fmtInt(entry.count)}` : ""}`,
        })
      )
    )
  );
}

export function chartSummary(text) {
  return h("p", { class: "chart-summary" }, text);
}
