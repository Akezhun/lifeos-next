import { NextResponse } from "next/server";
import { ownerEmail, signupMode } from "@/lib/auth/owner";

function configured(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export async function GET() {
  const mode = signupMode();
  return NextResponse.json({
    version: "V14.1",
    environment: process.env.VERCEL ? "vercel" : process.env.NODE_ENV || "local",
    supabase: configured("NEXT_PUBLIC_SUPABASE_URL") && configured("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRole: configured("SUPABASE_SERVICE_ROLE_KEY"),
    resend: configured("RESEND_API_KEY"),
    telegram: configured("TELEGRAM_BOT_TOKEN"),
    githubVault: configured("GITHUB_TOKEN") && configured("GITHUB_VAULT_REPO"),
    cronSecret: configured("CRON_SECRET"),
    signupMode: mode,
    publicSignup: mode === "public",
    inviteMode: mode === "invite",
    privateMode: mode === "private",
    ownerEmailConfigured: Boolean(ownerEmail()),
    multiUser: true,
    ownerMode: configured("LIFEOS_OWNER_EMAIL")
  });
}
