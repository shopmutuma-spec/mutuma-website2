import { json } from "./supabase-client.js";
import { sendEmail } from "./email-service.js";

export async function handler(event) {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    if ((event.body || "").length > 12000) return json(413, { error: "Message is too long." });
    let data;
    try { data = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid message." }); }
    if (data.website) return json(200, { ok: true });
    const { name, email, message } = data;
    if (typeof name !== "string" || !name.trim() || name.length > 120 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof message !== "string" || message.trim().length < 10 || message.length > 5000) return json(400, { error: "Enter your name, valid email and a message of 10-5,000 characters." });
    if (!process.env.SUPPORT_EMAIL) return json(503, { error: "The form is unavailable. Please email support directly." });
    try {
        await sendEmail({ to: process.env.SUPPORT_EMAIL, replyTo: email.trim(), subject: "MUTUMA website enquiry", text: `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}` });
        return json(200, { ok: true });
    } catch { return json(503, { error: "Your message could not be sent. Please try again or email support directly." }); }
}
