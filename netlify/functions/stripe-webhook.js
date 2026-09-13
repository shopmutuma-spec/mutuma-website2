import Stripe from "stripe";
import { json } from "./supabase-client.js";
import { savePaidCheckoutSession, updateOrderPaymentStatus } from "./order-sync.js";
import { claimWebhook, finishWebhook } from "./webhook-lease.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function header(event, name) {
    return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()] || "";
}

function getOrigin(event) {
    const origin = process.env.PUBLIC_SITE_URL || header(event, "origin");
    if (origin) return origin.replace(/\/$/, "");

    const host = header(event, "host");
    return host ? `https://${host}` : "https://mutumas.com";
}

function rawBody(event) {
    return event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || "";
}

async function handleEvent(stripeEvent, event) {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(stripeEvent.type)) {
        const session = await stripe.checkout.sessions.retrieve(stripeEvent.data.object.id);

        if (session.payment_status !== "paid") {
            return { ok: true, skipped: true, reason: "session_not_paid" };
        }

        return savePaidCheckoutSession({
            stripe,
            session,
            origin: getOrigin(event),
            queueEmail: true
        });
    }

    if (stripeEvent.type === "checkout.session.async_payment_failed") {
        const session = stripeEvent.data.object;
        return updateOrderPaymentStatus({
            paymentIntent: session.payment_intent,
            paymentStatus: "failed",
            fulfilmentStatus: "payment_failed",
            eventType: stripeEvent.type
        });
    }

    if (stripeEvent.type === "charge.refunded") {
        const charge = stripeEvent.data.object;
        return updateOrderPaymentStatus({
            paymentIntent: charge.payment_intent,
            paymentStatus: charge.refunded ? "refunded" : "partially_refunded",
            fulfilmentStatus: "refunded",
            eventType: stripeEvent.type
        });
    }

    if (stripeEvent.type === "payment_intent.payment_failed") {
        const paymentIntent = stripeEvent.data.object;
        return updateOrderPaymentStatus({
            paymentIntent: paymentIntent.id,
            paymentStatus: "failed",
            fulfilmentStatus: "payment_failed",
            eventType: stripeEvent.type
        });
    }

    return { ok: true, ignored: true };
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return json(500, { error: "Stripe webhook is not configured." });
    }

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody(event), header(event, "stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        return json(400, { error: "Webhook signature verification failed." });
    }

    let lease;
    try {
        lease = await claimWebhook(stripeEvent);
        if (lease.state === "processed") {
            return json(200, { ok: true, duplicate: true });
        }
        if (lease.state === "busy") return json(503, { error: "Event processing is in progress; retry later." });

        const result = await handleEvent(stripeEvent, event);
        await finishWebhook(lease, "processed");
        return json(200, { ok: true, result });
    } catch (error) {
        if (lease?.state === "claimed") {
            try { await finishWebhook(lease, "failed"); } catch { /* The lease can be recovered on a later retry. */ }
        }
        return json(500, { error: "Webhook processing failed; retry required." });
    }
}
