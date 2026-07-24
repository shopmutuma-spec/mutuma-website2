import Stripe from "stripe";
import { hasSupabaseConfig, supabaseRequest } from "./supabase-client.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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

        await saveOrder(session);

        return json(200, {
            email: session.customer_details?.email || session.customer_email || "",
            name: session.customer_details?.name || "",
            sessionId: session.id
        });
    } catch (error) {
        return json(500, { error: error.message || "Unable to read checkout session." });
    }
}

async function saveOrder(session) {
    if (!hasSupabaseConfig()) return;

    const email = session.customer_details?.email || session.customer_email || "";
    const orderNumber = session.id.replace(/^cs_(test|live)_/, "").slice(0, 12).toUpperCase();

    try {
        await supabaseRequest("orders?on_conflict=stripe_session_id", {
            method: "POST",
            body: JSON.stringify([{
                stripe_session_id: session.id,
                order_number: orderNumber,
                email,
                name: session.customer_details?.name || "",
                total: session.amount_total ? session.amount_total / 100 : null,
                currency: String(session.currency || "gbp").toUpperCase(),
                status: session.payment_status,
                customer_details: session.customer_details || {}
            }])
        });
    } catch (error) {
        console.warn("Supabase order sync skipped.", error);
    }
}
