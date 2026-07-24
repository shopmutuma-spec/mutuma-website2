export function trackEvent(name, detail = {}) {
    window.mutumaAnalytics = window.mutumaAnalytics || [];
    window.mutumaAnalytics.push({
        name,
        detail,
        timestamp: new Date().toISOString()
    });

    if (typeof window.gtag === "function") {
        window.gtag("event", name, detail);
    }

    window.dispatchEvent(new CustomEvent("mutuma:analytics", {
        detail: {
            name,
            detail
        }
    }));
}
