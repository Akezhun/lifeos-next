"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { clearOfflineQueue, exportOfflineQueue, getOfflineQueue } from "@/lib/offlineQueue";
import { syncOfflineQueue } from "@/lib/offlineSync";
import { Cloud, CloudOff, Download, FileUp, GitBranch, HeartPulse, LogOut, RefreshCw, Save, Send, Shield, Trash2, UserRound } from "lucide-react";

const defaultSettings: any = {
  language: "ru", theme: "dark", timezone: "Asia/Almaty", week_start: "monday", time_format: "24h", start_page: "/", compact_mode: false,
  tracker_prefs: { default_type: "gray", default_priority: "mid", progress_range: 90, show_progress_maps: true, confirm_delete: true },
  journal_prefs: { default_type: "Diary", autosave: true, autosave_interval: 20, focus_width: "wide", show_mood_energy: true, show_word_count: true },
  schedule_prefs: { visible_start: "06:00", visible_end: "23:00", default_duration: 60, snap_minutes: 15, show_weekends: true, overlap_warnings: true, default_reminder: 15 },
  analytics_prefs: { default_range: 90, show_ds_mode: true, show_progress_maps: true, show_tag_analytics: true },
  notification_prefs: { email: true, telegram: false, daily_brief: true, evening_review: false, weekly_review: false, quiet_start: "23:00", quiet_end: "07:00" },
  media_prefs: { url_previews: true, youtube: true, spotify: true, images: true, attachments: false },
  obsidian_prefs: { enabled: true, auto_export: true, preserve_workspace: true, export_trackers: true, export_journals: true, export_schedule: true, export_analytics: true, export_tags: true },
  personal_tools_enabled: false,
  feature_flags: { personal_tools: false, obsidian_sync: false, admin_panel: false, experimental_features: false },
  integration_prefs: { obsidian_repo: "", obsidian_branch: "main", obsidian_root: "LifeOS", telegram_enabled: false, email_enabled: true }
};

const tables = ["settings","user_profiles","trackers","tracker_events","tracker_notes","journals","journal_entries","journal_sections","schedule_tokens","schedule_rules","schedule_exceptions","tags","object_tags","notification_channels","notification_rules","notification_log","media_items","obsidian_files","obsidian_sync_log","workspace_invites","sync_audit_log"];

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="V14: финальная панель управления. Аккаунт, backup, offline/local-first, уведомления и Obsidian живут здесь.">
      <AuthGate>{(user) => <Suspense fallback={<div className="life-card p-5">Загрузка настроек...</div>}><Settings user={user} /></Suspense>}</AuthGate>
    </AppShell>
  );
}

