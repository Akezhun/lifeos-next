"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Download, FileUp, HeartPulse, LogOut, RefreshCw, Save, Shield, UserRound } from "lucide-react";

const defaultSettings: any = {
  language: "ru", theme: "dark", timezone: "Asia/Almaty", week_start: "monday", time_format: "24h", start_page: "/", compact_mode: false,
  tracker_prefs: { default_type: "gray", default_priority: "mid", progress_range: 90, show_progress_maps: true, confirm_delete: true },
  journal_prefs: { default_type: "Diary", autosave: true, autosave_interval: 20, focus_width: "wide", show_mood_energy: true, show_word_count: true },
  schedule_prefs: { visible_start: "06:00", visible_end: "23:00", default_duration: 60, snap_minutes: 15, show_weekends: true, overlap_warnings: true, default_reminder: 15 },
  analytics_prefs: { default_range: 90, show_ds_mode: true, show_progress_maps: true, show_tag_analytics: true },
  notification_prefs: { email: true, telegram: false, daily_brief: true, evening_review: false, weekly_review: false, quiet_start: "23:00", quiet_end: "07:00" },
  media_prefs: { url_previews: true, youtube: true, spotify: true, images: true, attachments: false },
  personal_tools_enabled: false
};

const tables = ["settings","user_profiles","trackers","tracker_events","tracker_notes","journals","journal_entries","journal_sections","schedule_tokens","schedule_rules","schedule_exceptions","tags","object_tags","notification_channels","notification_rules","notification_log","media_items"];

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="V12.3–V12.6: язык, тема, аккаунт, backup/export, health check, настройки модулей и media controls.">
      <AuthGate>{(user) => <Settings user={user} />}</AuthGate>
    </AppShell>
  );
}

