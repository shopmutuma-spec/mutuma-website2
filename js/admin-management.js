export function filterRows(rows, query = "", status = "", kind = "orders") {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
        const values = kind === "orders"
            ? [row.order_number, row.email, row.name, row.customer_details?.name, row.status,
                row.fulfilment_status, row.payment_status, row.tracking_number,
                ...(row.order_items || []).flatMap((item) => [item.name, item.sku, item.variant])]
            : [row.name, row.email, row.id, row.category, row.source];
        const text = values.join(" ").toLowerCase();
        return words.every((word) => text.includes(word))
            && (!status || (row.fulfilment_status || row.status || "processing") === status);
    });
}

export function pageRows(rows, page = 1, size = 25) {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(pages, Math.max(1, Math.floor(Number(page) || 1)));
    return { rows: rows.slice((current - 1) * size, current * size), page: current, pages, total: rows.length };
}

export function localDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function orderChangePrompt(orderNumber, previous, next) {
    if (previous === next) return "";
    const warning = ["refunded", "payment_failed"].includes(next)
        ? "This only changes the order record. It does not refund or change the payment with the provider."
        : ["shipped", "delivered"].includes(next) ? "This may send the customer an email." : "";
    return `Change ${orderNumber} from ${previous} to ${next}? ${warning}`.trim();
}
