import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";
import { appendOrderHistory } from "./order-sync.js";
import { notifyOrder } from "./order-email.js";

const allowedStatuses = new Set(["processing", "shipped", "delivered", "refunded", "payment_failed"]);

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

        const existingRows = await supabaseRequest(`orders?select=status,fulfilment_status,order_status_history&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`);
        const existingOrder = existingRows?.[0] || {};
        if (!existingRows?.length) return json(404, { error: "Order not found." });
        const currentStatus = existingOrder.fulfilment_status || existingOrder.status || "";
        const history = appendOrderHistory(existingOrder.order_status_history, {
            at: new Date().toISOString(),
            event: "admin.order_updated",
            from: currentStatus,
            to: status,
            note: cleanText(payload.adminNotes, 240) || "Order updated in admin."
        });

        const rows = await supabaseRequest(`orders?order_number=eq.${encodeURIComponent(orderNumber)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status,
                fulfilment_status: status,
                tracking_courier: cleanText(payload.trackingCourier, 80),
                tracking_number: cleanText(payload.trackingNumber, 120),
                tracking_url: cleanText(payload.trackingUrl, 500),
                admin_notes: cleanText(payload.adminNotes, 1000),
                order_status_history: history
            })
        });

        let notification = null;
        if (currentStatus !== status && ["shipped", "delivered"].includes(status)) {
            try { notification = await notifyOrder(orderNumber, status); }
            catch { notification = { status: "failed", error: "Check email configuration and migration." }; }
        }
        return json(200, {
            notification,
            ok: true,
            order: rows?.[0] || null
        });
    } catch (error) {
        return json(500, { error: error.message || "Order could not be updated." });
    }
}
