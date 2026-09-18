import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Background } from "../components/layout/Background";

export default function Landing() {
  return (
    <div className="min-h-screen relative flex flex-col">
      <Background />
      <header className="relative z-10 flex items-center justify-between px-6 py-6 max-w-[1280px] mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white text-black font-black flex items-center justify-center">R</div>
          <span className="text-[14px] font-semibold tracking-tight">RIFT</span>
        </div>
        <Link to="/login" className="h-9 px-5 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition">Dashboard →</Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center">
        <div className="max-w-[1280px] mx-auto w-full px-6 py-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] text-white/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live • 12.4k servers • 2.1M users
              </div>
              <h1 className="mt-6 text-[44px] md:text-[64px] font-[800] tracking-[-0.04em] leading-[0.9] text-balance">
                The command center for
                <span className="bg-gradient-to-r from-[#00b8ff] to-[#7c3aed] bg-clip-text text-transparent"> high-performance</span> communities.
              </h1>
              <p className="mt-6 text-[16px] leading-relaxed text-white/50 max-w-[560px] text-balance">
                Realtime analytics, moderation at scale, music, economy, voice bridging and verification — all instrumented with beautiful, lag-free telemetry.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login" className="h-12 px-7 rounded-full bg-white text-black font-medium text-[14px] inline-flex items-center hover:bg-white/90 transition shadow-[0_0_40px_rgba(255,255,255,0.2)]">Open Dashboard</Link>
                <a href="https://docs.rift.cool" target="_blank" className="h-12 px-7 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/80 text-[14px] inline-flex items-center hover:bg-white/[0.1]">Documentation</a>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6 max-w-[440px]">
                {[
                  { k: "99.9%", v: "Uptime" },
                  { k: "<12ms", v: "Latency" },
                  { k: "Real-time", v: "Analytics" },
                ].map(s => (
                  <div key={s.v}><div className="text-[20px] font-semibold text-white">{s.k}</div><div className="text-[11px] uppercase tracking-wide text-white/40">{s.v}</div></div>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22,1,0.36,1] }} className="relative">
            <div className="rounded-[24px] glass p-2 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
              <div className="rounded-[18px] bg-[#0e0f14] border border-white/[0.06] overflow-hidden">
                <div className="h-10 border-b border-white/[0.06] flex items-center px-4 gap-2">
                  <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-white/10" /><div className="w-3 h-3 rounded-full bg-white/10" /><div className="w-3 h-3 rounded-full bg-white/10" /></div>
                  <div className="ml-4 text-[12px] text-white/30">rift.cool — analytics</div>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                      <div className="h-2 w-12 rounded-full bg-white/10 mb-3" />
                      <div className="h-6 w-16 rounded bg-white/10" />
                      <div className="mt-3 h-[20px] rounded bg-gradient-to-r from-[#00b8ff]/20 to-[#7c3aed]/20" />
                    </div>
                  ))}
                </div>
                <div className="p-4 pt-0">
                  <div className="h-[140px] rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00b8ff]/10 via-transparent to-[#7c3aed]/10" />
                    <svg viewBox="0 0 300 80" className="w-full h-full relative">
                      <path d="M0 60 Q 50 10, 100 40 T 200 30 T 300 50" fill="none" stroke="#00b8ff" strokeWidth="2" />
                      <path d="M0 60 Q 50 10, 100 40 T 200 30 T 300 50 L 300 80 L 0 80 Z" fill="url(#g)" opacity={0.3} />
                      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00b8ff" stopOpacity={0.4} /><stop offset="100%" stopColor="#00b8ff" stopOpacity={0} /></linearGradient></defs>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -z-10 -inset-10 bg-gradient-to-br from-[#00b8ff]/20 to-[#7c3aed]/20 blur-[60px] rounded-[40px]" />
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-6 max-w-[1280px] mx-auto w-full flex items-center justify-between text-[12px] text-white/30">
        <span>© {new Date().getFullYear()} Rift • Built for scale</span>
        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> All systems nominal</span>
      </footer>
    </div>
  );
}
