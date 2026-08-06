import { findProductById, loadStoreCatalog } from "./products.js?v=20260806c";
import { initCurrency } from "./currency.js?v=20260806c";
import { getWishlist } from "./store.js?v=20260806c";
import { initBaseLayout, renderProductGrid } from "./ui.js?v=20260806c";

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
