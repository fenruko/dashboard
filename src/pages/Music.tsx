import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "../components/ui/card";
import { AreaChart, BarChart, Sparkline } from "../components/charts";
import { api, mockSeries } from "../lib/api";
import { motion } from "framer-motion";

export default function Music() {
  const { guildId } = useParams();
  const [state, setState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);

  useEffect(() => {
    if (!guildId) return;
    api.musicState(guildId).then(setState).catch(() => setState({ track: { title: "Midnight City", artist: "M83", duration: 243, position: 42 }, queue: Array.from({ length: 5 }).map((_, i) => ({ title: `Track ${i+1}`, artist: "Artist" })) }));
    api.musicHistory(guildId).then(d => setHistory(d.history || d || [])).catch(() => setHistory(Array.from({ length: 10 }).map((_, i) => ({ title: `Song ${i+1}`, plays: Math.floor(Math.random()*100) }))));
    api.playlists(guildId).then(d => setPlaylists(d.playlists || d || [])).catch(() => setPlaylists([{ name: "Chill Vibes", tracks: 42, duration: "2h 14m" }, { name: "Workout", tracks: 67, duration: "3h 02m" }]));
  }, [guildId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Music</h1><p className="text-[13px] text-white/40 mt-1">Player, queue, analytics and listening intelligence</p></div><Badge tone="info">24/7 • Active</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-6 flex gap-6">
            <div className="w-[140px] h-[140px] rounded-[16px] bg-gradient-to-br from-[#00b8ff] to-[#7c3aed] flex items-center justify-center text-[32px] shadow-[0_0_40px_rgba(0,184,255,0.3)]">♪</div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-widest text-white/30">Now Playing</div>
              <div className="text-[22px] font-semibold text-white mt-1">{state?.track?.title || "—"}</div>
              <div className="text-[14px] text-white/50">{state?.track?.artist || "—"}</div>
              <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: "38%" }} className="h-full bg-white rounded-full" /></div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary">⏮ Prev</Button>
                <Button size="sm">⏸ Pause</Button>
                <Button size="sm" variant="secondary">⏭ Next</Button>
                <Button size="sm" variant="ghost">🔀 Shuffle</Button>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="text-[12px] text-white/40 mb-2">Listening Hours • 24h</div>
            <AreaChart data={mockSeries(24, 80, 30)} color="#00b8ff" height={120} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Queue</CardTitle><Badge>{state?.queue?.length || 0}</Badge></CardHeader>
            <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
              {(state?.queue || []).map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.04]">
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-white/40">{i+1}</div>
                  <div className="flex-1 min-w-0"><div className="text-[13px] text-white/80 truncate">{t.title}</div><div className="text-[11px] text-white/30 truncate">{t.artist}</div></div>
                  <Sparkline data={[20,40,30,60,50,80]} w={40} h={16} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top Plays</CardTitle></CardHeader>
            <CardContent><BarChart data={history.slice(0,6).map((h: any, i: number) => ({ x: i, y: h.plays || Math.random()*100 }))} color="#7c3aed" height={120} /></CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Your Playlists</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {playlists.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition">
                <div><div className="text-[13px] font-medium text-white">{p.name}</div><div className="text-[11px] text-white/40 mt-1">{p.tracks} tracks • {p.duration}</div></div>
                <Button size="sm" variant="secondary">Play</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listening Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Hours</div><div className="text-[16px] font-semibold text-white mt-1">128.5h</div></div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Plays</div><div className="text-[16px] font-semibold text-white mt-1">4,321</div></div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Peak</div><div className="text-[16px] font-semibold text-white mt-1">342</div></div>
            </div>
            <AreaChart data={mockSeries(14, 60, 20)} color="#00ffa3" height={120} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
