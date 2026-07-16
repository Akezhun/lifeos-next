"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Loader2, NotebookPen, Plus, ShieldCheck, X, Zap } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { enqueueOfflineItem, getOfflineQueue } from "@/lib/offlineQueue";
import { syncOfflineItem, syncOfflineQueue as flushOfflineQueue } from "@/lib/offlineSync";

type Mode = "tracker" | "journal_note" | "schedule_token";

function nowDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("tracker");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(nowDate());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [status, setStatus] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    refreshCount();
    const onChange = () => refreshCount();
    window.addEventListener("lifeos-offline-queue-changed", onChange);
    window.addEventListener("online", () => void syncQueue());
    void syncQueue();
    return () => window.removeEventListener("lifeos-offline-queue-changed", onChange);
  }, []);

  async function getUserId() {
    const sb = createBrowserSupabase();
    const { data } = await sb.auth.getUser();
    return { sb, userId: data.user?.id || null };
  }

  async function refreshCount() {
    try {
      const { userId } = await getUserId();
      if (!userId) return;
      setQueueCount(getOfflineQueue(userId).length);
    } catch {}
  }

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    try {
      const { sb, userId } = await getUserId();
      if (!userId) return;
      setSyncing(true);
      const res = await flushOfflineQueue(sb, userId);
      setStatus(res.synced ? `Offline queue synced (${res.synced})` : "No pending offline changes");
      await refreshCount();
    } catch {
      setStatus("Sync will retry when connection is stable");
    } finally {
      setSyncing(false);
    }
  }

  async function save() {
    const payload = mode === "schedule_token" ? { title, date, start, end } : mode === "journal_note" ? { title: title || "Quick note", body } : { title, type: "gray", priority: "mid" };
    try {
      const { sb, userId } = await getUserId();
      if (!userId) return setStatus("Sign in first");
      if (!navigator.onLine) throw new Error("offline");
      await syncOfflineItem(sb, userId, { id: "direct", createdAt: new Date().toISOString(), kind: mode, payload });
      setStatus("Saved");
      setTitle(""); setBody("");
      window.dispatchEvent(new CustomEvent("lifeos-data-changed"));
      setTimeout(() => setOpen(false), 450);
    } catch {
      const { userId } = await getUserId();
      if (!userId) return;
      enqueueOfflineItem(userId, { kind: mode, payload });
      setStatus("Saved offline. It will sync later.");
      setTitle(""); setBody("");
      await refreshCount();
    }
  }

  const modeMeta = useMemo(() => ({
    tracker: { icon: ShieldCheck, label: "Tracker" },
    journal_note: { icon: NotebookPen, label: "Note" },
    schedule_token: { icon: CalendarPlus, label: "Token" }
  }), []);

  return <>
    <button className="quick-fab" onClick={() => setOpen(true)} aria-label="Quick add"><Plus size={24}/>{queueCount > 0 && <span>{queueCount}</span>}</button>
    {open && <div className="quick-overlay" onClick={() => setOpen(false)}>
      <div className="quick-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><div className="text-xs uppercase tracking-[.2em] text-violet-200/65"><Zap size={14} className="inline"/> Quick capture</div><h2 className="text-2xl font-black">Add without friction</h2></div>
          <button className="life-button ghost" onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {Object.entries(modeMeta).map(([key, meta]) => { const Icon = meta.icon; return <button key={key} className={`quick-mode ${mode === key ? "active" : ""}`} onClick={() => setMode(key as Mode)}><Icon size={17}/>{meta.label}</button>; })}
        </div>
        <div className="grid gap-3">
          <input className="life-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "journal_note" ? "Note title" : mode === "schedule_token" ? "Token title" : "Tracker title"}/>
          {mode === "journal_note" && <textarea className="life-input min-h-32" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write quick note. Offline-safe." />}
          {mode === "schedule_token" && <div className="grid grid-cols-3 gap-2"><input className="life-input" type="date" value={date} onChange={(e)=>setDate(e.target.value)}/><input className="life-input" type="time" value={start} onChange={(e)=>setStart(e.target.value)}/><input className="life-input" type="time" value={end} onChange={(e)=>setEnd(e.target.value)}/></div>}
          <button className="life-button" onClick={save}><CheckCircle2 size={17} className="inline"/> Save quick</button>
          <div className="flex items-center justify-between gap-2 text-xs text-white/48"><span>{status}</span>{queueCount > 0 && <button className="life-badge" onClick={syncQueue}>{syncing ? <Loader2 size={13} className="animate-spin"/> : null} Sync {queueCount}</button>}</div>
        </div>
      </div>
    </div>}
  </>;
}
