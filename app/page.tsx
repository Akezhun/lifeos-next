"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Archive, BarChart3, Bell, CalendarDays, Import, NotebookPen, Settings, ShieldCheck, Sparkles, Image as ImageIcon } from "lucide-react";

const modules = [
  { href: "/trackers", title: "Life Tracker", desc: "Active/archive, deadline/cycle/countdown, notes, history, tags.", icon: ShieldCheck },
  { href: "/journals", title: "Journals", desc: "Focus Writer, sections, drafts, mood/energy, edit mode.", icon: NotebookPen },
  { href: "/schedule", title: "Schedule", desc: "Weekly token board, recurring/permanent, quick move.", icon: CalendarDays },
  { href: "/analytics", title: "Analytics", desc: "Heatmap, risk, success, words, planned time, tag matrix.", icon: BarChart3 },
  { href: "/media", title: "Media", desc: "URL previews, images, YouTube/music cards, linked media.", icon: ImageIcon },
  { href: "/notifications", title: "Notifications", desc: "Email + Telegram, worker status and test endpoints.", icon: Bell },
  { href: "/import", title: "Import", desc: "Import Classic JSON from GitHub Vault/backup.", icon: Import },
  { href: "/settings", title: "Settings", desc: "Theme, sync, vault and app configuration.", icon: Settings },
];

export default function Home() {
  return <AppShell title="LifeOS 2.0" subtitle="V12.6: Settings Core, User Polish, Notification Hardening and Media update before Obsidian remaster."><AuthGate>{(user) => <HomeInner user={user} />}</AuthGate></AppShell>;
}

function HomeInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [counts, setCounts] = useState<any>({});
  useEffect(() => { load(); }, []);
  async function load() {
    const names = ["trackers", "journal_entries", "schedule_tokens", "schedule_rules", "tracker_events"];
    const result: any = {};
    for (const name of names) {
      const { count } = await sb.from(name).select("id", { count: "exact", head: true }).eq("user_id", user.id);
      result[name] = count || 0;
    }
    const { count: archived } = await sb.from("trackers").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("archived_at", "is", null);
    result.archived = archived || 0;
    setCounts(result);
  }
  return <div className="space-y-6">
    <div className="life-card-strong p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-100"><Sparkles size={18}/><span className="text-sm font-black uppercase tracking-[.22em]">new architecture, classic behavior</span></div>
          <h2 className="mt-2 text-3xl font-black md:text-5xl">Not just a prototype anymore.</h2>
          <p className="mt-3 max-w-3xl text-white/58">Supabase is the database. GitHub Vault is no longer main DB and will return later as Obsidian mirror. This build closes the pre-Obsidian feature block.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-3">
          <Metric label="Trackers" value={counts.trackers || 0}/><Metric label="Journal entries" value={counts.journal_entries || 0}/><Metric label="Schedule tokens" value={(counts.schedule_tokens || 0)+(counts.schedule_rules || 0)}/><Metric label="Events" value={counts.tracker_events || 0}/><Metric label="Archived" value={counts.archived || 0}/><Metric label="Version" value="12.6"/>
        </div>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => { const Icon = m.icon; return <Link key={m.href} href={m.href} className="life-card p-5 transition hover:-translate-y-1 hover:border-violet-300/30"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/18 text-violet-100"><Icon size={23}/></div><h3 className="text-xl font-black">{m.title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-white/55">{m.desc}</p></Link> })}
    </div>
    <div className="life-card p-5"><h3 className="mb-2 flex items-center gap-2 text-lg font-black"><Archive size={18}/> V12.6 checkpoint</h3><p className="text-white/58">После этой версии следующий крупный блок — Obsidian Sync 2.0 / remaster: Supabase → Markdown mirror → GitHub Vault → Obsidian.</p></div>
  </div>;
}
function Metric({label,value}:{label:string;value:any}) { return <div className="rounded-2xl border border-white/10 bg-white/[.045] p-3"><div className="text-2xl font-black">{value}</div><div className="text-xs text-white/45">{label}</div></div> }
