import { findProductById, getFamilyProducts, getProductById, getRecommendedProducts, loadStoreCatalog, productFamilyLabel, productOptions, productVariantLabel } from "./products.js?v=20260726b";
import { initCurrency, formatPrice, currentCurrency } from "./currency.js?v=20260724a";
import { addRecentlyViewed, addToCart, clearRecentlyViewed, getRecentlyViewed, getWishlist, toggleWishlist } from "./store.js?v=20260724a";
import { checkoutProduct, prewarmCheckout } from "./stripe.js?v=20260725b";
import { trackEvent } from "./analytics.js?v=20260724a";
import { initBaseLayout, notify, openCartDrawer, productImage, renderProductGrid, updateCounts } from "./ui.js?v=20260726b";
import { setupBundleForProduct } from "./merchandising.js?v=20260726a";

await loadStoreCatalog();
initBaseLayout();
initCurrency().catch(() => {});
prewarmCheckout();

const params = new URLSearchParams(window.location.search);
const product = getProductById(params.get("id"));
const productRoot = document.querySelector("[data-product-detail]");
const recommendationLimit = product.family || product.sourceUrl ? 8 : 4;
const recommendations = getRecommendedProducts(product.id, recommendationLimit);
const setupBundle = setupBundleForProduct(product, 3);
const galleryImages = buildGalleryImages(product);
const options = productOptions(product);
const variationList = (product.variations || options.colours).join(", ");
const sizeList = options.sizes.join(", ");
const familyProducts = getFamilyProducts(product.id);
const groupedVariants = buildGroupedVariants(product, familyProducts);
const galleryThumbs = galleryImages.length > 1 ? `
            <div class="gallery-thumbs">
                ${galleryImages.map((image, index) => `
                    <button class="${index === 0 ? "active" : ""}" data-gallery-image="${image}" aria-label="Show image ${index + 1}">
                        ${productImage(image, product.name)}
                    </button>
                `).join("")}
            </div>
` : "";

productRoot.innerHTML = `
    <section class="product-layout">
        <div class="gallery">
            <div class="gallery-main" data-gallery-main>
                ${productImage(galleryImages[0], product.name)}
            </div>
${galleryThumbs}
        </div>
        <aside class="purchase-panel">
            <span class="eyebrow">${product.category}</span>
            <h1>${product.name}</h1>
            <p>${product.description}</p>
            <div class="rating">${product.rating} stars / ${product.reviews} reviews</div>
            <div class="price-large">
                <strong data-price="${product.price}">${formatPrice(product.price)}</strong>
                ${product.oldPrice ? `<s data-price="${product.oldPrice}">${formatPrice(product.oldPrice)}</s>` : ""}
            </div>
            <p class="stock">${product.stock <= 8 ? "Low stock" : "In stock"} / estimated dispatch in 2-4 business days</p>
            <div class="quantity">
                <button data-qty-minus>-</button>
                <input value="1" data-quantity aria-label="Quantity" inputmode="numeric">
                <button data-qty-plus>+</button>
            </div>
            ${groupedVariants}
            ${setupBundle.length >= 2 ? `
                <div class="setup-bundle-card">
                    <div>
                        <span class="eyebrow">Bundle</span>
                        <strong>Complete the setup</strong>
                        <small>Add ${setupBundle.length} matching pieces in one tap.</small>
                    </div>
                    <div class="setup-bundle-images">
                        ${setupBundle.map((item) => productImage(item.images[0], item.name)).join("")}
                    </div>
                    <button class="button secondary wide" data-add-setup-bundle>Add Full Setup</button>
                </div>
            ` : ""}
            <button class="button primary wide" data-add-product>Add to Cart</button>
            <button class="button secondary wide" data-buy-stripe>Buy Now</button>
            <button class="button secondary wide ${getWishlist().includes(product.id) ? "active" : ""}" data-wishlist-product>Wishlist</button>
            <div class="details">
                <details open><summary>Description</summary><p>${product.description}</p></details>
                <details><summary>Specifications</summary><p>Category: ${product.category}. Sizes: ${sizeList}. Variations: ${variationList}. Style: ${options.styles.join(", ")}.</p></details>
                <details><summary>Delivery Estimate</summary><p>Estimated dispatch is 2-4 business days. Europe and US shipping options are confirmed at Stripe Checkout.</p></details>
                <details><summary>Returns</summary><p>Unused products can be returned within 30 days. See the returns page for the full policy.</p></details>
            </div>
        </aside>
    </section>
    <div class="mobile-sticky-add">
        <span>${product.name}</span>
        <button class="button primary" data-mobile-add>Quick Add</button>
        <button class="button secondary" data-mobile-buy>Buy Now</button>
    </div>
`;

