export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function safeImageUrl(value) {
    const text = String(value || "").trim();
    if (/^\/?images\/[a-z0-9_./% -]+$/i.test(text) && !text.includes("..")) return text;
    try {
        const url = new URL(text);
        if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { /* Missing or invalid images use the local fallback. */ }
    return "/images/products/product-placeholder.svg";
}
