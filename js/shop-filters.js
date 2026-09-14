export const priceBands = ["All", "under-25", "25-50", "50-100", "over-100"];

export function normalizePriceBand(value) {
    const legacy = ["All", "Under \u00a325", "\u00a325 to \u00a350", "\u00a350 to \u00a3100", "Over \u00a3100"];
    return priceBands.includes(value) ? value : priceBands[legacy.indexOf(value)] || "All";
}

export function priceBandLabel(value, format) {
    const labels = {
        All: "All",
        "under-25": `Under ${format(25)}`,
        "25-50": `${format(25)} to ${format(50)}`,
        "50-100": `${format(50)} to ${format(100)}`,
        "over-100": `Over ${format(100)}`
    };
    return labels[value] || "All";
}

export function matchesPriceBand(price, band) {
    if (band === "under-25") return price < 25;
    if (band === "25-50") return price >= 25 && price <= 50;
    if (band === "50-100") return price > 50 && price <= 100;
    if (band === "over-100") return price > 100;
    return true;
}

export function shopSearchParams(state) {
    const params = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
        if (value && value !== "All" && !(key === "sort" && value === "featured")) {
            params.set(key === "query" ? "q" : key, value);
        }
    });
    return params;
}
