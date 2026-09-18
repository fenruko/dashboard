import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "../components/ui/card";
import { AreaChart, Donut } from "../components/charts";
import { api, mockSeries } from "../lib/api";

export default function Verification() {
  const { guildId } = useParams();
  const [flags, setFlags] = useState<any[]>([]);
  const [prints, setPrints] = useState<any[]>([]);

  useEffect(() => {
    if (!guildId) return;
    api.verificationFlags(guildId).then(d => setFlags(d.flags || d || [])).catch(() => setFlags(Array.from({ length: 8 }).map((_, i) => ({ reason: ["duplicate","vpn","alt"][i%3], username: `User${i+1}`, user_id: `${1000+i}` }))));
    api.verificationPrints(guildId).then(d => setPrints(d.prints || d || d.fingerprints || [])).catch(() => setPrints(Array.from({ length: 6 }).map((_, i) => ({ fingerprint: `fp_${Math.random().toString(36).slice(2,14)}`, count: Math.floor(Math.random()*5+2), users: [`User${i*2+1}`, `User${i*2+2}`] }))));
  }, [guildId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Verification</h1><p className="text-[13px] text-white/40 mt-1">Configure via /setup_verification in Discord. Security analytics below.</p></div><Badge tone="success">94% success</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Success Rate</div><div className="flex items-center gap-4 mt-3"><Donut value={94} total={100} color="#00ffa3" size={80} /><div><div className="text-[20px] font-semibold text-white">94%</div><div className="text-[12px] text-white/40">Last 7d</div></div></div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Flagged</div><div className="text-[22px] font-semibold text-white mt-2">{flags.length}</div><div className="text-[12px] text-amber-300 mt-1">Needs review</div><div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: "23%" }} /></div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Duplicates</div><div className="text-[22px] font-semibold text-white mt-2">{prints.length}</div><div className="text-[12px] text-white/40 mt-1">Fingerprint collisions</div></Card>
      </div>

      <Card><CardHeader><CardTitle>Verification Trend • 14d</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(14, 80, 15)} color="#00ffa3" height={180} /></CardContent></Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Flagged Verifications</CardTitle><Badge tone="warning">{flags.length}</Badge></CardHeader>
          <CardContent className="divide-y divide-white/[0.05] max-h-[420px] overflow-y-auto">
            {flags.map((f, i) => (
              <div key={i} className="py-3 flex items-center gap-3"><Badge tone={f.reason==="duplicate"?"danger":f.reason==="vpn"?"warning":"info"}>{f.reason}</Badge><span className="flex-1 text-[13px] text-white/70 truncate">{f.username || f.user_id}</span><span className="text-[11px] text-white/30 font-mono">{f.user_id?.slice(0,8)}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Duplicate Fingerprints</CardTitle></CardHeader>
          <CardContent className="divide-y divide-white/[0.05] max-h-[420px] overflow-y-auto">
            {prints.map((p, i) => (
              <div key={i} className="py-3 flex items-center gap-3"><span className="text-[12px] font-mono text-white/40">{p.fingerprint?.slice(0,12)}</span><span className="flex-1 text-[13px] text-white/60 truncate">{p.users?.join(", ") || `${p.count} users`}</span><Badge>{p.count || 2} accounts</Badge></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
