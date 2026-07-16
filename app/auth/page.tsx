"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";

type SignupMode = { mode: "public" | "invite" | "private"; allowPublicSignup: boolean; inviteMode: boolean; privateMode: boolean; ownerEmailConfigured: boolean };

export default function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(params.get("invite") || "");
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [signup, setSignup] = useState<SignupMode>({ mode: "invite", allowPublicSignup: false, inviteMode: true, privateMode: false, ownerEmailConfigured: false });
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const sb = createBrowserSupabase();
    sb.auth.getSession().then(({ data }: any) => {
      if (data.session?.user) router.replace("/");
      setSessionChecked(true);
    }).catch(() => setSessionChecked(true));
    fetch("/api/auth/signup-mode").then(r=>r.json()).then(d=>setSignup(d)).catch(()=>setSignup({ mode: "invite", allowPublicSignup: false, inviteMode: true, privateMode: false, ownerEmailConfigured: false }));
  }, [router]);

  const canSignup = signup.allowPublicSignup || signup.inviteMode || signup.privateMode;
  const signupNeedsInvite = signup.inviteMode && !signup.allowPublicSignup;

  async function completeProfile() {
    const sb = createBrowserSupabase();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "No session token after auth." };
    return fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ inviteCode, language: "ru", timezone: "Asia/Almaty" })
    }).then(r=>r.json());
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const sb = createBrowserSupabase();
      if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
        if (error) throw error;
        setMessage("Письмо для смены пароля отправлено.");
        return;
      }
      if (mode === "signup") {
        if (!canSignup) throw new Error("Регистрация закрыта.");
        if (signupNeedsInvite && !inviteCode.trim()) throw new Error("Нужен invite code.");
      }
      const result = mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
      const profile = await completeProfile();
      if (!profile.ok) {
        if (mode === "signup") await sb.auth.signOut();
        throw new Error(profile.error || "Profile initialization failed.");
      }
      setMessage(mode === "signup" ? "Аккаунт создан. Workspace подготовлен." : "Вход выполнен. Сессия сохранена на этом устройстве.");
      router.replace("/");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signin" ? "Войти" : mode === "signup" ? "Создать аккаунт" : "Сбросить пароль";

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="life-card w-full max-w-md p-7 shadow-glow">
        <Link href="/" className="life-badge">← LifeOS 2.0</Link>
        <h1 className="mt-6 text-4xl font-black">{sessionChecked ? title : "Проверка сессии..."}</h1>
        <p className="mt-2 text-sm text-white/55">LifeOS V14.1 — одно multi-user приложение. Ты входишь как обычный пользователь, owner получает дополнительные функции через роль и feature flags.</p>

        <div className="mt-6 space-y-3">
          <input className="life-input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "reset" && <input className="life-input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          {mode === "signup" && signupNeedsInvite && <input className="life-input" placeholder="invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />}
          <button className="life-button w-full" onClick={submit} disabled={loading || !sessionChecked}>{loading ? "Working..." : title}</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-violet-200">
          {mode !== "signin" && <button onClick={() => setMode("signin")}>Войти</button>}
          {canSignup && mode !== "signup" && <button onClick={() => setMode("signup")}>{signup.inviteMode ? "Создать аккаунт по invite" : "Создать аккаунт"}</button>}
          {mode !== "reset" && <button onClick={() => setMode("reset")}>Забыли пароль?</button>}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-white/52">
          Signup mode: <b>{signup.mode}</b>. {signup.inviteMode ? "Новые пользователи входят по invite code. " : null}{signup.privateMode ? "Публичная регистрация закрыта. " : null}Owner email configured: {signup.ownerEmailConfigured ? "yes" : "no"}.
        </div>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/65">{message}</div>}
      </div>
    </div>
  );
}
