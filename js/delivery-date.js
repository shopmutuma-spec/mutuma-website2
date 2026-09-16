export function estimatedDeliveryDate(order = {}) {
    const status = order.fulfilment_status || order.status || "processing";
    if (status !== "shipped") return "";
    const history = Array.isArray(order.order_status_history) ? order.order_status_history : [];
    // Notes/tracking edits on an already-shipped order must not restart the clock.
    const dispatch = history.slice().reverse().find((entry) => entry?.to === "shipped" && entry.from !== "shipped" && entry.at && Number.isFinite(Date.parse(entry.at)));
    if (!dispatch) return "";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date(dispatch.at)).map(({ type, value }) => [type, value]));
    const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
    let days = 0;
    while (days < 7) {
        date.setUTCDate(date.getUTCDate() + 1);
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days++;
    }
    return date.toISOString().slice(0, 10);
}

export function deliveryEstimateMessage(order = {}) {
    const status = order.fulfilment_status || order.status || "processing";
    if (["delivered", "refunded", "cancelled", "payment_failed", "failed"].includes(status)) return "";
    const date = estimatedDeliveryDate(order);
    if (!date) return status === "shipped"
        ? "Estimated delivery date is unavailable. Please check carrier tracking or contact us."
        : "Your estimated delivery date will be confirmed after dispatch.";
    return `Estimated delivery: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}.`;
}
