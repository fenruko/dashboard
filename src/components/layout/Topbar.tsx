import { Link } from "react-router-dom";
import { useApp } from "../../lib/store";
import { motion } from "framer-motion";

export function Topbar() {
  const { user, logout } = useApp();
  return (
    <header className="h-[64px] border-b border-white/[0.06] bg-[#08090c]/60 backdrop-blur-2xl sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Link to="/guilds" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black text-black text-[13px]">R</div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold tracking-tight leading-none">RIFT</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest leading-none mt-0.5">Command Center</div>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-2 ml-6 pl-6 border-l border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[12px] text-white/50">Live telemetry • 12ms</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 mr-2">
          <div className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center gap-2 text-[12px] text-white/60">
            <span className="w-2 h-2 rounded-full bg-[#00b8ff] animate-pulse" /> API • Operational
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[13px] text-white font-medium leading-none">{user.username}</div>
              <div className="text-[11px] text-white/40 leading-none mt-1">Authenticated</div>
            </div>
            <motion.img whileHover={{ scale: 1.05 }} src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`} className="w-9 h-9 rounded-xl border border-white/10" />
            <button onClick={logout} className="h-8 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] text-[12px] text-white/60 hover:text-white/90">Logout</button>
          </div>
        ) : (
          <Link to="/login" className="h-9 px-4 rounded-xl bg-white text-black text-[13px] font-medium hover:bg-white/90">Login</Link>
        )}
      </div>
    </header>
  );
}
