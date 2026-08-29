import { hasSupabaseConfig, supabaseRequest } from "./supabase-client.js";
import { queueTrackingEmail } from "./mailer-lite.js";

const ORDER_HISTORY_LIMIT = 40;
const IMAGE_PLACEHOLDER = "images/products/product-placeholder.svg";

function cleanText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

function amountFromStripe(value) {
    return Number.isFinite(Number(value)) ? Number((Number(value) / 100).toFixed(2)) : null;
}

function orderNumberFromSession(sessionId) {
    return String(sessionId || "").replace(/^cs_(test|live)_/, "").slice(0, 12).toUpperCase();
}

function customerEmail(session) {
    return cleanText(session.customer_details?.email || session.customer_email || "", 180).toLowerCase();
}

function customerName(session) {
    return cleanText(session.customer_details?.name || session.shipping_details?.name || "", 180);
}

function paymentStatusFromSession(session) {
    if (session.payment_status === "paid") return "paid";
    if (session.status === "expired") return "expired";
    return cleanText(session.payment_status || session.status || "unpaid", 40).toLowerCase();
}

function lineItemMetadata(item) {
    const product = item.price?.product;
    return product && typeof product === "object" ? product.metadata || {} : {};
}

function lineItemImage(item, metadata) {
    const product = item.price?.product;
    const stripeImage = product && typeof product === "object" && Array.isArray(product.images) ? product.images[0] : "";
    return cleanText(metadata.image_url || stripeImage || IMAGE_PLACEHOLDER, 500);
}

export function buildOrderItemsFromStripe(lineItems, session) {
    return (lineItems?.data || []).map((item) => {
        const metadata = lineItemMetadata(item);
        const quantity = Number(item.quantity || 1);
        const amountSubtotal = amountFromStripe(item.amount_subtotal);
        const amountDiscount = amountFromStripe(item.amount_discount);
        const amountTax = amountFromStripe(item.amount_tax);
        const amountTotal = amountFromStripe(item.amount_total);
        const unitPrice = quantity && amountTotal !== null ? Number((amountTotal / quantity).toFixed(2)) : amountTotal;
        const currency = cleanText(item.currency || session.currency || "usd", 12).toUpperCase();

        return {
            product_id: cleanText(metadata.product_id || "", 160),
            sku: cleanText(metadata.sku || metadata.product_id || "", 160),
            name: cleanText(item.description || item.price?.product?.name || metadata.product_name || "Product", 240),
            variant: cleanText(metadata.variant || "", 180),
            category: cleanText(metadata.category || "", 120),
            image_url: lineItemImage(item, metadata),
            quantity,
            unit_price: unitPrice,
            line_total: amountTotal,
            amount_subtotal: amountSubtotal,
            amount_discount: amountDiscount,
            amount_tax: amountTax,
            amount_total: amountTotal,
            currency,
            stripe_price_id: cleanText(item.price?.id || "", 160)
        };
    });
}

function orderTotals(session) {
    const totalDetails = session.total_details || {};

    return {
        subtotal: amountFromStripe(session.amount_subtotal),
        discounts: amountFromStripe(totalDetails.amount_discount),
        tax: amountFromStripe(totalDetails.amount_tax),
        shipping_cost: amountFromStripe(session.shipping_cost?.amount_total || totalDetails.amount_shipping),
        total: amountFromStripe(session.amount_total)
    };
}

function orderHistory(eventType, fromStatus, toStatus, note = "") {
    return [{
        at: new Date().toISOString(),
        event: cleanText(eventType, 80),
        from: cleanText(fromStatus, 80),
        to: cleanText(toStatus, 80),
        note: cleanText(note, 240)
    }];
}

export function appendOrderHistory(existingHistory, entry) {
    const current = Array.isArray(existingHistory) ? existingHistory : [];
    return [...current, entry].slice(-ORDER_HISTORY_LIMIT);
}

async function existingOrderBySession(sessionId) {
    const rows = await supabaseRequest(`orders?select=order_number,email,status,payment_status,fulfilment_status,order_status_history&stripe_session_id=eq.${encodeURIComponent(sessionId)}&limit=1`);
    return rows?.[0] || null;
}

async function syncSubscriber(session) {
    const email = customerEmail(session);
    if (!email) return;

    await supabaseRequest("subscribers?on_conflict=email", {
        method: "POST",
        body: JSON.stringify([{
            email,
            source: "stripe-checkout",
            stripe_session_id: session.id
        }])
    });
}

