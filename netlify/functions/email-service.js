import { createHash } from "node:crypto";

export async function sendEmail({ to, subject, text, replyTo }) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!key || !from) throw new Error("Email sending is not configured.");
    const body = JSON.stringify({ from: `MUTUMA <${from}>`, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) });
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": createHash("sha256").update(body).digest("hex") },
        body
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status}).`);
    const result = await response.json();
    if (!result.id) throw new Error("Email provider did not confirm acceptance.");
    return result.id;
}
