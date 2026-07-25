import { json, supabaseRequest } from "./supabase-client.js";

function cleanText(value, maxLength = 120) {
    return String(value || "").trim().slice(0, maxLength);
}

function publicMessage(order) {
    const status = String(order.status || "paid").toLowerCase();
    const trackingNumber = cleanText(order.tracking_number);
    const courier = cleanText(order.tracking_courier, 80);

    if (status === "shipped" && trackingNumber) {
        return `Your order has shipped with ${courier || "the courier"}. Tracking number: ${trackingNumber}.`;
    }

    const messages = {
        paid: "Your order has been paid and is waiting to be processed.",
        processing: "Your order is being prepared.",
        shipped: "Your order has shipped. Tracking details will be added when available.",
        delivered: "Your order is marked as delivered.",
        refunded: "This order is marked as refunded."
    };

    return messages[status] || "Your order has been received.";
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        const payload = JSON.parse(event.body || "{}");
        const orderNumber = cleanText(payload.orderNumber, 64).toUpperCase();
        const email = cleanText(payload.email, 180).toLowerCase();

        if (!orderNumber || !email) {
            return json(400, { error: "Order number and email are required." });
        }

        const orders = await supabaseRequest(`orders?select=order_number,email,status,tracking_courier,tracking_number,created_at&order_number=eq.${encodeURIComponent(orderNumber)}&email=eq.${encodeURIComponent(email)}&limit=1`);

        if (!orders.length) {
            return json(404, { error: "Order not found." });
        }

        return json(200, {
            message: publicMessage(orders[0]),
            order: {
                orderNumber: orders[0].order_number,
                status: orders[0].status,
                createdAt: orders[0].created_at
            }
        });
    } catch (error) {
        return json(500, { error: error.message || "Order tracking is unavailable." });
    }
}