async function decrementInventory(orderItems) {
    await Promise.all(orderItems
        .filter((item) => item.product_id && Number(item.quantity || 0) > 0)
        .map(async (item) => {
            try {
                const rows = await supabaseRequest(`catalog_products?select=id,stock&id=eq.${encodeURIComponent(item.product_id)}&limit=1`);
                const product = rows?.[0];
                if (!product || product.stock === null || product.stock === undefined) return;

                await supabaseRequest(`catalog_products?id=eq.${encodeURIComponent(item.product_id)}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        stock: Math.max(0, Number(product.stock || 0) - Number(item.quantity || 1))
                    })
                });
            } catch (error) {
                console.warn("Inventory update skipped.", error);
            }
        }));
}

async function queueCustomerEmail(session, orderNumber, origin) {
    const email = customerEmail(session);
    if (!email) return { ok: false, skipped: true };

    const trackingUrl = `${origin}/tracking.html?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`;
    try {
        return await queueTrackingEmail({
            email,
            name: customerName(session),
            orderNumber,
            trackingUrl
        });
    } catch (error) {
        console.warn("MailerLite tracking email skipped.", error);
        return { ok: false };
    }
}

export async function savePaidCheckoutSession({ stripe, session, origin, queueEmail = true }) {
    const orderNumber = orderNumberFromSession(session.id);
    const email = customerEmail(session);
    const paymentStatus = paymentStatusFromSession(session);

    if (!hasSupabaseConfig()) {
        return { ok: false, skipped: true, orderNumber, email, created: false };
    }

    const existing = await existingOrderBySession(session.id);
    if (existing) {
        return {
            ok: true,
            orderNumber: existing.order_number || orderNumber,
            email: existing.email || email,
            created: false,
            alreadyExists: true
        };
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
        limit: 100
    });
    const orderItems = buildOrderItemsFromStripe(lineItems, session);
    const totals = orderTotals(session);
    const fulfilmentStatus = paymentStatus === "paid" ? "processing" : "pending";
    const history = orderHistory("checkout.session.completed", "", fulfilmentStatus, "Order created after verified Stripe payment.");

    await supabaseRequest("orders?on_conflict=stripe_session_id", {
        method: "POST",
        body: JSON.stringify([{
            stripe_session_id: session.id,
            stripe_payment_intent: cleanText(session.payment_intent, 180),
            order_number: orderNumber,
            email,
            name: customerName(session),
            subtotal: totals.subtotal,
            discounts: totals.discounts,
            tax: totals.tax,
            shipping_cost: totals.shipping_cost,
            total: totals.total,
            currency: cleanText(session.currency || "usd", 12).toUpperCase(),
            status: fulfilmentStatus,
            payment_status: paymentStatus,
            fulfilment_status: fulfilmentStatus,
            delivery_method: cleanText(session.shipping_cost?.shipping_rate || session.shipping_options?.[0]?.shipping_rate || "Tracked shipping", 180),
            order_items: orderItems,
            customer_details: {
                ...(session.customer_details || {}),
                shipping: session.shipping_details || {}
            },
            billing_details: session.customer_details || {},
            shipping_details: session.shipping_details || {},
            order_status_history: history
        }])
    });

    await Promise.allSettled([
        syncSubscriber(session),
        decrementInventory(orderItems),
        queueEmail ? queueCustomerEmail(session, orderNumber, origin) : Promise.resolve({ ok: false, skipped: true })
    ]);

    return { ok: true, orderNumber, email, created: true };
}

export async function updateOrderPaymentStatus({ paymentIntent, paymentStatus, fulfilmentStatus = "", eventType = "stripe.event" }) {
    if (!hasSupabaseConfig() || !paymentIntent) return { ok: false, skipped: true };

    const rows = await supabaseRequest(`orders?select=order_number,status,payment_status,fulfilment_status,order_status_history&stripe_payment_intent=eq.${encodeURIComponent(paymentIntent)}&limit=1`);
    const order = rows?.[0];
    if (!order) return { ok: false, notFound: true };

    const nextFulfilmentStatus = fulfilmentStatus || order.fulfilment_status || order.status || "processing";
    const historyEntry = {
        at: new Date().toISOString(),
        event: cleanText(eventType, 80),
        from: cleanText(order.payment_status || "", 80),
        to: cleanText(paymentStatus, 80),
        note: "Payment status updated from Stripe."
    };

    await supabaseRequest(`orders?order_number=eq.${encodeURIComponent(order.order_number)}`, {
        method: "PATCH",
        body: JSON.stringify({
            payment_status: cleanText(paymentStatus, 40),
            fulfilment_status: nextFulfilmentStatus,
            status: nextFulfilmentStatus,
            order_status_history: appendOrderHistory(order.order_status_history, historyEntry)
        })
    });

    return { ok: true, orderNumber: order.order_number };
}
