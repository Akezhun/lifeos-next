"use client";

import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: (user: User) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sb = createBrowserSupabase();
      sb.auth.getUser().then(({ data }) => {
        setUser(data.user ?? null);
        setLoading(false);
      });
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Supabase config error");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="life-card p-8 text-white/60">Loading LifeOS session...</div>;
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
        <h2 className="text-2xl font-black">Sign in first</h2>
        <p className="mt-2 text-white/60">LifeOS 2.0 stores data in Supabase under your user account.</p>
        <Link href="/auth" className="life-button mt-5 inline-block">Open auth</Link>
      </div>
    );
  }

  return <>{children(user)}</>;
}
