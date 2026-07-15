import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/notifications/sendTelegram";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const chatId = body.chatId || process.env.TELEGRAM_CHAT_ID;
  const result = await sendTelegram({ chatId, text: "LifeOS 2.0 test Telegram notification ✅" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
