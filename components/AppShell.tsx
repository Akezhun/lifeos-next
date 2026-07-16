"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BarChart3, CalendarDays, DatabaseZap, Home, LogOut, Menu, NotebookPen, PanelLeftClose, Settings, ShieldCheck, Workflow, X } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { OfflineSyncStatus } from "@/components/OfflineSyncStatus";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import clsx from "clsx";
import { applyClientTranslations } from "@/lib/i18n/clientTranslator";

const nav = [
  { href: "/", key: "home", icon: Home },
  { href: "/trackers", key: "trackers", icon: ShieldCheck },
  { href: "/journals", key: "journals", icon: NotebookPen },
  { href: "/schedule", key: "schedule", icon: CalendarDays },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
  { href: "/settings", key: "settings", icon: Settings }
];

const labels: Record<string, Record<string, string>> = {
  en: { home: "Home", trackers: "Trackers", journals: "Journals", schedule: "Schedule", analytics: "Analytics", settings: "Settings", signOut: "Sign out", checking: "Checking session...", db: "Supabase DB", menu: "Menu", close: "Close" },
  ru: { home: "Главная", trackers: "Трекеры", journals: "Журналы", schedule: "Расписание", analytics: "Аналитика", settings: "Настройки", signOut: "Выйти", checking: "Проверка сессии...", db: "База Supabase", menu: "Меню", close: "Закрыть" }
};

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const t = useMemo(() => labels[language] || labels.ru, [language]);

  useEffect(() => {
    const sb = createBrowserSupabase();
    sb.auth.getUser().then(async ({ data }: any) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      if (user?.id) {
        const { data: settings } = await sb.from("settings").select("language,compact_mode,theme").eq("user_id", user.id).maybeSingle();
        if (settings?.language === "en" || settings?.language === "ru") setLanguage(settings.language);
        document.documentElement.dataset.compact = settings?.compact_mode ? "true" : "false";
        document.documentElement.dataset.theme = settings?.theme || "dark";
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    applyClientTranslations(language);
    setNavOpen(false);
  }, [language, pathname]);

  async function signOut() {
    const sb = createBrowserSupabase();
    await sb.auth.signOut();
    router.push("/auth");
  }

  return (
    <div className="min-h-screen px-3 py-4 md:px-5 md:py-5">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => setNavOpen(true)} className="life-icon-button" aria-label={t.menu} title={t.menu}>
            <Menu size={20} />
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 font-black tracking-tight text-white/90">
            <Workflow size={18} className="text-violet-200" />
            <span className="hidden sm:inline">LifeOS 2.0</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/45">V14.1</span>
          </Link>
          <PwaInstallPrompt />
        </div>

        <main className="min-w-0">
          {(title || subtitle) && (
            <header className="mb-5">
              {title && <h1 className="text-3xl font-black tracking-tight md:text-5xl">{title}</h1>}
              {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55 md:text-base">{subtitle}</p>}
            </header>
          )}
          {children}
        </main>
      </div>

      {navOpen && <div className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm" onClick={() => setNavOpen(false)} />}
      <aside className={clsx("nav-drawer", navOpen && "open")} aria-hidden={!navOpen}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
              <Workflow size={23} />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">LifeOS 2.0</div>
              <div className="text-xs text-violet-200/70">V14.1 True Multi-user</div>
            </div>
          </Link>
          <button onClick={() => setNavOpen(false)} className="life-icon-button" aria-label={t.close}><X size={19}/></button>
        </div>

        <nav className="space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={clsx(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-violet-500/18 text-white ring-1 ring-violet-300/20" : "text-white/62 hover:bg-white/[0.055] hover:text-white"
              )}>
                <Icon size={18} />
                {t[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/58">
          <div className="mb-1 flex items-center gap-2 text-white/78"><DatabaseZap size={15}/> {t.db}</div>
          <div className="truncate">{ready ? (email ?? "Not signed in") : t.checking}</div>
          {email && <button onClick={signOut} className="mt-3 flex items-center gap-2 text-rose-200 hover:text-rose-100"><LogOut size={14}/> {t.signOut}</button>}
        </div>
      </aside>

      <nav className="mobile-bottom-nav lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href} className={clsx("mobile-nav-item", active && "active")}>
            <Icon size={19} />
            <span>{t[item.key]}</span>
          </Link>;
        })}
      </nav>
      {email && <><OfflineSyncStatus /><QuickAdd /></>}
    </div>
  );
}
