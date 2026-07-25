const SESSION_KEY = "mutuma.analyticsSession";

function sessionId() {
    try {
        const existing = localStorage.getItem(SESSION_KEY);
        if (existing) return existing;

        const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(SESSION_KEY, next);
        return next;
    } catch (error) {
        return "";
    }
}

function sendAnalytics(name, detail) {
    if (window.location.pathname.endsWith("/admin.html") || window.location.pathname === "/admin") {
        return;
    }

    const payload = JSON.stringify({
        name,
        detail,
        sessionId: sessionId(),
        pagePath: window.location.pathname
    });

    if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/.netlify/functions/collect-analytics", blob)) return;
    }

    fetch("/.netlify/functions/collect-analytics", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: payload,
        keepalive: true
    }).catch(() => {});
}

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

    sendAnalytics(name, detail);
}

trackEvent("page_viewed", {
    path: window.location.pathname,
    title: document.title
});
