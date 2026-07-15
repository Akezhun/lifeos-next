"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="V12.5: email + Telegram channels, worker status, test buttons, daily/evening/weekly rules and notification log.">
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
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [targetEmail, setTargetEmail] = useState(email);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramChat, setTelegramChat] = useState("");
  const [deadlineLeads, setDeadlineLeads] = useState("1440, 180, 60");
  const [scheduleLeads, setScheduleLeads] = useState("15");
  const [cycleLead, setCycleLead] = useState("180");
  const [countdownLead, setCountdownLead] = useState("60");
  const [dailyTime, setDailyTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("22:00");
  const [weeklyTime, setWeeklyTime] = useState("20:00");
  const [weeklyDay, setWeeklyDay] = useState("6");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [workerUrl, setWorkerUrl] = useState("");

  async function load() {
    const { data: channels } = await sb.from("notification_channels").select("*").eq("user_id", userId);
    const emailCh = (channels ?? []).find((c:any)=>c.channel_type === "email");
    const tgCh = (channels ?? []).find((c:any)=>c.channel_type === "telegram");
    if (emailCh) { setTargetEmail(emailCh.target); setEmailEnabled(Boolean(emailCh.enabled)); }
    if (tgCh) { setTelegramChat(tgCh.target); setTelegramEnabled(Boolean(tgCh.enabled)); }

    const { data: rules } = await sb.from("notification_rules").select("*").eq("user_id", userId).eq("enabled", true);
    const byType = (type: string) => (rules ?? []).filter((r:any)=>r.rule_type === type);
    const d = byType("deadline_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const s = byType("schedule_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const c = byType("cycle_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const cd = byType("countdown_reminder").map((r:any)=>r.lead_minutes).filter(Boolean);
    const daily = byType("daily_brief")[0];
    const evening = byType("evening_review")[0];
    const weekly = byType("weekly_review")[0];
    if (d.length) setDeadlineLeads(d.join(", "));
    if (s.length) setScheduleLeads(s.join(", "));
    if (c.length) setCycleLead(String(c[0]));
    if (cd.length) setCountdownLead(String(cd[0]));
    if (daily?.time_of_day) setDailyTime(String(daily.time_of_day).slice(0,5));
    if (evening?.time_of_day) setEveningTime(String(evening.time_of_day).slice(0,5));
    if (weekly?.time_of_day) setWeeklyTime(String(weekly.time_of_day).slice(0,5));
    if (Array.isArray(weekly?.weekdays) && weekly.weekdays.length) setWeeklyDay(String(weekly.weekdays[0]));
    await loadLogs();
  }

  async function loadLogs() {
    const { data } = await sb.from("notification_log").select("*").eq("user_id", userId).order("sent_at", { ascending: false }).limit(60);
    setLogs(data ?? []);
  }

  useEffect(() => {
    setWorkerUrl(`${window.location.origin}/api/notifications/check`);
    load();
  }, []);

  async function replaceRules(ruleType: string, leads: number[]) {
    await sb.from("notification_rules").delete().eq("user_id", userId).eq("rule_type", ruleType);
    if (leads.length) await sb.from("notification_rules").insert(leads.map((lead_minutes) => ({ user_id: userId, rule_type: ruleType, enabled: true, lead_minutes })));
  }
  async function replaceTimedRule(ruleType: string, time_of_day: string, weekdays?: number[]) {
    await sb.from("notification_rules").delete().eq("user_id", userId).eq("rule_type", ruleType);
    await sb.from("notification_rules").insert({ user_id: userId, rule_type: ruleType, enabled: true, time_of_day, weekdays: weekdays || null });
  }

  async function save() {
    setMessage("Saving...");
    if (targetEmail) await sb.from("notification_channels").upsert({ user_id: userId, channel_type: "email", enabled: emailEnabled, target: targetEmail }, { onConflict: "user_id,channel_type,target" });
    if (telegramChat) await sb.from("notification_channels").upsert({ user_id: userId, channel_type: "telegram", enabled: telegramEnabled, target: telegramChat }, { onConflict: "user_id,channel_type,target" });
    await replaceRules("deadline_reminder", parseLeadList(deadlineLeads, [1440, 180, 60]));
    await replaceRules("schedule_reminder", parseLeadList(scheduleLeads, [15]));
    await replaceRules("cycle_reminder", parseLeadList(cycleLead, [180]));
    await replaceRules("countdown_reminder", parseLeadList(countdownLead, [60]));
    await replaceTimedRule("daily_brief", dailyTime);
    await replaceTimedRule("evening_review", eveningTime);
    await replaceTimedRule("weekly_review", weeklyTime, [Number(weeklyDay)]);
    setMessage("Saved. External worker will use these channels and rules.");
    await loadLogs();
  }

  async function testEmail() {
    setMessage("Sending test email...");
    const response = await fetch("/api/notifications/test", { method: "POST", body: JSON.stringify({ to: targetEmail }) });
    setMessage(await response.text()); await loadLogs();
  }
  async function testTelegram() {
    setMessage("Sending test Telegram...");
    const response = await fetch("/api/notifications/test-telegram", { method: "POST", body: JSON.stringify({ chatId: telegramChat }) });
    setMessage(await response.text()); await loadLogs();
  }
  async function manualRun() {
    setMessage("Running worker once...");
    const response = await fetch(`/api/notifications/check?secret=${encodeURIComponent(prompt("CRON_SECRET") || "")}`);
    setMessage(await response.text()); await loadLogs();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[460px,1fr]">
      <div className="space-y-5">
        <div className="life-card-strong h-fit p-5">
          <h2 className="text-xl font-black">Channels</h2>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={emailEnabled} onChange={(e)=>setEmailEnabled(e.target.checked)}/> Email enabled</label>
            <label className="block text-sm text-white/55">Email target<input className="life-input mt-1" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} /></label>
            <label className="flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={telegramEnabled} onChange={(e)=>setTelegramEnabled(e.target.checked)}/> Telegram enabled</label>
            <label className="block text-sm text-white/55">Telegram chat ID<input className="life-input mt-1" value={telegramChat} onChange={(e) => setTelegramChat(e.target.value)} placeholder="e.g. 123456789" /></label>
          </div>
        </div>

        <div className="life-card-strong h-fit p-5">
          <h2 className="text-xl font-black">Rules</h2>
          <p className="mt-1 text-sm text-white/48">Lead minutes через запятую. 1440 = 24h, 180 = 3h, 60 = 1h.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-white/55">Deadline reminders<input className="life-input mt-1" value={deadlineLeads} onChange={(e) => setDeadlineLeads(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Schedule reminders<input className="life-input mt-1" value={scheduleLeads} onChange={(e) => setScheduleLeads(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Cycle ending reminder<input className="life-input mt-1" value={cycleLead} onChange={(e) => setCycleLead(e.target.value)} /></label>
            <label className="block text-sm text-white/55">Countdown reminder<input className="life-input mt-1" value={countdownLead} onChange={(e) => setCountdownLead(e.target.value)} /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-sm text-white/55">Daily brief<input className="life-input mt-1" type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} /></label><label className="block text-sm text-white/55">Evening review<input className="life-input mt-1" type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="block text-sm text-white/55">Weekly review<input className="life-input mt-1" type="time" value={weeklyTime} onChange={(e) => setWeeklyTime(e.target.value)} /></label><label className="block text-sm text-white/55">Weekly day<select className="life-input mt-1" value={weeklyDay} onChange={(e)=>setWeeklyDay(e.target.value)}><option value="0">Monday</option><option value="1">Tuesday</option><option value="2">Wednesday</option><option value="3">Thursday</option><option value="4">Friday</option><option value="5">Saturday</option><option value="6">Sunday</option></select></label></div>
            <button className="life-button w-full" onClick={save}>Save notification rules</button>
            <div className="grid grid-cols-2 gap-2"><button className="life-button secondary" onClick={testEmail}>Test email</button><button className="life-button secondary" onClick={testTelegram}>Test Telegram</button></div>
            <button className="life-button warn w-full" onClick={manualRun}>Manual worker run</button>
            {message && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">{message}</div>}
          </div>
        </div>

        <div className="life-card p-5">
          <h2 className="text-xl font-black">Worker status</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">Vercel cron отключён. Используй GitHub Actions / Render / Supabase Cron, который вызывает endpoint.</p>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/58"><b>Endpoint</b><div className="break-all">{workerUrl}</div></div>
        </div>
      </div>

      <div className="life-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Last notifications</h2><p className="mt-1 text-sm text-white/45">sent/failed/skipped после запуска worker.</p></div><button className="life-button secondary" onClick={loadLogs}>Refresh log</button></div>
        <div className="mt-4 overflow-x-auto"><table className="life-table"><thead><tr><th>Time</th><th>Status</th><th>Title</th><th>Channel</th><th>Source</th></tr></thead><tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.sent_at).toLocaleString("ru-RU")}</td><td>{l.status}</td><td>{l.title}</td><td>{l.channel_type}</td><td>{l.source_type}</td></tr>)}</tbody></table>{!logs.length && <div className="py-10 text-center text-white/45">No notification log yet.</div>}</div>
      </div>
    </div>
  );
}
