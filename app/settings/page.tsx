"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Общие настройки теперь лежат в Supabase и будут расширяться вместе с LifeOS 2.0.">
      <AuthGate>{(user) => <Settings userId={user.id} />}</AuthGate>
    </AppShell>
  );
}

function Settings({ userId }: { userId: string }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [timezone, setTimezone] = useState("Asia/Almaty");
  const [theme, setTheme] = useState("dark");
  const [compact, setCompact] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    sb.from("settings").select("*").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data) { setTimezone(data.timezone ?? "Asia/Almaty"); setTheme(data.theme ?? "dark"); setCompact(Boolean(data.compact_mode)); }
    });
  }, [userId]);

  async function save() {
    const { error } = await sb.from("settings").upsert({ user_id: userId, timezone, theme, compact_mode: compact }, { onConflict: "user_id" });
    setMessage(error ? error.message : "Saved.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="life-card p-5">
        <h2 className="text-xl font-black">General</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-white/55">Timezone<input className="life-input mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></label>
          <label className="block text-sm text-white/55">Theme<select className="life-input mt-1" value={theme} onChange={(e) => setTheme(e.target.value)}><option>dark</option><option>light</option><option>system</option></select></label>
          <label className="flex items-center gap-3 text-sm text-white/65"><input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> Compact mode</label>
          <button className="life-button" onClick={save}>Save settings</button>
          {message && <div className="text-sm text-white/55">{message}</div>}
        </div>
      </div>

      <div className="life-card p-5">
        <h2 className="text-xl font-black">Environment checklist</h2>
        <div className="mt-4 space-y-2 text-sm text-white/62">
          <div>NEXT_PUBLIC_SUPABASE_URL: browser-required</div>
          <div>NEXT_PUBLIC_SUPABASE_ANON_KEY: browser-required</div>
          <div>SUPABASE_SERVICE_ROLE_KEY: server routes / workers</div>
          <div>RESEND_API_KEY: email notifications</div>
          <div>CRON_SECRET: protects scheduled worker</div>
          <div>GITHUB_TOKEN: Obsidian vault mirror</div>
        </div>
      </div>
    </div>
  );
}
