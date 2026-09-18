import { NavLink, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useApp } from "../../lib/store";

const nav = [
  { group: "Intelligence" },
  { id: "overview", label: "Overview", icon: "◧", path: "", desc: "Realtime pulse" },
  { id: "analytics", label: "Analytics", icon: "◩", path: "analytics", desc: "Deep metrics" },
  { group: "Control" },
  { id: "moderation", label: "Moderation", icon: "⬢", path: "moderation", desc: "Logs & actions" },
  { id: "music", label: "Music", icon: "♪", path: "music", desc: "Player & queue" },
  { id: "lastfm", label: "Audio Intel", icon: "♫", path: "lastfm", desc: "Scrobbles" },
  { id: "stocks", label: "Economy", icon: "₿", path: "stocks", desc: "Market & trade" },
  { id: "voice-call", label: "Voice Bridge", icon: "◍", path: "voice-call", desc: "Cross-server" },
  { id: "verification-activity", label: "Verification", icon: "⬣", path: "verification-activity", desc: "Security" },
  { group: "Systems" },
  { id: "general", label: "General", icon: "⚙", path: "general", desc: "Core config" },
  { id: "leveling", label: "Leveling", icon: "↗", path: "settings/leveling", desc: "XP curves" },
  { id: "welcome", label: "Welcome", icon: "↗", path: "settings/welcome", desc: "Onboarding" },
  { id: "logging", label: "Logging", icon: "☰", path: "settings/logging", desc: "Event stream" },
];

export function Sidebar() {
  const { guildId } = useParams();
  const { guilds } = useApp();
  const guild = guilds.find(g => g.id === guildId);

  return (
    <aside className="w-[280px] shrink-0 h-screen sticky top-0 hidden lg:flex flex-col border-r border-white/[0.06] bg-[#0a0b0f]/60 backdrop-blur-2xl">
      {/* Guild header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b8ff] to-[#7c3aed] flex items-center justify-center text-[14px] font-bold text-white shadow-[0_0_20px_rgba(0,184,255,0.3)]">
            {guild?.icon ? <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="w-full h-full rounded-xl object-cover" /> : guild?.name?.[0] || "R"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">{guild?.name || "Select Server"}</div>
            <div className="text-[11px] text-white/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live • Synced</div>
          </div>
        </div>
        {/* mini stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { k: "Members", v: "12.4k" },
            { k: "Online", v: "3.4k" },
            { k: "Boost", v: "L2" },
          ].map(i => (
            <div key={i.k} className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/30">{i.k}</div>
              <div className="text-[12px] font-medium text-white">{i.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {nav.map((item, idx) => {
          if ((item as any).group) return <div key={idx} className="px-3 pt-2 text-[10px] uppercase tracking-[0.14em] text-white/25 font-semibold">{(item as any).group}</div>;
          const n = item as any;
          return (
            <NavLink
              key={n.id}
              to={n.path ? `/g/${guildId}/${n.path}` : `/g/${guildId}`}
              end={n.path === ""}
              className={({ isActive }) => `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all border ${isActive ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-transparent text-white/50 border-transparent hover:bg-white/[0.06] hover:text-white/90 hover:border-white/[0.06]"}`}
            >
              <span className="w-7 h-7 rounded-lg bg-white/[0.06] group-[.active]:bg-black/10 flex items-center justify-center text-[12px]">{n.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-none">{n.label}</div>
                <div className="text-[11px] opacity-60 leading-none mt-1">{n.desc}</div>
              </div>
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/[0.06]">
        <div className="rounded-xl bg-gradient-to-br from-[#00b8ff]/10 via-[#7c3aed]/10 to-transparent border border-white/[0.06] p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-[11px] text-white/50 uppercase tracking-wide">System Status</div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-white/80"><span className="w-2 h-2 rounded-full bg-emerald-400" /> All systems operational</div>
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: "92%" }} transition={{ duration: 1.5 }} className="h-full bg-emerald-400" /></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { guildId } = useParams();
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-[#0a0b0f]/90 backdrop-blur-2xl">
      <div className="flex overflow-x-auto p-2 gap-2">
        {nav.filter((n: any) => !n.group).slice(0, 7).map((n: any) => (
          <NavLink key={n.id} to={n.path ? `/g/${guildId}/${n.path}` : `/g/${guildId}`} end={n.path === ""} className={({ isActive }) => `shrink-0 px-3 py-2 rounded-xl text-[12px] border ${isActive ? "bg-white text-black border-white" : "bg-white/[0.04] text-white/60 border-white/[0.06]"}`}>
            {n.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
