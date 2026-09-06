const SESSION_KEY = "mutuma.analyticsSession";
const FIRST_TOUCH_KEY = "mutuma.firstTouch";
const LAST_TOUCH_KEY = "mutuma.lastTouch";
const STARTED_KEY = "mutuma.analyticsSessionStarted";
const SCROLL_DEPTHS = [25, 50, 75, 90];

let sentPageView = false;
let maxScrollDepth = 0;
let clickWindow = [];

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

function deviceCategory() {
    if (window.matchMedia("(max-width: 767px)").matches) return "Mobile";
    if (window.matchMedia("(max-width: 1024px)").matches) return "Tablet";
    return "Desktop";
}

function attribution() {
    const params = new URLSearchParams(window.location.search);
    const data = {
        utm_source: params.get("utm_source") || "",
        utm_medium: params.get("utm_medium") || "",
        utm_campaign: params.get("utm_campaign") || "",
        utm_content: params.get("utm_content") || "",
        utm_term: params.get("utm_term") || "",
        referrer: document.referrer || "",
        landingPage: window.location.pathname,
        capturedAt: new Date().toISOString()
    };

    try {
        const hasCampaign = Object.values(data).some(Boolean);
        if (hasCampaign && !localStorage.getItem(FIRST_TOUCH_KEY)) {
            localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
        }
        if (hasCampaign) {
            localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(data));
        }

        return {
            ...data,
            firstTouch: JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || "null"),
            lastTouch: JSON.parse(localStorage.getItem(LAST_TOUCH_KEY) || "null")
        };
    } catch (error) {
        return data;
    }
}

function baseDetail(detail = {}) {
    return {
        ...detail,
        ...attribution(),
        deviceCategory: deviceCategory(),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight
    };
}

function sendAnalytics(name, detail) {
    if (window.location.pathname.endsWith("/admin.html") || window.location.pathname === "/admin") {
        return;
    }

    const payload = JSON.stringify({
        name,
        detail: baseDetail(detail),
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

function trackSessionStarted() {
    try {
        const key = `${sessionId()}:${new Date().toISOString().slice(0, 10)}`;
        if (sessionStorage.getItem(STARTED_KEY) === key) return;
        sessionStorage.setItem(STARTED_KEY, key);
    } catch (error) {
        return;
    }

    trackEvent("session_started", {
        path: window.location.pathname,
        title: document.title
    });
}

function trackPageViewed() {
    if (sentPageView) return;
    sentPageView = true;
    trackEvent("page_viewed", {
        path: window.location.pathname,
        title: document.title
    });
}

function trackScrollDepth() {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
    if (documentHeight <= 0) return;
    const depth = Math.round(window.scrollY / documentHeight * 100);
    SCROLL_DEPTHS.forEach((target) => {
        if (depth >= target && maxScrollDepth < target) {
            maxScrollDepth = target;
            trackEvent("scroll_depth", { depth: target, path: window.location.pathname });
        }
    });
}

function trackClick(event) {
    const target = event.target.closest("a, button, [data-add-cart], [data-buy-now], [data-wishlist]");
    const now = Date.now();
    clickWindow = clickWindow.filter((time) => now - time < 1200);
    clickWindow.push(now);

    if (clickWindow.length >= 4) {
        trackEvent("rage_click", { path: window.location.pathname });
        clickWindow = [];
    }

    if (!target && event.target.closest("main, nav, footer")) {
        trackEvent("dead_click", { path: window.location.pathname });
        return;
    }

    if (target.tagName === "A" && target.href && !target.href.includes(window.location.host)) {
        trackEvent("outbound_link_clicked", {
            href: target.href,
            label: target.textContent.trim().slice(0, 120)
        });
        return;
    }

    if (target.matches("button, [data-add-cart], [data-buy-now], [data-wishlist]")) {
        trackEvent("button_clicked", {
            label: target.textContent.trim().slice(0, 120),
            action: target.dataset.addCart ? "add_to_cart" : target.dataset.buyNow ? "buy_now" : target.dataset.wishlist ? "wishlist" : "button"
        });
    }
}

function trackWebVitals() {
    if (!("PerformanceObserver" in window)) return;

    try {
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) trackEvent("web_vital", { metric: "LCP", value: Math.round(last.startTime) });
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (!entry.hadRecentInput) trackEvent("web_vital", { metric: "CLS", value: Number(entry.value || 0).toFixed(4) });
            });
        }).observe({ type: "layout-shift", buffered: true });
    } catch (error) {
        // Browser does not support one of the observers.
    }
}

window.addEventListener("error", (event) => {
    trackEvent("javascript_error", {
        message: String(event.message || "").slice(0, 240),
        source: String(event.filename || "").slice(0, 240)
    });
});

window.addEventListener("unhandledrejection", (event) => {
    trackEvent("javascript_error", {
        message: String(event.reason?.message || event.reason || "").slice(0, 240),
        source: "promise"
    });
});

document.addEventListener("click", trackClick, { passive: true });

let scrollFrameRequested = false;
window.addEventListener("scroll", () => {
    if (scrollFrameRequested) return;
    scrollFrameRequested = true;
    requestAnimationFrame(() => {
        trackScrollDepth();
        scrollFrameRequested = false;
    });
}, { passive: true });
trackSessionStarted();
trackPageViewed();
trackWebVitals();
