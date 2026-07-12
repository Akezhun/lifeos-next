"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { fmtDateTime, loadObjectTags, parseTags, priorityRank, saveObjectTags, successRate, tagsToText, trackerVisualStatus } from "@/lib/lifeos/clientHelpers";
import { Archive, Check, Clock, Edit3, FileText, History, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

type FormState = {
  id?: string;
  title: string;
  type: string;
  priority: string;
  deadline_at: string;
  cycle_type: string;
  countdown_days: number;
  required_confirmations: number;
  tags: string;
};

const emptyForm: FormState = {
  title: "",
  type: "deadline",
  priority: "mid",
  deadline_at: "",
  cycle_type: "daily",
  countdown_days: 1,
  required_confirmations: 1,
  tags: ""
};

function eventStats(events: any[]) {
  const done = events.filter((e) => e.event_type === "done").length;
  const partial = events.filter((e) => e.event_type === "partial_done").length;
  const fail = events.filter((e) => e.event_type === "fail").length;
  return { done, partial, fail, rate: successRate(done + partial, fail) };
}

export default function TrackersPage() {
  return <AppShell title="Life Tracker" subtitle="Полная версия: active/archive, deadline/cycle/countdown, notes, history, tags, done/fail, multi-confirm."><AuthGate>{(user) => <TrackerInner user={user} />}</AuthGate></AppShell>;
}

function TrackerInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [trackers, setTrackers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tagMap, setTagMap] = useState<Map<string, string[]>>(new Map());
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<"active"|"archive">("active");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [panel, setPanel] = useState<"details"|"notes"|"history"|"edit">("details");
  const [noteDraft, setNoteDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: trs }, { data: evs }, { data: nts }] = await Promise.all([
      sb.from("trackers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("tracker_events").select("*").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(800),
      sb.from("tracker_notes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false })
    ]);
    const list = trs || [];
    setTrackers(list);
    setEvents(evs || []);
    const noteObj: Record<string, string> = {};
    for (const n of nts || []) noteObj[(n as any).tracker_id] = (n as any).body || "";
    setNotes(noteObj);
    const map = await loadObjectTags(sb, user.id, "tracker", list.map((t: any) => t.id));
    setTagMap(map);
  }

  const enriched = useMemo(() => {
    return trackers.map((t) => {
      const ev = events.filter((e) => e.tracker_id === t.id);
      const visual = trackerVisualStatus(t, ev);
      const tags = tagMap.get(t.id) || [];
      const stats = eventStats(ev);
      return { ...t, _events: ev, _visual: visual, _tags: tags, _stats: stats };
    }).sort((a,b) => a._visual.order - b._visual.order || priorityRank(b.priority) - priorityRank(a.priority) || a._visual.urgency - b._visual.urgency);
  }, [trackers, events, tagMap]);

  const filtered = enriched.filter((t) => {
    const isArchive = !!t.archived_at || t.status === "archived";
    if (tab === "active" && isArchive) return false;
    if (tab === "archive" && !isArchive) return false;
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    const tf = tagFilter.trim().toLowerCase();
    if (tf && !t._tags.includes(tf)) return false;
    return true;
  });

  const allTags = Array.from(new Set([...tagMap.values()].flat())).sort();

  async function createOrUpdate() {
    if (!form.title.trim()) return;
    const metadata = { required_confirmations: Number(form.required_confirmations || 1) };
    const payload: any = {
      user_id: user.id,
      title: form.title.trim(),
      type: form.type,
      priority: form.priority,
      status: "active",
      deadline_at: form.type === "deadline" && form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
      cycle_type: form.type === "cycle" ? form.cycle_type : null,
      countdown_days: form.type === "countdown" ? Number(form.countdown_days || 1) : null
    };
    let id = form.id;
    if (id) {
      await sb.from("trackers").update(payload).eq("id", id).eq("user_id", user.id);
      await sb.from("tracker_events").insert({ user_id: user.id, tracker_id: id, event_type: "edit", metadata });
    } else {
      const { data, error } = await sb.from("trackers").insert(payload).select("id").single();
      if (error) { setMessage(error.message); return; }
      id = data.id;
      await sb.from("tracker_events").insert({ user_id: user.id, tracker_id: id, event_type: "create", metadata });
    }
    await saveObjectTags(sb, user.id, "tracker", id!, parseTags(form.tags));
    setForm(emptyForm); setPanel("details"); setMessage("Saved"); await loadAll();
  }

  async function trackerAction(t: any, event_type: string, note = "") {
    await sb.from("tracker_events").insert({ user_id: user.id, tracker_id: t.id, event_type, note, metadata: {} });
    await loadAll();
  }

  async function archive(t: any, on = true) {
    await sb.from("trackers").update({ status: on ? "archived" : "active", archived_at: on ? new Date().toISOString() : null }).eq("id", t.id).eq("user_id", user.id);
    await trackerAction(t, on ? "archive" : "restore");
  }

  async function remove(t: any) {
    if (!confirm(`Delete tracker “${t.title}”?`)) return;
    await sb.from("trackers").delete().eq("id", t.id).eq("user_id", user.id);
    if (selected?.id === t.id) setSelected(null);
    await loadAll();
  }

  function startEdit(t: any) {
    setSelected(t); setPanel("edit");
    setForm({
      id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      deadline_at: t.deadline_at ? t.deadline_at.slice(0,16) : "",
      cycle_type: t.cycle_type || "daily",
      countdown_days: t.countdown_days || 1,
      required_confirmations: Number(t.metadata?.required_confirmations || 1),
      tags: tagsToText(t._tags || [])
    });
  }

  async function saveNote() {
    if (!selected) return;
    const { data: existing } = await sb.from("tracker_notes").select("id").eq("user_id", user.id).eq("tracker_id", selected.id).maybeSingle();
    if (existing?.id) await sb.from("tracker_notes").update({ body: noteDraft }).eq("id", existing.id);
    else await sb.from("tracker_notes").insert({ user_id: user.id, tracker_id: selected.id, body: noteDraft });
    await trackerAction(selected, "note_update");
    await loadAll();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-5">
        <div className="life-card p-4 md:p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setTab("active")} className={`life-tab ${tab === "active" ? "active" : ""}`}>Active</button>
            <button onClick={() => setTab("archive")} className={`life-tab ${tab === "archive" ? "active" : ""}`}><Archive size={15} className="inline"/> Archive</button>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trackers..." className="life-input max-w-xs" />
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="life-input max-w-[220px]">
              <option value="">All tags</option>
              {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
          </div>
          <TrackerForm form={form} setForm={setForm} onSubmit={createOrUpdate} onCancel={() => setForm(emptyForm)} editing={!!form.id} />
          {message && <div className="mt-3 text-sm text-white/50">{message}</div>}
        </div>

        <div className="space-y-3">
          {filtered.map((t) => <article key={t.id} onClick={() => { setSelected(t); setPanel("details"); setNoteDraft(notes[t.id] || ""); }} className={`life-card p-4 transition hover:border-violet-300/30 ${selected?.id === t.id ? "ring-2 ring-violet-300/35" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`status-dot status-${t._visual.key}`}></span>
                  <h3 className="truncate text-lg font-black">{t.title}</h3>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/50">
                  <span>{t._visual.label}</span><span>•</span><span>{t.type}</span><span>•</span><span>{t.priority}</span>
                  {t.deadline_at && <><span>•</span><span>{fmtDateTime(t.deadline_at)}</span></>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{t._tags.map((x: string) => <span key={x} className="life-chip">#{x}</span>)}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {tab === "active" ? <>
                  <button onClick={(e) => { e.stopPropagation(); trackerAction(t, "done"); }} className="life-button good px-3 py-2"><Check size={16}/></button>
                  <button onClick={(e) => { e.stopPropagation(); trackerAction(t, "partial_done"); }} className="life-button warn px-3 py-2">½</button>
                  <button onClick={(e) => { e.stopPropagation(); trackerAction(t, "fail"); }} className="life-button danger px-3 py-2"><X size={16}/></button>
                  <button onClick={(e) => { e.stopPropagation(); archive(t, true); }} className="life-button secondary px-3 py-2"><Archive size={16}/></button>
                </> : <button onClick={(e) => { e.stopPropagation(); archive(t, false); }} className="life-button secondary px-3 py-2"><RotateCcw size={16}/></button>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-white/55">
              <div className="rounded-xl bg-white/[.035] p-2"><b className="text-white">{t._stats.done}</b><br/>done</div>
              <div className="rounded-xl bg-white/[.035] p-2"><b className="text-white">{t._stats.partial}</b><br/>partial</div>
              <div className="rounded-xl bg-white/[.035] p-2"><b className="text-white">{t._stats.fail}</b><br/>fail</div>
              <div className="rounded-xl bg-white/[.035] p-2"><b className="text-white">{t._stats.rate}%</b><br/>success</div>
            </div>
          </article>)}
          {!filtered.length && <div className="life-card p-8 text-center text-white/50">No trackers here.</div>}
        </div>
      </section>

      <aside className="life-card-strong sticky top-5 h-fit p-4 md:p-5">
        {!selected ? <div className="text-white/55">Select a tracker to open details, notes, edit and history.</div> : <>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[.24em] text-violet-200/60">selected tracker</div>
              <h2 className="mt-1 text-2xl font-black">{selected.title}</h2>
            </div>
            <button onClick={() => remove(selected)} className="life-button danger px-3"><Trash2 size={16}/></button>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button className={`life-tab ${panel === "details" ? "active" : ""}`} onClick={() => setPanel("details")}>Details</button>
            <button className={`life-tab ${panel === "notes" ? "active" : ""}`} onClick={() => { setPanel("notes"); setNoteDraft(notes[selected.id] || ""); }}><FileText size={14} className="inline"/> Notes</button>
            <button className={`life-tab ${panel === "history" ? "active" : ""}`} onClick={() => setPanel("history")}><History size={14} className="inline"/> History</button>
            <button className={`life-tab ${panel === "edit" ? "active" : ""}`} onClick={() => startEdit(selected)}><Edit3 size={14} className="inline"/> Edit</button>
          </div>
          {panel === "details" && <div className="space-y-3 text-sm text-white/68">
            <div className="rounded-2xl bg-white/[.035] p-3"><b>Status:</b> {selected._visual.label}</div>
            <div className="rounded-2xl bg-white/[.035] p-3"><b>Type:</b> {selected.type}</div>
            <div className="rounded-2xl bg-white/[.035] p-3"><b>Priority:</b> {selected.priority}</div>
            <div className="rounded-2xl bg-white/[.035] p-3"><b>Deadline:</b> {fmtDateTime(selected.deadline_at)}</div>
          </div>}
          {panel === "notes" && <div className="space-y-3">
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="life-input min-h-[360px]" placeholder="Private tracker notes..." />
            <button onClick={saveNote} className="life-button"><Save size={16} className="inline"/> Save notes</button>
          </div>}
          {panel === "history" && <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {(selected._events || []).map((e: any) => <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-3 text-sm">
              <div className="font-bold">{e.event_type}</div>
              <div className="text-xs text-white/45">{fmtDateTime(e.occurred_at)}</div>
              {e.note && <div className="mt-1 text-white/60">{e.note}</div>}
            </div>)}
          </div>}
          {panel === "edit" && <TrackerForm form={form} setForm={setForm} onSubmit={createOrUpdate} onCancel={() => { setForm(emptyForm); setPanel("details"); }} editing />}
        </>}
      </aside>
    </div>
  );
}

function TrackerForm({ form, setForm, onSubmit, onCancel, editing }: { form: FormState; setForm: (v: FormState) => void; onSubmit: () => void; onCancel: () => void; editing?: boolean }) {
  return <div className="grid gap-3 md:grid-cols-12">
    <div className="md:col-span-4"><label className="life-label">Title</label><input className="life-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Read psychology book" /></div>
    <div className="md:col-span-2"><label className="life-label">Type</label><select className="life-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="deadline">deadline</option><option value="cycle">cycle</option><option value="countdown">countdown</option><option value="gray">gray</option></select></div>
    <div className="md:col-span-2"><label className="life-label">Priority</label><select className="life-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="high">high</option><option value="mid">mid</option><option value="low">low</option></select></div>
    {form.type === "deadline" && <div className="md:col-span-4"><label className="life-label">Deadline</label><input type="datetime-local" className="life-input" value={form.deadline_at} onChange={(e) => setForm({ ...form, deadline_at: e.target.value })} /></div>}
    {form.type === "cycle" && <div className="md:col-span-4"><label className="life-label">Cycle</label><select className="life-input" value={form.cycle_type} onChange={(e) => setForm({ ...form, cycle_type: e.target.value })}><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option></select></div>}
    {form.type === "countdown" && <div className="md:col-span-4"><label className="life-label">Countdown days</label><input type="number" min={1} className="life-input" value={form.countdown_days} onChange={(e) => setForm({ ...form, countdown_days: Number(e.target.value) })} /></div>}
    <div className="md:col-span-6"><label className="life-label">Tags</label><input className="life-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="study, psychology" /></div>
    <div className="md:col-span-3"><label className="life-label">Confirmations</label><input type="number" min={1} className="life-input" value={form.required_confirmations} onChange={(e) => setForm({ ...form, required_confirmations: Number(e.target.value) })} /></div>
    <div className="flex items-end gap-2 md:col-span-3"><button onClick={onSubmit} className="life-button w-full"><Plus size={16} className="inline"/> {editing ? "Save" : "Create"}</button>{editing && <button onClick={onCancel} className="life-button secondary">Cancel</button>}</div>
  </div>;
}
