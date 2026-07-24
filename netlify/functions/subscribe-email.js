import { hasSupabaseConfig, json, supabaseRequest } from "./supabase-client.js";

function cleanEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function isEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    if (!hasSupabaseConfig()) {
        return json(503, { error: "Supabase is not configured yet." });
    }

    try {
        const payload = JSON.parse(event.body || "{}");
        const email = cleanEmail(payload.email);
        const source = String(payload.source || "website").slice(0, 80);
        const stripeSessionId = String(payload.stripeSessionId || "").slice(0, 120);

        if (!isEmail(email)) {
            return json(400, { error: "Please enter a valid email address." });
        }

        const rows = await supabaseRequest("subscribers?on_conflict=email", {
            method: "POST",
            body: JSON.stringify([{
                email,
                source,
                stripe_session_id: stripeSessionId || null,
                subscribed_at: new Date().toISOString()
            }])
        });

        return json(200, {
            ok: true,
            subscriber: rows?.[0] || { email, source }
        });
    } catch (error) {
        return json(500, { error: error.message || "Email signup could not be saved." });
    }
}
