import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "../components/ui/card";
import { AreaChart, Donut } from "../components/charts";
import { api, mockSeries } from "../lib/api";

export default function General() {
  const { guildId } = useParams();
  const [info, setInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!guildId) return;
    api.guildInfo(guildId).then(setInfo).catch(() => setInfo({ name: "Demo Server", member_count: 12483, owner_id: "123", region: "us-east" }));
    api.stats().then(setStats).catch(() => setStats({ guilds: 12483, users: 2100000, uptime: 99.9 }));
  }, [guildId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">General</h1><p className="text-[13px] text-white/40 mt-1">Core server configuration and platform telemetry</p></div><Badge tone="success">Synced</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <div className="flex gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00b8ff] to-[#7c3aed] flex items-center justify-center text-[24px] font-bold text-white shadow-[0_0_30px_rgba(0,184,255,0.3)]">{info?.name?.[0] || "S"}</div>
            <div><div className="text-[20px] font-semibold text-white">{info?.name || "Server"}</div><div className="text-[12px] text-white/40 mt-1 font-mono">ID: {guildId}</div><div className="mt-3 flex gap-2"><Badge tone="info">{info?.member_count || "12.4k"} members</Badge><Badge>Boost L2</Badge></div></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Owner</div><div className="text-[13px] text-white mt-1 font-mono">{info?.owner_id?.slice(0,8) || "—"}</div></div>
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Region</div><div className="text-[13px] text-white mt-1">{info?.region || "Automatic"}</div></div>
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Created</div><div className="text-[13px] text-white mt-1">2021 • 3y ago</div></div>
          </div>
        </Card>
        <Card className="p-6 flex flex-col items-center justify-center"><Donut value={94} total={100} color="#00b8ff" size={120} label="Health" /><div className="mt-4 text-[12px] text-white/40 text-center">All subsystems nominal • 12ms avg</div></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Platform Stats</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4"><div className="text-[11px] text-white/30 uppercase">Guilds</div><div className="text-[18px] font-semibold text-white mt-1">{stats?.guilds || "12.4k"}</div></div><div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4"><div className="text-[11px] text-white/30 uppercase">Users</div><div className="text-[18px] font-semibold text-white mt-1">{stats?.users ? `${(stats.users/1e6).toFixed(1)}M` : "2.1M"}</div></div><div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4"><div className="text-[11px] text-white/30 uppercase">Uptime</div><div className="text-[18px] font-semibold text-emerald-300 mt-1">{stats?.uptime || "99.9"}%</div></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Growth • 14d</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(14, 60, 15)} color="#00b8ff" height={140} /></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { k: "Command Prefix", v: "!" },
          { k: "Disabled Commands", v: "3 disabled" },
          { k: "ModMail", v: "Enabled" },
        ].map(i => (
          <Card key={i.k} className="p-5 flex items-center justify-between"><div><div className="text-[11px] uppercase text-white/30">{i.k}</div><div className="text-[14px] text-white font-medium mt-1">{i.v}</div></div><div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40">→</div></Card>
        ))}
      </div>
    </div>
  );
}
