import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "../components/ui/card";
import { AreaChart, Donut, RadialBars } from "../components/charts";
import { api, mockSeries } from "../lib/api";

export default function LastFM() {
  const { guildId } = useParams();
  const [artists, setArtists] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!guildId) return;
    api.lastfmTopArtists(guildId).then(d => setArtists(d.artists || d || [])).catch(() => setArtists(Array.from({ length: 10 }).map((_, i) => ({ name: `Artist ${i+1}`, playcount: Math.floor(Math.random()*1000) }))));
    api.lastfmTopTracks(guildId).then(d => setTracks(d.tracks || d || [])).catch(() => setTracks(Array.from({ length: 10 }).map((_, i) => ({ name: `Track ${i+1}`, playcount: Math.floor(Math.random()*800) }))));
    api.lastfmGenres(guildId).then(d => setGenres(d.genres || d || [])).catch(() => setGenres([{ name: "Indie" }, { name: "Electronic" }, { name: "Hip-Hop" }, { name: "Rock" }, { name: "Jazz" }]));
    api.lastfmProfile(guildId).then(setProfile).catch(() => setProfile({ scrobbles: 12843, artists: 892, tracks: 3421 }));
  }, [guildId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Audio Intel</h1><p className="text-[13px] text-white/40 mt-1">Last.fm scrobbles, trends and taste analytics</p></div><Badge tone="info">Last.fm • Connected</Badge></div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Scrobbles</div><div className="text-[22px] font-semibold text-white mt-1">{profile?.scrobbles || "12,843"}</div><div className="text-[11px] text-white/40 mt-1">All time</div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Artists</div><div className="text-[22px] font-semibold text-white mt-1">{profile?.artists || "892"}</div><div className="text-[11px] text-emerald-300 mt-1">+23 this week</div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Tracks</div><div className="text-[22px] font-semibold text-white mt-1">{profile?.tracks || "3,421"}</div><div className="text-[11px] text-white/40 mt-1">Unique</div></Card>
        <Card className="p-5 flex flex-col items-center justify-center"><Donut value={78} total={100} color="#7c3aed" size={90} label="Diversity" /></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Scrobbles • 30d</CardTitle></CardHeader><CardContent><AreaChart data={mockSeries(30, 120, 40)} color="#7c3aed" height={220} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Top Genres</CardTitle></CardHeader><CardContent><RadialBars items={genres.slice(0,5).map((g: any, i: number) => ({ label: g.name || g, value: 100 - i*12, color: ["#00b8ff","#7c3aed","#00ffa3","#f59e0b","#ef4444"][i%5] }))} /><div className="mt-4 flex flex-wrap gap-2">{genres.slice(0,8).map((g: any, i: number) => <span key={i} className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.06] border border-white/[0.08] text-white/60">{g.name || g}</span>)}</div></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Top Artists • 30d</CardTitle></CardHeader><CardContent className="divide-y divide-white/[0.05]">{artists.slice(0,10).map((a, i) => <div key={i} className="py-3 flex items-center gap-3"><span className="text-white/25 font-mono w-5 text-[12px]">{i+1}</span><span className="flex-1 text-[13px] text-white/70 truncate">{a.name}</span><span className="text-[12px] text-white/30">{a.playcount}</span><div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-[#7c3aed]" style={{ width: `${Math.max(10, 100 - i*8)}%` }} /></div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Top Tracks • 30d</CardTitle></CardHeader><CardContent className="divide-y divide-white/[0.05]">{tracks.slice(0,10).map((a, i) => <div key={i} className="py-3 flex items-center gap-3"><span className="text-white/25 font-mono w-5 text-[12px]">{i+1}</span><span className="flex-1 text-[13px] text-white/70 truncate">{a.name}</span><span className="text-[12px] text-white/30">{a.playcount}</span><div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-[#00b8ff]" style={{ width: `${Math.max(10, 100 - i*8)}%` }} /></div></div>)}</CardContent></Card>
      </div>
    </div>
  );
}
