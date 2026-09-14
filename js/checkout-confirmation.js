export async function confirmCheckout(sessionId, request = fetch) {
    if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId || "")) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await request(`/.netlify/functions/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`, { signal: controller.signal, cache: "no-store" });
        const order = await response.json();
        return response.ok && order.paymentStatus === "paid" && order.sessionId === sessionId && order.orderNumber ? order : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
