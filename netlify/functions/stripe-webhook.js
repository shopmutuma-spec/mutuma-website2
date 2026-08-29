import Stripe from "stripe";
import { json, supabaseRequest } from "./supabase-client.js";
import { savePaidCheckoutSession, updateOrderPaymentStatus } from "./order-sync.js";

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

async function alreadyProcessed(stripeEvent) {
    const existing = await supabaseRequest(`stripe_webhook_events?select=event_id,status&event_id=eq.${encodeURIComponent(stripeEvent.id)}&limit=1`);
    if (existing?.[0]?.status === "processed" || existing?.[0]?.status === "processing") return true;

    if (existing?.[0]?.status === "failed") {
        await supabaseRequest(`stripe_webhook_events?event_id=eq.${encodeURIComponent(stripeEvent.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: "processing",
                error_message: ""
            })
        });
        return false;
    }

    await supabaseRequest("stripe_webhook_events?on_conflict=event_id", {
        method: "POST",
        body: JSON.stringify([{
            event_id: stripeEvent.id,
            event_type: stripeEvent.type,
            status: "processing"
        }])
    });

    return false;
}

async function markProcessed(stripeEvent, status, errorMessage = "") {
    try {
        await supabaseRequest(`stripe_webhook_events?event_id=eq.${encodeURIComponent(stripeEvent.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status,
                error_message: errorMessage,
                processed_at: new Date().toISOString()
            })
        });
    } catch (error) {
        console.warn("Webhook status update skipped.", error);
    }
}

async function handleEvent(stripeEvent, event) {
    if (stripeEvent.type === "checkout.session.completed") {
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

    try {
        if (await alreadyProcessed(stripeEvent)) {
            return json(200, { ok: true, duplicate: true });
        }

        const result = await handleEvent(stripeEvent, event);
        await markProcessed(stripeEvent, "processed");
        return json(200, { ok: true, result });
    } catch (error) {
        await markProcessed(stripeEvent, "failed", error.message || "Webhook processing failed.");
        return json(500, { error: error.message || "Webhook processing failed." });
    }
}
