import { supabaseRequest } from "./supabase-client.js";
import { sendEmail } from "./email-service.js";
import { orderTemplateVariables } from "./order-template.js";
import { deliveryEstimateMessage } from "../../js/delivery-date.js";

export async function notifyOrder(orderNumber, kind = "processing") {
    if (!["processing", "shipped", "delivered"].includes(kind)) throw new Error("Invalid email type.");
    const path = `orders?order_number=eq.${encodeURIComponent(orderNumber)}`;
    const orders = await supabaseRequest(`${path}&select=*&limit=1`);
    const order = orders?.[0];
    if (!order?.email || order.payment_status !== "paid") throw new Error("A paid order with a customer email is required.");
    if (order.email_notification?.kind === kind && order.email_notification?.status === "accepted") return order.email_notification;
    const notification = { kind, status: "pending", at: new Date().toISOString() };
    // Persist before sending so configuration errors and interrupted requests are visible in admin.
    await supabaseRequest(path, { method: "PATCH", body: JSON.stringify({ email_notification: notification }) });
    try {
        const url = new URL("/tracking.html", process.env.PUBLIC_SITE_URL);
        if (url.protocol !== "https:") throw new Error("PUBLIC_SITE_URL must use HTTPS.");
        // Fragment values stay out of HTTP request URLs and referrer headers.
        url.hash = new URLSearchParams({ order: orderNumber, email: order.email }).toString();
        const message = kind === "shipped" ? "Your order has shipped." : kind === "delivered" ? "Your order has been marked delivered." : "Thank you for your order. We are preparing it for dispatch.";
        notification.messageId = await sendEmail({
            to: order.email, replyTo: process.env.SUPPORT_EMAIL || "shopmutuma@gmail.com",
            subject: kind === "processing" ? `Your MUTUMA order ${orderNumber} is confirmed` : `MUTUMA order ${orderNumber} - ${kind}`,
            ...(kind === "processing" ? { template: { id: process.env.RESEND_ORDER_TEMPLATE_ID || "order-confirmation", variables: orderTemplateVariables(order, url.href) } } : {}),
            text: `${message}\n\nOrder: ${orderNumber}\nTrack your order: ${url.href}\n\n${deliveryEstimateMessage(order)}\n\nFor help, reply to this email.`
        });
        notification.status = "accepted";
    } catch (error) {
        notification.status = "failed";
        notification.error = error.message;
    }
    await supabaseRequest(path, { method: "PATCH", body: JSON.stringify({ email_notification: notification }) });
    return notification;
}
