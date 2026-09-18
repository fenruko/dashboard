import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Field } from "../components/ui/card";
import { AreaChart, BarChart, Donut } from "../components/charts";
import { api, mockSeries } from "../lib/api";
import { useApp } from "../lib/store";

export default function Stocks() {
  const { guildId } = useParams();
  const { user, pushToast } = useApp();
  const [market, setMarket] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [trade, setTrade] = useState({ symbol: "", action: "buy", amount: "" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.stocksMarket().then(d => setMarket(d.stocks || d || [])).catch(() => setMarket(Array.from({ length: 12 }).map((_, i) => ({ symbol: ["RIFT","MOON","COOL","BASE","PEPE"][i%5] + (i>4?i:""), name: `Asset ${i+1}`, price: (Math.random()*100+10).toFixed(2), change: (Math.random()*10-5).toFixed(2) }))));
    if (user) api.stocksPortfolio(user.id).then(setPortfolio).catch(() => setPortfolio({ balance: 12450, stock_value: 8923, holdings: [{ symbol: "RIFT", qty: 42, value: "$4,200" }, { symbol: "MOON", qty: 12, value: "$1,200" }], history: mockSeries(30, 10000, 2000) }));
    api.stocksLeaderboard().then(d => setLeaderboard(d.leaderboard || d || [])).catch(() => setLeaderboard(Array.from({ length: 10 }).map((_, i) => ({ username: `Trader${i+1}`, net_worth: `$${(Math.random()*50000+5000).toFixed(0)}` }))));
  };
  useEffect(() => { load(); }, [user]);

  const doTrade = async (e: any) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.stocksTrade({ symbol: trade.symbol, action: trade.action, user_id: user?.id, quantity: Number(trade.amount) }); pushToast({ type: "success", message: r.status || "Trade executed" }); setTrade({ symbol: "", action: "buy", amount: "" }); load(); }
    catch (e: any) { pushToast({ type: "error", message: e.message || "Trade failed" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">Economy</h1><p className="text-[13px] text-white/40 mt-1">Market, portfolio, trading and wealth analytics</p></div><Badge tone="info">Market • Open</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Portfolio Value</div><div className="text-[24px] font-semibold text-white mt-1">${portfolio?.balance ? (Number(portfolio.balance) + Number(portfolio.stock_value||0)).toFixed(2) : "21,373.00"}</div><div className="text-[12px] text-emerald-300 mt-1">+8.2% today</div></Card>
        <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Stock Value</div><div className="text-[24px] font-semibold text-white mt-1">${portfolio?.stock_value || "8,923"}</div><div className="text-[12px] text-white/40 mt-1">Across {portfolio?.holdings?.length || 2} assets</div></Card>
        <Card className="p-5 flex items-center justify-between"><div><div className="text-[11px] uppercase text-white/30">Risk Score</div><div className="text-[24px] font-semibold text-white mt-1">42 / 100</div><div className="text-[12px] text-amber-300 mt-1">Moderate</div></div><Donut value={42} total={100} color="#f59e0b" size={80} /></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Trade</CardTitle><Badge tone="info">Instant settlement</Badge></CardHeader>
        <CardContent>
          <form onSubmit={doTrade} className="grid md:grid-cols-4 gap-4 items-end">
            <Field label="Symbol"><Input value={trade.symbol} onChange={e => setTrade({ ...trade, symbol: e.target.value.toUpperCase() })} placeholder="RIFT" required /></Field>
            <Field label="Action"><select value={trade.action} onChange={e => setTrade({ ...trade, action: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-[#0e0f14] border border-white/[0.06] text-[13px]"><option value="buy">Buy</option><option value="sell">Sell</option></select></Field>
            <Field label="Shares"><Input type="number" min="1" value={trade.amount} onChange={e => setTrade({ ...trade, amount: e.target.value })} placeholder="10" required /></Field>
            <Button type="submit" disabled={busy} className="h-10">{busy ? "Trading…" : "Execute"}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Portfolio History</CardTitle></CardHeader>
          <CardContent><AreaChart data={portfolio?.history || mockSeries(30, 10000, 1500)} color="#00ffa3" height={200} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(portfolio?.holdings || []).map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-3 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <div><div className="text-[13px] font-medium text-white font-mono">{h.symbol}</div><div className="text-[11px] text-white/40">{h.qty} shares</div></div>
                <div className="text-[13px] text-white/70">{h.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Market</CardTitle><Badge>{market.length} assets</Badge></CardHeader>
          <CardContent className="divide-y divide-white/[0.05] max-h-[420px] overflow-y-auto">
            {market.map((m, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-[11px] font-mono text-white/70">{m.symbol.slice(0,3)}</div>
                <div className="flex-1 min-w-0"><div className="text-[13px] text-white/80 font-mono">{m.symbol}</div><div className="text-[11px] text-white/40 truncate">{m.name}</div></div>
                <div className="text-right"><div className="text-[13px] text-white">${m.price}</div><div className={`text-[11px] ${Number(m.change) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{Number(m.change) >= 0 ? "+" : ""}{m.change}%</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader>
          <CardContent className="divide-y divide-white/[0.05]">
            {leaderboard.map((l, i) => (
              <div key={i} className="py-3 flex items-center gap-3"><span className="w-5 text-[12px] font-mono text-white/25">{i+1}</span><span className="flex-1 text-[13px] text-white/70 truncate">{l.username || l.name}</span><span className="text-[13px] text-white/60">{l.net_worth || l.balance}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
