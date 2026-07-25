import { hasSupabaseConfig, json, supabaseRequest } from "./supabase-client.js";

const allowedEvents = new Set([
    "page_viewed",
    "product_viewed",
    "search_performed",
    "product_added_to_cart",
    "product_removed_from_cart",
    "wishlist_item_added",
    "checkout_started",
    "newsletter_signup",
    "purchase_completed"
]);

function cleanText(value, maxLength = 240) {
    return String(value || "").trim().slice(0, maxLength);
}

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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
                metadata: detail,
                user_agent: cleanText(header(event, "user-agent"), 500),
                country: countryFromHeaders(event)
            }])
        });

        return json(200, { ok: true });
    } catch (error) {
        return json(202, { ok: false, skipped: true });
    }
}
