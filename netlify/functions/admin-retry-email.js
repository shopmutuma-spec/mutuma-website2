import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";
import { notifyOrder } from "./order-email.js";

export async function handler(event) {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;
    let payload;
    try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid request" }); }
    const number = String(payload.orderNumber || "").trim();
    if (!number || number.length > 64) return json(400, { error: "Order number required" });
    try {
        const rows = await supabaseRequest(`orders?select=*&order_number=eq.${encodeURIComponent(number)}&limit=1`);
        const order = rows?.[0];
        if (!order) return json(404, { error: "Order not found" });
        const kind = ["shipped", "delivered"].includes(order.fulfilment_status) ? order.fulfilment_status : "processing";
        return json(200, { notification: await notifyOrder(number, kind) });
    } catch { return json(503, { error: "Email could not be retried. Check email configuration and the database migration." }); }
}
