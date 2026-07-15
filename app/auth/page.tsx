"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);

  useEffect(() => {
    fetch("/api/auth/signup-mode").then(r=>r.json()).then(d=>setAllowSignup(Boolean(d.allowPublicSignup))).catch(()=>setAllowSignup(false));
  }, []);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const sb = createBrowserSupabase();
      if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
        if (error) throw error;
        setMessage("Password reset email requested.");
        return;
      }
      if (mode === "signup" && !allowSignup) throw new Error("Public signup is disabled for this LifeOS preview.");
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

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="life-card w-full max-w-md p-7 shadow-glow">
        <Link href="/" className="life-badge">← LifeOS 2.0</Link>
        <h1 className="mt-6 text-4xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-white/55">LifeOS 2.0 uses Supabase Auth. Public signup is {allowSignup ? "enabled" : "disabled"}.</p>

        <div className="mt-6 space-y-3">
          <input className="life-input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "reset" && <input className="life-input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          <button className="life-button w-full" onClick={submit} disabled={loading}>{loading ? "Working..." : title}</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-violet-200">
          {mode !== "signin" && <button onClick={() => setMode("signin")}>Sign in</button>}
          {allowSignup && mode !== "signup" && <button onClick={() => setMode("signup")}>Create account</button>}
          {mode !== "reset" && <button onClick={() => setMode("reset")}>Forgot password?</button>}
        </div>
        {!allowSignup && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-white/52">Owner/private preview mode. To open registration, set ALLOW_PUBLIC_SIGNUP=true and adjust Supabase Auth settings.</div>}
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/65">{message}</div>}
      </div>
    </div>
  );
}
