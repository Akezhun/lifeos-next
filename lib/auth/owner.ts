import { createAdminSupabase } from "@/lib/supabase/admin";

export type LifeOSRole = "owner" | "admin" | "user";

export function ownerEmail() {
  return (process.env.LIFEOS_OWNER_EMAIL || "").trim().toLowerCase();
}

export function signupMode(): "public" | "invite" | "private" {
  if (process.env.ALLOW_PUBLIC_SIGNUP === "true") return "public";
  const mode = (process.env.LIFEOS_SIGNUP_MODE || "invite").toLowerCase();
  if (mode === "public" || mode === "private" || mode === "invite") return mode as any;
  return "invite";
}

export function defaultFeatureFlags(role: LifeOSRole) {
  const owner = role === "owner";
  const admin = role === "admin" || owner;
  return {
    personal_tools: owner,
    obsidian_sync: owner,
    admin_panel: admin,
    experimental_features: owner
  };
}

export function roleForEmail(email?: string | null): LifeOSRole {
  const normalized = (email || "").trim().toLowerCase();
  return normalized && normalized === ownerEmail() ? "owner" : "user";
}

export async function getUserFromBearer(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { user: null, error: "Missing bearer token" };
  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { user: null, error: error?.message || "Invalid bearer token" };
  return { user: data.user, error: null };
}

export async function getCallerProfile(request: Request) {
  const { user, error } = await getUserFromBearer(request);
  if (!user) return { user: null, profile: null, role: null, error };
  const admin = createAdminSupabase();
  const expectedRole = roleForEmail(user.email);
  const { data: existing } = await admin.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const role = (existing?.role || expectedRole) as LifeOSRole;
  if (!existing) {
    const features = defaultFeatureFlags(expectedRole);
    await admin.from("user_profiles").upsert({
      user_id: user.id,
      display_name: user.email?.split("@")[0] || "LifeOS user",
      language: "ru",
      role: expectedRole,
      workspace_name: expectedRole === "owner" ? "Akezhan LifeOS" : "My LifeOS",
      feature_flags: features,
      signup_status: "active",
      onboarding_done: false,
      onboarding_step: "welcome",
      last_seen_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    await admin.from("settings").upsert({ user_id: user.id, feature_flags: features, personal_tools_enabled: features.personal_tools }, { onConflict: "user_id" });
    return { user, profile: { role: expectedRole, feature_flags: features }, role: expectedRole, error: null };
  }
  if (expectedRole === "owner" && existing.role !== "owner") {
    const features = defaultFeatureFlags("owner");
    await admin.from("user_profiles").update({ role: "owner", feature_flags: features, last_seen_at: new Date().toISOString() }).eq("user_id", user.id);
    await admin.from("settings").upsert({ user_id: user.id, feature_flags: features, personal_tools_enabled: true }, { onConflict: "user_id" });
    return { user, profile: { ...existing, role: "owner", feature_flags: features }, role: "owner", error: null };
  }
  await admin.from("user_profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", user.id);
  return { user, profile: existing, role, error: null };
}

export function requireOwnerOrAdmin(role: string | null | undefined) {
  if (role !== "owner" && role !== "admin") throw new Error("Owner/admin access required");
}
