"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BarChart3, CalendarDays, NotebookPen, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { SkeletonGrid } from "@/components/Skeleton";

const modules = [
  { href: "/trackers", title: "Трекеры", desc: "Задачи, циклы, дедлайны, архив", icon: ShieldCheck },
  { href: "/journals", title: "Журналы", desc: "Focus Writer, записи, медиа в тексте", icon: NotebookPen },
  { href: "/schedule", title: "Расписание", desc: "Недельная доска токенов", icon: CalendarDays },
  { href: "/analytics", title: "Аналитика", desc: "Прогресс, карты, графики", icon: BarChart3 },
  { href: "/settings", title: "Настройки", desc: "Интеграции, язык, backup, sync", icon: Settings }
];

export default function Home() {
  return <AppShell><AuthGate>{(user) => <HomeInner user={user} />}</AuthGate></AppShell>;
}

function HomeInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
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
    setLoading(false);
  }
  return <div className="space-y-5">
    <section className="life-card-strong compact-hero">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-violet-100"><Sparkles size={17}/><span className="text-xs font-black uppercase tracking-[.22em]">LifeOS 2.0</span></div>
          <h2 className="mt-2 font-black">Главная панель.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56 md:text-base">Короткий обзор системы: что активно, что написано, что запланировано. Все технические механики живут в настройках, а рабочие инструменты остаются чистыми.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-6">
          <Metric label="Трекеры" value={counts.trackers || 0}/>
          <Metric label="Записи" value={counts.journal_entries || 0}/>
          <Metric label="Токены" value={(counts.schedule_tokens || 0)+(counts.schedule_rules || 0)}/>
          <Metric label="События" value={counts.tracker_events || 0}/>
          <Metric label="Архив" value={counts.archived || 0}/>
          <Metric label="Версия" value="14"/>
        </div>
      </div>
    </section>

    {loading ? <SkeletonGrid count={5} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {modules.map((m) => { const Icon = m.icon; return <Link key={m.href} href={m.href} className="life-card group p-4 transition hover:-translate-y-1 hover:border-violet-300/30">
        <div className="mb-3 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/18 text-violet-100"><Icon size={22}/></div><h3 className="text-lg font-black">{m.title}</h3></div>
        <p className="text-sm leading-6 text-white/52">{m.desc}</p>
      </Link> })}
    </div>}

    <div className="grid gap-3 md:grid-cols-3">
      <Link href="/trackers" className="life-button justify-center">+ Добавить трекер</Link>
      <Link href="/journals" className="life-button secondary justify-center">✍ Быстрая запись</Link>
      <Link href="/schedule" className="life-button secondary justify-center">+ Токен в расписание</Link>
    </div>
  </div>;
}
function Metric({label,value}:{label:string;value:any}) { return <div className="rounded-2xl border border-white/10 bg-white/[.045] p-3"><div className="text-2xl font-black">{value}</div><div className="text-xs text-white/45">{label}</div></div> }
