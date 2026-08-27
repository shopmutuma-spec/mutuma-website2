import { findProductById, loadStoreCatalog } from "./products.js?v=20260827a";
import { initCurrency } from "./currency.js?v=20260827a";
import { getWishlist } from "./store.js?v=20260827a";
import { initBaseLayout, renderProductGrid } from "./ui.js?v=20260827a";

boot();

async function boot() {
    await loadStoreCatalog();
    initBaseLayout();
    initCurrency().catch(() => {});

    const wishlist = getWishlist().map(findProductById).filter(Boolean);
    const grid = document.querySelector("[data-wishlist-grid]");

    if (wishlist.length) {
        renderProductGrid(grid, wishlist);
    } else {
        grid.innerHTML = '<div class="empty-state">Your wishlist is empty.</div>';
    }
}
