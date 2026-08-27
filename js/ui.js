import { products, categories, discountPercent, findProductById, getProductById, getProductsByTag, productOptions, isNewArrival } from "./products.js?v=20260827a";
import { formatPrice, currentCurrency } from "./currency.js?v=20260827a";
import { checkoutCart, checkoutProduct, prewarmCheckout } from "./stripe.js?v=20260827a";
import { addToCart, addToWishlist, getCart, getRecentlyViewed, getWishlist, removeFromCart, toggleWishlist, updateCartQuantity } from "./store.js?v=20260827a";
import { trackEvent } from "./analytics.js?v=20260827a";
import { storeSettings } from "./site-settings.js?v=20260827a";
import { cartItemCount, cartRewardDiscount, cartRewardMessage, complementaryProducts, freeShippingUpsells, productSpendBadge } from "./merchandising.js?v=20260827a";
import { getSession, signInWithGoogle } from "./supabase-auth.js?v=20260827a";

export const icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 3 6v14h18V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>',
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4 0 7-3 7-7 0-5-4-8-5-12-3 2-5 5-5 9-1-1-2-2-2-4-2 2-3 4-3 7 0 4 3 7 8 7Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    cartPlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2 11h11l2-7H7"/><path d="M16 3v6M13 6h6"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.52Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.44l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.28.31-1.88V7.53H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.47l3.35-2.59Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.97 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.53l3.35 2.59C7.2 7.76 9.4 6 12 6Z"/></svg>'
};

function syncViewportHeight() {
    const setHeight = () => {
        document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    };

    setHeight();
    window.addEventListener("resize", setHeight, { passive: true });
    window.addEventListener("orientationchange", () => window.setTimeout(setHeight, 250), { passive: true });
    document.documentElement.classList.toggle("in-app-browser", /tiktok|musical_ly|ttwebview|bytedance|aweme|instagram|fbav|fban/i.test(navigator.userAgent));
}

