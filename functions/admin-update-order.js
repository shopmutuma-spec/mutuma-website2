import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

const allowedStatuses = new Set(["paid", "processing", "shipped", "delivered", "refunded"]);

function cleanText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    try {
        const payload = JSON.parse(event.body || "{}");
        const orderNumber = cleanText(payload.orderNumber, 64).toUpperCase();
        const status = cleanText(payload.status, 32).toLowerCase();

        if (!orderNumber) {
            return json(400, { error: "Order number is required." });
        }

        if (!allowedStatuses.has(status)) {
            return json(400, { error: "Choose a valid order status." });
        }

        const rows = await supabaseRequest(`orders?order_number=eq.${encodeURIComponent(orderNumber)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status,
                tracking_courier: cleanText(payload.trackingCourier, 80),
                tracking_number: cleanText(payload.trackingNumber, 120),
                tracking_url: cleanText(payload.trackingUrl, 500),
                admin_notes: cleanText(payload.adminNotes, 1000)
            })
        });

        return json(200, {
            ok: true,
            order: rows?.[0] || null
        });
    } catch (error) {
        return json(500, { error: error.message || "Order could not be updated." });
    }
}
