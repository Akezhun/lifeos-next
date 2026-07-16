import { NextResponse } from "next/server";
import { ownerEmail, signupMode } from "@/lib/auth/owner";

export async function GET() {
  const mode = signupMode();
  return NextResponse.json({
    mode,
    allowPublicSignup: mode === "public",
    inviteMode: mode === "invite",
    privateMode: mode === "private",
    ownerEmailConfigured: Boolean(ownerEmail())
  });
}
