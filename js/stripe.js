import { currentCurrency } from "./currency.js?v=20260724a";

export const stripeConfig = {
    cartCheckoutLink: "",
    paymentLinks: {},
    checkoutEndpoint: "/.netlify/functions/create-checkout-session"
};

export function isStripeLink(link) {
    return typeof link === "string" && /^https:\/\/(buy|checkout)\.stripe\.com\//.test(link.trim());
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

async function createStripeCheckout(cart) {
    const response = await fetch(stripeConfig.checkoutEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            cart,
            currency: currentCurrency()
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

    window.location.href = data.url;
}

export async function checkoutProduct(productId, quantity = 1) {
    try {
        await createStripeCheckout([{ id: productId, quantity }]);
        return { ok: true };
    } catch (error) {
        const link = getStripeProductLink(productId);

        if (link) {
            window.location.href = link;
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
            window.location.href = link;
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

    window.location.href = link;
    return { ok: true };
}
