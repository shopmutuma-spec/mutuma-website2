import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

function cleanText(value, maxLength = 180) {
    return String(value || "").trim().slice(0, maxLength);
}

function cleanPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(number, 90));
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    try {
        const payload = JSON.parse(event.body || "{}");
        const offer = {
            name: cleanText(payload.name) || "Store offer",
            discount_percent: cleanPercent(payload.discountPercent),
            scope: "all",
            enabled: Boolean(payload.enabled),
            starts_at: payload.startsAt || null,
            ends_at: payload.endsAt || null
        };

        if (!offer.discount_percent) {
            return json(400, { error: "Discount percent is required." });
        }

        const path = payload.id ? `store_offers?id=eq.${encodeURIComponent(payload.id)}` : "store_offers";
        const method = payload.id ? "PATCH" : "POST";
        const saved = await supabaseRequest(path, {
            method,
            body: JSON.stringify(payload.id ? offer : [offer])
        });

        return json(200, { ok: true, offer: Array.isArray(saved) ? saved[0] : saved });
    } catch (error) {
        return json(500, { error: error.message || "Offer could not be saved." });
    }
}
