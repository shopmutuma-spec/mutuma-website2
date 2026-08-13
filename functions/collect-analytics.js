import { hasSupabaseConfig, json, supabaseRequest } from "./supabase-client.js";

const allowedEvents = new Set([
    "session_started",
    "page_viewed",
    "collection_viewed",
    "product_viewed",
    "product_image_clicked",
    "search_performed",
    "search_result_clicked",
    "filter_applied",
    "quick_view_opened",
    "add_to_cart",
    "product_added_to_cart",
    "remove_from_cart",
    "product_removed_from_cart",
    "cart_viewed",
    "wishlist_item_added",
    "wishlist_added",
    "checkout_started",
    "shipping_submitted",
    "payment_attempted",
    "payment_failed",
    "discount_applied",
    "newsletter_signup",
    "purchase_completed",
    "refund_created",
    "outbound_link_clicked",
    "button_clicked",
    "navigation_clicked",
    "form_abandoned",
    "dead_click",
    "rage_click",
    "scroll_depth",
    "web_vital",
    "javascript_error",
    "api_error",
    "broken_link"
]);

function cleanText(value, maxLength = 240) {
    return String(value || "").trim().slice(0, maxLength);
}

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function safeMetadata(detail) {
    const blockedKeys = new Set(["password", "card", "cardNumber", "cvc", "cvv", "address", "phone"]);
    const clean = {};

    Object.entries(detail || {}).forEach(([key, value]) => {
        if (blockedKeys.has(key)) return;
        if (typeof value === "string") {
            clean[key] = cleanText(value, 500);
            return;
        }
        if (typeof value === "number" || typeof value === "boolean" || value === null) {
            clean[key] = value;
            return;
        }
        if (Array.isArray(value)) {
            clean[key] = value.slice(0, 20).map((item) => typeof item === "string" ? cleanText(item, 160) : item);
        }
    });

    return clean;
}

function header(event, name) {
    return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()] || "";
}

function countryFromHeaders(event) {
    return cleanText(
        header(event, "x-nf-country") ||
        header(event, "cf-ipcountry") ||
        header(event, "cloudfront-viewer-country"),
        2
    ).toUpperCase();
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    if (!hasSupabaseConfig()) {
        return json(202, { ok: false, skipped: true });
    }

    try {
        const payload = JSON.parse(event.body || "{}");
        const eventName = cleanText(payload.name || payload.eventName, 80);

        if (!allowedEvents.has(eventName)) {
            return json(202, { ok: false, skipped: true });
        }

        const detail = payload.detail && typeof payload.detail === "object" ? payload.detail : {};
        const metadata = safeMetadata(detail);
        await supabaseRequest("analytics_events", {
            method: "POST",
            body: JSON.stringify([{
                event_name: eventName,
                session_id: cleanText(payload.sessionId, 120),
                page_path: cleanText(payload.pagePath || detail.pagePath || detail.path, 240),
                product_id: cleanText(detail.productId || detail.product_id, 160),
                product_name: cleanText(detail.name || detail.productName, 240),
                search_query: cleanText(detail.query || detail.search || detail.searchQuery, 180),
                currency: cleanText(detail.currency, 12).toUpperCase(),
                value: numberOrNull(detail.value),
                metadata,
                user_agent: cleanText(header(event, "user-agent"), 500),
                country: countryFromHeaders(event)
            }])
        });

        return json(200, { ok: true });
    } catch (error) {
        return json(202, { ok: false, skipped: true });
    }
}