export function placeholderImage(productName) {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1125">
            <rect width="900" height="1125" fill="#111111"/>
            <rect x="60" y="60" width="780" height="1005" rx="28" fill="#090909" stroke="#ffffff" stroke-opacity=".14"/>
            <circle cx="450" cy="470" r="180" fill="#ffffff" fill-opacity=".88"/>
            <text x="80" y="980" fill="#ffffff" font-family="Arial" font-size="56" font-weight="900">${productName}</text>
            <text x="80" y="1040" fill="#bdbdbd" font-family="Arial" font-size="26" font-weight="700">MUTUMA</text>
        </svg>
    `;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function productImage(image, alt, options = {}) {
    const loading = options.eager ? "eager" : "lazy";
    const priority = options.eager ? ' fetchpriority="high"' : "";
    const sizes = options.sizes || "(max-width: 620px) 50vw, (max-width: 980px) 50vw, 25vw";

    return `<img src="${image}" alt="${alt}" loading="${loading}" decoding="async"${priority} width="900" height="1125" sizes="${sizes}" onerror="this.onerror=null;const card=this.closest('[data-product-card], .gallery-thumbs button');if(card){card.remove();}else{this.remove();}">`;
}

function optionDots(options) {
    return options.colours.slice(0, 4).map((colour) => `<span aria-label="${colour}" title="${colour}"></span>`).join("");
}

function productBadges(product) {
    const badges = [];
    const discount = discountPercent(product);

    if (discount) badges.push(`${discount}% OFF`);
    badges.push(productSpendBadge(product));
    if (product.tags.includes("best-seller")) badges.push("Best Seller");
    if (isNewArrival(product)) badges.push("New");
    if (product.tags.includes("low-stock")) badges.push("Low stock");

    return badges.slice(0, 3).map((badge) => `<span>${badge}</span>`).join("");
}

export function renderHeader() {
    const header = document.querySelector("[data-header]");
    if (!header) return;
    const page = location.pathname.split("/").pop() || "index.html";
    const activeAttr = (target) => page === target ? ' aria-current="page" class="active"' : "";
    const recentMenuItems = getRecentlyViewed()
        .map(findProductById)
        .filter(Boolean)
        .slice(0, 3);

    header.innerHTML = `
        <div class="sale-ticker" role="note" aria-label="30% off everything right now.">
            <div class="sale-ticker-track">
                <span>30% off everything</span>
                <span>No code needed</span>
                <span>Limited time only</span>
                <span>No code needed</span>
                <span aria-hidden="true">30% off everything</span>
                <span aria-hidden="true">No code needed</span>
                <span aria-hidden="true">Limited time only</span>
                <span aria-hidden="true">No code needed</span>
            </div>
        </div>
        <nav class="nav">
            <button class="icon-button mobile-toggle" data-menu-toggle aria-label="Open menu">${icons.menu}</button>
            <div class="nav-group nav-left">
                <a class="icon-button${page === "index.html" ? " active" : ""}" href="index.html" aria-label="Home"${page === "index.html" ? ' aria-current="page"' : ""}>${icons.home}</a>
                <a class="icon-button${page === "shop.html" ? " active" : ""}" href="shop.html" aria-label="Shop"${page === "shop.html" ? ' aria-current="page"' : ""}>${icons.shop}</a>
                <a class="icon-button${page === "categories.html" ? " active" : ""}" href="categories.html" aria-label="Categories"${page === "categories.html" ? ' aria-current="page"' : ""}>${icons.grid}</a>
                <a class="nav-link" href="categories.html">Collections</a>
                <a class="nav-link" href="shop.html?sort=newest">New Arrivals</a>
                <a class="nav-link" href="shop.html?tag=best-seller">Best Sellers</a>
                <a class="nav-link" href="index.html#shop-room">Room Setups</a>
            </div>
            <a class="logo" href="index.html">MUTUMA</a>
            <div class="nav-group nav-right">
                <a class="icon-button" href="shop.html?tag=trending" aria-label="Trending">${icons.fire}</a>
                <button class="icon-button" data-search-open aria-label="Search">${icons.search}</button>
                <a class="icon-button${page === "account.html" ? " active" : ""}" href="account.html" aria-label="Account"${page === "account.html" ? ' aria-current="page"' : ""}>${icons.user}</a>
                <a class="icon-button" href="wishlist.html" aria-label="Wishlist">${icons.heart}<span class="count" data-wishlist-count>0</span></a>
                <button class="icon-button" data-cart-open aria-label="Open shopping bag">${icons.bag}<span class="count" data-cart-count>0</span></button>
                <span class="currency-chip" data-currency-code>${currentCurrency()}</span>
            </div>
            <button class="icon-button mobile-bag" data-cart-open aria-label="Open shopping bag">${icons.bag}<span class="count" data-cart-count>0</span></button>
        </nav>
        <div class="drawer-backdrop" data-menu-close></div>
        <aside class="mobile-menu" data-mobile-menu aria-hidden="true">
            <div class="mobile-menu-head">
                <strong>MUTUMA</strong>
                <button class="icon-button" data-menu-close aria-label="Close menu">${icons.close}</button>
            </div>
            <a href="index.html"${activeAttr("index.html")}>${icons.home} Home</a>
            <a href="shop.html"${activeAttr("shop.html")}>${icons.shop} Shop</a>
            <a href="categories.html"${activeAttr("categories.html")}>${icons.grid} Categories</a>
            <a href="shop.html?tag=trending">${icons.fire} Trending</a>
            <a href="account.html"${activeAttr("account.html")}>${icons.user} Account</a>
            <a href="wishlist.html">${icons.heart} Wishlist</a>
            <button class="button secondary" data-cart-open>${icons.bag} Cart</button>
            <button class="button secondary" data-search-open>${icons.search} Search</button>
            ${recentMenuItems.length ? `
                <div class="mobile-menu-recent">
                    <strong>Recently viewed</strong>
                    ${recentMenuItems.map((product) => `
                        <a href="product.html?id=${product.id}">
                            <img src="${product.images[0]}" alt="${product.name}" loading="lazy" decoding="async">
                            <span>${product.name}</span>
                        </a>
                    `).join("")}
                </div>
            ` : ""}
        </aside>
        <aside class="cart-drawer" data-cart-drawer aria-hidden="true" aria-label="Shopping bag">
            <div class="cart-drawer-head">
                <strong>Shopping Bag</strong>
                <button class="icon-button" data-cart-close aria-label="Close cart">${icons.close}</button>
            </div>
            <div class="cart-drawer-body" data-cart-drawer-body></div>
            <div class="cart-drawer-summary" data-cart-drawer-summary></div>
        </aside>
    `;

    const menu = header.querySelector("[data-mobile-menu]");
    const backdrop = header.querySelector("[data-menu-close]");
    const openMenu = () => {
        menu.classList.add("open");
        backdrop.classList.add("open");
        document.body.classList.add("menu-open");
        menu.setAttribute("aria-hidden", "false");
    };
    const closeMenu = () => {
        menu.classList.remove("open");
        backdrop.classList.remove("open");
        document.body.classList.remove("menu-open");
        menu.setAttribute("aria-hidden", "true");
    };

    header.querySelector("[data-menu-toggle]").addEventListener("click", openMenu);
    header.querySelectorAll("[data-menu-close], .mobile-menu a").forEach((item) => item.addEventListener("click", closeMenu));
    header.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", () => {
        closeMenu();
        openSearch();
    }));
    header.querySelectorAll("[data-cart-open]").forEach((button) => button.addEventListener("click", () => {
        closeMenu();
        openCartDrawer();
    }));
    header.querySelectorAll("[data-cart-close]").forEach((button) => button.addEventListener("click", closeCartDrawer));
    backdrop.addEventListener("click", () => {
        closeMenu();
        closeCartDrawer();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeMenu();
        closeCartDrawer();
    });
    let scrollTicking = false;
    window.addEventListener("scroll", () => {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(() => {
            header.classList.toggle("scrolled", window.scrollY > 12);
            scrollTicking = false;
        });
    }, { passive: true });
    updateCounts();
}

export function renderFooter() {
    const footer = document.querySelector("[data-footer]");
    if (!footer) return;

    footer.innerHTML = `
        <div class="container footer-grid">
            <div>
                <strong>MUTUMA</strong>
                <p>YOUR ROOM. YOUR CULTURE.</p>
                <p>Premium room finds for sharp modern spaces.</p>
            </div>
            <div>
                <strong>Shop</strong>
                <a href="shop.html">Shop</a>
                <a href="categories.html">Categories</a>
                <a href="index.html#about">About</a>
                <a href="shop.html?tag=best-seller">Best Sellers</a>
                <a href="wishlist.html">Wishlist</a>
                <a href="account.html">Account</a>
            </div>
            <div>
                <strong>Support</strong>
                <a href="contact.html">Contact</a>
                <a href="faq.html">FAQ</a>
                <a href="delivery.html">Delivery</a>
                <a href="returns.html">Returns</a>
                <a href="tracking.html">Order Tracking</a>
                <a href="admin.html">Admin</a>
            </div>
            <div>
                <strong>Legal</strong>
                <a href="privacy.html">Privacy Policy</a>
                <a href="terms.html">Terms and Conditions</a>
                <a href="policies.html#refunds">Refund Policy</a>
                <a href="policies.html#shipping">Shipping Policy</a>
            </div>
            <div>
                <strong>Social</strong>
                <a href="https://www.tiktok.com/@mutumamaret.e" rel="noopener" target="_blank">TikTok</a>
                <a href="https://www.instagram.com/" rel="noopener" target="_blank">Instagram</a>
                <a href="https://www.pinterest.com/" rel="noopener" target="_blank">Pinterest</a>
            </div>
        </div>
    `;
}

export function productCard(product, cardOptions = {}) {
    const wished = getWishlist().includes(product.id);
    const options = productOptions(product);
    return `
        <article class="product-card" data-product-card>
            <a class="product-image" href="product.html?id=${product.id}">
                ${productImage(product.images[0], product.name, { eager: cardOptions.eager, sizes: cardOptions.sizes })}
                <div class="product-badges">${productBadges(product)}</div>
            </a>
            <div class="product-info">
                <div class="product-meta">
                    <span>${product.category}</span>
                    <span>${options.type}</span>
                </div>
                <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
                <p>${product.description}</p>
                <div class="option-row">
                    <span>${options.sizes.slice(0, 2).join(" / ")}</span>
                    <div class="swatches">${optionDots(options)}</div>
                </div>
                <div class="price-row">
                    <strong data-price="${product.price}">${formatPrice(product.price)}</strong>
                    ${product.oldPrice ? `<s data-price="${product.oldPrice}">${formatPrice(product.oldPrice)}</s>` : ""}
                </div>
                <div class="card-actions">
                    <button class="button secondary quick-add-button" data-add-cart="${product.id}" aria-label="Add ${product.name} to bag" title="Add to bag">${icons.cartPlus}<span>Add to bag</span></button>
                    <button class="button primary buy-now-button" data-buy-now="${product.id}">Buy Now</button>
                    <button class="button secondary quick-view-button" data-quick-view="${product.id}">Quick View</button>
                    <button class="icon-button ${wished ? "active" : ""}" data-wishlist="${product.id}" aria-pressed="${wished}" aria-label="Add ${product.name} to wishlist">${icons.heart}</button>
                </div>
            </div>
        </article>
    `;
}

export function renderProductGrid(target, list) {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    if (!element) return;
    const isHomeRail = element.classList.contains("home-product-rail");
    if (isHomeRail) {
        element.closest(".home-section")?.classList.add("has-product-rail");
    }

    element.innerHTML = list
        .filter((product) => product.images?.[0])
        .map((product, index) => productCard(product, {
            eager: index < (isHomeRail ? 3 : 4),
            sizes: isHomeRail ? "(max-width: 620px) 52vw, (max-width: 980px) 34vw, 18vw" : undefined
        }))
        .join("");
    bindProductActions(element);
}

export function bindProductActions(root = document) {
    if (root.dataset.actionsBound) return;
    root.dataset.actionsBound = "true";

    root.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-cart]");
        const buyNowButton = event.target.closest("[data-buy-now]");
        const wishlistButton = event.target.closest("[data-wishlist]");
        const quickViewButton = event.target.closest("[data-quick-view]");

        if (addButton && root.contains(addButton)) {
            addToCart(addButton.dataset.addCart, 1);
            notify("Added to cart");
            openCartDrawer();
            return;
        }

        if (buyNowButton && root.contains(buyNowButton)) {
            const originalText = buyNowButton.textContent;
            buyNowButton.disabled = true;
            buyNowButton.classList.add("is-loading");
            buyNowButton.textContent = "Opening...";
            trackEvent("checkout_started", { source: "product_card", productId: buyNowButton.dataset.buyNow, currency: currentCurrency() });
            checkoutProduct(buyNowButton.dataset.buyNow, 1).then((result) => {
                if (!result.ok) notify(result.message);
                buyNowButton.disabled = false;
                buyNowButton.classList.remove("is-loading");
                buyNowButton.textContent = originalText;
            });
            return;
        }

        if (wishlistButton && root.contains(wishlistButton)) {
            const active = toggleWishlist(wishlistButton.dataset.wishlist);
            wishlistButton.classList.toggle("active", active);
            wishlistButton.setAttribute("aria-pressed", String(active));
            notify(active ? "Saved to wishlist" : "Removed from wishlist");
        }

        if (quickViewButton && root.contains(quickViewButton)) {
            openQuickView(quickViewButton.dataset.quickView);
        }
    });
}

export function renderCategories(target) {
    const element = document.querySelector(target);
    if (!element) return;
    element.innerHTML = categories.map((category) => `
        <a class="category-card" href="categories.html?category=${encodeURIComponent(category.name)}#category-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}">
            <img src="${category.image}" alt="${category.name}" loading="lazy" decoding="async" onerror="this.style.opacity='0';">
            <span>${category.name}</span>
        </a>
    `).join("");
}

export function updateCounts() {
    const cartCount = getCart().reduce((total, item) => total + item.quantity, 0);
    const wishlistCount = getWishlist().length;
    document.querySelectorAll("[data-cart-count]").forEach((item) => item.textContent = cartCount);
    document.querySelectorAll("[data-wishlist-count]").forEach((item) => item.textContent = wishlistCount);
}

export function renderCartDrawer() {
    const drawerBody = document.querySelector("[data-cart-drawer-body]");
    const drawerSummary = document.querySelector("[data-cart-drawer-summary]");
    if (!drawerBody || !drawerSummary) return;

    const cart = getCart().map(lineItemProduct).filter((line) => line.product);

    if (!cart.length) {
        drawerBody.innerHTML = '<div class="empty-state compact">Your cart is empty.</div>';
        drawerSummary.innerHTML = `
            <div class="drawer-recommendations">
                <strong>Start with a best seller</strong>
                ${getProductsByTag("best-seller", 2).map((product) => `
                    <a href="product.html?id=${product.id}">
                        ${productImage(product.images[0], product.name)}
                        <span>${product.name}</span>
                    </a>
                `).join("")}
            </div>
            <a class="button primary wide" href="shop.html">Shop Products</a>
        `;
        return;
    }

    drawerBody.innerHTML = cart.map(({ product, quantity }) => `
        <article class="drawer-line">
            ${productImage(product.images[0], product.name)}
            <div>
                <strong>${product.name}</strong>
                <span>${product.category}</span>
                <div class="quantity small">
                    <button data-drawer-decrease="${product.id}" aria-label="Decrease ${product.name} quantity">-</button>
                    <input value="${quantity}" readonly aria-label="${product.name} quantity">
                    <button data-drawer-increase="${product.id}" aria-label="Increase ${product.name} quantity">+</button>
                </div>
            </div>
            <div class="drawer-line-end">
                <b data-price="${product.price * quantity}">${formatPrice(product.price * quantity)}</b>
                <button data-drawer-remove="${product.id}" aria-label="Remove ${product.name}">Remove</button>
                <button data-drawer-save="${product.id}" aria-label="Save ${product.name} for later">Save for later</button>
            </div>
        </article>
    `).join("");

    const subtotal = cart.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
    const itemCount = cartItemCount(cart);
    const rewardDiscount = cartRewardDiscount(subtotal, itemCount);
    const rewardMessage = cartRewardMessage(itemCount);
    const adjustedSubtotal = Math.max(0, subtotal - rewardDiscount);
    const freeShippingThreshold = storeSettings.freeShippingThreshold;
    const shipping = subtotal >= freeShippingThreshold ? 0 : storeSettings.standardShipping;
    const total = adjustedSubtotal + shipping;
    const progress = Math.min(100, subtotal / freeShippingThreshold * 100);
    const cartProducts = cart.map((line) => line.product);
    const upsells = subtotal < freeShippingThreshold
        ? freeShippingUpsells(cartProducts, freeShippingThreshold - subtotal, 3)
        : complementaryProducts(cartProducts, 3);

    prewarmCheckout();

    drawerSummary.innerHTML = `
        <div class="cart-reward-card">
            <strong>${rewardMessage}</strong>
            <small>Multi-item rewards are applied automatically at checkout.</small>
        </div>
        <div class="shipping-progress" aria-label="Free shipping progress"><span style="width:${progress}%"></span></div>
        <small>${subtotal >= freeShippingThreshold ? "Free Europe and US delivery unlocked." : `Add ${formatPrice(freeShippingThreshold - subtotal)} more to unlock free Europe and US delivery.`}</small>
        <div><span>Subtotal</span><strong data-price="${subtotal}">${formatPrice(subtotal)}</strong></div>
        ${rewardDiscount ? `<div><span>Room reward</span><strong>-${formatPrice(rewardDiscount)}</strong></div>` : ""}
        <div><span>Shipping</span><strong>${shipping ? formatPrice(shipping) : "Included"}</strong></div>
        <div class="drawer-total"><span>Total incl. shipping</span><strong data-price="${total}">${formatPrice(total)}</strong></div>
        <button class="button primary wide" data-drawer-checkout>Checkout - ${formatPrice(total)}</button>
        <div class="checkout-trust-row">
            <span>Secure Stripe checkout</span>
            <span>5-8 day delivery</span>
            <span>30% off applied</span>
        </div>
        ${upsells.length ? `
            <div class="drawer-recommendations drawer-upsells">
                <strong>${subtotal < freeShippingThreshold ? "Add one to unlock more value" : "Complete the room"}</strong>
                ${upsells.map((product) => `
                    <button type="button" data-drawer-upsell="${product.id}">
                        ${productImage(product.images[0], product.name)}
                        <span>${product.name}<small>${formatPrice(product.price)}</small></span>
                    </button>
                `).join("")}
            </div>
        ` : ""}
        <small>30% off is already applied to product prices. No code needed.</small>
        <button class="button secondary wide" data-cart-close>Continue Shopping</button>
        <a class="button secondary wide" href="cart.html">View Full Cart</a>
    `;

    drawerBody.querySelectorAll("[data-drawer-increase]").forEach((button) => {
        button.addEventListener("click", () => {
            const item = getCart().find((line) => line.id === button.dataset.drawerIncrease);
            updateCartQuantity(button.dataset.drawerIncrease, item.quantity + 1);
            renderCartDrawer();
            updateCounts();
        });
    });

    drawerBody.querySelectorAll("[data-drawer-decrease]").forEach((button) => {
        button.addEventListener("click", () => {
            const item = getCart().find((line) => line.id === button.dataset.drawerDecrease);
            if (item.quantity <= 1) {
                removeFromCart(button.dataset.drawerDecrease);
            } else {
                updateCartQuantity(button.dataset.drawerDecrease, item.quantity - 1);
            }
            renderCartDrawer();
            updateCounts();
        });
    });

    drawerBody.querySelectorAll("[data-drawer-remove]").forEach((button) => {
        button.addEventListener("click", () => {
            removeFromCart(button.dataset.drawerRemove);
            renderCartDrawer();
            updateCounts();
            notify("Removed from cart");
        });
    });

    drawerBody.querySelectorAll("[data-drawer-save]").forEach((button) => {
        button.addEventListener("click", () => {
            addToWishlist(button.dataset.drawerSave);
            removeFromCart(button.dataset.drawerSave);
            renderCartDrawer();
            updateCounts();
            notify("Saved for later");
        });
    });

    drawerSummary.querySelectorAll("[data-drawer-upsell]").forEach((button) => {
        button.addEventListener("click", () => {
            addToCart(button.dataset.drawerUpsell, 1);
            renderCartDrawer();
            updateCounts();
            notify("Added to cart");
        });
    });

    drawerSummary.querySelector("[data-drawer-checkout]").addEventListener("click", async (event) => {
        const checkoutButton = event.currentTarget;
        checkoutButton.disabled = true;
        checkoutButton.classList.add("is-loading");
        checkoutButton.textContent = "Opening Stripe...";
        trackEvent("checkout_started", { source: "cart_drawer", value: subtotal, currency: currentCurrency() });
        const result = await checkoutCart(getCart());
        if (!result.ok) notify(result.message);
        checkoutButton.disabled = false;
        checkoutButton.classList.remove("is-loading");
        checkoutButton.textContent = `Checkout - ${formatPrice(total)}`;
    });
    drawerSummary.querySelector("[data-cart-close]").addEventListener("click", closeCartDrawer);
}

export function openCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const backdrop = document.querySelector(".drawer-backdrop");
    if (!drawer || !backdrop) return;

    renderCartDrawer();
    prewarmCheckout();
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.classList.add("menu-open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.querySelector("[data-cart-close]")?.focus();
}

export function closeCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const backdrop = document.querySelector(".drawer-backdrop");
    if (!drawer || !backdrop) return;

    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.classList.remove("menu-open");
    drawer.setAttribute("aria-hidden", "true");
}

export function updatePrices() {
    document.querySelectorAll("[data-price]").forEach((item) => {
        item.textContent = formatPrice(Number(item.dataset.price));
    });
    document.querySelectorAll("[data-currency-code]").forEach((item) => {
        item.textContent = currentCurrency();
    });
}

export function notify(message) {
    let toast = document.querySelector("[data-toast]");
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        toast.setAttribute("data-toast", "");
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.mutumaToast);
    window.mutumaToast = setTimeout(() => toast.classList.remove("show"), 1800);
}

export async function submitEmailSignup(email, source, metadata = {}) {
    const supabaseResponse = await fetch("/.netlify/functions/subscribe-email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            source,
            ...metadata
        })
    });

    if (supabaseResponse.ok) {
        trackEvent("newsletter_signup", { source, backend: "supabase" });
        return;
    }

    const body = new URLSearchParams({
        "form-name": "mutuma-email-list",
        email,
        source
    });

    const response = await fetch("/", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new Error("Email signup could not be saved.");
    }

    trackEvent("newsletter_signup", { source });
}

export function openSearch() {
    const recentKey = "mutuma.recentSearches";
    const normalizeSearch = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const fuzzyMatch = (content, query) => {
        if (!query) return true;
        if (content.includes(query)) return true;

        const queryWords = query.split(" ").filter(Boolean);
        const contentWords = content.split(" ").filter(Boolean);

        return queryWords.every((queryWord) => contentWords.some((word) => word.includes(queryWord) || queryWord.includes(word)));
    };
    const readRecent = () => {
        try {
            return JSON.parse(localStorage.getItem(recentKey) || "[]");
        } catch (error) {
            return [];
        }
    };
    const writeRecent = (query) => {
        if (!query) return;
        const next = [query, ...readRecent().filter((item) => item !== query)].slice(0, 6);
        localStorage.setItem(recentKey, JSON.stringify(next));
    };
    const modal = document.querySelector("[data-modal]");
    modal.innerHTML = `
        <div class="modal open" role="dialog" aria-modal="true" aria-label="Product search">
            <div class="modal-panel">
                <div class="modal-head">
                    <strong>Search MUTUMA</strong>
                    <button class="icon-button" data-modal-close aria-label="Close search">${icons.close}</button>
                </div>
                <input class="search-input" data-global-search placeholder="Search lighting, desk, wall art..." aria-label="Search products">
                <div class="search-suggestions" data-search-suggestions></div>
                <div class="search-results" data-global-results></div>
            </div>
        </div>
    `;

    const input = modal.querySelector("[data-global-search]");
    const results = modal.querySelector("[data-global-results]");
    const suggestions = modal.querySelector("[data-search-suggestions]");
    const close = () => {
        modal.innerHTML = "";
        document.body.classList.remove("menu-open");
        document.removeEventListener("keydown", escapeClose);
    };
    const escapeClose = (event) => {
        if (event.key === "Escape") close();
    };

    modal.querySelector("[data-modal-close]").addEventListener("click", close);
    modal.querySelector(".modal").addEventListener("click", (event) => {
        if (event.target.classList.contains("modal")) close();
    });
    document.addEventListener("keydown", escapeClose);
    document.body.classList.add("menu-open");

    let searchTrackTimer = 0;
    const render = () => {
        const query = normalizeSearch(input.value);
        const matches = products.filter((product) => {
            const options = productOptions(product);
            const content = normalizeSearch(`${product.name} ${product.description} ${product.category} ${product.tags.join(" ")} ${options.colours.join(" ")} ${options.sizes.join(" ")} ${options.roomTypes.join(" ")} ${options.styles.join(" ")} ${options.type}`);
            return fuzzyMatch(content, query);
        }).slice(0, 6);

        suggestions.innerHTML = query ? "" : `
            <div class="suggestion-group">
                <strong>Popular</strong>
                ${storeSettings.popularSearches.map((term) => `<button data-search-term="${term}">${term}</button>`).join("")}
            </div>
            ${readRecent().length ? `<div class="suggestion-group"><strong>Recent</strong>${readRecent().map((term) => `<button data-search-term="${term}">${term}</button>`).join("")}<button data-clear-searches>Clear</button></div>` : ""}
        `;

        results.innerHTML = matches.length ? matches.map((product) => `
            <a class="search-result" href="product.html?id=${product.id}">
                ${productImage(product.images[0], product.name)}
                <span><strong>${product.name}</strong><small>${product.category}</small></span>
                <b>
                    ${formatPrice(product.price)}
                    ${product.oldPrice ? `<s>${formatPrice(product.oldPrice)}</s>` : ""}
                </b>
            </a>
        `).join("") : `
            <div class="empty-state compact">
                No products found. Browse categories, view best sellers, check spelling, or try another keyword.
            </div>
        `;

        if (query.length >= 2) {
            window.clearTimeout(searchTrackTimer);
            searchTrackTimer = window.setTimeout(() => {
                trackEvent("search_performed", { query, results: matches.length });
            }, 520);
        }
    };

    input.addEventListener("input", render);
    modal.addEventListener("click", (event) => {
        const termButton = event.target.closest("[data-search-term]");
        const clearButton = event.target.closest("[data-clear-searches]");

        if (termButton) {
            input.value = termButton.dataset.searchTerm;
            writeRecent(input.value.trim().toLowerCase());
            render();
            input.focus();
        }

        if (clearButton) {
            localStorage.removeItem(recentKey);
            render();
            input.focus();
        }
    });
    input.addEventListener("keydown", (event) => {
        const links = [...results.querySelectorAll("a")];
        if (event.key === "ArrowDown" && links[0]) {
            event.preventDefault();
            links[0].focus();
        }

        if (event.key === "Enter") {
            writeRecent(normalizeSearch(input.value));
        }
    });
    results.addEventListener("click", () => {
        writeRecent(normalizeSearch(input.value));
    });
    render();
    input.focus();
}

export function openQuickView(productId) {
    const product = findProductById(productId);
    if (!product) {
        notify("This product is no longer available.");
        return;
    }

    const modal = document.querySelector("[data-modal]");
    const options = productOptions(product);
    const wished = getWishlist().includes(product.id);
    modal.innerHTML = `
        <div class="modal open" role="dialog" aria-modal="true" aria-label="${product.name} quick view">
            <div class="modal-panel quick-view-panel">
                <div class="modal-head">
                    <strong>Quick View</strong>
                    <button class="icon-button" data-modal-close aria-label="Close quick view">${icons.close}</button>
                </div>
                <div class="quick-view-grid">
                    <div>
                        <div class="quick-view-image" data-quick-image>${productImage(product.images[0], product.name)}</div>
                        <div class="gallery-thumbs">
                            ${product.images.map((image, index) => `
                                <button class="${index === 0 ? "active" : ""}" data-qv-image="${image}" aria-label="Show ${product.name} image ${index + 1}">
                                    ${productImage(image, product.name)}
                                </button>
                            `).join("")}
                        </div>
                    </div>
                    <div class="quick-view-info">
                        <span class="eyebrow">${product.category}</span>
                        <h2>${product.name}</h2>
                        <p>${product.description}</p>
                        <div class="price-large">
                            <strong data-price="${product.price}">${formatPrice(product.price)}</strong>
                            ${product.oldPrice ? `<s data-price="${product.oldPrice}">${formatPrice(product.oldPrice)}</s>` : ""}
                        </div>
                        <div class="option-row"><span>Sizes: ${options.sizes.join(", ")}</span><div class="swatches">${optionDots(options)}</div></div>
                        <div class="quantity">
                            <button data-qv-minus aria-label="Decrease quantity">-</button>
                            <input value="1" data-qv-quantity aria-label="Quantity" inputmode="numeric">
                            <button data-qv-plus aria-label="Increase quantity">+</button>
                        </div>
                        <button class="button primary wide" data-qv-add>Add to Cart</button>
                        <button class="button secondary wide" data-qv-buy>Buy Now</button>
                        <button class="button secondary wide ${wished ? "active" : ""}" data-qv-wishlist>${wished ? "Saved" : "Wishlist"}</button>
                        <a class="button secondary wide" href="product.html?id=${product.id}">Full Product Page</a>
                    </div>
                </div>
            </div>
        </div>
    `;

    let quantity = 1;
    const quantityInput = modal.querySelector("[data-qv-quantity]");
    const close = () => {
        modal.innerHTML = "";
        document.body.classList.remove("menu-open");
        document.removeEventListener("keydown", escapeClose);
    };
    const escapeClose = (event) => {
        if (event.key === "Escape") close();
        if (event.key === "Tab") trapFocus(event, modal);
    };

    document.body.classList.add("menu-open");
    document.addEventListener("keydown", escapeClose);
    modal.querySelector("[data-modal-close]").addEventListener("click", close);
    modal.querySelector(".modal").addEventListener("click", (event) => {
        if (event.target.classList.contains("modal")) close();
    });
    modal.querySelectorAll("[data-qv-image]").forEach((button) => {
        button.addEventListener("click", () => {
            modal.querySelector("[data-quick-image]").innerHTML = productImage(button.dataset.qvImage, product.name);
            modal.querySelectorAll("[data-qv-image]").forEach((item) => item.classList.toggle("active", item === button));
        });
    });
    modal.querySelector("[data-qv-minus]").addEventListener("click", () => {
        quantity = Math.max(1, quantity - 1);
        quantityInput.value = quantity;
    });
    modal.querySelector("[data-qv-plus]").addEventListener("click", () => {
        quantity += 1;
        quantityInput.value = quantity;
    });
    modal.querySelector("[data-qv-add]").addEventListener("click", () => {
        addToCart(product.id, quantity);
        notify("Added to cart");
        close();
        openCartDrawer();
    });
    modal.querySelector("[data-qv-buy]").addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        event.currentTarget.textContent = "Opening...";
        trackEvent("checkout_started", { source: "quick_view", productId: product.id, currency: currentCurrency() });
        const result = await checkoutProduct(product.id, quantity);
        if (!result.ok) {
            notify(result.message);
            event.currentTarget.disabled = false;
            event.currentTarget.textContent = "Buy Now";
        }
    });
    modal.querySelector("[data-qv-wishlist]").addEventListener("click", (event) => {
        const active = toggleWishlist(product.id);
        event.currentTarget.classList.toggle("active", active);
        event.currentTarget.textContent = active ? "Saved" : "Wishlist";
    });
    trackEvent("quick_view_opened", { productId: product.id });
    modal.querySelector("[data-modal-close]").focus();
}

function trapFocus(event, root) {
    const focusable = [...root.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

export function initBaseLayout() {
    syncViewportHeight();
    document.documentElement.classList.remove("no-js");
    renderHeader();
    renderFooter();
    updateCounts();
    updatePrices();
    renderBreakMode();
    initEmailOffer();
    prewarmCheckout();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

    document.querySelectorAll("[data-reveal]").forEach((item) => observer.observe(item));
    window.addEventListener("cartchange", updateCounts);
    window.addEventListener("cartchange", renderCartDrawer);
    window.addEventListener("wishlistchange", updateCounts);
    window.addEventListener("currencychange", updatePrices);
    window.addEventListener("currencychange", renderCartDrawer);
    window.addEventListener("cartadd", (event) => trackEvent("product_added_to_cart", event.detail));
    window.addEventListener("cartremove", (event) => trackEvent("product_removed_from_cart", event.detail));
    window.addEventListener("wishlistadd", (event) => trackEvent("wishlist_item_added", event.detail));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCartDrawer();
            const modal = document.querySelector("[data-modal]");
            if (modal) modal.innerHTML = "";
        }
    });
}

function renderBreakMode() {
    if (!storeSettings.breakMode?.enabled) return;

    const pathname = location.pathname.replace(/\/+$/, "");
    const page = pathname.split("/").pop() || "index.html";
    const allowedPages = new Set([
        "admin.html",
        "admin",
        "account.html",
        "account",
        "tracking.html",
        "tracking",
        "privacy.html",
        "privacy",
        "terms.html",
        "terms",
        "returns.html",
        "returns",
        "delivery.html",
        "delivery",
        "policies.html",
        "policies"
    ]);

    if (allowedPages.has(page) || pathname.includes("/.netlify/")) return;

    document.body.classList.add("break-mode-active");

    const shell = document.createElement("section");
    shell.className = "break-screen";
    shell.setAttribute("data-break-screen", "");
    shell.setAttribute("aria-label", "MUTUMA waiting list");
    shell.innerHTML = `
        <div class="break-screen-inner">
            <span class="eyebrow">${storeSettings.breakMode.reopenLabel}</span>
            <h1>MUTUMA</h1>
            <h2>${storeSettings.breakMode.title}</h2>
            <p>${storeSettings.breakMode.body}</p>
            <form class="break-waitlist-form" data-break-waitlist>
                <input type="email" name="email" placeholder="Email address" aria-label="Email address" autocomplete="email" required>
                <button class="button primary" type="submit">Join</button>
            </form>
        </div>
    `;

    document.body.appendChild(shell);

    const form = shell.querySelector("[data-break-waitlist]");
    const button = form.querySelector("button");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        button.textContent = "Joining...";

        try {
            await submitEmailSignup(form.email.value, storeSettings.breakMode.waitlistSource, {
                waitlist: "one-day-break"
            });
            localStorage.setItem("mutuma.emailSubscribed", "true");
            form.innerHTML = "<strong>You are on the 1-day list. We will let you know when MUTUMA reopens.</strong>";
        } catch (error) {
            notify(error.message);
            button.disabled = false;
            button.textContent = "Join";
        }
    });
}

function initEmailOffer() {
    const OFFER_KEY = "mutuma.emailOfferSeen";
    const GOOGLE_PROMPT_KEY = "mutuma.googlePromptSeen";
    const SUBSCRIBED_KEY = "mutuma.emailSubscribed";
    const page = location.pathname.split("/").pop() || "index.html";
    const skipPage = page === "account.html" || page === "admin.html";

    if (storeSettings.breakMode?.enabled || skipPage || getSession()?.access_token || localStorage.getItem(GOOGLE_PROMPT_KEY)) return;

    window.setTimeout(() => {
        const modal = document.querySelector("[data-modal]");
        if (!modal || modal.innerHTML.trim()) return;

        modal.innerHTML = `
            <div class="modal offer-modal open" data-offer-modal>
                <div class="modal-panel offer-panel">
                    <div class="modal-head">
                        <span class="eyebrow">MUTUMA account</span>
                        <button class="icon-button" data-offer-close aria-label="Close offer">${icons.close}</button>
                    </div>
                    <h2>Save your room finds.</h2>
                    <p>Sign in with Google to keep your wishlist and future order details closer. It only takes a tap.</p>
                    <button class="google-auth-button google-auth-button-large" type="button" data-google-modal-sign-in>
                        <span class="google-mark">${icons.google}</span>
                        Continue with Google
                    </button>
                    <div class="auth-divider"><span>or join the drop list</span></div>
                    <form class="offer-form" name="mutuma-email-list" data-offer-form>
                        <input type="hidden" name="form-name" value="mutuma-email-list">
                        <input type="hidden" name="source" value="first-visit-offer">
                        <input type="email" name="email" placeholder="Email address" aria-label="Email address" required>
                        <button class="button primary">Join</button>
                    </form>
                    <small>30% off is already applied. No code needed.</small>
                </div>
            </div>
        `;

        const close = () => {
            localStorage.setItem(GOOGLE_PROMPT_KEY, "true");
            localStorage.setItem(OFFER_KEY, "true");
            modal.innerHTML = "";
        };

        modal.querySelector("[data-offer-close]").addEventListener("click", close);
        modal.querySelector("[data-offer-modal]").addEventListener("click", (event) => {
            if (event.target.classList.contains("offer-modal")) close();
        });
        modal.querySelector("[data-google-modal-sign-in]").addEventListener("click", async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            localStorage.setItem(GOOGLE_PROMPT_KEY, "true");

            try {
                await signInWithGoogle();
            } catch (error) {
                notify(error.message);
                button.disabled = false;
            }
        });
        modal.querySelector("[data-offer-form]").addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector("button");
            button.disabled = true;
            button.textContent = "Saving...";

            try {
                await submitEmailSignup(form.email.value, "first-visit-offer");
            } catch (error) {
                notify(error.message);
                button.disabled = false;
                button.textContent = "Join";
                return;
            }

            localStorage.setItem(SUBSCRIBED_KEY, "true");
            localStorage.setItem(OFFER_KEY, "true");
            localStorage.setItem(GOOGLE_PROMPT_KEY, "true");
            modal.querySelector(".offer-panel").innerHTML = `
                <div class="offer-success">
                    <span class="eyebrow">You're on the list</span>
                    <h2>30% off is live.</h2>
                    <p>No code needed. Sale prices are already applied across MUTUMA.</p>
                    <button class="button primary wide" data-offer-close>Shop Now</button>
                </div>
            `;
            modal.querySelector("[data-offer-close]").addEventListener("click", () => {
                modal.innerHTML = "";
            });
        });
    }, 1200);
}

export function lineItemProduct(line) {
    return {
        ...line,
        product: findProductById(line.id)
    };
}

