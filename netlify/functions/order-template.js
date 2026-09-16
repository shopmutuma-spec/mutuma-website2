import { deliveryEstimateMessage } from "../../js/delivery-date.js";

function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function orderTemplateVariables(order, trackingUrl) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const money = (value) => value == null || !Number.isFinite(Number(value)) ? "Not recorded" : new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency || "USD" }).format(Number(value));
    const shipping = order.shipping_details || order.customer_details?.shipping || order.customer_details || {};
    const address = shipping.address || shipping;
    const date = new Date(order.created_at);
    let image = new URL("/images/products/product-placeholder.svg", trackingUrl);
    try {
        const candidate = new URL(items.find((item) => item.image_url)?.image_url || image.href, trackingUrl);
        if (candidate.protocol === "https:") image = candidate;
    } catch { /* Keep the placeholder for malformed historical image URLs. */ }
    const variables = {
        CUSTOMER_NAME: order.name || order.customer_details?.name || "there",
        ORDER_NUMBER: order.order_number,
        ORDER_DATE: Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Europe/London" }) : "",
        PRODUCT_IMAGE_URL: image.href,
        PRODUCT_NAME: items.map((item) => `${item.name || item.product_id || "Product"}${items.length > 1 ? ` (x${item.quantity || 1})` : ""}`).join("; ") || "View your order for product details",
        PRODUCT_OPTIONS: items.map((item) => [items.length > 1 ? item.name : "", item.variant, item.sku ? `SKU: ${item.sku}` : ""].filter(Boolean).join(" / ")).filter(Boolean).join("; "),
        QUANTITY: String(items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)),
        LINE_TOTAL: items.length && items.every((item) => item.line_total != null || item.amount_total != null) ? money(items.reduce((sum, item) => sum + Number(item.line_total ?? item.amount_total), 0)) : "See order total below",
        SUBTOTAL: money(order.subtotal), DISCOUNT: money(order.discounts),
        SHIPPING: money(order.shipping_cost), TAX: money(order.tax), TOTAL_PAID: money(order.total),
        TRACKING_URL: trackingUrl,
        DELIVERY_ADDRESS: [shipping.name, address.line1, address.line2, address.city, address.state, address.postal_code, address.country].filter(Boolean).join(", ") || "View your order for delivery details",
        DELIVERY_ESTIMATE: deliveryEstimateMessage(order).replace(/^Estimated delivery: /, "").replace(/\.$/, ""),
        BUSINESS_POSTAL_ADDRESS: process.env.BUSINESS_POSTAL_ADDRESS || ""
    };
    return Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]));
}
