import { SupabaseClient } from "@supabase/supabase-js";

let lastSync = 0;

export async function triggerObsidianAutoExport(sb: SupabaseClient, reason = "change") {
  try {
    const now = Date.now();
    if (now - lastSync < 5000) return;
    lastSync = now;
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    fetch("/api/obsidian/export", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ auto: true, reason }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}
