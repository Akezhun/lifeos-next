export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, message: "RESEND_API_KEY is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "LifeOS <onboarding@resend.dev>",
      to,
      subject,
      html: html ?? `<pre>${text ?? ""}</pre>`,
      text
    })
  });

  if (!response.ok) {
    return { ok: false, status: response.status, message: await response.text() };
  }

  return { ok: true, status: response.status, message: await response.text() };
}
