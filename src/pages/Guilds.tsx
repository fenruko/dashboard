import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useApp } from "../lib/store";
import { Background } from "../components/layout/Background";
import { Card, Badge } from "../components/ui/card";
import { useState } from "react";

export default function Guilds() {
  const { guilds, loading, user } = useApp();
  const [q, setQ] = useState("");

  const filtered = guilds.filter(g => g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen relative">
      <Background />
      <div className="relative z-10 max-w-[1120px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Select a server</h1>
            <p className="text-[13px] text-white/40 mt-1">Manage analytics, controls and automations. {user ? `Welcome, ${user.username}` : ""}</p>
          </div>
          <Link to="/" className="h-9 px-4 rounded-xl bg-white/[0.06] border border-white/[0.06] text-[13px] text-white/70 hover:text-white">Home</Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search servers…" className="h-10 px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-[13px] w-full max-w-[360px] focus:outline-none focus:border-[#00b8ff]/50" />
          <div className="text-[12px] text-white/30">{loading ? "Loading…" : `${filtered.length} servers`}</div>
        </div>

        {loading ? (
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[140px] rounded-[16px] bg-white/[0.04] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="mt-8 p-12 text-center">
            <div className="text-[14px] text-white/60">No servers found. Invite Rift or check your token.</div>
            <div className="mt-4 text-[12px] text-white/30">For local dev without backend, paste your Discord token in console: <code className="text-white/60">localStorage.setItem('rift_token','TOKEN')</code> then reload.</div>
          </Card>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((g, idx) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Link to={`/g/${g.id}`} className="block group">
                  <Card hover className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] overflow-hidden flex items-center justify-center font-bold text-white/80">
                        {g.icon ? <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} className="w-full h-full object-cover" /> : g.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-white truncate group-hover:text-white">{g.name}</div>
                        <div className="text-[11px] text-white/40 mt-1 font-mono">{g.id}</div>
                        <div className="mt-3 flex gap-2">
                          <Badge tone="info">Live</Badge>
                          <Badge>Manage</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2"><div className="text-[10px] text-white/30 uppercase">Members</div><div className="text-[12px] text-white">12.4k</div></div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2"><div className="text-[10px] text-white/30 uppercase">Score</div><div className="text-[12px] text-white">94</div></div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2"><div className="text-[10px] text-white/30 uppercase">Uptime</div><div className="text-[12px] text-emerald-300">99.9%</div></div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
