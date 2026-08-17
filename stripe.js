import { currentCurrency, readyCurrency } from "./currency.js?v=20260816a";

export const stripeConfig = {
    cartCheckoutLink: "",
    paymentLinks: {},
    checkoutEndpoint: "/.netlify/functions/create-checkout-session"
};

let checkoutWarmupStarted = false;

export function isStripeLink(link) {
    return typeof link === "string" && /^https:\/\/(buy|checkout)\.stripe\.com\//.test(link.trim());
}

function preconnectStripe() {
    ["https://checkout.stripe.com", "https://js.stripe.com"].forEach((href) => {
        if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;

        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        link.crossOrigin = "";
        document.head.append(link);
    });
}

export function prewarmCheckout() {
    if (checkoutWarmupStarted || !stripeConfig.checkoutEndpoint) return;

    checkoutWarmupStarted = true;
    preconnectStripe();
    fetch(stripeConfig.checkoutEndpoint, {
        method: "GET",
        cache: "no-store",
        keepalive: true
    }).catch(() => {});
}

export function getStripeProductLink(productId) {
    const link = stripeConfig.paymentLinks[productId] || "";
    return isStripeLink(link) ? link.trim() : "";
}

export function getStripeCartLink(cart) {
    if (!cart.length) return "";

    if (isStripeLink(stripeConfig.cartCheckoutLink)) {
        return stripeConfig.cartCheckoutLink.trim();
    }

    if (cart.length === 1) {
        return getStripeProductLink(cart[0].id);
    }

    return "";
}

function showCheckoutFallback(url) {
    let fallback = document.querySelector("[data-checkout-fallback]");

    if (!fallback) {
        fallback = document.createElement("div");
        fallback.className = "checkout-fallback";
        fallback.setAttribute("data-checkout-fallback", "");
        document.body.append(fallback);
    }

    fallback.innerHTML = `
        <div>
            <strong>Secure checkout is ready.</strong>
            <span>If TikTok does not open it automatically, tap below.</span>
        </div>
        <a class="button primary" href="${url}" rel="noopener">Open secure checkout</a>
    `;
}

function redirectToCheckout(url) {
    showCheckoutFallback(url);

    try {
        window.location.assign(url);
    } catch (error) {
        try {
            window.top.location.href = url;
        } catch (topError) {
            const link = document.createElement("a");
            link.href = url;
            link.rel = "noopener";
            document.body.append(link);
            link.click();
            link.remove();
        }
    }
}

async function createStripeCheckout(cart) {
    const checkoutCurrency = await readyCurrency(80);
    const response = await fetch(stripeConfig.checkoutEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            cart,
            currency: checkoutCurrency || currentCurrency()
        })
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : {};

    if (!response.ok) {
        throw new Error(data.error || "Stripe backend is not running. Use Netlify dev or deploy to Netlify.");
    }

    if (!data.url) {
        throw new Error("Stripe checkout URL was not returned.");
    }

    redirectToCheckout(data.url);
}

export async function checkoutProduct(productId, quantity = 1) {
    try {
        await createStripeCheckout([{ id: productId, quantity }]);
        return { ok: true };
    } catch (error) {
        const link = getStripeProductLink(productId);

        if (link) {
            redirectToCheckout(link);
            return { ok: true };
        }

        return {
            ok: false,
            message: error.message || "Stripe checkout is not ready yet."
        };
    }
}

export async function checkoutCart(cart) {
    try {
        await createStripeCheckout(cart);
        return { ok: true };
    } catch (error) {
        const link = getStripeCartLink(cart);

        if (link) {
            redirectToCheckout(link);
            return { ok: true };
        }

        return {
            ok: false,
            message: error.message || "Stripe checkout is not ready yet."
        };
    }
}

export function checkoutProductLink(productId) {
    const link = getStripeProductLink(productId);

    if (!link) {
        return {
            ok: false,
            message: "Add this product's Stripe Payment Link in js/stripe.js."
        };
    }

    redirectToCheckout(link);
    return { ok: true };
}