function Settings({ user }: { user: any }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [tab, setTab] = useState("general");
  const [s, setS] = useState<any>(defaultSettings);
  const [profile, setProfile] = useState<any>({ display_name: "", onboarding_done: false });
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<any[]>([]);
  const [backupText, setBackupText] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: settings } = await sb.from("settings").select("*").eq("user_id", user.id).maybeSingle();
    if (settings) setS(mergeSettings(settings));
    else await sb.from("settings").upsert({ user_id: user.id, ...defaultSettings }, { onConflict: "user_id" });
    const { data: prof } = await sb.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (prof) setProfile(prof);
    else await sb.from("user_profiles").upsert({ user_id: user.id, display_name: user.email?.split("@")[0] || "", language: "ru" }, { onConflict: "user_id" });
    const app = await fetch("/api/app/status").then(r=>r.json()).catch(()=>null);
    setStatus(app);
    await runHealthCheck(false);
  }

  function mergeSettings(row: any) {
    return {
      ...defaultSettings,
      ...row,
      tracker_prefs: { ...defaultSettings.tracker_prefs, ...(row.tracker_prefs || {}) },
      journal_prefs: { ...defaultSettings.journal_prefs, ...(row.journal_prefs || {}) },
      schedule_prefs: { ...defaultSettings.schedule_prefs, ...(row.schedule_prefs || {}) },
      analytics_prefs: { ...defaultSettings.analytics_prefs, ...(row.analytics_prefs || {}) },
      notification_prefs: { ...defaultSettings.notification_prefs, ...(row.notification_prefs || {}) },
      media_prefs: { ...defaultSettings.media_prefs, ...(row.media_prefs || {}) }
    };
  }

  function setField(k: string, v: any) { setS((x:any)=>({ ...x, [k]: v })); }
  function setPref(group: string, k: string, v: any) { setS((x:any)=>({ ...x, [group]: { ...(x[group] || {}), [k]: v } })); }

  async function save() {
    setMessage("Saving...");
    const payload = {
      user_id: user.id,
      language: s.language,
      theme: s.theme,
      timezone: s.timezone,
      week_start: s.week_start,
      time_format: s.time_format,
      start_page: s.start_page,
      compact_mode: s.compact_mode,
      tracker_prefs: s.tracker_prefs,
      journal_prefs: s.journal_prefs,
      schedule_prefs: s.schedule_prefs,
      analytics_prefs: s.analytics_prefs,
      notification_prefs: s.notification_prefs,
      media_prefs: s.media_prefs,
      personal_tools_enabled: s.personal_tools_enabled
    };
    const { error } = await sb.from("settings").upsert(payload, { onConflict: "user_id" });
    const { error: pError } = await sb.from("user_profiles").upsert({ user_id: user.id, display_name: profile.display_name, language: s.language, onboarding_done: profile.onboarding_done }, { onConflict: "user_id" });
    setMessage(error?.message || pError?.message || "Saved. Reload page to apply shell language/theme fully.");
  }

  async function signOut() { await sb.auth.signOut(); window.location.href = "/auth"; }
  async function resetPassword() {
    const { error } = await sb.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + "/auth" });
    setMessage(error?.message || "Password reset email requested.");
  }

  async function exportAll() {
    setMessage("Exporting...");
    const dump: any = { version: "V12.6", exported_at: new Date().toISOString(), user: { id: user.id, email: user.email }, tables: {} };
    for (const table of tables) {
      const { data, error } = await sb.from(table).select("*").eq("user_id", user.id);
      dump.tables[table] = error ? { error: error.message } : (data || []);
    }
    const json = JSON.stringify(dump, null, 2);
    downloadText(`lifeos-backup-${new Date().toISOString().slice(0,10)}.json`, json);
    setBackupText(json);
    setMessage("Backup downloaded.");
  }

  async function importBackup() {
    if (!backupText.trim()) return setMessage("Paste backup JSON first.");
    let dump: any;
    try { dump = JSON.parse(backupText); } catch { return setMessage("Invalid JSON."); }
    if (!dump.tables) return setMessage("This does not look like a LifeOS backup.");
    setMessage("Importing backup. Existing rows with same IDs may be updated.");
    const order = ["settings","user_profiles","trackers","tracker_events","tracker_notes","journals","journal_entries","journal_sections","schedule_tokens","schedule_rules","schedule_exceptions","tags","object_tags","notification_channels","notification_rules","media_items"];
    for (const table of order) {
      const rows = dump.tables[table];
      if (!Array.isArray(rows) || !rows.length) continue;
      const clean = rows.map((r:any)=>({ ...r, user_id: user.id }));
      await sb.from(table).upsert(clean);
    }
    setMessage("Import finished. Reloading...");
    await load();
  }

  async function runHealthCheck(showMessage = true) {
    const checks:any[] = [];
    const [{data: trackers},{data: entries},{data: journals},{data: tokens},{data: objectTags},{data: tags},{data: media}] = await Promise.all([
      sb.from("trackers").select("id,title,type,deadline_at,created_at").eq("user_id", user.id),
      sb.from("journal_entries").select("id,title,journal_id,word_count").eq("user_id", user.id),
      sb.from("journals").select("id,title").eq("user_id", user.id),
      sb.from("schedule_tokens").select("id,title,start_at,end_at,linked_tracker_id,linked_journal_entry_id").eq("user_id", user.id),
      sb.from("object_tags").select("id,tag_id,object_type,object_id").eq("user_id", user.id),
      sb.from("tags").select("id,name").eq("user_id", user.id),
      sb.from("media_items").select("id,title,url,object_type,object_id").eq("user_id", user.id)
    ]);
    const journalIds = new Set((journals||[]).map((j:any)=>j.id));
    const trackerIds = new Set((trackers||[]).map((t:any)=>t.id));
    const entryIds = new Set((entries||[]).map((e:any)=>e.id));
    const tagIds = new Set((tags||[]).map((t:any)=>t.id));
    checks.push(check("Trackers loaded", "ok", `${trackers?.length || 0} trackers`));
    checks.push(check("Journal entries loaded", "ok", `${entries?.length || 0} entries`));
    checks.push(check("Schedule tokens loaded", "ok", `${tokens?.length || 0} tokens`));
    checks.push(check("Deadline trackers without deadline", (trackers||[]).some((t:any)=>t.type === "deadline" && !t.deadline_at) ? "warn" : "ok", "deadline trackers should normally have deadline_at"));
    checks.push(check("Broken journal links", (entries||[]).some((e:any)=>!journalIds.has(e.journal_id)) ? "bad" : "ok", "entries should point to an existing journal"));
    checks.push(check("Broken schedule links", (tokens||[]).some((t:any)=>(t.linked_tracker_id && !trackerIds.has(t.linked_tracker_id)) || (t.linked_journal_entry_id && !entryIds.has(t.linked_journal_entry_id))) ? "warn" : "ok", "tokens may link to trackers/journals"));
    checks.push(check("Empty / duplicate tags", (tags||[]).some((t:any)=>!String(t.name||"").trim()) ? "warn" : "ok", `${tags?.length || 0} tags`));
    checks.push(check("Broken tag references", (objectTags||[]).some((ot:any)=>!tagIds.has(ot.tag_id)) ? "bad" : "ok", `${objectTags?.length || 0} object_tags`));
    checks.push(check("Media links", (media||[]).some((m:any)=>!String(m.url||"").startsWith("http")) ? "warn" : "ok", `${media?.length || 0} media items`));
    setHealth(checks);
    if (showMessage) setMessage("Data health check refreshed.");
  }

  const tabs = [
    ["general","General"], ["modules","Modules"], ["notifications","Notifications"], ["account","Account"], ["backup","Backup"], ["health","Health"], ["system","System"]
  ];

  return <div className="space-y-5">
    <div className="life-card p-3"><div className="flex flex-wrap gap-2">{tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`life-tab ${tab===id?"active":""}`}>{label}</button>)}</div></div>
    {message && <div className="life-card border-violet-300/20 p-4 text-sm text-violet-50/75">{message}</div>}

    {tab === "general" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="App basics"><div className="grid gap-3 md:grid-cols-2">
        <Select label="Language" value={s.language} onChange={(v:any)=>setField("language",v)} options={[['ru','Русский'],['en','English']]}/>
        <Select label="Theme" value={s.theme} onChange={(v:any)=>setField("theme",v)} options={[['dark','Dark'],['light','Light'],['system','System']]}/>
        <Input label="Timezone" value={s.timezone} onChange={(v:any)=>setField("timezone",v)} placeholder="Asia/Almaty"/>
        <Select label="Week starts" value={s.week_start} onChange={(v:any)=>setField("week_start",v)} options={[['monday','Monday'],['sunday','Sunday']]}/>
        <Select label="Time format" value={s.time_format} onChange={(v:any)=>setField("time_format",v)} options={[['24h','24h'],['12h','12h']]}/>
        <Select label="Start page" value={s.start_page} onChange={(v:any)=>setField("start_page",v)} options={[["/","Home"],["/trackers","Trackers"],["/journals","Journals"],["/schedule","Schedule"],["/analytics","Analytics"]]}/>
        <Check label="Compact mode" checked={!!s.compact_mode} onChange={(v:any)=>setField("compact_mode",v)}/>
        <Check label="Personal tools enabled" checked={!!s.personal_tools_enabled} onChange={(v:any)=>setField("personal_tools_enabled",v)}/>
      </div><SaveButton save={save}/></Panel>
      <Panel title="Profile"><Input label="Display name" value={profile.display_name || ""} onChange={(v:any)=>setProfile({...profile, display_name:v})}/><Check label="Onboarding done" checked={!!profile.onboarding_done} onChange={(v:any)=>setProfile({...profile,onboarding_done:v})}/><SaveButton save={save}/></Panel>
    </div>}

    {tab === "modules" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Tracker preferences"><Select label="Default tracker type" value={s.tracker_prefs.default_type} onChange={(v:any)=>setPref('tracker_prefs','default_type',v)} options={[["gray","gray"],["deadline","deadline"],["cycle","cycle"],["countdown","countdown"]]}/><Select label="Default priority" value={s.tracker_prefs.default_priority} onChange={(v:any)=>setPref('tracker_prefs','default_priority',v)} options={[["low","low"],["mid","mid"],["high","high"]]}/><Input label="Progress map range, days" value={String(s.tracker_prefs.progress_range)} onChange={(v:any)=>setPref('tracker_prefs','progress_range',Number(v)||90)} type="number"/><Check label="Show progress maps" checked={!!s.tracker_prefs.show_progress_maps} onChange={(v:any)=>setPref('tracker_prefs','show_progress_maps',v)}/><Check label="Confirm before delete" checked={!!s.tracker_prefs.confirm_delete} onChange={(v:any)=>setPref('tracker_prefs','confirm_delete',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Journal preferences"><Select label="Default entry type" value={s.journal_prefs.default_type} onChange={(v:any)=>setPref('journal_prefs','default_type',v)} options={[["Diary","Diary"],["Essay/Academic","Essay/Academic"],["Project","Project"],["Learning","Learning"],["Draft","Draft"]]}/><Check label="Autosave" checked={!!s.journal_prefs.autosave} onChange={(v:any)=>setPref('journal_prefs','autosave',v)}/><Input label="Autosave interval, seconds" value={String(s.journal_prefs.autosave_interval)} onChange={(v:any)=>setPref('journal_prefs','autosave_interval',Number(v)||20)} type="number"/><Select label="Focus writer width" value={s.journal_prefs.focus_width} onChange={(v:any)=>setPref('journal_prefs','focus_width',v)} options={[["normal","Normal"],["wide","Wide"],["full","Full"]]}/><Check label="Show mood/energy" checked={!!s.journal_prefs.show_mood_energy} onChange={(v:any)=>setPref('journal_prefs','show_mood_energy',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Schedule preferences"><Input label="Visible start" value={s.schedule_prefs.visible_start} onChange={(v:any)=>setPref('schedule_prefs','visible_start',v)} type="time"/><Input label="Visible end" value={s.schedule_prefs.visible_end} onChange={(v:any)=>setPref('schedule_prefs','visible_end',v)} type="time"/><Input label="Default duration, minutes" value={String(s.schedule_prefs.default_duration)} onChange={(v:any)=>setPref('schedule_prefs','default_duration',Number(v)||60)} type="number"/><Input label="Snap interval, minutes" value={String(s.schedule_prefs.snap_minutes)} onChange={(v:any)=>setPref('schedule_prefs','snap_minutes',Number(v)||15)} type="number"/><Check label="Show weekends" checked={!!s.schedule_prefs.show_weekends} onChange={(v:any)=>setPref('schedule_prefs','show_weekends',v)}/><Check label="Overlap warnings" checked={!!s.schedule_prefs.overlap_warnings} onChange={(v:any)=>setPref('schedule_prefs','overlap_warnings',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Analytics & Media preferences"><Input label="Analytics default range" value={String(s.analytics_prefs.default_range)} onChange={(v:any)=>setPref('analytics_prefs','default_range',Number(v)||90)} type="number"/><Check label="Show Data Science mode" checked={!!s.analytics_prefs.show_ds_mode} onChange={(v:any)=>setPref('analytics_prefs','show_ds_mode',v)}/><Check label="URL previews" checked={!!s.media_prefs.url_previews} onChange={(v:any)=>setPref('media_prefs','url_previews',v)}/><Check label="Image previews" checked={!!s.media_prefs.images} onChange={(v:any)=>setPref('media_prefs','images',v)}/><Check label="YouTube cards" checked={!!s.media_prefs.youtube} onChange={(v:any)=>setPref('media_prefs','youtube',v)}/><Check label="Spotify/Apple Music cards" checked={!!s.media_prefs.spotify} onChange={(v:any)=>setPref('media_prefs','spotify',v)}/><SaveButton save={save}/></Panel>
    </div>}

    {tab === "notifications" && <Panel title="Notification preferences"><div className="grid gap-3 md:grid-cols-2"><Check label="Email enabled" checked={!!s.notification_prefs.email} onChange={(v:any)=>setPref('notification_prefs','email',v)}/><Check label="Telegram enabled" checked={!!s.notification_prefs.telegram} onChange={(v:any)=>setPref('notification_prefs','telegram',v)}/><Check label="Daily brief" checked={!!s.notification_prefs.daily_brief} onChange={(v:any)=>setPref('notification_prefs','daily_brief',v)}/><Check label="Evening review" checked={!!s.notification_prefs.evening_review} onChange={(v:any)=>setPref('notification_prefs','evening_review',v)}/><Check label="Weekly review" checked={!!s.notification_prefs.weekly_review} onChange={(v:any)=>setPref('notification_prefs','weekly_review',v)}/><Input label="Quiet start" type="time" value={s.notification_prefs.quiet_start} onChange={(v:any)=>setPref('notification_prefs','quiet_start',v)}/><Input label="Quiet end" type="time" value={s.notification_prefs.quiet_end} onChange={(v:any)=>setPref('notification_prefs','quiet_end',v)}/></div><SaveButton save={save}/><p className="mt-4 text-sm text-white/55">Detailed channels/rules stay on /notifications. Settings stores global preferences.</p></Panel>}

    {tab === "account" && <div className="grid gap-5 xl:grid-cols-2"><Panel title="Account"><div className="space-y-3 text-sm text-white/65"><div className="flex items-center gap-2"><UserRound size={16}/> {user.email}</div><div className="break-all text-white/42">User ID: {user.id}</div><div>Public signup: {status?.publicSignup ? "enabled" : "disabled / hidden"}</div></div><div className="mt-4 flex flex-wrap gap-2"><button className="life-button secondary" onClick={resetPassword}>Send password reset</button><button className="life-button danger" onClick={signOut}><LogOut size={16} className="inline"/> Logout</button></div></Panel><Panel title="Owner / invite mode"><p className="text-sm leading-6 text-white/60">Для личной версии держи <b>ALLOW_PUBLIC_SIGNUP=false</b> в Vercel Environment Variables. В Supabase Auth можно также выключить публичную регистрацию.</p></Panel></div>}

    {tab === "backup" && <div className="grid gap-5 xl:grid-cols-2"><Panel title="Export backup"><p className="text-sm leading-6 text-white/58">Скачивает все основные таблицы текущего пользователя в один JSON. Делай это перед крупными обновлениями.</p><button className="life-button mt-4" onClick={exportAll}><Download size={16} className="inline"/> Download full backup</button></Panel><Panel title="Import backup"><textarea className="life-input min-h-[260px]" placeholder="Paste LifeOS backup JSON here" value={backupText} onChange={(e)=>setBackupText(e.target.value)}/><button className="life-button warn mt-3" onClick={importBackup}><FileUp size={16} className="inline"/> Import pasted backup</button></Panel></div>}

    {tab === "health" && <Panel title="Data Health Check"><div className="mb-4 flex gap-2"><button className="life-button secondary" onClick={()=>runHealthCheck(true)}><RefreshCw size={16} className="inline"/> Refresh</button></div><div className="grid gap-3 md:grid-cols-2">{health.map((h,i)=><div key={i} className={`rounded-2xl border p-4 ${h.status==='ok'?'border-emerald-300/20 bg-emerald-300/8':h.status==='warn'?'border-amber-300/25 bg-amber-300/10':'border-rose-300/25 bg-rose-300/10'}`}><div className="font-black">{h.status==='ok'?'✅':h.status==='warn'?'⚠️':'❌'} {h.name}</div><div className="mt-1 text-sm text-white/55">{h.detail}</div></div>)}</div></Panel>}

    {tab === "system" && <Panel title="System status"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{status && Object.entries(status).map(([k,v])=><div key={k} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[.2em] text-white/35">{k}</div><div className="mt-1 font-black">{String(v)}</div></div>)}</div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58"><Shield size={16} className="mr-1 inline"/> Секреты должны быть только в .env.local и Vercel Environment Variables, не в GitHub.</div></Panel>}
  </div>;
}

function check(name: string, status: "ok"|"warn"|"bad", detail: string){return {name,status,detail};}
function downloadText(filename: string, text: string) { const blob = new Blob([text], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function Panel({ title, children }: any){return <div className="life-card p-5"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</div>}
function SaveButton({ save }: any){return <button className="life-button mt-4" onClick={save}><Save size={16} className="inline"/> Save settings</button>}
function Input({ label, value, onChange, type="text", placeholder="" }: any){return <label className="block text-sm text-white/55">{label}<input type={type} className="life-input mt-1" value={value ?? ""} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)}/></label>}
function Select({ label, value, onChange, options }: any){return <label className="block text-sm text-white/55">{label}<select className="life-input mt-1" value={value ?? ""} onChange={(e)=>onChange(e.target.value)}>{options.map(([v,l]:any)=><option key={v} value={v}>{l}</option>)}</select></label>}
function Check({ label, checked, onChange }: any){return <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/70"><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/>{label}</label>}
