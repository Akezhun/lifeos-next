import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCallerProfile, requireOwnerOrAdmin } from "@/lib/auth/owner";

export async function GET(request: Request) {
  try {
    const { user, role, error } = await getCallerProfile(request);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
    requireOwnerOrAdmin(role);
    const admin = createAdminSupabase();
    const { data: profiles, error: pError } = await admin.from("user_profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (pError) throw pError;
    return NextResponse.json({ ok: true, users: profiles || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Users failed" }, { status: 403 });
  }
}
