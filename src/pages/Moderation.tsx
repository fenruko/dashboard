import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Field } from "../components/ui/card";
import { AreaChart, BarChart } from "../components/charts";
import { api, mockSeries } from "../lib/api";
import { motion } from "framer-motion";

export default function Moderation() {
  const { guildId } = useParams();
  const [logs, setLogs] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [action, setAction] = useState({ user_id: "", type: "ban", reason: "" });

  useEffect(() => {
    if (!guildId) return;
    api.modLogs(guildId, { limit: 20 }).then(d => setLogs(d.logs || d || [])).catch(() => setLogs(Array.from({ length: 12 }).map((_, i) => ({ id: i, action: ["ban","kick","timeout"][i%3], user: `User#${1000+i}`, reason: "Spam", time: `${i*2}m ago` }))));
    api.modBans(guildId).then(d => setBans(d.bans || d || [])).catch(() => setBans(Array.from({ length: 6 }).map((_, i) => ({ id: i, username: `BadUser${i}`, reason: "Raiding", date: "2d ago" }))));
  }, [guildId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="text-[26px] font-bold tracking-tight">Moderation</h1><p className="text-[13px] text-white/40 mt-1">Automod, actions, bans and realtime analytics</p></div>
        <Badge tone="info">AutoMod • Active</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Mod Actions • 30d</CardTitle></CardHeader>
          <CardContent><AreaChart data={mockSeries(30, 20, 12)} color="#ef4444" height={200} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Action Split</CardTitle></CardHeader>
          <CardContent><BarChart data={[{x:0,y:42},{x:1,y:23},{x:2,y:18},{x:3,y:12},{x:4,y:8}]} color="#ef4444" height={200} /></CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Logs</CardTitle><Badge>Live tail</Badge></CardHeader>
          <CardContent className="space-y-1 max-h-[420px] overflow-y-auto">
            {logs.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i*0.02 }} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${l.action==="ban"?"bg-red-500/15 text-red-300":l.action==="kick"?"bg-amber-500/15 text-amber-300":"bg-white/10 text-white/60"}`}>{l.action?.[0]?.toUpperCase() || "M"}</div>
                <div className="flex-1 min-w-0"><div className="text-[13px] text-white/80">{l.user || l.username} • {l.action}</div><div className="text-[11px] text-white/30 truncate">{l.reason}</div></div>
                <div className="text-[11px] text-white/30">{l.time || "now"}</div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Quick Action</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="User ID"><Input value={action.user_id} onChange={e => setAction({ ...action, user_id: e.target.value })} placeholder="123456789..." /></Field>
              <Field label="Type">
                <select value={action.type} onChange={e => setAction({ ...action, type: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-[#0e0f14] border border-white/[0.06] text-[13px]">
                  <option value="ban">Ban</option><option value="kick">Kick</option><option value="timeout">Timeout</option><option value="warn">Warn</option>
                </select>
              </Field>
              <Field label="Reason"><Input value={action.reason} onChange={e => setAction({ ...action, reason: e.target.value })} placeholder="Reason…" /></Field>
              <Button className="w-full" onClick={() => {
                if (!guildId) return;
                api.modAction({ guild_id: guildId, ...action }).catch(()=>{});
              }}>Execute</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Banned Users</CardTitle><Badge tone="danger">{bans.length}</Badge></CardHeader>
            <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
              {bans.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div><div className="text-[13px] text-white/80">{b.username || b.user}</div><div className="text-[11px] text-white/30">{b.reason}</div></div>
                  <div className="text-[11px] text-white/30">{b.date}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: "AutoMod", desc: "Spam, links, invites", enabled: true },
          { title: "Anti-Nuke", desc: "Mass ban protection", enabled: true },
          { title: "Anti-Raid", desc: "Join flood detection", enabled: false },
        ].map(s => (
          <Card key={s.title} className="p-5 flex items-center justify-between">
            <div><div className="text-[13px] font-medium text-white">{s.title}</div><div className="text-[11px] text-white/40 mt-1">{s.desc}</div></div>
            <div className={`w-10 h-6 rounded-full p-1 transition ${s.enabled ? "bg-emerald-500" : "bg-white/10"}`}><div className={`w-4 h-4 rounded-full bg-white transition ${s.enabled ? "translate-x-4" : ""}`} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
