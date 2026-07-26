const CART_KEY = "mutuma.cart";
const WISHLIST_KEY = "mutuma.wishlist";
const RECENT_KEY = "mutuma.recent";

export function readStorage(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        return false;
    }

    return true;
}

export function getCart() {
    return readStorage(CART_KEY, []);
}

export function saveCart(cart) {
    writeStorage(CART_KEY, cart);
    window.dispatchEvent(new Event("cartchange"));
}

export function addToCart(productId, quantity = 1) {
    const cart = getCart();
    const item = cart.find((line) => line.id === productId);
    const numericQuantity = Math.max(1, Number(quantity) || 1);

    if (item) {
        item.quantity += numericQuantity;
    } else {
        cart.push({ id: productId, quantity: numericQuantity });
    }

    saveCart(cart);
    window.dispatchEvent(new CustomEvent("cartadd", {
        detail: {
            productId,
            quantity: numericQuantity
        }
    }));
}

export function updateCartQuantity(productId, quantity) {
    const cart = getCart().map((line) => {
        if (line.id !== productId) return line;
        return { ...line, quantity: Math.max(1, quantity) };
    });
    saveCart(cart);
}

export function removeFromCart(productId) {
    const removed = getCart().find((line) => line.id === productId);
    saveCart(getCart().filter((line) => line.id !== productId));
    if (removed) {
        window.dispatchEvent(new CustomEvent("cartremove", {
            detail: removed
        }));
    }
}

export function clearCart() {
    saveCart([]);
}

export function getWishlist() {
    return readStorage(WISHLIST_KEY, []);
}

export function toggleWishlist(productId) {
    const wishlist = getWishlist();
    const adding = !wishlist.includes(productId);
    const next = wishlist.includes(productId)
        ? wishlist.filter((id) => id !== productId)
        : [...wishlist, productId];

    writeStorage(WISHLIST_KEY, next);
    window.dispatchEvent(new Event("wishlistchange"));
    if (adding) {
        window.dispatchEvent(new CustomEvent("wishlistadd", {
            detail: {
                productId
            }
        }));
    }
    return next.includes(productId);
}

export function addToWishlist(productId) {
    const wishlist = getWishlist();
    if (wishlist.includes(productId)) return false;

    writeStorage(WISHLIST_KEY, [...wishlist, productId]);
    window.dispatchEvent(new Event("wishlistchange"));
    window.dispatchEvent(new CustomEvent("wishlistadd", {
        detail: {
            productId
        }
    }));
    return true;
}

export function addRecentlyViewed(productId) {
    const recent = readStorage(RECENT_KEY, []).filter((id) => id !== productId);
    recent.unshift(productId);
    writeStorage(RECENT_KEY, recent.slice(0, 8));
}

export function getRecentlyViewed() {
    return readStorage(RECENT_KEY, []);
}

export function clearRecentlyViewed() {
    writeStorage(RECENT_KEY, []);
    window.dispatchEvent(new Event("recentchange"));
}
