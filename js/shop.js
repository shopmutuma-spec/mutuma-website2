import { products, categories, discountPercent, productOptions, isNewArrival, loadStoreCatalog } from "./products.js?v=20260915-geo";
import { initCurrency, formatPrice } from "./currency.js?v=20260915-geo";
import { escapeHtml } from "./html.js";
import { priceBands, normalizePriceBand, priceBandLabel, matchesPriceBand, shopSearchParams } from "./shop-filters.js";
import { trackEvent } from "./analytics.js?v=20260915-geo";
import { initBaseLayout, renderProductGrid } from "./ui.js?v=20260915-geo";

import { showPageError } from "./page-error.js";

boot().catch((error) => {
    console.error("MUTUMA shop failed to start.", error);
    showPageError();
});

async function boot() {
initBaseLayout();
initCurrency().catch(() => {});
await loadStoreCatalog();

const params = new URLSearchParams(window.location.search);
const state = {
    query: params.get("q") || params.get("query") || "",
    category: params.get("category") || "All",
    colour: params.get("colour") || "All",
    size: params.get("size") || "All",
    availability: params.get("availability") || "All",
    style: params.get("style") || "All",
    type: params.get("type") || "All",
    collection: params.get("collection") || ({ trending: "Trending", "best-seller": "Best Seller", featured: "Featured" }[params.get("tag")]) || "All",
    price: normalizePriceBand(params.get("price")),
    sort: params.get("sort") || (params.get("tag") === "best-seller" ? "best-seller" : "featured")
};

const searchInput = document.querySelector("[data-shop-search]");
const filterPanel = document.querySelector("[data-shop-filters]");
if (filterPanel) filterPanel.open = !window.matchMedia("(max-width: 760px)").matches;
const categoryFilters = document.querySelector("[data-category-filters]");
const sortSelect = document.querySelector("[data-sort]");
const count = document.querySelector("[data-product-count]");
const chips = document.createElement("div");
chips.className = "filter-chips";
chips.setAttribute("data-filter-chips", "");
categoryFilters.after(chips);

function uniqueFromProducts(mapper) {
    return [...new Set(products.flatMap((product) => mapper(product)).filter(Boolean))].sort();
}

const filterConfig = [
    ["category", "Category", ["All", ...categories.map((category) => category.name)]],
    ["colour", "Colour", ["All", ...uniqueFromProducts((product) => productOptions(product).colours)]],
    ["size", "Size", ["All", ...uniqueFromProducts((product) => productOptions(product).sizes)]],
    ["availability", "Availability", ["All", "In stock", "Low stock", "Discounted", "New arrivals", "Best sellers"]],
    ["type", "Product type", ["All", ...uniqueFromProducts((product) => [productOptions(product).type])]],
    ["style", "Style", ["All", ...uniqueFromProducts((product) => productOptions(product).styles)]],
    ["collection", "Collection", ["All", "Featured", "Trending", "Best Seller"]]
];

filterConfig.forEach(([key, , values]) => {
    if (!values.includes(state[key])) state[key] = "All";
});

categoryFilters.innerHTML = filterConfig.map(([key, label, values]) => `
    <label>${label}
        <select data-filter="${key}" aria-label="${label}">
            ${values.map((value) => `<option value="${escapeHtml(value)}" ${state[key] === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
    </label>
`).join("") + `
    <label>Price
        <select data-filter="price" aria-label="Price">
            ${priceBands.map((value) => `<option value="${value}" ${state.price === value ? "selected" : ""}>${escapeHtml(priceBandLabel(value, formatPrice))}</option>`).join("")}
        </select>
    </label>
    <button class="button secondary wide" data-clear-filters>Clear All</button>
`;

searchInput.value = state.query;
sortSelect.innerHTML = [
    ["featured", "Featured"],
    ["newest", "Newest"],
    ["best-seller", "Best selling"],
    ["price-low", "Price low to high"],
    ["price-high", "Price high to low"],
    ["rating", "Highest rated"],
    ["discount", "Biggest discount"]
]
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");

if (![...sortSelect.options].some((option) => option.value === state.sort)) state.sort = "featured";
sortSelect.value = state.sort;

function filteredProducts() {
    let list = [...products];
    const query = state.query.trim().toLowerCase();

    if (state.category !== "All") {
        list = list.filter((product) => product.category === state.category);
    }

    if (state.colour !== "All") {
        list = list.filter((product) => productOptions(product).colours.includes(state.colour));
    }

    if (state.size !== "All") {
        list = list.filter((product) => productOptions(product).sizes.includes(state.size));
    }

    if (state.style !== "All") {
        list = list.filter((product) => productOptions(product).styles.includes(state.style));
    }

    if (state.type !== "All") {
        list = list.filter((product) => productOptions(product).type === state.type);
    }

    if (state.collection !== "All") {
        list = list.filter((product) => product.tags.includes(state.collection.toLowerCase().replace(" ", "-")));
    }

    if (state.availability === "In stock") list = list.filter((product) => product.stock > 0);
    if (state.availability === "Low stock") list = list.filter((product) => product.tags.includes("low-stock"));
    if (state.availability === "Discounted") list = list.filter((product) => discountPercent(product) > 0);
    if (state.availability === "New arrivals") list = list.filter(isNewArrival);
    if (state.availability === "Best sellers") list = list.filter((product) => product.tags.includes("best-seller"));

    list = list.filter((product) => matchesPriceBand(product.price, state.price));

    if (query) {
        list = list.filter((product) => {
            const content = `${product.name} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase();
            return content.includes(query);
        });
    }

    if (state.sort === "price-low") list.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") list.sort((a, b) => b.price - a.price);
    if (state.sort === "rating") list.sort((a, b) => b.rating - a.rating);
    if (state.sort === "best-seller") list.sort((a, b) => Number(b.tags.includes("best-seller")) - Number(a.tags.includes("best-seller")));
    if (state.sort === "discount") list.sort((a, b) => discountPercent(b) - discountPercent(a));
    if (state.sort === "newest") list.sort((a, b) => Number(isNewArrival(b)) - Number(isNewArrival(a)));

    return list;
}

