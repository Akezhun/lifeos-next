export async function sendTelegram({ chatId, text }: { chatId: string; text: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, status: 0, message: "TELEGRAM_BOT_TOKEN is not configured" };
  if (!chatId) return { ok: false, status: 0, message: "Telegram chat id is missing" };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
  });
  const body = await response.text();
  if (!response.ok) return { ok: false, status: response.status, message: body };
  return { ok: true, status: response.status, message: body };
}
