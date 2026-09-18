import { motion } from "framer-motion";
import { Background } from "../components/layout/Background";
import { getDiscordAuthUrl } from "../lib/api";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center relative px-6">
      <Background />
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }} className="w-full max-w-[420px] relative z-10">
        <div className="rounded-[24px] glass p-8">
          <div className="w-12 h-12 rounded-xl bg-white text-black font-black flex items-center justify-center text-[18px]">R</div>
          <h1 className="mt-6 text-[28px] font-bold tracking-tight leading-none">Continue to Rift</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/50">Authenticate with Discord to access your servers, analytics and controls. We only request identify + guilds.</p>

          <div className="mt-8 space-y-3">
            <a href={getDiscordAuthUrl()} className="h-12 w-full rounded-xl bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition">
              <span className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-[12px]">D</span> Continue with Discord
            </a>
            <div className="text-[11px] text-white/30 text-center">By continuing you agree to our Terms and Privacy.</div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2">
            {[
              { k: "Encrypted", v: "OAuth2" },
              { k: "No spam", v: "Minimal" },
              { k: "Instant", v: "Access" },
            ].map(i => (
              <div key={i.k} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                <div className="text-[11px] text-white/40 uppercase tracking-wide">{i.k}</div>
                <div className="text-[12px] text-white/80 mt-1">{i.v}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
