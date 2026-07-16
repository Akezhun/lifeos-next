"use client";

import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { SkeletonCard } from "@/components/Skeleton";

export function AuthGate({ children }: { children: (user: User) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const sb = createBrowserSupabase();
      sb.auth.getSession().then(({ data }: any) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      }).catch((e: any) => {
        if (!active) return;
        setConfigError(e instanceof Error ? e.message : "Supabase session error");
        setLoading(false);
      });

      const { data: listener } = sb.auth.onAuthStateChange((_event: any, session: any) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Supabase config error");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <SkeletonCard lines={4} />;
  }

  if (configError) {
    return (
      <div className="life-card p-8">
        <h2 className="text-2xl font-black">Supabase is not configured</h2>
        <p className="mt-2 text-white/60">{configError}</p>
        <p className="mt-4 text-sm text-white/50">Fill `.env.local`, restart `npm run dev`, then open the app again.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="life-card p-8">
        <h2 className="text-2xl font-black">Войдите в LifeOS</h2>
        <p className="mt-2 text-white/60">Сессия сохраняется на устройстве. LifeOS попросит вход только после ручного выхода или очистки данных браузера.</p>
        <Link href="/auth" className="life-button mt-5 inline-block">Открыть вход</Link>
      </div>
    );
  }

  return <>{children(user)}</>;
}
