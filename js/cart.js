import { initCurrency, formatPrice } from "./currency.js?v=20260731c";
import { addToCart, addToWishlist, clearCart, getCart, removeFromCart, updateCartQuantity } from "./store.js?v=20260731c";
import { checkoutCart, prewarmCheckout } from "./stripe.js?v=20260731c";
import { trackEvent } from "./analytics.js?v=20260731c";
import { storeSettings } from "./site-settings.js?v=20260731c";
import { loadStoreCatalog } from "./products.js?v=20260731c";
import { cartItemCount, cartRewardDiscount, cartRewardMessage, complementaryProducts, freeShippingUpsells } from "./merchandising.js?v=20260731c";
import { freeGiftProduct, initBaseLayout, lineItemProduct, notify, productImage, submitEmailSignup, updateCounts } from "./ui.js?v=20260731c";

const cartItems = document.querySelector("[data-cart-items]");
const summary = document.querySelector("[data-cart-summary]");
const FREE_SHIPPING_THRESHOLD = storeSettings.freeShippingThreshold;
const STANDARD_SHIPPING = storeSettings.standardShipping;
const params = new URLSearchParams(window.location.search);
const checkoutStatus = params.get("checkout");

boot();

async function boot() {
    await loadStoreCatalog();
    initBaseLayout();
    initCurrency().catch(() => {});

    if (checkoutStatus === "success") {
        clearCart();
        notify("Payment complete. Your order details are in Stripe.");
        trackEvent("purchase_completed", { sessionId: params.get("session_id") || "" });
        syncStripeCustomerEmail(params.get("session_id"));
        renderPostPurchasePicks();
    } else if (checkoutStatus === "cancelled") {
        notify("Checkout cancelled. Your cart is still here.");
    }

    renderCart();
    window.addEventListener("currencychange", renderCart);
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
        cartItems.innerHTML = checkoutStatus === "success"
            ? '<div class="empty-state">Payment complete. Finish the room with these picks below.</div>'
            : '<div class="empty-state">Your cart is empty.</div>';
        summary.innerHTML = "";
        updateCounts();
        return;
    }

    const gift = freeGiftProduct(cart);
    const giftLine = gift ? `
        <article class="cart-line free-gift-line">
            ${productImage(gift.images[0], gift.name)}
            <div>
                <strong>${gift.name}</strong>
                <span>${storeSettings.freeGift.label}</span>
            </div>
            <div class="quantity small">
                <input value="1" readonly aria-label="${gift.name} free gift quantity">
            </div>
            <b>Free</b>
        </article>
    ` : "";

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
    `).join("") + giftLine;

    const subtotal = cart.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
    const itemCount = cartItemCount(cart);
    const rewardDiscount = cartRewardDiscount(subtotal, itemCount);
    const adjustedSubtotal = Math.max(0, subtotal - rewardDiscount);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
    const total = adjustedSubtotal + shipping;
    const progress = Math.min(100, subtotal / FREE_SHIPPING_THRESHOLD * 100);
    const cartProducts = cart.map((line) => line.product);
    const upsells = subtotal < FREE_SHIPPING_THRESHOLD
        ? freeShippingUpsells(cartProducts, FREE_SHIPPING_THRESHOLD - subtotal, 3)
        : complementaryProducts(cartProducts, 3);

    summary.innerHTML = `
        <div class="summary-card">
            <h2>Order Summary</h2>
            <div class="cart-reward-card">
                <strong>${gift ? "Buy one, get one free is unlocked." : cartRewardMessage(itemCount)}</strong>
                <small>${gift ? `${gift.name} is included free with this order.` : "Room rewards are applied automatically in Stripe Checkout."}</small>
            </div>
            <div class="shipping-progress"><span style="width:${progress}%"></span></div>
            <p>${subtotal >= FREE_SHIPPING_THRESHOLD ? "Free shipping unlocked." : `${formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} away from free shipping.`}</p>
            <div><span>Subtotal</span><strong data-price="${subtotal}">${formatPrice(subtotal)}</strong></div>
            ${rewardDiscount ? `<div><span>Room reward</span><strong>-${formatPrice(rewardDiscount)}</strong></div>` : ""}
            ${gift ? `<div><span>${storeSettings.freeGift.label}</span><strong>Free</strong></div>` : ""}
            <div><span>Shipping</span><strong>${shipping ? formatPrice(shipping) : "Included"}</strong></div>
            <div><span>Tax</span><strong>Calculated by Stripe</strong></div>
            <div class="total"><span>Total incl. shipping</span><strong data-price="${total}">${formatPrice(total)}</strong></div>
            <button class="button primary wide" data-checkout>Checkout with Stripe - ${formatPrice(total)}</button>
            ${upsells.length ? `
                <div class="cart-upsell-list">
                    <strong>${subtotal < FREE_SHIPPING_THRESHOLD ? "Get closer to free delivery" : "Complete your setup"}</strong>
                    ${upsells.map((product) => `
                        <button type="button" data-cart-upsell="${product.id}">
                            ${productImage(product.images[0], product.name)}
                            <span>${product.name}</span>
                            <b>${formatPrice(product.price)}</b>
                        </button>
                    `).join("")}
                </div>
            ` : ""}
        </div>
    `;

    prewarmCheckout();

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
        const checkoutButton = event.currentTarget;
        checkoutButton.disabled = true;
        checkoutButton.classList.add("is-loading");
        checkoutButton.textContent = "Opening Stripe...";
        trackEvent("checkout_started", { source: "cart_page", value: subtotal });
        const result = await checkoutCart(getCart());
        if (!result.ok) notify(result.message);
        checkoutButton.disabled = false;
        checkoutButton.classList.remove("is-loading");
        checkoutButton.textContent = `Checkout with Stripe - ${formatPrice(total)}`;
    });

    summary.querySelectorAll("[data-cart-upsell]").forEach((button) => {
        button.addEventListener("click", () => {
            addToCart(button.dataset.cartUpsell, 1);
            notify("Added to cart");
            renderCart();
        });
    });
    updateCounts();
}

function renderPostPurchasePicks() {
    const picks = complementaryProducts([], 4);
    if (!picks.length) return;

    window.setTimeout(() => {
        const section = document.createElement("section");
        section.className = "section container post-purchase-picks";
        section.innerHTML = `
            <div class="section-head">
                <div>
                    <span class="eyebrow">Still building?</span>
                    <h2>Finish the room.</h2>
                </div>
                <a href="shop.html">Shop more</a>
            </div>
            <div class="cart-upsell-grid">
                ${picks.map((product) => `
                    <a href="product.html?id=${product.id}">
                        ${productImage(product.images[0], product.name)}
                        <span>${product.name}</span>
                        <strong>${formatPrice(product.price)}</strong>
                    </a>
                `).join("")}
            </div>
        `;
        document.querySelector("main").append(section);
    }, 0);
}

