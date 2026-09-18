import { motion } from "framer-motion";

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#08090c]" />
      <div className="absolute inset-0 bg-grid opacity-[0.4]" />
      {/* Gradient orbs */}
      <motion.div
        animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[30%] -left-[20%] w-[80%] h-[80%] rounded-full blur-[120px] opacity-[0.15]"
        style={{ background: "radial-gradient(circle, #00b8ff 0%, transparent 70%)" }}
      />
      <motion.div
        animate={{ x: [0, -60, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] rounded-full blur-[120px] opacity-[0.12]"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
      />
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-[40%] left-[40%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-[0.08]"
        style={{ background: "radial-gradient(circle, #00ffa3 0%, transparent 70%)" }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#08090c]/80" />
    </div>
  );
}
