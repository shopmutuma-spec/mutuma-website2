import { categories, products, loadStoreCatalog } from "./products.js?v=20260802a";
import { initCurrency } from "./currency.js?v=20260802a";
import { initBaseLayout, renderCategories, renderProductGrid } from "./ui.js?v=20260802a";

boot();

async function boot() {
    await loadStoreCatalog();
    initBaseLayout();
    initCurrency().catch(() => {});
    renderCategories("[data-category-grid]");
    renderCategorySections();
}

function categoryId(name) {
    return `category-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function renderCategorySections() {
    const target = document.querySelector("[data-category-sections]");
    if (!target) return;

    target.innerHTML = categories.map((category) => {
        const categoryProducts = products.filter((product) => product.category === category.name && product.images?.[0]);

        return `
            <section class="category-detail" id="${categoryId(category.name)}" data-category-detail="${category.name}">
                <div class="section-head">
                    <div>
                        <span class="eyebrow">${categoryProducts.length} products</span>
                        <h2>${category.name}</h2>
                    </div>
                    <a class="button secondary" href="shop.html?category=${encodeURIComponent(category.name)}">Shop category</a>
                </div>
                <div class="product-grid" data-category-products="${category.name}"></div>
            </section>
        `;
    }).join("");

    categories.forEach((category) => {
        const list = products
            .filter((product) => product.category === category.name && product.images?.[0])
            .slice(0, 8);
        renderProductGrid(`[data-category-products="${category.name}"]`, list);
    });

    const selected = new URLSearchParams(window.location.search).get("category");
    const selectedCategory = categories.find((category) => category.name === selected);
    if (selectedCategory) {
        document.getElementById(categoryId(selectedCategory.name))?.scrollIntoView({ block: "start" });
    }
}
