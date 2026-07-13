"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Email-уведомления теперь рассчитаны на внешний GitHub Actions worker. Интерфейс только управляет правилами и логом.">
      <AuthGate>{(user) => <Notifications userId={user.id} email={user.email ?? ""} />}</AuthGate>
    </AppShell>
  );
}

function parseLeadList(value: string, fallback: number[]) {
  const nums = value.split(/[ ,;]+/g).map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
  return nums.length ? Array.from(new Set(nums)).sort((a,b)=>b-a) : fallback;
}

function Notifications({ userId, email }: { userId: string; email: string }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [targetEmail, setTargetEmail] = useState(email);
  const [deadlineLeads, setDeadlineLeads] = useState("1440, 180, 60");
  const [scheduleLeads, setScheduleLeads] = useState("15");
  const [cycleLead, setCycleLead] = useState("180");
  const [countdownLead, setCountdownLead] = useState("60");
  const [dailyTime, setDailyTime] = useState("08:00");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [workerUrl, setWorkerUrl] = useState("");

  async function load() {
    const { data: channels } = await sb.from("notification_channels").select("*").eq("user_id", userId).eq("channel_type", "email").eq("enabled", true).limit(1);
    if (channels?.[0]?.target) setTargetEmail(channels[0].target);
    const { data: rules } = await sb.from("notification_rules").select("*").eq("user_id", userId).eq("enabled", true);
    const byType = (type: string) => (rules ?? []).filter((r:any)=>r.rule_type === type);
    const d = byType("deadline_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const s = byType("schedule_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const c = byType("cycle_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const cd = byType("countdown_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const daily = byType("daily_brief")[0];
    if (d.length) setDeadlineLeads(d.join(", "));
    if (s.length) setScheduleLeads(s.join(", "));
    if (c.length) setCycleLead(String(c[0]));
    if (cd.length) setCountdownLead(String(cd[0]));
    if (daily?.time_of_day) setDailyTime(String(daily.time_of_day).slice(0,5));
    await loadLogs();
  }

  async function loadLogs() {
    const { data } = await sb.from("notification_log").select("*").eq("user_id", userId).order("sent_at", { ascending: false }).limit(40);
    setLogs(data ?? []);
  }

  useEffect(() => {
    setWorkerUrl(`${window.location.origin}/api/notifications/check`);
    load();
  }, []);

  async function replaceRules(ruleType: string, leads: number[]) {
    await sb.from("notification_rules").delete().eq("user_id", userId).eq("rule_type", ruleType);
    if (leads.length) {
      await sb.from("notification_rules").insert(leads.map((lead_minutes) => ({ user_id: userId, rule_type: ruleType, enabled: true, lead_minutes })));
    }
  }

  async function save() {
    setMessage("Saving...");
    await sb.from("notification_channels").upsert({ user_id: userId, channel_type: "email", enabled: true, target: targetEmail }, { onConflict: "user_id,channel_type,target" });
    await replaceRules("deadline_reminder", parseLeadList(deadlineLeads, [1440, 180, 60]));
    await replaceRules("schedule_reminder", parseLeadList(scheduleLeads, [15]));
    await replaceRules("cycle_reminder", parseLeadList(cycleLead, [180]));
    await replaceRules("countdown_reminder", parseLeadList(countdownLead, [60]));
    await sb.from("notification_rules").delete().eq("user_id", userId).eq("rule_type", "daily_brief");
    await sb.from("notification_rules").insert({ user_id: userId, rule_type: "daily_brief", enabled: true, time_of_day: dailyTime });
    setMessage("Saved. GitHub Actions worker will use these rules.");
    await loadLogs();
  }

  async function testEmail() {
    setMessage("Sending test...");
    const response = await fetch("/api/notifications/test", { method: "POST", body: JSON.stringify({ to: targetEmail }) });
    const text = await response.text();
    setMessage(text);
    await loadLogs();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[430px,1fr]">
      <div className="space-y-5">
        <div className="life-card-strong h-fit p-5">
          <h2 className="text-xl font-black">Rules</h2>
          <p className="mt-1 text-sm text-white/48">Можно писать несколько lead minutes через запятую. Например deadline: 1440, 180, 60.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-white/55">Email target<input className="life-input mt-1" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Deadline reminders, minutes<input className="life-input mt-1" value={deadlineLeads} onChange={(e) => setDeadlineLeads(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Schedule reminders, minutes<input className="life-input mt-1" value={scheduleLeads} onChange={(e) => setScheduleLeads(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Cycle ending reminder, minutes<input className="life-input mt-1" value={cycleLead} onChange={(e) => setCycleLead(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Countdown reminder, minutes<input className="life-input mt-1" value={countdownLead} onChange={(e) => setCountdownLead(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Daily brief time<input className="life-input mt-1" type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} /></label>
            <button className="life-button w-full" onClick={save}>Save notification rules</button>
            <button className="life-button secondary w-full" onClick={testEmail}>Send test email</button>
            {message && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">{message}</div>}
          </div>
        </div>

        <div className="life-card p-5">
          <h2 className="text-xl font-black">Worker status</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">Vercel cron отключён. Эта версия рассчитана на GitHub Actions: он дёргает endpoint и LifeOS отправляет письма.</p>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/58">
            <div className="mb-1 font-bold text-white/75">Endpoint</div>
            <div className="break-all">{workerUrl || "/api/notifications/check"}</div>
          </div>
          <div className="mt-3 rounded-2xl border border-violet-300/15 bg-violet-300/10 p-3 text-xs leading-6 text-violet-50/70">
            GitHub secrets needed:<br/>
            <b>LIFEOS_APP_URL</b> = твой Vercel URL<br/>
            <b>LIFEOS_CRON_SECRET</b> = тот же CRON_SECRET, что в Vercel
          </div>
        </div>
      </div>

      <div className="life-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Last notifications</h2>
            <p className="mt-1 text-sm text-white/45">sent/failed/skipped смотрится здесь после запуска worker.</p>
          </div>
          <button className="life-button secondary" onClick={loadLogs}>Refresh log</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="life-table">
            <thead><tr><th>Time</th><th>Status</th><th>Title</th><th>Channel</th><th>Source</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.sent_at).toLocaleString("ru-RU")}</td><td>{l.status}</td><td>{l.title}</td><td>{l.channel_type}</td><td>{l.source_type}</td></tr>)}</tbody>
          </table>
          {!logs.length && <div className="py-10 text-center text-white/45">No notification log yet.</div>}
        </div>
      </div>
    </div>
  );
}
