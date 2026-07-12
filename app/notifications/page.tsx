"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Настройки настоящих уведомлений. Отправка происходит через scheduled worker, а не внутри интерфейса.">
      <AuthGate>{(user) => <Notifications userId={user.id} email={user.email ?? ""} />}</AuthGate>
    </AppShell>
  );
}

function Notifications({ userId, email }: { userId: string; email: string }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [targetEmail, setTargetEmail] = useState(email);
  const [deadlineLead, setDeadlineLead] = useState(60);
  const [scheduleLead, setScheduleLead] = useState(15);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  async function loadLogs() {
    const { data } = await sb.from("notification_log").select("*").eq("user_id", userId).order("sent_at", { ascending: false }).limit(20);
    setLogs(data ?? []);
  }

  useEffect(() => { loadLogs(); }, []);

  async function save() {
    setMessage("Saving...");
    await sb.from("notification_channels").upsert({ user_id: userId, channel_type: "email", enabled: true, target: targetEmail }, { onConflict: "user_id,channel_type,target" });
    await sb.from("notification_rules").upsert({ user_id: userId, rule_type: "deadline_reminder", enabled: true, lead_minutes: deadlineLead }, { onConflict: "user_id,rule_type,lead_minutes" });
    await sb.from("notification_rules").upsert({ user_id: userId, rule_type: "schedule_reminder", enabled: true, lead_minutes: scheduleLead }, { onConflict: "user_id,rule_type,lead_minutes" });
    await sb.from("notification_rules").upsert({ user_id: userId, rule_type: "daily_brief", enabled: true, time_of_day: dailyTime }, { onConflict: "user_id,rule_type,time_of_day" });
    setMessage("Saved. Worker will use these rules.");
  }

  async function testEmail() {
    setMessage("Sending test...");
    const response = await fetch("/api/notifications/test", { method: "POST", body: JSON.stringify({ to: targetEmail }) });
    setMessage(await response.text());
    await loadLogs();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px,1fr]">
      <div className="life-card h-fit p-5">
        <h2 className="text-xl font-black">Rules</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-white/55">Email target<input className="life-input mt-1" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} /></label>
          <label className="block text-sm text-white/55">Deadline lead minutes<input className="life-input mt-1" type="number" min={5} value={deadlineLead} onChange={(e) => setDeadlineLead(Number(e.target.value))} /></label>
          <label className="block text-sm text-white/55">Schedule lead minutes<input className="life-input mt-1" type="number" min={5} value={scheduleLead} onChange={(e) => setScheduleLead(Number(e.target.value))} /></label>
          <label className="block text-sm text-white/55">Daily brief time<input className="life-input mt-1" type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} /></label>
          <button className="life-button w-full" onClick={save}>Save rules</button>
          <button className="life-button secondary w-full" onClick={testEmail}>Send test email</button>
          {message && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">{message}</div>}
        </div>
      </div>

      <div className="life-card p-5">
        <h2 className="text-xl font-black">Last notifications</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="life-table">
            <thead><tr><th>Time</th><th>Status</th><th>Title</th><th>Channel</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.sent_at).toLocaleString("ru-RU")}</td><td>{l.status}</td><td>{l.title}</td><td>{l.channel_type}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