function syncUrl() {
    const next = shopSearchParams(state);
    history.replaceState(null, "", `${location.pathname}${next.toString() ? `?${next}` : ""}`);
}

function renderChips() {
    const active = Object.entries(state).filter(([key, value]) => value && value !== "All" && !(key === "sort" && value === "featured") && key !== "query");
    chips.innerHTML = active.length ? active.map(([key, value]) => `
        <button data-remove-filter="${key}">${escapeHtml(key === "price" ? priceBandLabel(value, formatPrice) : value)} ×</button>
    `).join("") : "";
}

function render() {
    const list = filteredProducts();
    count.textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    renderProductGrid("[data-shop-grid]", list);
    renderChips();
    syncUrl();
}

let renderFrame = 0;
function scheduleRender() {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(render);
}

searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    trackEvent("search_performed", { source: "shop", query: state.query });
    scheduleRender();
});

categoryFilters.addEventListener("click", (event) => {
    const clearButton = event.target.closest("[data-clear-filters]");
    if (!clearButton) return;

    Object.assign(state, {
        category: "All",
        colour: "All",
        size: "All",
        availability: "All",
        style: "All",
        type: "All",
        collection: "All",
        price: "All"
    });
    categoryFilters.querySelectorAll("[data-filter]").forEach((item) => {
        item.value = "All";
    });
    scheduleRender();
});

categoryFilters.addEventListener("change", (event) => {
    const select = event.target.closest("[data-filter]");
    if (!select) return;

    state[select.dataset.filter] = select.value;
    trackEvent("filter_applied", { filter: select.dataset.filter, value: select.value });
    scheduleRender();
});

chips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) return;

    const key = button.dataset.removeFilter;
    state[key] = key === "sort" ? "featured" : "All";
    if (key === "sort") sortSelect.value = state.sort;
    const select = categoryFilters.querySelector(`[data-filter="${key}"]`);
    if (select) select.value = "All";
    scheduleRender();
});

sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    scheduleRender();
});

window.addEventListener("currencychange", () => {
    categoryFilters.querySelectorAll('[data-filter="price"] option').forEach((option) => {
        option.textContent = priceBandLabel(option.value, formatPrice);
    });
    scheduleRender();
});

render();
}
