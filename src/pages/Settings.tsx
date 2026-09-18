import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Field } from "../components/ui/card";
import { AreaChart } from "../components/charts";
import { api, mockSeries } from "../lib/api";

const SETTINGS_META: Record<string, { title: string; desc: string; fields: { key: string; label: string; type: string; placeholder?: string }[] }> = {
  leveling: { title: "Leveling & XP", desc: "Configure XP curves, rewards and cooldowns", fields: [{ key: "xp_rate", label: "XP Rate", type: "number", placeholder: "1.0" }, { key: "level_channel", label: "Level-up Channel", type: "text", placeholder: "Channel ID" }, { key: "xp_cooldown", label: "Cooldown (s)", type: "number", placeholder: "60" }] },
  welcome: { title: "Welcome Messages", desc: "Greet new members with style", fields: [{ key: "welcome_channel", label: "Channel", type: "text" }, { key: "welcome_message", label: "Message", type: "text", placeholder: "Welcome {user}!" }, { key: "welcome_enabled", label: "Enabled", type: "bool" }] },
  goodbye: { title: "Goodbye Messages", desc: "Farewell flow", fields: [{ key: "goodbye_channel", label: "Channel", type: "text" }, { key: "goodbye_message", label: "Message", type: "text" }] },
  logging: { title: "Logging", desc: "Event stream and audit", fields: [{ key: "log_channel", label: "Log Channel", type: "text" }, { key: "log_level", label: "Level", type: "text", placeholder: "all" }] },
  verification: { title: "Verification", desc: "Security and onboarding", fields: [{ key: "verification_role", label: "Verified Role", type: "text" }, { key: "verification_channel", label: "Channel", type: "text" }] },
  starboard: { title: "Starboard", desc: "Highlight top messages", fields: [{ key: "starboard_channel", label: "Channel", type: "text" }, { key: "starboard_threshold", label: "Threshold", type: "number" }] },
  counting: { title: "Counting Game", desc: "Members count together", fields: [{ key: "counting_channel", label: "Channel", type: "text" }] },
  tickets: { title: "Ticket Auto-Delete", desc: "Cleanup automation", fields: [{ key: "ticket_delete_days", label: "Delete after (days)", type: "number" }] },
  invites: { title: "Invite Tracking", desc: "Track growth sources", fields: [{ key: "invite_channel", label: "Channel", type: "text" }] },
  prefix: { title: "Command Prefix", desc: "Custom prefix", fields: [{ key: "prefix", label: "Prefix", type: "text", placeholder: "!" }] },
};

export default function Settings() {
  const { guildId, section } = useParams();
  const meta = SETTINGS_META[section || ""] || { title: section || "Settings", desc: "Configure module", fields: [{ key: "value", label: "Value", type: "text" }] };
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!guildId || !section) return;
    setLoading(true);
    // Try to load each field
    Promise.all(meta.fields.map(f => api.getSetting(guildId, f.key).then(d => ({ k: f.key, v: d.value ?? d.data ?? d })).catch(() => ({ k: f.key, v: "" }))))
      .then(arr => {
        const obj: any = {};
        arr.forEach(({ k, v }) => obj[k] = v);
        setValues(obj);
      })
      .finally(() => setLoading(false));
  }, [guildId, section]);

  const save = async (key: string) => {
    if (!guildId) return;
    setSaving(true);
    try { await api.setSetting(guildId, key, { value: values[key] }); } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight">{meta.title}</h1><p className="text-[13px] text-white/40 mt-1">{meta.desc}</p></div><Badge tone="info">{section}</Badge></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Configuration</CardTitle><Badge>{loading ? "Loading" : "Ready"}</Badge></CardHeader>
            <CardContent className="space-y-5">
              {meta.fields.map(f => (
                <Field key={f.key} label={f.label}>
                  {f.type === "bool" ? (
                    <div className="flex items-center gap-3">
                      <button onClick={() => setValues({ ...values, [f.key]: !values[f.key] })} className={`w-10 h-6 rounded-full p-1 transition ${values[f.key] ? "bg-emerald-500" : "bg-white/10"}`}><div className={`w-4 h-4 rounded-full bg-white transition ${values[f.key] ? "translate-x-4" : ""}`} /></button>
                      <span className="text-[13px] text-white/60">{values[f.key] ? "Enabled" : "Disabled"}</span>
                      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => save(f.key)} disabled={saving}>Save</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={values[f.key] || ""} onChange={e => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.placeholder} />
                      <Button size="sm" variant="secondary" onClick={() => save(f.key)} disabled={saving}>Save</Button>
                    </div>
                  )}
                </Field>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Module Analytics</CardTitle></CardHeader>
            <CardContent><AreaChart data={mockSeries(14, 40, 15)} color="#7c3aed" height={160} /></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5"><div className="text-[11px] uppercase text-white/30">Status</div><div className="mt-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[13px] text-white/80">Operational</span></div><div className="mt-4 space-y-2"><div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-emerald-400 w-[92%]" /></div><div className="text-[11px] text-white/30">92% healthy</div></div></Card>
          <Card><CardHeader><CardTitle>Quick Docs</CardTitle></CardHeader><CardContent className="text-[12px] leading-relaxed text-white/50">This module is managed via dashboard and Discord commands. Changes propagate instantly. Use analytics to tune thresholds.</CardContent></Card>
          <Card><CardHeader><CardTitle>Related</CardTitle></CardHeader><CardContent className="space-y-2">{Object.keys(SETTINGS_META).slice(0,6).map(k => <div key={k} className="py-2 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/60 hover:bg-white/[0.06] cursor-pointer">{SETTINGS_META[k].title}</div>)}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
