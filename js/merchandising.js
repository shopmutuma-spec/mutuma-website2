import { products, getRecommendedProducts } from "./products.js?v=20260806c";
import { storeSettings } from "./site-settings.js?v=20260806c";

export function cartItemCount(cart) {
    return cart.reduce((total, item) => total + Number(item.quantity || 1), 0);
}

export function bestCartReward(itemCount) {
    return [...storeSettings.cartRewardTiers]
        .filter((tier) => itemCount >= tier.minimumItems)
        .sort((first, second) => second.discountPercent - first.discountPercent)[0] || null;
}

export function nextCartReward(itemCount) {
    return [...storeSettings.cartRewardTiers]
        .filter((tier) => itemCount < tier.minimumItems)
        .sort((first, second) => first.minimumItems - second.minimumItems)[0] || null;
}

export function cartRewardDiscount(subtotal, itemCount) {
    const reward = bestCartReward(itemCount);
    return reward ? Number((subtotal * reward.discountPercent / 100).toFixed(2)) : 0;
}

export function cartRewardMessage(itemCount) {
    const active = bestCartReward(itemCount);
    const next = nextCartReward(itemCount);

    if (active && next) {
        return `${active.discountPercent}% extra room reward unlocked. Add ${next.minimumItems - itemCount} more item for ${next.discountPercent}% off.`;
    }

    if (active) {
        return `${active.discountPercent}% full setup reward unlocked.`;
    }

    if (next) {
        return `Add ${next.minimumItems - itemCount} more item to unlock ${next.discountPercent}% off your room setup.`;
    }

    return "";
}

export function productSpendBadge(product) {
    const text = `${product.name} ${product.description} ${(product.tags || []).join(" ")}`.toLowerCase();
    if (product.price < 25) return "Under 25";
    if (product.category === "Rugs") return "Room anchor";
    if (product.category === "Lighting") return "Vibe changer";
    if (product.category === "Posters") return "Wall upgrade";
    if (text.includes("mirror")) return "Fit check";
    if (text.includes("storage") || product.category === "Organisation") return "Setup saver";
    return "Room find";
}

export function complementaryProducts(baseProducts = [], limit = 4) {
    const baseIds = new Set(baseProducts.map((product) => product.id));
    const baseCategories = new Set(baseProducts.map((product) => product.category));
    const preferredOrder = ["Rugs", "Lighting", "Posters", "Mirrors", "Organisation", "Decor", "Furniture", "Lego"];

    return products
        .filter((product) => product.images?.[0] && !baseIds.has(product.id))
        .map((product) => {
            const categoryIndex = preferredOrder.indexOf(product.category);
            const categoryScore = baseCategories.has(product.category) ? 0 : 8;
            const tagScore = Number(product.tags.includes("best-seller")) * 5 + Number(product.tags.includes("trending")) * 4 + Number(product.featured) * 3;
            return {
                product,
                score: categoryScore + tagScore + (categoryIndex >= 0 ? preferredOrder.length - categoryIndex : 0)
            };
        })
        .sort((first, second) => second.score - first.score)
        .map((item) => item.product)
        .slice(0, limit);
}

export function freeShippingUpsells(cartProducts, amountNeeded, limit = 3) {
    const baseIds = new Set(cartProducts.map((product) => product.id));
    const candidates = products
        .filter((product) => product.images?.[0] && !baseIds.has(product.id))
        .map((product) => ({
            product,
            score: Math.abs(product.price - amountNeeded) + (product.tags.includes("best-seller") ? -5 : 0)
        }))
        .sort((first, second) => first.score - second.score)
        .map((item) => item.product);

    return candidates.slice(0, limit);
}

export function setupBundleForProduct(product, limit = 3) {
    return [product, ...getRecommendedProducts(product.id, 8)]
        .filter((item) => item?.images?.[0])
        .filter((item, index, list) => list.findIndex((match) => match.id === item.id) === index)
        .slice(0, limit);
}

export function homepageBundles(limit = 3) {
    const rugs = products.filter((product) => product.category === "Rugs" && product.images?.[0]);
    const accents = products.filter((product) => ["Lighting", "Posters", "Decor", "Mirrors", "Organisation"].includes(product.category) && product.images?.[0]);
    const bundles = rugs.slice(0, limit).map((rug, index) => {
        const picks = [rug, ...accentProducts(accents, index)].slice(0, 3);
        return {
            title: index === 0 ? "Street Room Starter" : index === 1 ? "Soft Night Setup" : "Wall + Floor Edit",
            products: picks,
            href: `product.html?id=${rug.id}`
        };
    });

    return bundles.filter((bundle) => bundle.products.length >= 2);
}

function accentProducts(accents, offset) {
    return accents.filter((product, index) => index % 3 === offset % 3).slice(0, 3);
}
