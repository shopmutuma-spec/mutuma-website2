export const storeSettings = {
    freeShippingThreshold: 50,
    standardShipping: 6,
    popularSearches: ["lamp", "rug", "poster", "desk", "gaming"],
    fallbackOffer: {
        name: "30% off everything",
        discount_percent: 30,
        scope: "all",
        enabled: true
    },
    freeGift: {
        enabled: true,
        productId: "q-cute-ceramic-cup-classic-250ml",
        label: "Buy one, get one free gift"
    },
    cartRewardTiers: [
        { minimumItems: 2, discountPercent: 5, label: "2-piece room reward" },
        { minimumItems: 3, discountPercent: 10, label: "3-piece room reward" },
        { minimumItems: 4, discountPercent: 15, label: "full setup reward" }
    ],
    bundleDiscountPercent: 10,
    bundleMinimumItems: 3
};
