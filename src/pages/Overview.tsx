import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, Badge, Stat } from "../components/ui/card";
import { AreaChart, BarChart, Donut, Sparkline, Heatmap, RadialBars } from "../components/charts";
import { api, mockAnalytics, mockSeries } from "../lib/api";

export default function Overview() {
  const { guildId } = useParams();
  const [data, setData] = useState<any>(null);
  const [guildInfo, setGuildInfo] = useState<any>(null);

  useEffect(() => {
    if (!guildId) return;
    api.analytics(guildId).then(setData).catch(() => setData(mockAnalytics()));
    api.guildInfo(guildId).then(setGuildInfo).catch(() => setGuildInfo({ name: "Demo Server", member_count: 12483 }));
  }, [guildId]);

  const analytics = data || mockAnalytics();
  const series24 = mockSeries(24, 120, 40);
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.random()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[28px] font-bold tracking-tight">Overview</motion.h1>
          <p className="text-[13px] text-white/40 mt-1">Realtime pulse for {guildInfo?.name || "your server"} • Last sync 2s ago • 12ms latency</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="success">● Live</Badge>
          <Badge tone="info">{guildId?.slice(0, 8)}…</Badge>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: "12,483", sub: "+127 this week", trend: "up", spark: [20, 40, 30, 60, 50, 80, 70, 90] },
          { label: "Messages Today", value: "48,291", sub: "2.1k / hour", trend: "up", spark: [40, 30, 60, 45, 70, 55, 80, 65] },
          { label: "Active Voice", value: "342", sub: "Peak 412", trend: "down", spark: [60, 70, 50, 80, 60, 40, 55, 45] },
          { label: "Commands", value: "8,923", sub: "94% success", trend: "up", spark: [20, 30, 40, 35, 50, 60, 55, 70] },
        ].map((k, i) => (
          <Card key={i} className="p-5">
            <div className="flex justify-between items-start">
              <Stat label={k.label} value={k.value} sub={k.sub} trend={k.trend as any} />
              <Sparkline data={k.spark} color={i % 2 === 0 ? "#00b8ff" : "#00ffa3"} />
            </div>
          </Card>
        ))}
      </div>

      {/* Main charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Member Growth • 30d</CardTitle>
              <div className="text-[12px] text-white/40 mt-1">Acquisition, churn and net growth with forecast</div>
            </div>
            <Badge tone="info">+8.2%</Badge>
          </CardHeader>
          <CardContent>
            <AreaChart data={analytics.members?.growth || mockSeries(30, 12000, 300)} color="#00b8ff" height={220} />
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.06]">
              <div><div className="text-[11px] text-white/30 uppercase">New</div><div className="text-[14px] text-white font-medium">+482</div></div>
              <div><div className="text-[11px] text-white/30 uppercase">Left</div><div className="text-[14px] text-white font-medium">-127</div></div>
              <div><div className="text-[11px] text-white/30 uppercase">Net</div><div className="text-[14px] text-emerald-300 font-medium">+355</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Command Success</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center">
            <Donut value={8923} total={9492} color="#00ffa3" size={140} label="Success" />
            <div className="w-full mt-6 space-y-3">
              <RadialBars items={[
                { label: "play", value: 3421, color: "#00b8ff" },
                { label: "ban", value: 123, color: "#7c3aed" },
                { label: "level", value: 892, color: "#00ffa3" },
                { label: "help", value: 543, color: "#f59e0b" },
              ]} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Message Activity • 24h</CardTitle></CardHeader>
          <CardContent><BarChart data={analytics.messages?.series || series24} color="#7c3aed" height={180} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Moderation • 30d</CardTitle></CardHeader>
          <CardContent><AreaChart data={analytics.moderation?.series || mockSeries(30, 15, 8)} color="#ef4444" height={180} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Economy Volume</CardTitle></CardHeader>
          <CardContent><AreaChart data={analytics.economy?.series || mockSeries(30, 50000, 15000)} color="#f59e0b" height={180} /></CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Activity Heatmap • Hour vs Day</CardTitle></CardHeader>
          <CardContent>
            <Heatmap data={heat} />
            <div className="flex justify-between text-[10px] text-white/30 mt-2"><span>00:00</span><span>12:00</span><span>23:00</span></div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { k: "API Latency", v: 12, max: 100, color: "#00b8ff" },
              { k: "Gateway", v: 94, max: 100, color: "#00ffa3" },
              { k: "Voice Nodes", v: 88, max: 100, color: "#7c3aed" },
              { k: "DB Cache", v: 76, max: 100, color: "#f59e0b" },
            ].map((r, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-[12px]"><span className="text-white/50">{r.k}</span><span className="text-white font-mono">{r.v}%</span></div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${r.v}%` }} transition={{ delay: i * 0.1, duration: 0.8 }} className="h-full rounded-full" style={{ background: r.color }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Ban User", desc: "Moderate instantly" },
              { label: "Announce", desc: "Broadcast message" },
              { label: "Play Music", desc: "Queue track" },
              { label: "Verify Sweep", desc: "Run checks" },
            ].map(a => (
              <button key={a.label} className="text-left rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 hover:bg-white/[0.06] transition group">
                <div className="text-[13px] font-medium text-white group-hover:text-white">{a.label}</div>
                <div className="text-[11px] text-white/40 mt-1">{a.desc}</div>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Mod Log</CardTitle><Badge>Live</Badge></CardHeader>
          <CardContent className="space-y-2 max-h-[220px] overflow-y-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px]">M</div>
                <div className="flex-1 min-w-0"><div className="text-[12px] text-white/80 truncate">User banned • {Math.floor(Math.random()*1000)} • Spam</div><div className="text-[11px] text-white/30">{i*3+2}m ago</div></div>
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">ban</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
