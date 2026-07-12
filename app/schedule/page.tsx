"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addDays, addMinutes, fmtDate, fmtDateTime, isoLocalDate, isoLocalDateTime, loadObjectTags, minutesBetween, parseTags, saveObjectTags, startOfWeek, tagsToText } from "@/lib/lifeos/clientHelpers";
import { CalendarDays, Copy, Plus, Save, Trash2 } from "lucide-react";

const hours = Array.from({ length: 19 }, (_, i) => i + 5);
const pxPerMin = 52 / 60;
const daysRu = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Occ = { id: string; baseId: string; kind: "token"|"rule"; title: string; source_type: string; start: Date; end: Date; dateKey: string; recurrence_kind: string; tags: string[]; raw: any; deleted?: boolean; };

export default function SchedulePage() {
  return <AppShell title="Schedule" subtitle="Weekly Token Board: one-time, recurring, permanent, quick move, duplicate, delete scopes, overlap warnings."><AuthGate>{(user) => <ScheduleInner user={user} />}</AuthGate></AppShell>;
}

function ScheduleInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tokens, setTokens] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [tagMap, setTagMap] = useState<Map<string,string[]>>(new Map());
  const [trackers, setTrackers] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [selected, setSelected] = useState<Occ | null>(null);
  const [form, setForm] = useState({ title: "", source_type: "free", recurrence_kind: "one_time", date: isoLocalDate(new Date()), start: "09:00", end: "10:00", weekdays: [] as number[], end_date: "", tags: "", linked_tracker_id: "", linked_journal_entry_id: "" });
  const [edit, setEdit] = useState({ title: "", start: "", end: "", tags: "" });
  const [message, setMessage] = useState("");

  useEffect(() => { loadAll(); }, [weekStart]);

  async function loadAll() {
    const ws = new Date(weekStart); const we = addDays(ws, 7);
    const [{ data: tks }, { data: rls }, { data: exs }, { data: trs }, { data: ens }] = await Promise.all([
      sb.from("schedule_tokens").select("*").eq("user_id", user.id).lt("start_at", we.toISOString()).gt("end_at", ws.toISOString()).order("start_at"),
      sb.from("schedule_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("schedule_exceptions").select("*").eq("user_id", user.id),
      sb.from("trackers").select("id,title").eq("user_id", user.id).order("title"),
      sb.from("journal_entries").select("id,title").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100)
    ]);
    setTokens(tks || []); setRules(rls || []); setExceptions(exs || []); setTrackers(trs || []); setEntries(ens || []);
    const ids = [...(tks || []).map((x:any)=>x.id), ...(rls || []).map((x:any)=>x.id)];
    const tokenTags = await loadObjectTags(sb, user.id, "schedule_token", ids);
    setTagMap(tokenTags);
  }

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const occurrences = useMemo(() => {
    const out: Occ[] = [];
    for (const t of tokens) {
      const st = new Date(t.start_at), en = new Date(t.end_at);
      out.push({ id: `token:${t.id}`, baseId: t.id, kind: "token", title: t.title, source_type: t.source_type, start: st, end: en, dateKey: isoLocalDate(st), recurrence_kind: t.recurrence_kind, tags: tagMap.get(t.id) || [], raw: t });
    }
    for (const r of rules) {
      const startDate = new Date(r.start_date + "T00:00:00");
      const endDate = r.end_date ? new Date(r.end_date + "T23:59:59") : null;
      for (let i=0;i<7;i++) {
        const d = weekDays[i];
        if (d < startDate || (endDate && d > endDate)) continue;
        const wd = (d.getDay()+6)%7;
        if (!Array.isArray(r.weekdays) || !r.weekdays.includes(wd)) continue;
        const dateKey = isoLocalDate(d);
        const ex = exceptions.find((x) => x.rule_id === r.id && x.original_date === dateKey);
        if (ex?.action === "delete") continue;
        const [sh, sm] = String(r.start_time).slice(0,5).split(":").map(Number);
        const [eh, em] = String(r.end_time).slice(0,5).split(":").map(Number);
        let st = new Date(d); st.setHours(sh, sm, 0, 0);
        let en = new Date(d); en.setHours(eh, em, 0, 0);
        if (ex?.action === "move" && ex.moved_start_at && ex.moved_end_at) { st = new Date(ex.moved_start_at); en = new Date(ex.moved_end_at); }
        out.push({ id: `rule:${r.id}:${dateKey}`, baseId: r.id, kind: "rule", title: r.title, source_type: r.source_type, start: st, end: en, dateKey, recurrence_kind: r.recurrence_kind, tags: tagMap.get(r.id) || [], raw: r });
      }
    }
    return out.sort((a,b) => +a.start - +b.start);
  }, [tokens, rules, exceptions, tagMap, weekDays]);

  const overlapWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (let i=0;i<occurrences.length;i++) for (let j=i+1;j<occurrences.length;j++) {
      const a=occurrences[i], b=occurrences[j];
      if (isoLocalDate(a.start) === isoLocalDate(b.start) && a.start < b.end && b.start < a.end) warnings.push(`${fmtDate(a.start)}: ${a.title} overlaps ${b.title}`);
    }
    return warnings.slice(0, 6);
  }, [occurrences]);

  async function createTokenOrRule() {
    if (!form.title.trim()) return;
    const common: any = { user_id: user.id, title: form.title.trim(), source_type: form.source_type, linked_tracker_id: form.linked_tracker_id || null, linked_journal_entry_id: form.linked_journal_entry_id || null, recurrence_kind: form.recurrence_kind };
    let id = "";
    if (form.recurrence_kind === "one_time") {
      const st = new Date(`${form.date}T${form.start}`); const en = new Date(`${form.date}T${form.end}`);
      const { data, error } = await sb.from("schedule_tokens").insert({ ...common, start_at: st.toISOString(), end_at: en.toISOString() }).select("id").single();
      if (error) { setMessage(error.message); return; }
      id = data.id;
    } else {
      const weekdays = form.weekdays.length ? form.weekdays : [(new Date(form.date).getDay()+6)%7];
      const { data, error } = await sb.from("schedule_rules").insert({ ...common, weekdays, start_time: form.start, end_time: form.end, start_date: form.date, end_date: form.recurrence_kind === "recurring" ? (form.end_date || null) : null }).select("id").single();
      if (error) { setMessage(error.message); return; }
      id = data.id;
    }
    await saveObjectTags(sb, user.id, "schedule_token", id, parseTags(form.tags));
    setForm({ ...form, title: "", tags: "" }); setMessage("Saved"); await loadAll();
  }

  function choose(o: Occ) { setSelected(o); setEdit({ title: o.title, start: isoLocalDateTime(o.start), end: isoLocalDateTime(o.end), tags: tagsToText(o.tags) }); }

  async function saveSelected(scope: "this"|"future"|"series" = "this") {
    if (!selected) return;
    const st = new Date(edit.start), en = new Date(edit.end);
    if (selected.kind === "token") {
      await sb.from("schedule_tokens").update({ title: edit.title, start_at: st.toISOString(), end_at: en.toISOString() }).eq("id", selected.baseId).eq("user_id", user.id);
      await saveObjectTags(sb, user.id, "schedule_token", selected.baseId, parseTags(edit.tags));
    } else if (scope === "this") {
      await sb.from("schedule_exceptions").upsert({ user_id: user.id, rule_id: selected.baseId, original_date: selected.dateKey, action: "move", moved_start_at: st.toISOString(), moved_end_at: en.toISOString(), metadata: { title: edit.title } }, { onConflict: "user_id,rule_id,original_date" });
    } else if (scope === "future") {
      const oldEnd = addDays(new Date(selected.dateKey + "T00:00:00"), -1);
      await sb.from("schedule_rules").update({ end_date: isoLocalDate(oldEnd) }).eq("id", selected.baseId).eq("user_id", user.id);
      const weekdays = [((st.getDay()+6)%7)];
      const { data } = await sb.from("schedule_rules").insert({ user_id: user.id, title: edit.title, source_type: selected.source_type, weekdays, start_time: edit.start.slice(11,16), end_time: edit.end.slice(11,16), start_date: isoLocalDate(st), end_date: selected.raw.end_date || null, recurrence_kind: selected.raw.recurrence_kind, linked_tracker_id: selected.raw.linked_tracker_id, linked_journal_entry_id: selected.raw.linked_journal_entry_id }).select("id").single();
      if (data?.id) await saveObjectTags(sb, user.id, "schedule_token", data.id, parseTags(edit.tags));
    } else {
      await sb.from("schedule_rules").update({ title: edit.title, start_time: edit.start.slice(11,16), end_time: edit.end.slice(11,16) }).eq("id", selected.baseId).eq("user_id", user.id);
      await saveObjectTags(sb, user.id, "schedule_token", selected.baseId, parseTags(edit.tags));
    }
    await loadAll();
  }

  async function quickMove(minutes: number) {
    if (!selected) return;
    const st = addMinutes(selected.start, minutes); const en = addMinutes(selected.end, minutes);
    setEdit({ ...edit, start: isoLocalDateTime(st), end: isoLocalDateTime(en) });
  }

  async function duplicateNextWeek() {
    if (!selected) return;
    const st = addDays(selected.start, 7), en = addDays(selected.end, 7);
    const { data } = await sb.from("schedule_tokens").insert({ user_id: user.id, title: selected.title, source_type: selected.source_type, linked_tracker_id: selected.raw.linked_tracker_id || null, linked_journal_entry_id: selected.raw.linked_journal_entry_id || null, start_at: st.toISOString(), end_at: en.toISOString(), recurrence_kind: "one_time" }).select("id").single();
    if (data?.id) await saveObjectTags(sb, user.id, "schedule_token", data.id, selected.tags);
    await loadAll();
  }

  async function deleteSelected(scope: "this"|"future"|"series") {
    if (!selected) return;
    if (!confirm("Delete selected schedule token?")) return;
    if (selected.kind === "token") await sb.from("schedule_tokens").delete().eq("id", selected.baseId).eq("user_id", user.id);
    else if (scope === "this") await sb.from("schedule_exceptions").upsert({ user_id: user.id, rule_id: selected.baseId, original_date: selected.dateKey, action: "delete" }, { onConflict: "user_id,rule_id,original_date" });
    else if (scope === "future") await sb.from("schedule_rules").update({ end_date: isoLocalDate(addDays(new Date(selected.dateKey+"T00:00:00"), -1)) }).eq("id", selected.baseId).eq("user_id", user.id);
    else await sb.from("schedule_rules").delete().eq("id", selected.baseId).eq("user_id", user.id);
    setSelected(null); await loadAll();
  }

  async function copyWeekToNext() {
    const oneTime = occurrences.filter((o) => o.kind === "token");
    for (const o of oneTime) {
      const { data } = await sb.from("schedule_tokens").insert({ user_id: user.id, title: o.title, source_type: o.source_type, linked_tracker_id: o.raw.linked_tracker_id || null, linked_journal_entry_id: o.raw.linked_journal_entry_id || null, start_at: addDays(o.start, 7).toISOString(), end_at: addDays(o.end, 7).toISOString(), recurrence_kind: "one_time" }).select("id").single();
      if (data?.id) await saveObjectTags(sb, user.id, "schedule_token", data.id, o.tags);
    }
    await loadAll(); setMessage("Copied one-time tokens to next week");
  }

  const tokenLibrary = useMemo(() => Array.from(new Map([...tokens, ...rules].map((x:any) => [x.title, x])).values()).slice(0, 12), [tokens, rules]);

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
    <section className="min-w-0 space-y-5">
      <div className="life-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className="life-button secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Previous</button>
            <button className="life-button" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
            <button className="life-button secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
          </div>
          <div className="font-black">{fmtDate(weekStart)} — {fmtDate(addDays(weekStart,6))}</div>
          <button onClick={copyWeekToNext} className="life-button secondary"><Copy size={16} className="inline"/> Copy week +1</button>
        </div>
        {overlapWarnings.length > 0 && <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Overlap warnings:<br/>{overlapWarnings.map((w) => <div key={w}>• {w}</div>)}</div>}
      </div>

      <div className="life-card overflow-auto p-3">
        <div className="schedule-board">
          <div></div>{weekDays.map((d,i)=><div key={i} className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0a16]/90 p-2 text-center font-black"><div>{daysRu[i]}</div><div className="text-xs text-white/45">{fmtDate(d)}</div></div>)}
          <div>{hours.map((h)=><div key={h} className="schedule-hour">{String(h).padStart(2,"0")}:00</div>)}</div>
          {weekDays.map((d,di) => <div key={di} className="schedule-day">
            {hours.map((h,idx)=><div key={h} className="schedule-gridline" style={{ top: idx*52 }} />)}
            {occurrences.filter((o)=>isoLocalDate(o.start)===isoLocalDate(d)).map((o) => {
              const startMin = Math.max(0, (o.start.getHours()-5)*60 + o.start.getMinutes());
              const dur = Math.max(24, minutesBetween(o.start, o.end));
              return <button key={o.id} onClick={() => choose(o)} className={`schedule-token ${o.kind === "rule" ? "rule" : ""} ${selected?.id === o.id ? "selected" : ""}`} style={{ top: startMin*pxPerMin, height: dur*pxPerMin }}>
                <div className="truncate text-left text-xs font-black">{o.title}</div>
                <div className="truncate text-left text-[11px] text-white/65">{o.start.toTimeString().slice(0,5)}–{o.end.toTimeString().slice(0,5)} · {o.recurrence_kind}</div>
                <div className="mt-1 flex flex-wrap gap-1">{o.tags.slice(0,2).map((t)=><span key={t} className="rounded-full bg-white/10 px-1.5 text-[10px]">#{t}</span>)}</div>
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </section>

    <aside className="space-y-5">
      <div className="life-card-strong p-4">
        <h2 className="mb-3 text-xl font-black"><Plus size={18} className="inline"/> Add Token</h2>
        <div className="grid gap-3">
          <input className="life-input" placeholder="Title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2"><select className="life-input" value={form.source_type} onChange={(e)=>setForm({...form,source_type:e.target.value})}><option value="free">free</option><option value="tracker">tracker</option><option value="journal">journal</option><option value="hybrid">hybrid</option></select><select className="life-input" value={form.recurrence_kind} onChange={(e)=>setForm({...form,recurrence_kind:e.target.value})}><option value="one_time">one-time</option><option value="recurring">recurring</option><option value="permanent">permanent</option></select></div>
          {(form.source_type === "tracker" || form.source_type === "hybrid") && <select className="life-input" value={form.linked_tracker_id} onChange={(e)=>setForm({...form,linked_tracker_id:e.target.value})}><option value="">Link tracker...</option>{trackers.map((t)=><option key={t.id} value={t.id}>{t.title}</option>)}</select>}
          {(form.source_type === "journal" || form.source_type === "hybrid") && <select className="life-input" value={form.linked_journal_entry_id} onChange={(e)=>setForm({...form,linked_journal_entry_id:e.target.value})}><option value="">Link journal entry...</option>{entries.map((e)=><option key={e.id} value={e.id}>{e.title}</option>)}</select>}
          <div className="grid grid-cols-3 gap-2"><input className="life-input" type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/><input className="life-input" type="time" value={form.start} onChange={(e)=>setForm({...form,start:e.target.value})}/><input className="life-input" type="time" value={form.end} onChange={(e)=>setForm({...form,end:e.target.value})}/></div>
          {form.recurrence_kind !== "one_time" && <><div className="flex flex-wrap gap-1">{daysRu.map((d,i)=><button key={d} onClick={()=>setForm({...form,weekdays:form.weekdays.includes(i)?form.weekdays.filter(x=>x!==i):[...form.weekdays,i]})} className={`life-tab ${form.weekdays.includes(i)?"active":""}`}>{d}</button>)}</div>{form.recurrence_kind === "recurring" && <input className="life-input" type="date" value={form.end_date} onChange={(e)=>setForm({...form,end_date:e.target.value})}/>}</>}
          <input className="life-input" placeholder="Tags" value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})}/>
          <button onClick={createTokenOrRule} className="life-button"><Save size={16} className="inline"/> Save token</button>
          {message && <div className="text-sm text-white/48">{message}</div>}
        </div>
      </div>

      <div className="life-card p-4"><h3 className="mb-3 font-black">Token Library</h3><div className="flex flex-wrap gap-2">{tokenLibrary.map((t:any)=><button key={t.id} onClick={()=>setForm({...form,title:t.title,source_type:t.source_type,linked_tracker_id:t.linked_tracker_id||"",linked_journal_entry_id:t.linked_journal_entry_id||"",tags:tagsToText(tagMap.get(t.id)||[])})} className="life-badge"><CalendarDays size={13}/>{t.title}</button>)}</div></div>

      <div className="life-card-strong p-4">
        <h3 className="mb-3 text-xl font-black">Selected</h3>
        {!selected ? <div className="text-white/52">Click a token on the board.</div> : <div className="space-y-3">
          <input className="life-input" value={edit.title} onChange={(e)=>setEdit({...edit,title:e.target.value})}/>
          <input className="life-input" type="datetime-local" value={edit.start} onChange={(e)=>setEdit({...edit,start:e.target.value})}/>
          <input className="life-input" type="datetime-local" value={edit.end} onChange={(e)=>setEdit({...edit,end:e.target.value})}/>
          <input className="life-input" placeholder="Tags" value={edit.tags} onChange={(e)=>setEdit({...edit,tags:e.target.value})}/>
          <div className="grid grid-cols-3 gap-2"><button onClick={()=>quickMove(-60)} className="life-button secondary">−1h</button><button onClick={()=>quickMove(60)} className="life-button secondary">+1h</button><button onClick={()=>quickMove(1440)} className="life-button secondary">Tomorrow</button></div>
          <div className="grid gap-2"><button onClick={()=>saveSelected("this")} className="life-button">Save this occurrence</button>{selected.kind === "rule" && <><button onClick={()=>saveSelected("future")} className="life-button secondary">Apply this & future</button><button onClick={()=>saveSelected("series")} className="life-button secondary">Apply entire series</button></>}<button onClick={duplicateNextWeek} className="life-button secondary">Duplicate +1 week</button></div>
          <div className="grid gap-2 pt-2"><button onClick={()=>deleteSelected("this")} className="life-button danger"><Trash2 size={15} className="inline"/> Delete this</button>{selected.kind === "rule" && <><button onClick={()=>deleteSelected("future")} className="life-button danger">Delete this & future</button><button onClick={()=>deleteSelected("series")} className="life-button danger">Delete entire series</button></>}</div>
        </div>}
      </div>
    </aside>
  </div>;
}