let quantity = 1;
const quantityInput = document.querySelector("[data-quantity]");
let activeGalleryIndex = 0;

function buildGalleryImages(item) {
    return [...new Set(item.images.filter(Boolean))];
}

function buildGroupedVariants(item, familyItems) {
    if (familyItems.length <= 1) return "";

    const label = productFamilyLabel(item) || "More styles";

    return `
            <div class="variant-group" aria-label="${label}">
                <div class="variant-group-header">
                    <span>${label}</span>
                    <strong>${familyItems.length} styles</strong>
                </div>
                <div class="variant-grid">
                    ${familyItems.map((familyItem) => `
                        <a class="variant-choice ${familyItem.id === item.id ? "active" : ""}" href="product.html?id=${familyItem.id}" aria-label="View ${familyItem.name}">
                            ${productImage(familyItem.images[0], familyItem.name)}
                            <span>${productVariantLabel(familyItem)}</span>
                        </a>
                    `).join("")}
                </div>
            </div>
    `;
}

function showGalleryImage(index) {
    activeGalleryIndex = (index + galleryImages.length) % galleryImages.length;
    document.querySelector("[data-gallery-main]").innerHTML = productImage(galleryImages[activeGalleryIndex], product.name);
    document.querySelectorAll("[data-gallery-image]").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === activeGalleryIndex));
}

document.querySelectorAll("[data-gallery-image]").forEach((button) => {
    button.addEventListener("click", () => {
        showGalleryImage(galleryImages.indexOf(button.dataset.galleryImage));
    });
});

const galleryMain = document.querySelector("[data-gallery-main]");
let touchStartX = 0;
galleryMain.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0].clientX;
}, { passive: true });
galleryMain.addEventListener("touchend", (event) => {
    const diff = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 42 && galleryImages.length > 1) {
        showGalleryImage(activeGalleryIndex + (diff < 0 ? 1 : -1));
    }
}, { passive: true });

document.querySelector("[data-qty-minus]").addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    quantityInput.value = quantity;
});

document.querySelector("[data-qty-plus]").addEventListener("click", () => {
    quantity += 1;
    quantityInput.value = quantity;
});

document.querySelector("[data-add-product]").addEventListener("click", () => {
    addToCart(product.id, quantity);
    updateCounts();
    notify("Added to cart");
    openCartDrawer();
});

document.querySelector("[data-mobile-add]").addEventListener("click", () => {
    addToCart(product.id, quantity);
    updateCounts();
    notify("Added to cart");
    openCartDrawer();
});

document.querySelector("[data-add-setup-bundle]")?.addEventListener("click", () => {
    setupBundle.forEach((item) => addToCart(item.id, 1));
    updateCounts();
    notify("Setup bundle added to cart");
    openCartDrawer();
    trackEvent("add_to_cart", {
        source: "setup_bundle",
        productId: product.id,
        quantity: setupBundle.length
    });
});

document.querySelector("[data-buy-stripe]").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Opening Stripe...";
    trackEvent("checkout_started", { source: "product_page", productId: product.id, currency: currentCurrency() });
    const result = await checkoutProduct(product.id, quantity);
    if (!result.ok) notify(result.message);
    event.currentTarget.disabled = false;
    event.currentTarget.textContent = "Buy Now";
});

document.querySelector("[data-mobile-buy]").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Opening...";
    trackEvent("checkout_started", { source: "mobile_sticky", productId: product.id, currency: currentCurrency() });
    const result = await checkoutProduct(product.id, quantity);
    if (!result.ok) {
        notify(result.message);
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = "Buy Now";
    }
});

document.querySelector("[data-wishlist-product]").addEventListener("click", (event) => {
    const active = toggleWishlist(product.id);
    event.currentTarget.classList.toggle("active", active);
    notify(active ? "Saved to wishlist" : "Removed from wishlist");
});

renderProductGrid("[data-setup-products]", recommendations);
renderRecentProducts();
addRecentlyViewed(product.id);
trackEvent("product_viewed", { productId: product.id, name: product.name, category: product.category });

function renderRecentProducts() {
    const recentProducts = getRecentlyViewed()
        .filter((id) => id !== product.id)
        .map(findProductById)
        .filter(Boolean)
        .slice(0, 4);
    const clearButton = document.querySelector("[data-clear-recent]");

    renderProductGrid("[data-recent-products]", recentProducts);
    if (clearButton) clearButton.hidden = !recentProducts.length;
}

document.querySelector("[data-clear-recent]")?.addEventListener("click", () => {
    clearRecentlyViewed();
    renderRecentProducts();
    notify("Recently viewed cleared");
});
