import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { defaultFeatureFlags, getUserFromBearer, ownerEmail, roleForEmail, signupMode } from "@/lib/auth/owner";

export async function POST(request: Request) {
  try {
    const admin = createAdminSupabase();
    const { user, error } = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const inviteCode = String(body.inviteCode || "").trim();
    const email = (user.email || "").toLowerCase();
    let role = roleForEmail(email);
    let features = defaultFeatureFlags(role);
    let signupStatus = "active";
    let inviteUsed: any = null;

    if (role !== "owner") {
      const mode = signupMode();
      if (mode === "private") {
        signupStatus = "blocked";
      } else if (mode === "invite") {
        if (!inviteCode) signupStatus = "pending_invite";
        else {
          const { data: invite } = await admin
            .from("workspace_invites")
            .select("*")
            .eq("invite_code", inviteCode)
            .eq("status", "active")
            .maybeSingle();
          const expired = invite?.expires_at && new Date(invite.expires_at).getTime() < Date.now();
          const exhausted = invite && Number(invite.use_count || 0) >= Number(invite.max_uses || 1);
          const emailMismatch = invite?.email && invite.email.toLowerCase() !== email;
          if (!invite || expired || exhausted || emailMismatch) signupStatus = "invalid_invite";
          else {
            role = (invite.role_on_signup || "user") as any;
            features = { ...defaultFeatureFlags(role as any), ...(invite.feature_flags || {}) };
            inviteUsed = invite;
          }
        }
      }
    }

    if (signupStatus !== "active") {
      await admin.from("user_profiles").upsert({
        user_id: user.id,
        display_name: user.email?.split("@")[0] || "LifeOS user",
        language: "ru",
        role,
        feature_flags: features,
        signup_status: signupStatus,
        invite_code_used: inviteCode || null,
        last_seen_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      return NextResponse.json({ ok: false, signupStatus, error: "Registration is not open for this account." }, { status: 403 });
    }

    await admin.from("user_profiles").upsert({
      user_id: user.id,
      display_name: user.email?.split("@")[0] || "LifeOS user",
      language: body.language || "ru",
      role,
      workspace_name: role === "owner" ? "Akezhan LifeOS" : "My LifeOS",
      feature_flags: features,
      invite_code_used: inviteCode || null,
      signup_status: "active",
      onboarding_step: "welcome",
      last_seen_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    await admin.from("settings").upsert({
      user_id: user.id,
      language: body.language || "ru",
      timezone: body.timezone || "Asia/Almaty",
      theme: "dark",
      week_start: "monday",
      time_format: "24h",
      start_page: "/",
      compact_mode: false,
      feature_flags: features,
      personal_tools_enabled: Boolean(features.personal_tools),
      obsidian_prefs: {
        enabled: Boolean(features.obsidian_sync),
        auto_export: Boolean(features.obsidian_sync),
        preserve_workspace: true,
        export_trackers: true,
        export_journals: true,
        export_schedule: true,
        export_analytics: true,
        export_tags: true
      }
    }, { onConflict: "user_id" });

    if (inviteUsed) {
      const nextUseCount = Number(inviteUsed.use_count || 0) + 1;
      await admin.from("workspace_invites").update({
        use_count: nextUseCount,
        used_by: user.id,
        used_at: new Date().toISOString(),
        status: nextUseCount >= Number(inviteUsed.max_uses || 1) ? "used" : "active"
      }).eq("id", inviteUsed.id);
    }

    return NextResponse.json({ ok: true, role, features, ownerEmailConfigured: Boolean(ownerEmail()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Profile init failed" }, { status: 500 });
  }
}
