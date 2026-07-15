import { NextResponse } from "next/server";

export async function GET() {
  const allow = process.env.ALLOW_PUBLIC_SIGNUP === "true";
  return NextResponse.json({ allowPublicSignup: allow });
}
