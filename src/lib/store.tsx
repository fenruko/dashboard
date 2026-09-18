import React, { createContext, useContext, useEffect, useState } from "react";
import { api, fetchDiscordGuilds, fetchDiscordUser } from "./api";

type User = { id: string; username: string; avatar?: string; discriminator?: string } | null;
type Guild = { id: string; name: string; icon?: string; owner?: boolean; permissions?: number };

type Toast = { id: string; type: "success" | "error" | "info"; message: string };

type AppState = {
  user: User;
  token: string | null;
  guilds: Guild[];
  loading: boolean;
  error: string | null;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  reload: () => void;
  logout: () => void;
};

const Ctx = createContext<AppState>(null as any);

export function useApp() { return useContext(Ctx); }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("rift_token"));
  const [user, setUser] = useState<User>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(s => [...s, { ...t, id }]);
    setTimeout(() => setToasts(s => s.filter(x => x.id !== id)), 4000);
  };
  const removeToast = (id: string) => setToasts(s => s.filter(x => x.id !== id));

  const load = async () => {
    if (!token) { setLoading(false); setUser(null); setGuilds([]); return; }
    setLoading(true);
    setError(null);
    try {
      // Try our API first for session
      let discordToken = token;
      try {
        const me = await fetchDiscordUser(token);
        setUser(me);
      } catch {
        // token might be our backend token, try to get discord token via backend? fallback
        try {
          const data = await api.get("/auth/me", undefined, token);
          if (data?.user) setUser(data.user);
          if (data?.discord_token) discordToken = data.discord_token;
        } catch {
          setUser(null);
        }
      }
      try {
        const g = await fetchDiscordGuilds(discordToken);
        // filter to only guilds where bot is present if we can
        try {
          const botGuilds = await api.botGuildIds();
          const ids = new Set((botGuilds?.guild_ids || botGuilds || []).map((x: any) => typeof x === "string" ? x : x.id));
          if (ids.size > 0) {
            setGuilds(g.filter((x: any) => ids.has(x.id)));
          } else setGuilds(g);
        } catch {
          setGuilds(g);
        }
      } catch {
        setGuilds([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const reload = () => load();
  const logout = () => {
    localStorage.removeItem("rift_token");
    setToken(null);
    setUser(null);
    setGuilds([]);
  };

  // Listen for token changes from other tabs or login
  useEffect(() => {
    const handler = () => setToken(localStorage.getItem("rift_token"));
    window.addEventListener("storage", handler);
    (window as any).setRiftToken = (t: string) => { localStorage.setItem("rift_token", t); setToken(t); };
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <Ctx.Provider value={{ user, token, guilds, loading, error, toasts, pushToast, removeToast, reload, logout }}>
      {children}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto min-w-[300px] rounded-xl px-4 py-3 text-[13px] glass flex items-center gap-3 animate-[slideIn_0.3s_ease] ${t.type === "error" ? "border-red-500/30 bg-red-500/10" : t.type === "success" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10"}`}>
            <div className={`w-2 h-2 rounded-full ${t.type === "error" ? "bg-red-400" : t.type === "success" ? "bg-emerald-400" : "bg-white/60"}`} />
            <span className="flex-1 text-white/80">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="text-white/40 hover:text-white/80">✕</button>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateY(10px) scale(0.98); opacity:0 } to { transform: translateY(0) scale(1); opacity:1 } }`}</style>
    </Ctx.Provider>
  );
}

export function useGuild() {
  const { guilds } = useApp();
  const guildId = window.location.pathname.split("/")[2]; // /g/:guildId
  const guild = guilds.find(g => g.id === guildId) || null;
  return { guildId, guild };
}
