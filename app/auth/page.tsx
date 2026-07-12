"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const sb = createBrowserSupabase();
      const result = mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
      setMessage(mode === "signup" ? "Account created. Check email confirmation if Supabase requires it." : "Signed in.");
      router.push("/");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="life-card w-full max-w-md p-7 shadow-glow">
        <Link href="/" className="life-badge">← LifeOS 2.0</Link>
        <h1 className="mt-6 text-4xl font-black">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="mt-2 text-sm text-white/55">New architecture starts with real auth and a real database.</p>

        <div className="mt-6 space-y-3">
          <input className="life-input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="life-input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="life-button w-full" onClick={submit} disabled={loading}>{loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}</button>
        </div>

        <button className="mt-4 text-sm text-violet-200" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/65">{message}</div>}
      </div>
    </div>
  );
}
