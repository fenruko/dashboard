import { Card, CardHeader, CardTitle, CardContent, Badge } from "../components/ui/card";
import { AreaChart, BarChart, Heatmap, RadialBars } from "../components/charts";
import { mockSeries } from "../lib/api";

export default function Analytics() {
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.random()));
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Analytics</h1><p className="text-[13px] text-white/40 mt-1">Deep telemetry across every subsystem</p></div><Badge tone="info">Realtime</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Messages • 24h</CardTitle></CardHeader><CardContent><BarChart data={mockSeries(24, 1800, 600)} color="#00b8ff" height={180} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Voice • 24h</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(24, 120, 40)} color="#7c3aed" height={180} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Commands • 24h</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(24, 80, 30)} color="#00ffa3" height={180} /></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3"><CardHeader><CardTitle>Activity Heatmap</CardTitle></CardHeader><CardContent><Heatmap data={heat} /><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Peak Hour</div><div className="text-[13px] text-white font-medium">19:00 • 3.4k msgs</div></div><div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Quiet Hour</div><div className="text-[13px] text-white font-medium">04:00 • 42 msgs</div></div><div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Avg</div><div className="text-[13px] text-white font-medium">1.2k / hour</div></div></div></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Top Channels</CardTitle></CardHeader><CardContent><RadialBars items={[{ label: "#general", value: 3421, color: "#00b8ff" }, { label: "#music", value: 2103, color: "#7c3aed" }, { label: "#memes", value: 1823, color: "#00ffa3" }, { label: "#gaming", value: 1234, color: "#f59e0b" }, { label: "#off-topic", value: 892, color: "#ef4444" }]} /></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Leveling Distribution</CardTitle></CardHeader><CardContent><BarChart data={[{x:0,y:12},{x:1,y:19},{x:2,y:30},{x:3,y:45},{x:4,y:67},{x:5,y:89},{x:6,y:54},{x:7,y:32}]} color="#00ffa3" height={180} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Invite Sources</CardTitle></CardHeader><CardContent><RadialBars items={[{ label: "Direct", value: 4321, color: "#00b8ff" }, { label: "Vanity", value: 2100, color: "#7c3aed" }, { label: "Widget", value: 892, color: "#00ffa3" }, { label: "OAuth", value: 543, color: "#f59e0b" }]} /></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Economy</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(30, 50000, 15000)} color="#f59e0b" height={160} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Verification</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(14, 80, 15)} color="#00ffa3" height={160} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Music Hours</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(14, 60, 20)} color="#7c3aed" height={160} /></CardContent></Card>
      </div>
    </div>
  );
}
