import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Callback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const error = params.get("error");
    if (error) { setErr(error); return; }
    if (!code) { setErr("No code"); return; }

    // In a real setup you'd exchange code via backend. For now we simulate:
    // If VITE_API_BASE has /auth/callback endpoint, call it. Otherwise store mock and go to guilds.
    const apiBase = (import.meta as any).env?.VITE_API_BASE;
    if (apiBase) {
      fetch(`${apiBase}/auth/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(window.location.origin + "/callback")}`)
        .then(r => r.json())
        .then(d => {
          if (d.token || d.access_token) {
            localStorage.setItem("rift_token", d.token || d.access_token);
            (window as any).setRiftToken?.(d.token || d.access_token);
          } else if (d.discord_token) {
            localStorage.setItem("rift_token", d.discord_token);
          }
          nav("/guilds");
        })
        .catch(() => {
          // fallback: store code as token for demo (will use discord api directly if user pastes token)
          // Actually we need to exchange via discord directly is not possible client-side securely.
          // So we show instruction to set token manually for now.
          setErr("Backend exchange failed — configure VITE_API_BASE to enable OAuth. For local dev, set rift_token manually in console: localStorage.setItem('rift_token','YOUR_DISCORD_TOKEN')");
        });
    } else {
      // No backend configured — redirect to guilds where user can paste token manually
      // For demo, we allow manual token entry
      nav("/guilds");
    }
  }, [params, nav]);

  return (
    <div className="min-h-screen bg-[#08090c] flex items-center justify-center p-6">
      <div className="max-w-[420px] w-full rounded-2xl glass p-6">
        <div className="text-[14px] text-white font-medium">Finishing authentication…</div>
        {err && <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{err}</div>}
        <div className="mt-4 text-[12px] text-white/40">If this hangs, configure your backend at VITE_API_BASE. The dashboard will still render with mock analytics.</div>
      </div>
    </div>
  );
}
