import { findProductById, products, getProductsByTag, loadStoreCatalog } from "./products.js?v=20260726b";
import { initCurrency } from "./currency.js?v=20260724a";
import { addToCart } from "./store.js?v=20260724a";
import { aboutMutuma, discoveryMoods, inspirationGallery, roomEdit } from "./site-content.js?v=20260724a";
import { initBaseLayout, notify, renderCategories, renderProductGrid, submitEmailSignup, updateCounts } from "./ui.js?v=20260726b";
import { homepageBundles } from "./merchandising.js?v=20260726a";

await loadStoreCatalog();
initBaseLayout();
initCurrency().catch(() => {});

let activeRailUsage = null;

renderProductGrid("[data-featured-products]", getRotatingFeaturedProducts());
renderProductGrid("[data-best-sellers]", getProductsByTag("best-seller", 4));
renderCategories("[data-category-grid]");
renderSpendBanner();
renderHomeBundles();
renderDiscoverySections();
renderFeelings();
renderRoomEdit();
renderAbout();
renderInspiration();

function threeHourSeed(date = new Date()) {
    return Math.floor(date.getTime() / (3 * 60 * 60 * 1000));
}

function seededRandom(seed) {
    let value = seed + 0x6D2B79F5;

    return () => {
        value |= 0;
        value = value + 0x6D2B79F5 | 0;
        let mixed = Math.imul(value ^ value >>> 15, 1 | value);
        mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed);
        return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
}

function seededShuffle(list, seed) {
    const shuffled = [...list];
    const random = seededRandom(seed);

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
}

function getRotatingFeaturedProducts() {
    const featured = products.filter((product) => product.featured && product.images?.[0]);
    const fallback = products.filter((product) => product.images?.[0] && (product.tags.includes("trending") || product.tags.includes("best-seller")));
    const pool = uniqueProducts([...featured, ...fallback]);

    return seededShuffle(pool, threeHourSeed()).slice(0, 4);
}

function imageProducts(list) {
    return list.filter((product) => product.images?.[0]);
}

