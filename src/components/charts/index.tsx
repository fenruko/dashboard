import React, { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

type Point = { x: number; y: number; label?: string };

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 200 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

// Optimized Area Chart with gradient and motion
export function AreaChart({ data, color = "#00b8ff", height = 160, showGrid = true, animated = true }: { data: Point[]; color?: string; height?: number; showGrid?: boolean; animated?: boolean }) {
  const { ref, w } = useContainerSize();
  const h = height;
  const padding = { t: 10, r: 10, b: 20, l: 10 };

  const { path, areaPath, max, min } = useMemo(() => {
    if (!data.length) return { path: "", areaPath: "", max: 0, min: 0 };
    const vals = data.map(d => d.y);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const innerW = w - padding.l - padding.r;
    const innerH = h - padding.t - padding.b;
    const step = innerW / Math.max(1, data.length - 1);
    const points = data.map((d, i) => ({
      x: padding.l + i * step,
      y: padding.t + innerH - ((d.y - min) / range) * innerH,
    }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${path} L ${padding.l + innerW} ${padding.t + innerH} L ${padding.l} ${padding.t + innerH} Z`;
    return { path, areaPath, max, min, points };
  }, [data, w, h]);

  return (
    <div ref={ref} style={{ height: h }} className="w-full relative">
      <svg width="100%" height={h} className="overflow-visible">
        <defs>
          <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id={`glow-${color}`}><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {showGrid && (
          <g opacity={0.06}>
            {[0,1,2,3].map(i => <line key={i} x1={10} x2={w-10} y1={10 + (h-30)/3*i} y2={10 + (h-30)/3*i} stroke="white" strokeWidth={1} strokeDasharray="4 8" />)}
          </g>
        )}
        <motion.path d={areaPath} fill={`url(#g-${color})`} initial={animated ? { opacity: 0 } : undefined} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${color})`} initial={animated ? { pathLength: 0 } : undefined} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.22,1,0.36,1] }} />
      </svg>
    </div>
  );
}

export function BarChart({ data, color = "#7c3aed", height = 160 }: { data: Point[]; color?: string; height?: number }) {
  const { ref, w } = useContainerSize();
  const h = height;
  const vals = data.map(d => d.y);
  const max = Math.max(...vals, 1);
  const barW = Math.max(4, (w - 40) / data.length - 6);

  return (
    <div ref={ref} style={{ height: h }} className="w-full relative">
      <div className="absolute inset-0 flex items-end gap-[6px] px-3 pb-4">
        {data.map((d, i) => (
          <motion.div
            key={i}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${(d.y / max) * 100}%`, opacity: 1 }}
            transition={{ delay: i * 0.02, duration: 0.5, ease: [0.22,1,0.36,1] }}
            className="flex-1 rounded-[6px] relative group"
            style={{ background: `linear-gradient(to top, ${color}99, ${color})`, minWidth: barW, maxWidth: 28 }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0e0f14] border border-white/10 px-2 py-1 rounded-lg text-[11px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {d.y.toFixed(0)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function Donut({ value, total, color = "#00b8ff", size = 120, label }: { value: number; total: number; color?: string; size?: number; label?: string }) {
  const pct = Math.min(1, value / total);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={8} fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - pct) }} transition={{ duration: 1, ease: [0.22,1,0.36,1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[20px] font-semibold text-white">{Math.round(pct*100)}%</div>
        {label && <div className="text-[11px] text-white/40 uppercase tracking-wide">{label}</div>}
      </div>
    </div>
  );
}

export function Sparkline({ data, color = "#00ffa3", w = 80, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  );
}

export function Heatmap({ data }: { data: number[][] }) {
  // data: 7x24
  return (
    <div className="grid grid-cols-24 gap-[3px]">
      {data.flat().map((v, i) => (
        <div key={i} className="aspect-square rounded-[3px] transition-all hover:scale-110" style={{ background: `rgba(0,184,255,${0.06 + v * 0.9})`, border: v > 0.7 ? '1px solid rgba(0,184,255,0.3)' : '1px solid transparent' }} />
      ))}
    </div>
  );
}

export function RadialBars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="space-y-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-white/60">{it.label}</span>
            <span className="text-white/90 font-mono">{it.value}</span>
          </div>
          <div className="h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ delay: idx * 0.08, duration: 0.8, ease: [0.22,1,0.36,1] }} className="h-full rounded-full" style={{ background: it.color, boxShadow: `0 0 12px ${it.color}66` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
