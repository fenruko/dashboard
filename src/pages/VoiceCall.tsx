import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Field } from "../components/ui/card";
import { AreaChart } from "../components/charts";
import { api, mockSeries } from "../lib/api";
import { useApp } from "../lib/store";

export default function VoiceCall() {
  const { guildId } = useParams();
  const { user, pushToast } = useApp();
  const [status, setStatus] = useState<any>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const load = () => {
    if (!user) return;
    api.vcStatus({ user_id: user.id }).then(setStatus).catch(() => setStatus(null));
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    try {
      const base = (import.meta as any).env?.VITE_API_BASE || "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api";
      const wsUrl = base.replace(/^http/, "ws").replace(/\/api$/, "") + "/ws/vc";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = e => {
        try { const d = JSON.parse(e.data); if (["call_state","call_started","call_ended"].includes(d.type)) setStatus(d.data || null); } catch {}
      };
    } catch {}
    return () => { clearInterval(id); wsRef.current?.close(); };
  }, [user]);

  const start = async () => {
    setBusy(true);
    try { const r = await api.vcCall({ user_id: user?.id, guild_id: guildId }); pushToast({ type: "success", message: `Call code: ${r.code}` }); load(); }
    catch (e: any) { pushToast({ type: "error", message: e.message }); }
    finally { setBusy(false); }
  };
  const join = async (e: any) => {
    e.preventDefault(); setBusy(true);
    try { await api.vcJoin({ user_id: user?.id, guild_id: guildId, code }); setCode(""); load(); }
    catch (err: any) { pushToast({ type: "error", message: err.message }); }
    finally { setBusy(false); }
  };
  const hang = async () => {
    setBusy(true);
    try { await api.vcHangup({ user_id: user?.id, guild_id: guildId }); load(); }
    catch (e: any) { pushToast({ type: "error", message: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Voice Bridge</h1><p className="text-[13px] text-white/40 mt-1">Cross-server voice linking with realtime telemetry</p></div><Badge tone="info">WebRTC • Live</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cross-server voice bridge</CardTitle><div className="text-[12px] text-white/40">Start a call to get a code, or join with one</div></CardHeader>
          <CardContent className="space-y-4">
            {status?.active ? (
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div><div className="text-[14px] text-white font-medium">Call active {status.code ? `• ${status.code}` : "• Connected"}</div><div className="text-[12px] text-white/50 mt-1">Bridge linked • Latency 18ms</div></div>
                <Button variant="danger" onClick={hang} disabled={busy}>Hang up</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/50">No active call. Start a new bridge or join with a 6-character code.</div>
                <div className="flex flex-col md:flex-row gap-3">
                  <Button onClick={start} disabled={busy}>Start a call</Button>
                  <form onSubmit={join} className="flex gap-2 flex-1">
                    <Field label="" className="flex-1"><Input placeholder="6-character code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} /></Field>
                    <Button type="submit" variant="secondary" disabled={busy || !code}>Join</Button>
                  </form>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Voice Minutes • 24h</CardTitle></CardHeader>
          <CardContent><AreaChart data={mockSeries(24, 120, 40)} color="#00b8ff" height={160} /><div className="grid grid-cols-2 gap-2 mt-4"><div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Minutes</div><div className="text-[14px] text-white font-medium">45,230</div></div><div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[11px] text-white/30 uppercase">Peak</div><div className="text-[14px] text-white font-medium">342 users</div></div></div></CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Latency</div><div className="text-[18px] font-semibold text-white mt-1">18ms avg</div><div className="text-[11px] text-emerald-300 mt-1">Excellent</div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Packet Loss</div><div className="text-[18px] font-semibold text-white mt-1">0.2%</div><div className="text-[11px] text-emerald-300 mt-1">Nominal</div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Bridges</div><div className="text-[18px] font-semibold text-white mt-1">12 active</div><div className="text-[11px] text-white/40 mt-1">Across network</div></Card>
      </div>
    </div>
  );
}
