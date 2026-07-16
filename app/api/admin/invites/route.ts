import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { defaultFeatureFlags, getCallerProfile, requireOwnerOrAdmin } from "@/lib/auth/owner";

function code() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8))).map((n) => n.toString(36).padStart(2, "0")).join("").slice(0, 12).toUpperCase();
}

export async function GET(request: Request) {
  try {
    const { user, role, error } = await getCallerProfile(request);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
    requireOwnerOrAdmin(role);
    const admin = createAdminSupabase();
    const { data, error: qError } = await admin.from("workspace_invites").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (qError) throw qError;
    return NextResponse.json({ ok: true, invites: data || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Invites failed" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, role, error } = await getCallerProfile(request);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
    requireOwnerOrAdmin(role);
    const body = await request.json().catch(() => ({}));
    const roleOnSignup = body.role === "admin" ? "admin" : "user";
    const flags = { ...defaultFeatureFlags(roleOnSignup), ...(body.feature_flags || {}) };
    const row = {
      user_id: user.id,
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      invite_code: body.invite_code ? String(body.invite_code).trim() : code(),
      status: "active",
      expires_at: body.expires_at || null,
      max_uses: Math.max(1, Number(body.max_uses || 1)),
      role_on_signup: roleOnSignup,
      feature_flags: flags
    };
    const admin = createAdminSupabase();
    const { data, error: qError } = await admin.from("workspace_invites").insert(row).select("*").single();
    if (qError) throw qError;
    return NextResponse.json({ ok: true, invite: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Create invite failed" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, role, error } = await getCallerProfile(request);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
    requireOwnerOrAdmin(role);
    const body = await request.json().catch(() => ({}));
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing invite id" }, { status: 400 });
    const admin = createAdminSupabase();
    const { data, error: qError } = await admin.from("workspace_invites").update({ status: body.status || "revoked" }).eq("id", body.id).eq("user_id", user.id).select("*").single();
    if (qError) throw qError;
    return NextResponse.json({ ok: true, invite: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Update invite failed" }, { status: 403 });
  }
}
