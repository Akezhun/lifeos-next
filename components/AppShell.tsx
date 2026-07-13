"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BarChart3, Bell, CalendarDays, DatabaseZap, Home, Import, LogOut, NotebookPen, Settings, ShieldCheck, Tags, Workflow } from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trackers", label: "Trackers", icon: ShieldCheck },
  { href: "/journals", label: "Journals", icon: NotebookPen },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/import", label: "Import", icon: Import },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = createBrowserSupabase();
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
  }, []);

  async function signOut() {
    const sb = createBrowserSupabase();
    await sb.auth.signOut();
    router.push("/auth");
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto flex max-w-[1500px] gap-4">
        <aside className="life-card sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 p-4 lg:block">
          <Link href="/" className="mb-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
              <Workflow size={23} />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">LifeOS 2.0</div>
              <div className="text-xs text-violet-200/70">V12.2 Progress + Notifications</div>
            </div>
          </Link>

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
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/58">
            <div className="mb-1 flex items-center gap-2 text-white/78"><DatabaseZap size={15}/> Supabase DB</div>
            <div className="truncate">{ready ? (email ?? "Not signed in") : "Checking session..."}</div>
            {email && <button onClick={signOut} className="mt-3 flex items-center gap-2 text-rose-200 hover:text-rose-100"><LogOut size={14}/> Sign out</button>}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:hidden">
            <Link href="/" className="font-black">LifeOS 2.0</Link>
            <Link href="/settings" className="life-badge">Settings</Link>
          </div>
          {(title || subtitle) && (
            <header className="mb-5">
              {title && <h1 className="text-3xl font-black tracking-tight md:text-5xl">{title}</h1>}
              {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58 md:text-base">{subtitle}</p>}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
