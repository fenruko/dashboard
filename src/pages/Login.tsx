import { motion } from "framer-motion";
import { getDiscordAuthUrl } from "../lib/api";

export default function Login() {
  return (
    <div className="min-h-screen bg-[#08090c] flex items-center justify-center relative px-6 overflow-hidden">
      {/* Subtle grid + glow like old but cleaner */}
      <div className="absolute inset-0 bg-grid opacity-[0.25] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] bg-[#5865f2]/[0.12] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] bg-[#00b8ff]/[0.08] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[360px] relative z-10 flex flex-col items-center text-center"
      >
        {/* Logo - old style */}
        <motion.img
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          src="https://i.postimg.cc/qR4jqJdK/cropped_circle_image.png"
          alt="Rift"
          className="w-[72px] h-[72px] rounded-full shadow-[0_0_40px_rgba(88,101,242,0.25)]"
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-6"
        >
          <h1 className="text-[22px] font-bold tracking-tight text-white">Rift Dashboard</h1>
          <p className="mt-2 text-[13px] text-white/40 leading-relaxed">
            Sign in with Discord to manage your servers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5 }}
          className="mt-8 w-full"
        >
          <a
            href={getDiscordAuthUrl()}
            className="h-[44px] w-full rounded-xl bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-medium text-[14px] flex items-center justify-center gap-2.5 transition-all hover:shadow-[0_0_30px_rgba(88,101,242,0.35)] active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="opacity-90">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3847-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
            Login with Discord
          </a>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/25">
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Secure OAuth2 • Only identify + guilds</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-10 text-[11px] text-white/20"
        >
          dash.rift.cool
        </motion.div>
      </motion.div>
    </div>
  );
}
