import Stripe from "stripe";
import { savePaidCheckoutSession } from "./order-sync.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function getOrigin(event) {
    const origin = event.headers.origin || event.headers.Origin;
    if (origin) return origin;

    const host = event.headers.host || event.headers.Host;
    return host ? `https://${host}` : "https://mutumas.com";
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return json(500, { error: "Stripe secret key is missing." });
    }

    const sessionId = event.queryStringParameters?.session_id;

    if (!sessionId || !sessionId.startsWith("cs_")) {
        return json(400, { error: "Stripe checkout session ID is missing." });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
            return json(400, { error: "Checkout session is not paid." });
        }

        const result = await savePaidCheckoutSession({
            stripe,
            session,
            origin: getOrigin(event),
            queueEmail: true
        });
        const orderNumber = result.orderNumber;
        const email = result.email || session.customer_details?.email || session.customer_email || "";
        const trackingUrl = `${getOrigin(event)}/tracking.html?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`;

        return json(200, {
            email,
            name: session.customer_details?.name || "",
            orderNumber,
            trackingUrl,
            trackingEmailQueued: result.created,
            alreadyExists: Boolean(result.alreadyExists),
            sessionId: session.id
        });
    } catch (error) {
        return json(500, { error: error.message || "Unable to read checkout session." });
    }
}
