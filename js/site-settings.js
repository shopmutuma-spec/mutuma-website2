export const storeSettings = {
    freeShippingThreshold: 50,
    standardShipping: 6,
    popularSearches: ["lamp", "rug", "poster", "desk", "gaming"],
    fallbackOffer: {
        name: "45% off everything",
        discount_percent: 45,
        scope: "all",
        enabled: true
    },
    cartRewardTiers: [
        { minimumItems: 2, discountPercent: 5, label: "2-piece room reward" },
        { minimumItems: 3, discountPercent: 10, label: "3-piece room reward" },
        { minimumItems: 4, discountPercent: 15, label: "full setup reward" }
    ],
    bundleDiscountPercent: 10,
    bundleMinimumItems: 3
};
