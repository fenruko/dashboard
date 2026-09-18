import React from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...a: any[]) { return twMerge(clsx(a)); }

export function Card({ className, children, hover = false, glow = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; glow?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-[16px] glass overflow-hidden",
        hover && "glass-hover transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(255,255,255,0.04)]",
        glow && "glow-accent",
        className
      )}
      {...props as any}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-3 flex items-start justify-between", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <h3 className={cn("text-[13px] font-semibold tracking-wide text-white/90 uppercase", className)} {...p} />;
}
export function CardDesc({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <p className={cn("text-[12px] text-white/40 mt-1", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...p} />;
}

export function Stat({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-widest text-white/30 font-medium">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-[22px] font-semibold text-white tracking-tight">{value}</div>
        {trend && <div className={`text-[11px] px-1.5 py-0.5 rounded-full ${trend === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{trend === "up" ? "↗" : "↘"}</div>}
      </div>
      {sub && <div className="text-[12px] text-white/40">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "danger" | "info" | "warning" }) {
  const map: any = {
    default: "bg-white/[0.06] text-white/60 border-white/10",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    danger: "bg-red-500/10 text-red-300 border-red-500/20",
    info: "bg-[#00b8ff]/10 text-[#00b8ff] border-[#00b8ff]/20",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${map[tone]}`}>{children}</span>;
}

export function Button({ variant = "primary", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "h-8 px-3 text-[12px]", md: "h-9 px-4 text-[13px]", lg: "h-11 px-6 text-[14px]" };
  const variants = {
    primary: "bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.15)]",
    secondary: "bg-white/[0.06] text-white hover:bg-white/[0.10] border border-white/[0.08]",
    ghost: "bg-transparent text-white/60 hover:text-white hover:bg-white/[0.06]",
    danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20",
  };
  return <button className={cn(base, sizes[size], variants[variant], className)} {...p} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#00b8ff]/50 focus:bg-white/[0.06] transition-all", props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full h-10 px-3 rounded-xl bg-[#0e0f14] border border-white/[0.06] text-[13px] text-white focus:outline-none focus:border-[#00b8ff]/50 transition-all", props.className)} />;
}
export function Label({ children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...p} className={cn("text-[11px] uppercase tracking-wide text-white/40 font-medium", p.className)}>{children}</label>;
}
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>;
}
