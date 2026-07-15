import { NextResponse } from "next/server";

function configured(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export async function GET() {
  return NextResponse.json({
    version: "V12.6",
    environment: process.env.VERCEL ? "vercel" : process.env.NODE_ENV || "local",
    supabase: configured("NEXT_PUBLIC_SUPABASE_URL") && configured("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRole: configured("SUPABASE_SERVICE_ROLE_KEY"),
    resend: configured("RESEND_API_KEY"),
    telegram: configured("TELEGRAM_BOT_TOKEN"),
    githubVault: configured("GITHUB_TOKEN") && configured("GITHUB_VAULT_REPO"),
    cronSecret: configured("CRON_SECRET"),
    publicSignup: process.env.ALLOW_PUBLIC_SIGNUP === "true"
  });
}
