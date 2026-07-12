import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/sendEmail";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const to = body.to || process.env.LIFEOS_OWNER_EMAIL;
  if (!to) return NextResponse.json({ error: "No recipient" }, { status: 400 });
  const result = await sendEmail({
    to,
    subject: "LifeOS 2.0 test notification",
    text: "If you received this, email notifications are connected."
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