function Settings({ user }: { user: any }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const search = useSearchParams();
  const [tab, setTab] = useState(search.get("tab") || "general");
  const [s, setS] = useState<any>(defaultSettings);
  const [profile, setProfile] = useState<any>({ display_name: "", onboarding_done: false, role: "user", workspace_name: "My LifeOS", feature_flags: {} });
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<any[]>([]);
  const [backupText, setBackupText] = useState("");
  const [notificationLog, setNotificationLog] = useState<any[]>([]);
  const [obsidianLog, setObsidianLog] = useState<any[]>([]);
  const [obsidianResult, setObsidianResult] = useState<any>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [invites, setInvites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const refresh = () => { setOnline(typeof navigator === "undefined" ? true : navigator.onLine); setOfflineCount(getOfflineQueue(user.id).length); };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("lifeos-offline-queue-changed", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); window.removeEventListener("lifeos-offline-queue-changed", refresh); };
  }, [user.id]);

  async function load() {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) await fetch("/api/auth/complete-profile", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ language: "ru", timezone: "Asia/Almaty" }) }).catch(()=>null);
    const { data: settings } = await sb.from("settings").select("*").eq("user_id", user.id).maybeSingle();
    if (settings) setS(mergeSettings(settings));
    else await sb.from("settings").upsert({ user_id: user.id, ...defaultSettings }, { onConflict: "user_id" });
    const { data: prof } = await sb.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (prof) { setProfile(prof); if (prof.role === "owner" || prof.role === "admin") await loadAdminData(); }
    else await sb.from("user_profiles").upsert({ user_id: user.id, display_name: user.email?.split("@")[0] || "", language: "ru", role: "user", workspace_name: "My LifeOS" }, { onConflict: "user_id" });
    const app = await fetch("/api/app/status").then(r=>r.json()).catch(()=>null);
    setStatus(app);
    await Promise.all([runHealthCheck(false), loadLogs()]);
  }

  async function loadAdminData() {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const headers = { authorization: `Bearer ${token}` };
    const [inviteRes, userRes] = await Promise.all([
      fetch("/api/admin/invites", { headers }).then(r=>r.json()).catch(()=>({ ok:false, invites: [] })),
      fetch("/api/admin/users", { headers }).then(r=>r.json()).catch(()=>({ ok:false, users: [] }))
    ]);
    if (inviteRes.ok) setInvites(inviteRes.invites || []);
    if (userRes.ok) setUsers(userRes.users || []);
  }

  async function createInvite() {
    setMessage("Creating invite...");
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setMessage("No session token.");
    const res = await fetch("/api/admin/invites", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: inviteEmail || null, role: inviteRole }) }).then(r=>r.json()).catch((e)=>({ ok:false, error:String(e) }));
    setMessage(res.ok ? `Invite created: ${res.invite.invite_code}` : (res.error || "Invite failed"));
    await loadAdminData();
  }

  async function revokeInvite(id: string) {
    setMessage("Revoking invite...");
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setMessage("No session token.");
    const res = await fetch("/api/admin/invites", { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status: "revoked" }) }).then(r=>r.json()).catch((e)=>({ ok:false, error:String(e) }));
    setMessage(res.ok ? "Invite revoked." : (res.error || "Revoke failed"));
    await loadAdminData();
  }

  async function loadLogs() {
    const [{ data: nlog }, { data: olog }] = await Promise.all([
      sb.from("notification_log").select("*").eq("user_id", user.id).order("sent_at", { ascending: false }).limit(10),
      sb.from("obsidian_sync_log").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
    ]);
    setNotificationLog(nlog || []);
    setObsidianLog(olog || []);
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
      media_prefs: { ...defaultSettings.media_prefs, ...(row.media_prefs || {}) },
      obsidian_prefs: { ...defaultSettings.obsidian_prefs, ...(row.obsidian_prefs || {}) },
      feature_flags: { ...defaultSettings.feature_flags, ...(row.feature_flags || {}) },
      integration_prefs: { ...defaultSettings.integration_prefs, ...(row.integration_prefs || {}) }
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
      obsidian_prefs: s.obsidian_prefs,
      feature_flags: s.feature_flags,
      integration_prefs: s.integration_prefs,
      personal_tools_enabled: s.personal_tools_enabled
    };
    const { error } = await sb.from("settings").upsert(payload, { onConflict: "user_id" });
    const { error: pError } = await sb.from("user_profiles").upsert({ user_id: user.id, display_name: profile.display_name, language: s.language, onboarding_done: profile.onboarding_done, workspace_name: profile.workspace_name || "My LifeOS" }, { onConflict: "user_id" });
    setMessage(error?.message || pError?.message || "Saved");
    document.documentElement.dataset.compact = s.compact_mode ? "true" : "false";
    document.documentElement.dataset.theme = s.theme || "dark";
  }

  async function signOut() { await sb.auth.signOut(); window.location.href = "/auth"; }
  async function resetPassword() {
    const { error } = await sb.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + "/auth" });
    setMessage(error?.message || "Password reset email requested.");
  }

  async function testEmail() {
    setMessage("Sending test email...");
    const res = await fetch("/api/notifications/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: user.email }) }).then(r=>r.json()).catch((e)=>({ ok:false, message:String(e) }));
    setMessage(res.ok ? "Test email sent." : (res.message || res.error || "Email test failed."));
  }
  async function testTelegram() {
    setMessage("Sending test Telegram...");
    const res = await fetch("/api/notifications/test-telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }).then(r=>r.json()).catch((e)=>({ ok:false, message:String(e) }));
    setMessage(res.ok ? "Test Telegram sent." : (res.message || res.error || "Telegram test failed."));
  }
  async function exportObsidian() {
    setMessage("Exporting Obsidian mirror...");
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/obsidian/export", { method: "POST", headers: { authorization: `Bearer ${token}` } }).then(r=>r.json()).catch((e)=>({ ok:false, error:String(e) }));
    setObsidianResult(res);
    setMessage(res.ok ? `Obsidian export finished: ${res.total - res.failed - res.skipped}/${res.total} files.` : (res.error || "Obsidian export failed."));
    await loadLogs();
  }

  async function exportAll() {
    setMessage("Exporting...");
    const dump: any = { version: "V14", exported_at: new Date().toISOString(), user: { id: user.id, email: user.email }, tables: {} };
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
    const order = ["settings","user_profiles","trackers","tracker_events","tracker_notes","journals","journal_entries","journal_sections","schedule_tokens","schedule_rules","schedule_exceptions","tags","object_tags","notification_channels","notification_rules","media_items","obsidian_files","obsidian_sync_log","workspace_invites","sync_audit_log"];
    for (const table of order) {
      const rows = dump.tables[table];
      if (!Array.isArray(rows) || !rows.length) continue;
      const clean = rows.map((r:any)=>({ ...r, user_id: user.id }));
      await sb.from(table).upsert(clean);
    }
    setMessage("Import finished. Reloading...");
    await load();
  }

  async function syncOfflineNow() {
    setMessage("Syncing offline queue...");
    const res = await syncOfflineQueue(sb, user.id);
    setOfflineCount(getOfflineQueue(user.id).length);
    setMessage(res.offline ? "Still offline. Queue is safe on this device." : `Synced ${res.synced}; ${res.remaining} pending.`);
  }

  function exportOffline() {
    downloadText(`lifeos-offline-queue-${new Date().toISOString().slice(0,10)}.json`, exportOfflineQueue(user.id));
    setMessage("Offline queue exported.");
  }

  function clearOffline() {
    if (!confirm("Clear local offline queue on this device?")) return;
    clearOfflineQueue(user.id);
    setOfflineCount(0);
    setMessage("Local offline queue cleared.");
  }

  async function resetWorkspace() {
    if (!confirm("Reset your LifeOS workspace? This deletes your trackers, journals, schedule, tags, logs and media for this user.")) return;
    setMessage("Resetting workspace...");
    const order = ["object_tags","tags","media_items","obsidian_sync_log","obsidian_files","notification_log","notification_rules","notification_channels","schedule_exceptions","schedule_rules","schedule_tokens","journal_sections","journal_entries","journals","tracker_notes","tracker_events","trackers"];
    for (const table of order) await sb.from(table).delete().eq("user_id", user.id);
    clearOfflineQueue(user.id);
    setMessage("Workspace reset finished. Reload the app.");
  }

  async function runHealthCheck(showMessage = true) {
    const checks:any[] = [];
    const [{data: trackers},{data: entries},{data: journals},{data: tokens},{data: objectTags},{data: tags},{data: media},{data: obsFiles}] = await Promise.all([
      sb.from("trackers").select("id,title,type,deadline_at,created_at").eq("user_id", user.id),
      sb.from("journal_entries").select("id,title,journal_id,word_count").eq("user_id", user.id),
      sb.from("journals").select("id,title").eq("user_id", user.id),
      sb.from("schedule_tokens").select("id,title,start_at,end_at,linked_tracker_id,linked_journal_entry_id").eq("user_id", user.id),
      sb.from("object_tags").select("id,tag_id,object_type,object_id").eq("user_id", user.id),
      sb.from("tags").select("id,name").eq("user_id", user.id),
      sb.from("media_items").select("id,title,url,object_type,object_id").eq("user_id", user.id),
      sb.from("obsidian_files").select("id,path,conflict_status").eq("user_id", user.id)
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
    checks.push(check("Broken tag references", (objectTags||[]).some((ot:any)=>!tagIds.has(ot.tag_id)) ? "bad" : "ok", `${objectTags?.length || 0} object_tags`));
    checks.push(check("Media links", (media||[]).some((m:any)=>!String(m.url||"").startsWith("http")) ? "warn" : "ok", `${media?.length || 0} attached media links`));
    checks.push(check("Obsidian mirror files", (obsFiles||[]).some((f:any)=>f.conflict_status && f.conflict_status !== "clean") ? "warn" : "ok", `${obsFiles?.length || 0} tracked markdown files`));
    checks.push(check("RLS / user isolation", "ok", "Client queries filter by current user_id; Supabase RLS policies should also be enabled from migrations."));
    checks.push(check("Offline queue", getOfflineQueue(user.id).length ? "warn" : "ok", `${getOfflineQueue(user.id).length} local operations pending on this device`));
    setHealth(checks);
    if (showMessage) setMessage("Data health check refreshed.");
  }

  const tabs = [
    ["general","General"], ["modules","Modules"], ["integrations","Integrations"], ["account","Account"], ["offline","Offline & Sync"], ["backup","Backup"], ["health","Health"], ["system","System"]
  ];

  return <div className="space-y-5">
    <div className="life-card p-3"><div className="flex flex-wrap gap-2">{tabs.map(([id,label])=><button key={id} className={`life-tab ${tab === id ? "active" : ""}`} onClick={()=>setTab(id)}>{label}</button>)}</div></div>
    {message && <div className="life-card border-violet-300/20 p-4 text-sm text-violet-100">{message}</div>}

    {tab === "general" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="General"><Select label="Language" value={s.language} onChange={(v:any)=>setField('language',v)} options={[["ru","Русский"],["en","English"]]}/><Select label="Theme" value={s.theme} onChange={(v:any)=>setField('theme',v)} options={[["dark","dark"],["light","light"],["system","system"]]}/><Input label="Timezone" value={s.timezone} onChange={(v:any)=>setField('timezone',v)} /><Select label="Week start" value={s.week_start} onChange={(v:any)=>setField('week_start',v)} options={[["monday","Monday"],["sunday","Sunday"]]}/><Select label="Time format" value={s.time_format} onChange={(v:any)=>setField('time_format',v)} options={[["24h","24h"],["12h","12h"]]}/><Select label="Start page" value={s.start_page} onChange={(v:any)=>setField('start_page',v)} options={[["/","Home"],["/trackers","Trackers"],["/journals","Journals"],["/schedule","Schedule"],["/analytics","Analytics"]]}/><Check label="Compact mode" checked={!!s.compact_mode} onChange={(v:any)=>setField('compact_mode',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Profile"><Input label="Display name" value={profile.display_name || ""} onChange={(v:any)=>setProfile({...profile, display_name:v})}/><Check label="Onboarding done" checked={!!profile.onboarding_done} onChange={(v:any)=>setProfile({...profile,onboarding_done:v})}/><SaveButton save={save}/></Panel>
    </div>}

    {tab === "modules" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Tracker preferences"><Select label="Default tracker type" value={s.tracker_prefs.default_type} onChange={(v:any)=>setPref('tracker_prefs','default_type',v)} options={[["gray","gray"],["deadline","deadline"],["cycle","cycle"],["countdown","countdown"]]}/><Select label="Default priority" value={s.tracker_prefs.default_priority} onChange={(v:any)=>setPref('tracker_prefs','default_priority',v)} options={[["low","low"],["mid","mid"],["high","high"]]}/><Input label="Progress map range, days" value={String(s.tracker_prefs.progress_range)} onChange={(v:any)=>setPref('tracker_prefs','progress_range',Number(v)||90)} type="number"/><Check label="Show progress maps" checked={!!s.tracker_prefs.show_progress_maps} onChange={(v:any)=>setPref('tracker_prefs','show_progress_maps',v)}/><Check label="Confirm before delete" checked={!!s.tracker_prefs.confirm_delete} onChange={(v:any)=>setPref('tracker_prefs','confirm_delete',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Journal preferences"><Select label="Default entry type" value={s.journal_prefs.default_type} onChange={(v:any)=>setPref('journal_prefs','default_type',v)} options={[["Diary","Diary"],["Essay/Academic","Essay/Academic"],["Project","Project"],["Learning","Learning"],["Draft","Draft"]]}/><Check label="Autosave" checked={!!s.journal_prefs.autosave} onChange={(v:any)=>setPref('journal_prefs','autosave',v)}/><Input label="Autosave interval, seconds" value={String(s.journal_prefs.autosave_interval)} onChange={(v:any)=>setPref('journal_prefs','autosave_interval',Number(v)||20)} type="number"/><Select label="Focus writer width" value={s.journal_prefs.focus_width} onChange={(v:any)=>setPref('journal_prefs','focus_width',v)} options={[["normal","Normal"],["wide","Wide"],["full","Full"]]}/><Check label="Show mood/energy" checked={!!s.journal_prefs.show_mood_energy} onChange={(v:any)=>setPref('journal_prefs','show_mood_energy',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Schedule preferences"><Input label="Visible start" value={s.schedule_prefs.visible_start} onChange={(v:any)=>setPref('schedule_prefs','visible_start',v)} type="time"/><Input label="Visible end" value={s.schedule_prefs.visible_end} onChange={(v:any)=>setPref('schedule_prefs','visible_end',v)} type="time"/><Input label="Default duration, minutes" value={String(s.schedule_prefs.default_duration)} onChange={(v:any)=>setPref('schedule_prefs','default_duration',Number(v)||60)} type="number"/><Input label="Snap interval, minutes" value={String(s.schedule_prefs.snap_minutes)} onChange={(v:any)=>setPref('schedule_prefs','snap_minutes',Number(v)||15)} type="number"/><Check label="Show weekends" checked={!!s.schedule_prefs.show_weekends} onChange={(v:any)=>setPref('schedule_prefs','show_weekends',v)}/><Check label="Overlap warnings" checked={!!s.schedule_prefs.overlap_warnings} onChange={(v:any)=>setPref('schedule_prefs','overlap_warnings',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Analytics preferences"><Input label="Analytics default range" value={String(s.analytics_prefs.default_range)} onChange={(v:any)=>setPref('analytics_prefs','default_range',Number(v)||90)} type="number"/><Check label="Show Data Science mode" checked={!!s.analytics_prefs.show_ds_mode} onChange={(v:any)=>setPref('analytics_prefs','show_ds_mode',v)}/><Check label="Show Tag analytics" checked={!!s.analytics_prefs.show_tag_analytics} onChange={(v:any)=>setPref('analytics_prefs','show_tag_analytics',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Media rendering"><p className="mb-4 text-sm leading-6 text-white/55">Media is not a separate library anymore. It renders inside Journal text and linked objects.</p><Check label="URL previews" checked={!!s.media_prefs.url_previews} onChange={(v:any)=>setPref('media_prefs','url_previews',v)}/><Check label="Image previews" checked={!!s.media_prefs.images} onChange={(v:any)=>setPref('media_prefs','images',v)}/><Check label="YouTube cards" checked={!!s.media_prefs.youtube} onChange={(v:any)=>setPref('media_prefs','youtube',v)}/><Check label="Spotify/Apple Music cards" checked={!!s.media_prefs.spotify} onChange={(v:any)=>setPref('media_prefs','spotify',v)}/><Check label="Attachments" checked={!!s.media_prefs.attachments} onChange={(v:any)=>setPref('media_prefs','attachments',v)}/><SaveButton save={save}/></Panel>
      <Panel title="Feature flags"><p className="mb-4 text-sm leading-6 text-white/55">LifeOS is always multi-user. Extra personal/admin functions are enabled per user, not as a separate app.</p><Check label="Personal Tools" checked={!!s.feature_flags.personal_tools} onChange={(v:any)=>setPref('feature_flags','personal_tools',v)}/><Check label="Obsidian Sync" checked={!!s.feature_flags.obsidian_sync} onChange={(v:any)=>setPref('feature_flags','obsidian_sync',v)}/><Check label="Admin panel" checked={!!s.feature_flags.admin_panel} onChange={(v:any)=>setPref('feature_flags','admin_panel',v)}/><Check label="Experimental features" checked={!!s.feature_flags.experimental_features} onChange={(v:any)=>setPref('feature_flags','experimental_features',v)}/><SaveButton save={save}/></Panel>
    </div>}

    {tab === "integrations" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Notification preferences"><div className="grid gap-3 md:grid-cols-2"><Check label="Email enabled" checked={!!s.notification_prefs.email} onChange={(v:any)=>setPref('notification_prefs','email',v)}/><Check label="Telegram enabled" checked={!!s.notification_prefs.telegram} onChange={(v:any)=>setPref('notification_prefs','telegram',v)}/><Check label="Daily brief" checked={!!s.notification_prefs.daily_brief} onChange={(v:any)=>setPref('notification_prefs','daily_brief',v)}/><Check label="Evening review" checked={!!s.notification_prefs.evening_review} onChange={(v:any)=>setPref('notification_prefs','evening_review',v)}/><Check label="Weekly review" checked={!!s.notification_prefs.weekly_review} onChange={(v:any)=>setPref('notification_prefs','weekly_review',v)}/><Input label="Quiet start" type="time" value={s.notification_prefs.quiet_start} onChange={(v:any)=>setPref('notification_prefs','quiet_start',v)}/><Input label="Quiet end" type="time" value={s.notification_prefs.quiet_end} onChange={(v:any)=>setPref('notification_prefs','quiet_end',v)}/></div><div className="mt-4 flex flex-wrap gap-2"><button className="life-button secondary" onClick={testEmail}><Send size={16} className="inline"/> Test email</button><button className="life-button secondary" onClick={testTelegram}><Send size={16} className="inline"/> Test Telegram</button><button className="life-button" onClick={save}><Save size={16} className="inline"/> Save settings</button></div><LogList title="Last notifications" rows={notificationLog} timeKey="sent_at"/></Panel>
      <Panel title="Obsidian Sync 2.0"><p className="mb-4 text-sm leading-6 text-white/58">Supabase is the main database. Obsidian is now a Markdown mirror in GitHub Vault. Export is manual here before we add safer automation.</p><div className="grid gap-3 md:grid-cols-2"><Check label="Export trackers" checked={!!s.obsidian_prefs.export_trackers} onChange={(v:any)=>setPref('obsidian_prefs','export_trackers',v)}/><Check label="Export journals" checked={!!s.obsidian_prefs.export_journals} onChange={(v:any)=>setPref('obsidian_prefs','export_journals',v)}/><Check label="Export schedule" checked={!!s.obsidian_prefs.export_schedule} onChange={(v:any)=>setPref('obsidian_prefs','export_schedule',v)}/><Check label="Export analytics" checked={!!s.obsidian_prefs.export_analytics} onChange={(v:any)=>setPref('obsidian_prefs','export_analytics',v)}/><Check label="Export tags" checked={!!s.obsidian_prefs.export_tags} onChange={(v:any)=>setPref('obsidian_prefs','export_tags',v)}/><Check label="Auto export after changes" checked={!!s.obsidian_prefs.auto_export} onChange={(v:any)=>setPref('obsidian_prefs','auto_export',v)}/><Check label="Preserve workspace blocks" checked={!!s.obsidian_prefs.preserve_workspace} onChange={(v:any)=>setPref('obsidian_prefs','preserve_workspace',v)}/></div><div className="mt-4 flex flex-wrap gap-2"><button className="life-button" onClick={exportObsidian}><GitBranch size={16} className="inline"/> Manual export to GitHub Vault</button><button className="life-button secondary" onClick={save}><Save size={16} className="inline"/> Save settings</button></div>{obsidianResult && <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">{JSON.stringify(obsidianResult, null, 2)}</pre>}<LogList title="Obsidian sync log" rows={obsidianLog} timeKey="created_at"/></Panel>
    </div>}

    {tab === "account" && <div className="grid gap-5 xl:grid-cols-2"><Panel title="Account"><div className="space-y-3 text-sm text-white/65"><div className="flex items-center gap-2"><UserRound size={16}/> {user.email}</div><div className="break-all text-white/42">User ID: {user.id}</div><div>Role: <b>{profile.role || "user"}</b></div><div>Workspace: {profile.workspace_name || "My LifeOS"}</div><div>Signup mode: {status?.signupMode || (status?.publicSignup ? "public" : "invite/private")}</div><div>Session: stays on this device until manual logout / browser data reset.</div></div><div className="mt-4 grid gap-3"><Input label="Workspace name" value={profile.workspace_name || ""} onChange={(v:any)=>setProfile({...profile, workspace_name:v})}/><Input label="Display name" value={profile.display_name || ""} onChange={(v:any)=>setProfile({...profile, display_name:v})}/></div><div className="mt-4 flex flex-wrap gap-2"><button className="life-button secondary" onClick={resetPassword}>Send password reset</button><button className="life-button" onClick={save}><Save size={16} className="inline"/> Save profile</button><button className="life-button danger" onClick={signOut}><LogOut size={16} className="inline"/> Logout</button></div></Panel><Panel title="True multi-user mode"><p className="text-sm leading-6 text-white/60">LifeOS теперь всегда multi-user. Ты не отдельная личная версия, а owner-user с расширенными feature flags. У каждого пользователя отдельный workspace, настройки, уведомления, offline queue и данные.</p><div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">Obsidian, Personal Tools и admin panel включаются per-user. Обычные пользователи их не видят.</div><button className="life-button danger mt-4" onClick={resetWorkspace}><Trash2 size={16} className="inline"/> Reset my workspace</button></Panel>{(profile.role === "owner" || profile.role === "admin") && <Panel title="Owner/admin invites"><p className="mb-4 text-sm leading-6 text-white/55">Создай invite code для другого пользователя. Он получит собственный пустой workspace и не увидит твои данные.</p><div className="grid gap-3 md:grid-cols-2"><Input label="Email optional" value={inviteEmail} onChange={setInviteEmail}/><Select label="Role" value={inviteRole} onChange={setInviteRole} options={[["user","user"],["admin","admin"]]}/></div><button className="life-button mt-4" onClick={createInvite}>Create invite</button><div className="mt-4 max-h-72 space-y-2 overflow-auto">{invites.length ? invites.map((i:any)=><div key={i.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60"><div className="font-black text-white/80">{i.invite_code} · {i.status}</div><div>{i.email || "any email"} · uses {i.use_count}/{i.max_uses} · role {i.role_on_signup}</div><div className="mt-2 flex gap-2"><button className="life-button secondary" onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}/auth?invite=${i.invite_code}`)}>Copy link</button>{i.status === "active" && <button className="life-button danger" onClick={()=>revokeInvite(i.id)}>Revoke</button>}</div></div>) : <div className="rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white/42">No invites yet.</div>}</div></Panel>}{(profile.role === "owner" || profile.role === "admin") && <Panel title="Users"><div className="max-h-80 space-y-2 overflow-auto">{users.length ? users.map((u:any)=><div key={u.id || u.user_id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60"><div className="font-black text-white/80">{u.display_name || u.user_id}</div><div>{u.role} · {u.signup_status} · {u.workspace_name || "workspace"}</div><div className="break-all text-white/35">{u.user_id}</div></div>) : <div className="rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white/42">No users loaded.</div>}</div></Panel>}</div>}

    {tab === "offline" && <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Offline / Local-first"><div className="space-y-3 text-sm text-white/65"><div className="flex items-center gap-2">{online ? <Cloud size={16}/> : <CloudOff size={16}/>} {online ? "Online" : "Offline"}</div><div>Pending local changes on this device: <b>{offlineCount}</b></div><div>Offline supports quick capture, new journal drafts, tracker events and one-time schedule tokens. Existing data remains in Supabase as the source of truth.</div></div><div className="mt-4 flex flex-wrap gap-2"><button className="life-button" onClick={syncOfflineNow}><RefreshCw size={16} className="inline"/> Sync now</button><button className="life-button secondary" onClick={exportOffline}><Download size={16} className="inline"/> Export offline queue</button><button className="life-button danger" onClick={clearOffline}><Trash2 size={16} className="inline"/> Clear local queue</button></div></Panel>
      <Panel title="Conflict policy"><p className="text-sm leading-6 text-white/58">V14 uses safe conflict rules: new offline items are appended, tracker Done/Fail events are replayed, and journal drafts are preserved locally until saved. For real conflicts, keep both versions rather than overwriting text.</p><div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">Phone-first offline is meant for capture and important actions. Heavy editing is still safest when online.</div></Panel>
    </div>}

    {tab === "backup" && <div className="grid gap-5 xl:grid-cols-2"><Panel title="Export backup"><p className="text-sm leading-6 text-white/58">Скачивает все основные таблицы текущего пользователя в один JSON. Делай это перед крупными обновлениями.</p><button className="life-button mt-4" onClick={exportAll}><Download size={16} className="inline"/> Download full backup</button></Panel><Panel title="Import backup"><p className="mb-3 text-sm leading-6 text-white/55">Import is now a utility here, not a main module. Use it only for backup restore or one-time migration.</p><textarea className="life-input min-h-[260px]" placeholder="Paste LifeOS backup JSON here" value={backupText} onChange={(e)=>setBackupText(e.target.value)}/><button className="life-button warn mt-3" onClick={importBackup}><FileUp size={16} className="inline"/> Import pasted backup</button></Panel></div>}

    {tab === "health" && <Panel title="Data Health Check"><div className="mb-4 flex gap-2"><button className="life-button secondary" onClick={()=>runHealthCheck(true)}><RefreshCw size={16} className="inline"/> Refresh</button></div><div className="grid gap-3 md:grid-cols-2">{health.map((h,i)=><div key={i} className={`rounded-2xl border p-4 ${h.status==='ok'?'border-emerald-300/20 bg-emerald-300/8':h.status==='warn'?'border-amber-300/25 bg-amber-300/10':'border-rose-300/25 bg-rose-300/10'}`}><div className="font-black">{h.status==='ok'?'✅':h.status==='warn'?'⚠️':'❌'} {h.name}</div><div className="mt-1 text-sm text-white/55">{h.detail}</div></div>)}</div></Panel>}

    {tab === "system" && <Panel title="System status"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{status && Object.entries(status).map(([k,v])=><div key={k} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[.2em] text-white/35">{k}</div><div className="mt-1 font-black">{String(v)}</div></div>)}</div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58"><Shield size={16} className="mr-1 inline"/> Секреты должны быть только в .env.local и Vercel Environment Variables, не в GitHub.</div><div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58"><HeartPulse size={16} className="mr-1 inline"/> If a utility grows large enough to deserve its own page, it must first prove that it is used daily. Notifications, import, media and Obsidian stay in Settings/context.</div></Panel>}
  </div>;
}

function check(name: string, status: "ok"|"warn"|"bad", detail: string){return {name,status,detail};}
function downloadText(filename: string, text: string) { const blob = new Blob([text], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function Panel({ title, children }: any){return <div className="life-card p-5"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</div>}
function SaveButton({ save }: any){return <button className="life-button mt-4" onClick={save}><Save size={16} className="inline"/> Save settings</button>}
function Input({ label, value, onChange, type="text", placeholder="" }: any){return <label className="block text-sm text-white/55">{label}<input type={type} className="life-input mt-1" value={value ?? ""} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)}/></label>}
function Select({ label, value, onChange, options }: any){return <label className="block text-sm text-white/55">{label}<select className="life-input mt-1" value={value ?? ""} onChange={(e)=>onChange(e.target.value)}>{options.map(([v,l]:any)=><option key={v} value={v}>{l}</option>)}</select></label>}
function Check({ label, checked, onChange }: any){return <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/70"><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/>{label}</label>}
function LogList({ title, rows, timeKey }: any){return <div className="mt-5"><h3 className="mb-2 text-sm font-black uppercase tracking-[.18em] text-white/40">{title}</h3><div className="max-h-72 space-y-2 overflow-auto">{rows?.length ? rows.map((r:any)=><div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55"><div className="font-bold text-white/75">{r.title || r.action || r.dedupe_key || r.path || r.status}</div><div>{r.status} · {r[timeKey]}</div>{r.message && <div className="mt-1">{r.message}</div>}</div>) : <div className="rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white/42">No log yet.</div>}</div></div>}
