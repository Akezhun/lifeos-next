import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildNotificationCandidates } from "@/lib/notifications/buildNotifications";
import { sendEmail } from "@/lib/notifications/sendEmail";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return auth === `Bearer ${secret}` || querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminSupabase();
  const candidates = await buildNotificationCandidates(new Date());
  const results = [];

  for (const c of candidates) {
    const { data: existing } = await sb.from("notification_log").select("id").eq("user_id", c.user_id).eq("dedupe_key", c.dedupe_key).maybeSingle();
    if (existing?.id) {
      results.push({ dedupe_key: c.dedupe_key, skipped: true });
      continue;
    }

    const sent = c.channel_type === "email"
      ? await sendEmail({ to: c.target, subject: c.title, text: c.body })
      : { ok: false, status: 0, message: "Unsupported channel" };

    await sb.from("notification_log").insert({
      user_id: c.user_id,
      dedupe_key: c.dedupe_key,
      channel_type: c.channel_type,
      title: c.title,
      body: c.body,
      sent_at: new Date().toISOString(),
      source_type: c.source_type,
      source_id: c.source_id,
      status: sent.ok ? "sent" : "failed",
      metadata: sent
    });

    results.push({ dedupe_key: c.dedupe_key, sent: sent.ok, status: sent.status, message: sent.message });
  }

  return NextResponse.json({ checked_at: new Date().toISOString(), candidates: candidates.length, results });
}
