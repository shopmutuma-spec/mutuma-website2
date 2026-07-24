import { findProductById, products, getProductsByTag } from "./products.js?v=20260724a";
import { initCurrency } from "./currency.js?v=20260724a";
import { addToCart } from "./store.js?v=20260724a";
import { aboutMutuma, discoveryMoods, inspirationGallery, roomEdit } from "./site-content.js?v=20260724a";
import { initBaseLayout, notify, renderCategories, renderProductGrid, submitEmailSignup, updateCounts } from "./ui.js?v=20260724a";

initBaseLayout();
initCurrency().catch(() => {});

renderProductGrid("[data-featured-products]", products.filter((product) => product.featured).slice(0, 4));
renderProductGrid("[data-best-sellers]", getProductsByTag("best-seller", 4));
renderCategories("[data-category-grid]");
renderDiscoverySections();
renderFeelings();
renderRoomEdit();
renderAbout();
renderInspiration();

function uniqueProducts(list) {
    const seen = new Set();
    return list.filter((product) => {
        if (!product || seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
    });
}

function productRail(title, link, list) {
    const productsToShow = uniqueProducts(list).slice(0, 10);
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

    const under25 = products.filter((product) => product.price < 25);
    const lighting = products.filter((product) => product.category === "Lighting" || product.tags.includes("lighting"));
    const desk = products.filter((product) => /desk|lamp|organ/i.test(`${product.name} ${product.description} ${product.tags.join(" ")}`));
    const setup = products.filter((product) => ["Decor", "Lighting", "Organisation"].includes(product.category));

    target.innerHTML = `
        <div class="section-head">
            <div>
                <span class="eyebrow">Discover</span>
                <h2>More ways to build the room.</h2>
            </div>
            <p>Curated from the live catalogue, not copied into separate lists.</p>
        </div>
        <div class="discovery-stack">
            ${productRail("Trending Now", "shop.html?tag=trending", products.filter((product) => product.tags.includes("trending")))}
            ${productRail("New Room Finds", "shop.html?sort=newest", products.filter((product) => product.featured || product.family))}
            ${productRail("Under £25", "shop.html?price=Under%20%C2%A325", under25)}
            ${productRail("Lighting That Changes the Room", "shop.html?category=Lighting", lighting)}
            ${productRail("Desk Setup Essentials", "shop.html?type=Organisation", desk)}
            ${productRail("Complete Your Setup", "shop.html?category=Decor", setup)}
        </div>
    `;
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
            newsletterForm.innerHTML = "<strong>You're on the list. Use code FIRSTROOM at checkout.</strong>";
        } catch (error) {
            notify(error.message);
            button.disabled = false;
            button.textContent = "Join";
        }
    });
}
