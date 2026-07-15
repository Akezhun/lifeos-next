"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { inferMediaType, mediaHostname, youtubeEmbedUrl } from "@/lib/media/inferMedia";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";

export default function MediaPage() {
  return <AppShell title="Media" subtitle="V12.6: URL previews, image cards, YouTube embeds, music link cards and media linked to journals/trackers/schedule."><AuthGate>{(user)=><MediaInner user={user}/>}</AuthGate></AppShell>;
}

function MediaInner({ user }: { user: any }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [trackers, setTrackers] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", url: "", notes: "", object_type: "", object_id: "" });
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  useEffect(()=>{ load(); }, []);
  async function load() {
    const [{data: media},{data: es},{data: ts}] = await Promise.all([
      sb.from("media_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("journal_entries").select("id,title").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
      sb.from("trackers").select("id,title").eq("user_id", user.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(100)
    ]);
    setItems(media || []); setEntries(es || []); setTrackers(ts || []);
  }
  async function create() {
    if (!form.url.trim()) return;
    const url = form.url.trim();
    const media_type = inferMediaType(url);
    const payload:any = { user_id: user.id, title: form.title.trim() || mediaHostname(url), url, media_type, notes: form.notes.trim() || null, metadata: { host: mediaHostname(url) } };
    if (form.object_type && form.object_id) { payload.object_type = form.object_type; payload.object_id = form.object_id; }
    const { error } = await sb.from("media_items").insert(payload);
    setMessage(error?.message || "Media item added.");
    if (!error) setForm({ title: "", url: "", notes: "", object_type: "", object_id: "" });
    await load();
  }
  async function remove(item:any) {
    if (!confirm(`Delete media “${item.title || item.url}”?`)) return;
    await sb.from("media_items").delete().eq("user_id", user.id).eq("id", item.id);
    await load();
  }
  const filtered = items.filter(i => filter === "all" || i.media_type === filter || i.object_type === filter);
  const linkOptions = form.object_type === "journal_entry" ? entries : form.object_type === "tracker" ? trackers : [];

  return <div className="grid gap-5 xl:grid-cols-[430px,1fr]">
    <div className="space-y-5">
      <div className="life-card-strong p-5">
        <h2 className="text-xl font-black">Add media URL</h2>
        <div className="mt-4 space-y-3">
          <input className="life-input" placeholder="Title / optional" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/>
          <input className="life-input" placeholder="https://image / youtube / spotify / article" value={form.url} onChange={(e)=>setForm({...form,url:e.target.value})}/>
          <textarea className="life-input min-h-[110px]" placeholder="Notes" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/>
          <div className="grid grid-cols-2 gap-3"><select className="life-input" value={form.object_type} onChange={(e)=>setForm({...form,object_type:e.target.value,object_id:""})}><option value="">No link</option><option value="journal_entry">Journal entry</option><option value="tracker">Tracker</option></select><select className="life-input" value={form.object_id} onChange={(e)=>setForm({...form,object_id:e.target.value})} disabled={!form.object_type}><option value="">Choose object</option>{linkOptions.map((x:any)=><option key={x.id} value={x.id}>{x.title}</option>)}</select></div>
          <button className="life-button w-full" onClick={create}><Plus size={16} className="inline"/> Add media</button>
          {message && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/62">{message}</div>}
        </div>
      </div>
      <div className="life-card p-5"><h2 className="text-xl font-black">Filters</h2><div className="mt-3 flex flex-wrap gap-2">{["all","image","youtube","spotify","apple_music","link","journal_entry","tracker"].map(f=><button key={f} onClick={()=>setFilter(f)} className={`life-tab ${filter===f?"active":""}`}>{f}</button>)}</div></div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {filtered.map((item)=><MediaCard key={item.id} item={item} remove={()=>remove(item)}/>) }
      {!filtered.length && <div className="life-card p-8 text-center text-white/45 md:col-span-2">No media items yet.</div>}
    </div>
  </div>;
}

function MediaCard({ item, remove }: { item:any; remove:()=>void }) {
  const embed = item.media_type === "youtube" ? youtubeEmbedUrl(item.url) : null;
  return <article className="life-card overflow-hidden p-4">
    <div className="mb-3 flex items-start justify-between gap-3"><div><div className="life-badge">{item.media_type}</div><h3 className="mt-2 text-lg font-black">{item.title || mediaHostname(item.url)}</h3><p className="mt-1 text-xs text-white/42">{mediaHostname(item.url)} {item.object_type ? `· linked to ${item.object_type}` : ""}</p></div><button onClick={remove} className="life-button danger px-3"><Trash2 size={15}/></button></div>
    <Preview item={item} embed={embed}/>
    {item.notes && <p className="mt-3 text-sm leading-6 text-white/58">{item.notes}</p>}
    <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-violet-200"><ExternalLink size={15}/> Open original</a>
  </article>;
}
function Preview({ item, embed }: any) {
  if (item.media_type === "image") return <img className="media-preview" src={item.url} alt={item.title || "media"}/>;
  if (embed) return <iframe className="media-preview" src={embed} title={item.title || "YouTube"} allowFullScreen/>;
  if (item.media_type === "video") return <video className="media-preview" src={item.url} controls/>;
  return <div className="media-placeholder"><Link2 size={28}/><div className="mt-2 text-sm">{item.url}</div></div>;
}
