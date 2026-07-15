"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { countWords, defaultSectionsForType, fmtDateTime, loadObjectTags, parseTags, saveObjectTags, tagsToText } from "@/lib/lifeos/clientHelpers";
import { Archive, Edit3, Maximize2, NotebookPen, Plus, Save, Trash2, X, Link2 } from "lucide-react";
import { inferMediaType, mediaHostname } from "@/lib/media/inferMedia";

const entryTypes = ["Diary", "Essay/Academic", "Project", "Learning", "Draft", "Custom"];

export default function JournalsPage() {
  return <AppShell title="Journals" subtitle="Focus Writer вернулся: большие тексты, редактирование, sections, tags, mood/energy, archive."><AuthGate>{(user) => <JournalInner user={user} />}</AuthGate></AppShell>;
}

function JournalInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [journals, setJournals] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [sections, setSections] = useState<Record<string, any[]>>({});
  const [tagMap, setTagMap] = useState<Map<string,string[]>>(new Map());
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"list"|"writer">("list");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tab, setTab] = useState<"active"|"archive">("active");
  const [journalTitle, setJournalTitle] = useState("");
  const [form, setForm] = useState({ journal_id: "", title: "", entry_type: "Diary", status: "draft", mood: "", energy: "", tags: "" });
  const [body, setBody] = useState("");
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaTitle, setMediaTitle] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: js }, { data: es }, { data: ss }] = await Promise.all([
      sb.from("journals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("journal_entries").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      sb.from("journal_sections").select("*").eq("user_id", user.id).order("sort_order")
    ]);
    setJournals(js || []);
    setEntries(es || []);
    const obj: Record<string, any[]> = {};
    for (const s of ss || []) obj[(s as any).entry_id] = [...(obj[(s as any).entry_id] || []), s];
    setSections(obj);
    const map = await loadObjectTags(sb, user.id, "journal_entry", (es || []).map((x: any) => x.id));
    setTagMap(map);
  }

  const enriched = useMemo(() => entries.map((e) => ({ ...e, _journal: journals.find((j) => j.id === e.journal_id), _sections: sections[e.id] || [], _tags: tagMap.get(e.id) || [] })), [entries, journals, sections, tagMap]);
  const allTags = Array.from(new Set([...tagMap.values()].flat())).sort();
  const filtered = enriched.filter((e) => {
    const archived = !!e.archived_at;
    if (tab === "active" && archived) return false;
    if (tab === "archive" && !archived) return false;
    if (query && !(e.title + " " + (e.body || "")).toLowerCase().includes(query.toLowerCase())) return false;
    if (tagFilter && !e._tags.includes(tagFilter)) return false;
    return true;
  });

  async function createJournal() {
    if (!journalTitle.trim()) return;
    await sb.from("journals").insert({ user_id: user.id, title: journalTitle.trim() });
    setJournalTitle("");
    await loadAll();
  }

  function resetWriter() {
    setSelected(null); setBody(""); setSectionDrafts({}); setMode("list"); setForm({ journal_id: journals[0]?.id || "", title: "", entry_type: "Diary", status: "draft", mood: "", energy: "", tags: "" });
  }

  function openNew() {
    const j = journals[0];
    setSelected(null); setBody(""); setSectionDrafts({});
    setForm({ journal_id: j?.id || "", title: "", entry_type: "Diary", status: "draft", mood: "", energy: "", tags: "" });
    setMode("writer");
  }

  function openEdit(e: any) {
    setSelected(e);
    setForm({ journal_id: e.journal_id, title: e.title, entry_type: e.entry_type, status: e.status || "draft", mood: e.mood ?? "", energy: e.energy ?? "", tags: tagsToText(e._tags || []) });
    setBody(e.body || "");
    const drafts: Record<string,string> = {};
    for (const s of e._sections || []) drafts[s.name] = s.body || "";
    if (!Object.keys(drafts).length) for (const name of defaultSectionsForType(e.entry_type)) drafts[name] = name === "Text" ? (e.body || "") : "";
    setSectionDrafts(drafts);
    setMode("writer");
  }

  async function saveEntry(exit = false) {
    if (!form.journal_id || !form.title.trim()) { setMessage("Journal and title are required"); return; }
    const usingSections = !["Diary", "Draft", "Custom"].includes(form.entry_type);
    const textForCount = usingSections ? Object.values(sectionDrafts).join("\n\n") : body;
    const payload: any = {
      user_id: user.id,
      journal_id: form.journal_id,
      title: form.title.trim(),
      entry_type: form.entry_type,
      status: form.status,
      body: usingSections ? null : body,
      mood: form.mood === "" ? null : Number(form.mood),
      energy: form.energy === "" ? null : Number(form.energy),
      word_count: countWords(textForCount)
    };
    let id = selected?.id;
    if (id) await sb.from("journal_entries").update(payload).eq("id", id).eq("user_id", user.id);
    else {
      const { data, error } = await sb.from("journal_entries").insert(payload).select("id").single();
      if (error) { setMessage(error.message); return; }
      id = data.id;
    }
    await saveObjectTags(sb, user.id, "journal_entry", id, parseTags(form.tags));
    if (usingSections) {
      await sb.from("journal_sections").delete().eq("user_id", user.id).eq("entry_id", id);
      const names = defaultSectionsForType(form.entry_type);
      await sb.from("journal_sections").insert(names.map((name, i) => ({ user_id: user.id, entry_id: id, name, body: sectionDrafts[name] || "", sort_order: i })));
    } else {
      await sb.from("journal_sections").delete().eq("user_id", user.id).eq("entry_id", id);
    }
    setMessage("Saved");
    await loadAll();
    if (exit) resetWriter();
  }


  async function addMediaToEntry() {
    if (!selected?.id || !mediaUrl.trim()) return;
    const url = mediaUrl.trim();
    const { error } = await sb.from("media_items").insert({
      user_id: user.id,
      title: mediaTitle.trim() || mediaHostname(url),
      url,
      media_type: inferMediaType(url),
      object_type: "journal_entry",
      object_id: selected.id,
      metadata: { host: mediaHostname(url) }
    });
    setMessage(error?.message || "Media attached to entry");
    if (!error) { setMediaUrl(""); setMediaTitle(""); }
  }

  async function archiveEntry(e: any, on = true) {
    await sb.from("journal_entries").update({ archived_at: on ? new Date().toISOString() : null }).eq("id", e.id).eq("user_id", user.id);
    await loadAll();
  }

  async function deleteEntry(e: any) {
    if (!confirm(`Delete entry “${e.title}”?`)) return;
    await sb.from("journal_entries").delete().eq("id", e.id).eq("user_id", user.id);
    await loadAll();
  }

  if (mode === "writer") {
    const usingSections = !["Diary", "Draft", "Custom"].includes(form.entry_type);
    const sectionNames = defaultSectionsForType(form.entry_type);
    return <div className="writer-shell life-card-strong p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[.24em] text-violet-200/60">Focus Writer</div>
          <h2 className="text-2xl font-black md:text-4xl">{selected ? "Edit entry" : "New entry"}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => saveEntry(false)} className="life-button"><Save size={16} className="inline"/> Save</button>
          <button onClick={() => saveEntry(true)} className="life-button good">Save & Exit</button>
          <button onClick={resetWriter} className="life-button secondary"><X size={16} className="inline"/> Close</button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3"><label className="life-label">Journal</label><select className="life-input" value={form.journal_id} onChange={(e) => setForm({ ...form, journal_id: e.target.value })}>{journals.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
        <div className="md:col-span-4"><label className="life-label">Title</label><input className="life-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Entry title" /></div>
        <div className="md:col-span-2"><label className="life-label">Type</label><select className="life-input" value={form.entry_type} onChange={(e) => { const type = e.target.value; const d: Record<string,string> = {}; for (const n of defaultSectionsForType(type)) d[n] = n === "Text" ? body : (sectionDrafts[n] || ""); setForm({ ...form, entry_type: type }); setSectionDrafts(d); }}>{entryTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="md:col-span-1"><label className="life-label">Mood</label><input type="number" min="1" max="5" className="life-input" value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} /></div>
        <div className="md:col-span-1"><label className="life-label">Energy</label><input type="number" min="1" max="5" className="life-input" value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value })} /></div>
        <div className="md:col-span-1"><label className="life-label">Status</label><select className="life-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>draft</option><option>active</option><option>final</option></select></div>
        <div className="md:col-span-12"><label className="life-label">Tags</label><input className="life-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="writing, psychology, university" /></div>
      </div>
      {selected?.id && <div className="mb-4 rounded-3xl border border-white/10 bg-black/15 p-4">
        <div className="mb-3 flex items-center gap-2 font-black text-violet-100"><Link2 size={16}/> Attach media to this entry</div>
        <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
          <input className="life-input" placeholder="Media title / optional" value={mediaTitle} onChange={(e)=>setMediaTitle(e.target.value)} />
          <input className="life-input" placeholder="https://image / youtube / spotify / article" value={mediaUrl} onChange={(e)=>setMediaUrl(e.target.value)} />
          <button className="life-button secondary" onClick={addMediaToEntry}>Attach</button>
        </div>
      </div>}

      {usingSections ? <div className="grid gap-4 xl:grid-cols-2">
        {sectionNames.map((name) => <div key={name} className="rounded-3xl border border-white/10 bg-black/15 p-3">
          <label className="mb-2 block text-sm font-black text-violet-100">{name}</label>
          <textarea className="life-input writer-textarea" value={sectionDrafts[name] || ""} onChange={(e) => setSectionDrafts({ ...sectionDrafts, [name]: e.target.value })} placeholder={`Write ${name.toLowerCase()}...`} />
        </div>)}
      </div> : <textarea className="life-input writer-textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write here. This is the big text space, not a tiny form." />}
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-white/48"><span>{countWords(usingSections ? Object.values(sectionDrafts).join(" ") : body)} words</span><span>{message}</span></div>
    </div>;
  }

  return <div className="space-y-5">
    <div className="life-card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2"><button className={`life-tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>Active</button><button className={`life-tab ${tab === "archive" ? "active" : ""}`} onClick={() => setTab("archive")}><Archive size={14} className="inline"/> Archive</button></div>
        <button onClick={openNew} className="life-button"><Maximize2 size={16} className="inline"/> Open Focus Writer</button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <input className="life-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search entries..." />
        <select className="life-input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}><option value="">All tags</option>{allTags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>
      </div>
    </div>

    <div className="life-card p-4 md:p-5">
      <h3 className="mb-3 text-lg font-black">Journal containers</h3>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} className="life-input" placeholder="New journal, e.g. Diary / Essays / Projects" />
        <button onClick={createJournal} className="life-button"><Plus size={16} className="inline"/> Create journal</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{journals.map((j) => <span key={j.id} className="life-badge"><NotebookPen size={14}/>{j.title}</span>)}</div>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      {filtered.map((e) => <article key={e.id} className="life-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="text-xs uppercase tracking-[.18em] text-white/38">{e._journal?.title || "Journal"} · {e.entry_type}</div><h3 className="mt-1 truncate text-xl font-black">{e.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-white/55">{e.body || (e._sections || []).map((s: any) => s.body).join(" ").slice(0, 420) || "No text yet"}</p></div>
          <div className="flex gap-2"><button onClick={() => openEdit(e)} className="life-button secondary px-3"><Edit3 size={15}/></button><button onClick={() => deleteEntry(e)} className="life-button danger px-3"><Trash2 size={15}/></button></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/48"><span>{e.word_count} words</span><span>•</span><span>{fmtDateTime(e.updated_at)}</span>{e.mood && <><span>•</span><span>mood {e.mood}/5</span></>}{e.energy && <><span>•</span><span>energy {e.energy}/5</span></>}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">{e._tags.map((t: string) => <span key={t} className="life-chip">#{t}</span>)}</div>
        <button onClick={() => archiveEntry(e, tab === "active")} className="life-button secondary mt-4 text-sm">{tab === "active" ? "Archive" : "Restore"}</button>
      </article>)}
      {!filtered.length && <div className="life-card p-8 text-center text-white/50 lg:col-span-2">No journal entries yet.</div>}
    </div>
  </div>;
}