function uniqueProducts(list) {
    const seen = new Set();
    return list.filter((product) => {
        if (!product || seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
    });
}

function renderSpendBanner() {
    const target = document.querySelector("[data-spend-banner]");
    if (!target) return;

    target.innerHTML = `
        <div>
            <span class="eyebrow">Live storewide sale</span>
            <strong>Everything is 45% off right now.</strong>
            <p>Sale prices are already applied. Add more room pieces to unlock extra setup rewards in checkout.</p>
        </div>
        <a class="button primary" href="shop.html">Build a setup</a>
    `;
}

function renderHomeBundles() {
    const target = document.querySelector("[data-home-bundles]");
    if (!target) return;

    const bundles = homepageBundles(3);
    if (!bundles.length) {
        target.hidden = true;
        return;
    }

    target.innerHTML = `
        <div class="section-head">
            <div>
                <span class="eyebrow">Room bundles</span>
                <h2>Start with a full setup.</h2>
            </div>
            <p>Built from real products in the catalogue. Add the edit or swap pieces later.</p>
        </div>
        <div class="bundle-grid">
            ${bundles.map((bundle, index) => `
                <article class="bundle-card">
                    <a href="${bundle.href}" class="bundle-images" aria-label="${bundle.title}">
                        ${bundle.products.map((product) => `<img src="${product.images[0]}" alt="${product.name}" loading="lazy" decoding="async">`).join("")}
                    </a>
                    <div>
                        <span class="eyebrow">Save more together</span>
                        <h3>${bundle.title}</h3>
                        <p>${bundle.products.map((product) => product.name).join(" + ")}</p>
                        <button class="button primary wide" data-home-bundle="${index}">Add Bundle</button>
                    </div>
                </article>
            `).join("")}
        </div>
    `;

    target.querySelectorAll("[data-home-bundle]").forEach((button) => {
        button.addEventListener("click", () => {
            bundles[Number(button.dataset.homeBundle)].products.forEach((product) => addToCart(product.id, 1));
            updateCounts();
            notify("Room bundle added to cart");
        });
    });
}

function productRail(title, link, list, options = {}) {
    const used = options.used || activeRailUsage || new Set();
    const limit = options.limit || 10;
    const seed = threeHourSeed() + (options.seedOffset || 0);
    const preferred = uniqueProducts(imageProducts(list)).filter((product) => !used.has(product.id));
    const preferredIds = new Set(preferred.map((product) => product.id));
    const backup = uniqueProducts(imageProducts(products)).filter((product) => !used.has(product.id) && !preferredIds.has(product.id));
    const productsToShow = seededShuffle([...preferred, ...backup], seed).slice(0, limit);

    productsToShow.forEach((product) => used.add(product.id));
    if (productsToShow.length < 3) return "";

    return `
        <div class="product-rail-block">
            <div class="section-head compact">
                <h3>${title}</h3>
                <a href="${link}">Shop edit</a>
            </div>
            <div class="product-rail" tabindex="0" aria-label="${title}">
                ${productsToShow.map((product) => `
                    <a class="rail-card" href="product.html?id=${product.id}">
                        <img src="${product.images[0]}" alt="${product.name}" loading="lazy" decoding="async">
                        <span>${product.name}</span>
                    </a>
                `).join("")}
            </div>
        </div>
    `;
}

function renderDiscoverySections() {
    const target = document.querySelector("[data-discovery-sections]");
    if (!target) return;

    const usedRailProducts = new Set();
    activeRailUsage = usedRailProducts;
    const under25 = products.filter((product) => product.price < 25);
    const lighting = products.filter((product) => product.category === "Lighting" || product.tags.includes("lighting"));
    const desk = products.filter((product) => /desk|lamp|organ/i.test(`${product.name} ${product.description} ${product.tags.join(" ")}`));
    const setup = products.filter((product) => ["Decor", "Lighting", "Organisation"].includes(product.category));
    const trending = products.filter((product) => product.tags.includes("trending") || product.tags.includes("best-seller"));
    const newFinds = [...products].reverse().filter((product) => product.featured || product.family || product.tags.includes("new") || product.tags.includes("trending"));

    target.innerHTML = `
        <div class="section-head">
            <div>
                <span class="eyebrow">Discover</span>
                <h2>More ways to build the room.</h2>
            </div>
            <p>Curated from the live catalogue, not copied into separate lists.</p>
        </div>
        <div class="discovery-stack">
            ${productRail("Trending Now", "shop.html?tag=trending", trending, { used: usedRailProducts, seedOffset: 11 })}
            ${productRail("New Room Finds", "shop.html?sort=newest", newFinds, { used: usedRailProducts, seedOffset: 29 })}
            ${productRail("Under £25", "shop.html?price=Under%20%C2%A325", under25, { used: usedRailProducts, seedOffset: 47 })}
            ${productRail("Lighting That Changes the Room", "shop.html?category=Lighting", lighting, { used: usedRailProducts, seedOffset: 71 })}
            ${productRail("Desk Setup Essentials", "shop.html?type=Organisation", desk, { used: usedRailProducts, seedOffset: 89 })}
            ${productRail("Complete Your Setup", "shop.html?category=Decor", setup, { used: usedRailProducts, seedOffset: 113 })}
        </div>
    `;
    activeRailUsage = null;
}

function renderFeelings() {
    const target = document.querySelector("[data-feeling-section]");
    if (!target) return;

    target.innerHTML = `
        <div class="section-head">
            <div>
                <span class="eyebrow">Shop by feeling</span>
                <h2>Choose the room energy first.</h2>
            </div>
            <p>Quick filters for the mood you want your setup to carry.</p>
        </div>
        <div class="feeling-grid">
            ${discoveryMoods.map((mood) => `<a href="${mood.href}">${mood.label}</a>`).join("")}
        </div>
    `;
}

function renderRoomEdit() {
    const target = document.querySelector("[data-room-section]");
    if (!target) return;

    const roomProducts = roomEdit.productIds.map(findProductById).filter(Boolean);
    if (!roomProducts.length) return;

    target.innerHTML = `
        <div class="room-edit">
            <div class="room-edit-image">
                <img src="${roomEdit.image}" alt="MUTUMA room setup" loading="lazy" decoding="async">
            </div>
            <div class="room-edit-content">
                <span class="eyebrow">${roomEdit.eyebrow}</span>
                <h2>${roomEdit.title}</h2>
                <p>${roomEdit.body}</p>
                <div class="room-edit-products">
                    ${roomProducts.map((product) => `
                        <a href="product.html?id=${product.id}">
                            <img src="${product.images[0]}" alt="${product.name}" loading="lazy" decoding="async">
                            <span>${product.name}</span>
                        </a>
                    `).join("")}
                </div>
                <button class="button primary" data-add-room>Add Room Edit</button>
            </div>
        </div>
    `;

    target.querySelector("[data-add-room]").addEventListener("click", () => {
        roomProducts.forEach((product) => addToCart(product.id, 1));
        updateCounts();
        notify("Room edit added to cart");
    });
}

function renderAbout() {
    const about = document.querySelector("[data-about]");
    if (!about) return;

    about.innerHTML = `
        <span class="eyebrow">${aboutMutuma.eyebrow}</span>
        <h2>${aboutMutuma.title}</h2>
        <p>${aboutMutuma.body}</p>
        <a class="button secondary" href="shop.html">Shop the edit</a>
    `;
}

function renderInspiration() {
    const inspiration = document.querySelector("[data-inspiration]");
    if (!inspiration) return;

    const posts = inspirationGallery.posts;
    inspiration.innerHTML = `
        <div class="section-head">
            <div>
                <span class="eyebrow">${inspirationGallery.eyebrow}</span>
                <h2>${inspirationGallery.title}</h2>
            </div>
            <p>${inspirationGallery.intro}</p>
        </div>
        <div class="social-gallery">
            ${posts.length ? posts.map((post) => `
                <a class="social-tile" href="${post.url}" target="_blank" rel="noopener">
                    <img src="${post.image}" alt="${post.alt}" loading="lazy" decoding="async">
                    <span>${post.platform}</span>
                </a>
            `).join("") : '<div class="empty-state">No room posts are connected yet.</div>'}
        </div>
    `;
}

const newsletterForm = document.querySelector("[data-newsletter]");
if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = newsletterForm.email.value;
        const button = newsletterForm.querySelector("button");
        button.disabled = true;
        button.textContent = "Joining...";

        try {
            await submitEmailSignup(email, "homepage-newsletter");
            localStorage.setItem("mutuma.emailSubscribed", "true");
            newsletterForm.innerHTML = "<strong>You're on the list. 45% off is already live across MUTUMA.</strong>";
        } catch (error) {
            notify(error.message);
            button.disabled = false;
            button.textContent = "Join";
        }
    });
}
