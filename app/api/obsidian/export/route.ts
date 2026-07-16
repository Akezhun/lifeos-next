import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildObsidianFiles } from "@/lib/obsidian/exportMarkdown";
import { pushMarkdownFile } from "@/lib/obsidian/githubVault";

async function resolveUserId(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (!error && data.user?.id) return data.user.id;
  }

  const secret = req.headers.get("x-lifeos-cron-secret") || "";
  if (secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET) {
    const body = await req.json().catch(() => ({}));
    if (body.user_id) return body.user_id;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = createAdminSupabase();
  await admin.from("obsidian_sync_log").insert({ user_id: userId, action: "export", status: "started", message: "Manual Obsidian export started" });

  const files = await buildObsidianFiles(userId);
  const results = [];
  for (const file of files) {
    const result = await pushMarkdownFile(file.path, file.content, `LifeOS Obsidian sync: ${file.path}`);
    results.push(result);
    await admin.from("obsidian_files").upsert({
      user_id: userId,
      object_type: file.object_type,
      object_id: file.object_id || null,
      path: result.path,
      sha: result.sha || null,
      last_pushed_at: new Date().toISOString(),
      conflict_status: result.status === "failed" ? "export_failed" : "clean",
      metadata: { status: result.status, message: result.message || null }
    }, { onConflict: "user_id,path" });
  }
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  await admin.from("obsidian_sync_log").insert({
    user_id: userId,
    action: "export",
    status: failed ? "failed" : skipped ? "skipped" : "success",
    message: `Exported ${results.length - failed - skipped}/${results.length} files`,
    metadata: { results: results.slice(0, 200) }
  });
  return NextResponse.json({ ok: !failed, total: files.length, failed, skipped, results });
}
