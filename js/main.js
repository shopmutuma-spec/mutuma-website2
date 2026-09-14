import { findProductById, products, loadStoreCatalog } from "./products.js?v=20260914-relaunch";
import { initCurrency } from "./currency.js?v=20260914-relaunch";
import { addToCart } from "./store.js?v=20260914-relaunch";
import { aboutMutuma, roomEdit } from "./site-content.js?v=20260914-relaunch";
import { initBaseLayout, notify, productImage, renderCategories, renderProductGrid, submitEmailSignup, updateCounts } from "./ui.js?v=20260914-relaunch";

import { escapeHtml } from "./html.js";
import { showPageError } from "./page-error.js";

boot().catch((error) => {
    console.error("MUTUMA homepage failed to start.", error);
    showPageError();
});

async function boot() {
    initBaseLayout();
    initCurrency().catch(() => {});
    renderCategories("[data-category-grid]");
    renderAbout();
    bindNewsletterForm();
    await loadStoreCatalog();
    renderProductGrid("[data-trending-products]", getTrendingRoomProducts(10));
    renderProductGrid("[data-best-sellers]", getHomeProductSet("best-seller", 8));
    renderProductGrid("[data-customer-favourites]", getCustomerFavourites());
    renderNewArrivals();
    renderRoomEdit();
    startHeroRotation();
}

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

function getHomeProductSet(tag, limit = 8) {
    const tagged = products.filter((product) => product.images?.[0] && product.tags.includes(tag));
    const backup = products.filter((product) => product.images?.[0] && (product.featured || product.family));

    return seededShuffle(uniqueProducts([...tagged, ...backup]), threeHourSeed() + tag.length).slice(0, limit);
}

function getTrendingRoomProducts(limit = 10) {
    const curatedTrendingIds = [
        "aesthetic-soft-rug",
        "red-web-mask-rug",
        "gothic-cross-ring-rug",
        "web-poster-rug-punk-cover",
        "web-poster-rug-black-symbiote-cover",
        "web-poster-rug-versus-cover",
        "travis-scott-astroworld-tracklist-canvas-poster",
        "kanye-west-graduation-tracklist-canvas-poster",
        "drake-take-care-tracklist-canvas-poster",
        "chief-keef-rug",
        "travis-scott-rug",
        "mf-doom-inspired-rug"
    ];

    const curated = curatedTrendingIds.map(findProductById).filter((product) => product?.images?.[0]);
    const isRugOrPoster = (product) => {
        const category = product.category?.toLowerCase() || "";
        const tags = product.tags?.map((tag) => tag.toLowerCase()) || [];

        return category.includes("rug")
            || category.includes("poster")
            || tags.includes("rugs")
            || tags.includes("poster")
            || tags.includes("posters");
    };

    const coreTrending = products.filter((product) => (
        product.images?.[0]
        && product.tags.includes("trending")
        && isRugOrPoster(product)
    ));

    const coreFallback = products.filter((product) => product.images?.[0] && isRugOrPoster(product));
    const widerFallback = products.filter((product) => product.images?.[0] && product.tags.includes("trending"));

    return uniqueProducts([
        ...curated,
        ...seededShuffle([...coreTrending, ...coreFallback, ...widerFallback], threeHourSeed() + 88)
    ]).slice(0, limit);
}

function getCustomerFavourites() {
    const favourites = products.filter((product) => product.images?.[0] && (product.rating >= 4.8 || product.tags.includes("best-seller")));
    return seededShuffle(uniqueProducts(favourites), threeHourSeed() + 141).slice(0, 8);
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

function startHeroRotation() {
    const media = document.querySelector(".hero-media");
    if (!media) return;

    const enableRotation = () => media.classList.add("is-rotating");
    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(enableRotation, { timeout: 1800 });
        return;
    }

    window.setTimeout(enableRotation, 1400);
}

function renderNewArrivals() {
    const target = document.querySelector("[data-new-arrivals]");
    if (!target) return;

    const newProducts = seededShuffle(
        imageProducts([...products].reverse()).filter((product) => product.tags.includes("new") || product.family || product.featured),
        threeHourSeed() + 223
    ).slice(0, 4);

    target.innerHTML = newProducts.map((product) => `
        <a class="arrival-card" href="product.html?id=${escapeHtml(product.id)}">
            ${productImage(product.images[0], product.name, { sizes: "(max-width: 620px) 48vw, 18vw" })}
            <span>${escapeHtml(product.category)}</span>
            <strong>${escapeHtml(product.name)}</strong>
        </a>
    `).join("");
}

function renderRoomEdit() {
    const target = document.querySelector("[data-room-section]");
    if (!target) return;

    const roomProducts = roomEdit.productIds.map(findProductById).filter(Boolean);
    if (!roomProducts.length) return;

    target.innerHTML = `
        <div class="room-edit">
            <div class="room-edit-image">
                <img src="${roomEdit.image}" alt="MUTUMA room setup" loading="lazy" decoding="async" width="1200" height="900" sizes="(max-width: 780px) 100vw, 48vw">
            </div>
            <div class="room-edit-content">
                <span class="eyebrow">${roomEdit.eyebrow}</span>
                <h2>${roomEdit.title}</h2>
                ${roomEdit.body ? `<p>${roomEdit.body}</p>` : ""}
                <div class="room-edit-products">
                    ${roomProducts.map((product) => `
                        <a href="product.html?id=${escapeHtml(product.id)}">
                            ${productImage(product.images[0], product.name, { sizes: "120px" })}
                            <span>${escapeHtml(product.name)}</span>
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
        ${aboutMutuma.body ? `<p>${aboutMutuma.body}</p>` : ""}
        <a class="button secondary" href="shop.html">Shop the edit</a>
    `;
}

function bindNewsletterForm() {
    const newsletterForm = document.querySelector("[data-newsletter]");
    if (!newsletterForm) return;

    newsletterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = newsletterForm.email.value;
        const button = newsletterForm.querySelector("button");
        button.disabled = true;
        button.textContent = "Joining...";

        try {
            await submitEmailSignup(email, "homepage-newsletter");
            localStorage.setItem("mutuma.emailSubscribed", "true");
            newsletterForm.innerHTML = "<strong>You're on the list. 15% off is live across MUTUMA.</strong>";
        } catch (error) {
            notify(error.message);
            button.disabled = false;
            button.textContent = "Join";
        }
    });
}
