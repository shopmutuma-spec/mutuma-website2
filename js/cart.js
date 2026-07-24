import { initCurrency, formatPrice } from "./currency.js?v=20260724a";
import { addToWishlist, clearCart, getCart, removeFromCart, updateCartQuantity } from "./store.js?v=20260724a";
import { checkoutCart } from "./stripe.js?v=20260724a";
import { trackEvent } from "./analytics.js?v=20260724a";
import { storeSettings } from "./site-settings.js?v=20260724a";
import { initBaseLayout, lineItemProduct, notify, productImage, submitEmailSignup, updateCounts } from "./ui.js?v=20260724a";

initBaseLayout();
initCurrency().catch(() => {});

const cartItems = document.querySelector("[data-cart-items]");
const summary = document.querySelector("[data-cart-summary]");
const FREE_SHIPPING_THRESHOLD = storeSettings.freeShippingThreshold;
const STANDARD_SHIPPING = storeSettings.standardShipping;
const params = new URLSearchParams(window.location.search);
const checkoutStatus = params.get("checkout");

if (checkoutStatus === "success") {
    clearCart();
    notify("Payment complete. Your order details are in Stripe.");
    trackEvent("purchase_completed", { sessionId: params.get("session_id") || "" });
    syncStripeCustomerEmail(params.get("session_id"));
} else if (checkoutStatus === "cancelled") {
    notify("Checkout cancelled. Your cart is still here.");
}

async function syncStripeCustomerEmail(sessionId) {
    if (!sessionId || localStorage.getItem(`mutuma.stripeEmailSynced.${sessionId}`)) return;

    try {
        const response = await fetch(`/.netlify/functions/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await response.json();

        if (!response.ok || !data.email) return;

        await submitEmailSignup(data.email, "stripe-checkout", {
            stripeSessionId: sessionId
        });
        localStorage.setItem(`mutuma.stripeEmailSynced.${sessionId}`, "true");
    } catch (error) {
        console.warn("Stripe email sync skipped.", error);
    }
}

function renderCart() {
    const cart = getCart().map(lineItemProduct).filter((line) => line.product);

    if (!cart.length) {
        cartItems.innerHTML = '<div class="empty-state">Your cart is empty.</div>';
        summary.innerHTML = "";
        updateCounts();
        return;
    }

    cartItems.innerHTML = cart.map(({ product, quantity }) => `
        <article class="cart-line">
            ${productImage(product.images[0], product.name)}
            <div>
                <strong>${product.name}</strong>
                <span>${product.category}</span>
                <button data-remove="${product.id}">Remove</button>
                <button data-save-later="${product.id}">Save for later</button>
            </div>
            <div class="quantity small">
                <button data-decrease="${product.id}">-</button>
                <input value="${quantity}" readonly aria-label="${product.name} quantity">
                <button data-increase="${product.id}">+</button>
            </div>
            <b data-price="${product.price * quantity}">${formatPrice(product.price * quantity)}</b>
        </article>
    `).join("");

    const subtotal = cart.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
    const total = subtotal + shipping;
    const progress = Math.min(100, subtotal / FREE_SHIPPING_THRESHOLD * 100);

    summary.innerHTML = `
        <div class="summary-card">
            <h2>Order Summary</h2>
            <div class="shipping-progress"><span style="width:${progress}%"></span></div>
            <p>${subtotal >= FREE_SHIPPING_THRESHOLD ? "Free shipping unlocked." : `${formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} away from free shipping.`}</p>
            <div><span>Subtotal</span><strong data-price="${subtotal}">${formatPrice(subtotal)}</strong></div>
            <div><span>Shipping</span><strong>${shipping ? formatPrice(shipping) : "Free"}</strong></div>
            <div><span>Tax</span><strong>Calculated by Stripe</strong></div>
            <div class="total"><span>Total</span><strong data-price="${total}">${formatPrice(total)}</strong></div>
            <button class="button primary wide" data-checkout>Checkout with Stripe</button>
        </div>
    `;

    cartItems.querySelectorAll("[data-increase]").forEach((button) => {
        button.addEventListener("click", () => {
            const item = getCart().find((line) => line.id === button.dataset.increase);
            updateCartQuantity(button.dataset.increase, item.quantity + 1);
            renderCart();
        });
    });

    cartItems.querySelectorAll("[data-decrease]").forEach((button) => {
        button.addEventListener("click", () => {
            const item = getCart().find((line) => line.id === button.dataset.decrease);
            updateCartQuantity(button.dataset.decrease, item.quantity - 1);
            renderCart();
        });
    });

    cartItems.querySelectorAll("[data-remove]").forEach((button) => {
        button.addEventListener("click", () => {
            removeFromCart(button.dataset.remove);
            renderCart();
        });
    });

    cartItems.querySelectorAll("[data-save-later]").forEach((button) => {
        button.addEventListener("click", () => {
            addToWishlist(button.dataset.saveLater);
            removeFromCart(button.dataset.saveLater);
            notify("Saved for later");
            renderCart();
        });
    });

    document.querySelector("[data-checkout]").addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        event.currentTarget.textContent = "Opening Stripe...";
        trackEvent("checkout_started", { source: "cart_page", value: subtotal });
        const result = await checkoutCart(getCart());
        if (!result.ok) notify(result.message);
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = "Checkout with Stripe";
    });
    updateCounts();
}

renderCart();
window.addEventListener("currencychange", renderCart);
