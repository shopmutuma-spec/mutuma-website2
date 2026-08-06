import Stripe from "stripe";
import { products } from "../../js/products.js";
import { storeSettings } from "../../js/site-settings.js";
import { supabaseRequest } from "./supabase-client.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const FREE_SHIPPING_THRESHOLD = storeSettings.freeShippingThreshold;
const STANDARD_SHIPPING = storeSettings.standardShipping;
const FREE_GIFT_PRODUCT = products.find((product) => product.id === storeSettings.freeGift?.productId);
const CHECKOUT_CATALOG_TTL = 1000 * 60 * 2;
const CHECKOUT_RATES_TTL = 1000 * 60 * 30;
const BASE_CURRENCY = "USD";
const LEGACY_GBP_TO_USD_RATE = 1.27;

let checkoutCatalogCache = {
    expiresAt: 0,
    promise: null,
    value: null
};

let checkoutRatesCache = {
    expiresAt: 0,
    promise: null,
    value: null
};
const fallbackRates = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.93,
    CAD: 1.36,
    AUD: 1.51,
    NZD: 1.64,
    JPY: 160,
    CHF: 0.9,
    CNY: 7.26,
    HKD: 7.83,
    SGD: 1.35,
    INR: 83.62,
    AED: 3.67,
    SAR: 3.75,
    ZAR: 18.19,
    SEK: 10.51,
    NOK: 10.57,
    DKK: 6.93,
    PLN: 3.96,
    MXN: 18.03,
    BRL: 5.55,
    KRW: 1386,
    THB: 36.46,
    TRY: 33.15,
    ILS: 3.75,
    CZK: 23.15,
    HUF: 364.57,
    RON: 4.62,
    BGN: 1.82,
    ISK: 138.58,
    IDR: 16299,
    MYR: 4.71,
    PHP: 58.5
};

const supportedCurrencies = new Set(Object.keys(fallbackRates));
const zeroDecimalCurrencies = new Set(["JPY", "KRW"]);

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

function getOrigin(event) {
    const origin = event.headers.origin || event.headers.Origin;
    if (origin) return origin;

    const host = event.headers.host || event.headers.Host;
    return host ? `https://${host}` : "https://mutuma.netlify.app";
}

function normalizeRemoteProduct(product) {
    const currency = product.currency || BASE_CURRENCY;

    return {
        id: product.id,
        name: product.name,
        description: product.description || "",
        category: product.category || "Decor",
        price: toUsdAmount(product.price, currency),
        oldPrice: product.old_price ? toUsdAmount(product.old_price, currency) : null,
        currency: BASE_CURRENCY,
        images: [product.image_url].filter(Boolean),
        tags: Array.isArray(product.tags) ? product.tags : []
    };
}

function toUsdAmount(value, currency = BASE_CURRENCY) {
    const number = Number(value || 0);
    if (!number) return number;
    return String(currency || "").toUpperCase() === "GBP"
        ? Number((number * LEGACY_GBP_TO_USD_RATE).toFixed(2))
        : number;
}

function isActiveOffer(offer) {
    const now = Date.now();
    const startsAt = offer.starts_at ? new Date(offer.starts_at).getTime() : 0;
    const endsAt = offer.ends_at ? new Date(offer.ends_at).getTime() : Infinity;
    return offer.enabled && startsAt <= now && now <= endsAt;
}

function normalizeOffer(offer) {
    if (!offer) return offer;
    const isLegacyStorewideSale = Number(offer.discount_percent) === 45
        && String(offer.name || "").toLowerCase().includes("45% off everything");

    if (!isLegacyStorewideSale) return offer;

    return {
        ...offer,
        name: "30% off everything",
        discount_percent: 30
    };
}

async function loadCheckoutProducts() {
    try {
        const [remoteProducts, offers] = await Promise.all([
            supabaseRequest("catalog_products?select=id,name,description,category,price,old_price,currency,image_url,tags,published&published=eq.true&limit=300"),
            supabaseRequest("store_offers?select=name,discount_percent,scope,enabled,starts_at,ends_at&enabled=eq.true&limit=20")
        ]);
        const mergedProducts = [...products, ...remoteProducts.map(normalizeRemoteProduct)];
        const activeOffers = offers.filter(isActiveOffer).map(normalizeOffer);
        const offersToApply = activeOffers.length ? activeOffers : [storeSettings.fallbackOffer].filter((offer) => offer?.enabled);
        const bestOffer = offersToApply
            .filter((offer) => offer.scope === "all")
            .sort((first, second) => Number(second.discount_percent) - Number(first.discount_percent))[0];

        if (bestOffer) {
            mergedProducts.forEach((product) => {
                const basePrice = Number(product.oldPrice || product.price || 0);
                product.oldPrice = Math.max(Number(product.oldPrice || 0), basePrice);
                product.price = Number((basePrice * (1 - Number(bestOffer.discount_percent) / 100)).toFixed(2));
            });
        }

        return mergedProducts;
    } catch (error) {
        return products.map((product) => {
            const offer = storeSettings.fallbackOffer;
            const basePrice = Number(product.oldPrice || product.price || 0);
            if (!offer?.enabled || !basePrice) return product;

            return {
                ...product,
                oldPrice: Math.max(Number(product.oldPrice || 0), basePrice),
                price: Number((basePrice * (1 - Number(offer.discount_percent) / 100)).toFixed(2))
            };
        });
    }
}

function cachedCheckoutProducts() {
    const now = Date.now();
    if (checkoutCatalogCache.value && checkoutCatalogCache.expiresAt > now) {
        return Promise.resolve(checkoutCatalogCache.value);
    }

    if (checkoutCatalogCache.promise) return checkoutCatalogCache.promise;

    checkoutCatalogCache.promise = loadCheckoutProducts()
        .then((catalogProducts) => {
            checkoutCatalogCache.value = catalogProducts;
            checkoutCatalogCache.expiresAt = Date.now() + CHECKOUT_CATALOG_TTL;
            return catalogProducts;
        })
        .finally(() => {
            checkoutCatalogCache.promise = null;
        });

    return checkoutCatalogCache.promise;
}

function sanitizeCart(cart, catalogProducts) {
    if (!Array.isArray(cart)) return [];

    return cart
        .map((item) => {
            const product = catalogProducts.find((entry) => entry.id === item.id);
            const quantity = Math.max(1, Math.min(Number(item.quantity) || 1, 20));

            if (!product) return null;

            return {
                product,
                quantity
            };
        })
        .filter(Boolean);
}

function sanitizeCurrency(currency) {
    const code = String(currency || "").toUpperCase();
    return supportedCurrencies.has(code) ? code : BASE_CURRENCY;
}

async function loadRates() {
    try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}`, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Exchange-rate request failed.");
        }

        const data = await response.json();
        return { ...fallbackRates, [BASE_CURRENCY]: 1, ...(data.rates || {}) };
    } catch (error) {
        return fallbackRates;
    }
}

function cachedRates() {
    const now = Date.now();
    if (checkoutRatesCache.value && checkoutRatesCache.expiresAt > now) {
        return Promise.resolve(checkoutRatesCache.value);
    }

    if (checkoutRatesCache.promise) return checkoutRatesCache.promise;

    checkoutRatesCache.promise = loadRates()
        .then((rates) => {
            checkoutRatesCache.value = rates;
            checkoutRatesCache.expiresAt = Date.now() + CHECKOUT_RATES_TTL;
            return rates;
        })
        .finally(() => {
            checkoutRatesCache.promise = null;
        });

    return checkoutRatesCache.promise;
}

function stripeAmount(baseAmount, currency, rates) {
    if (baseAmount <= 0) return 0;

    const convertedAmount = baseAmount * (rates[currency] || fallbackRates[currency] || 1);
    const multiplier = zeroDecimalCurrencies.has(currency) ? 1 : 100;
    return Math.max(1, Math.round(convertedAmount * multiplier));
}

function itemCount(cart) {
    return cart.reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function bestCartReward(count) {
    return [...(storeSettings.cartRewardTiers || [])]
        .filter((tier) => count >= Number(tier.minimumItems || 0))
        .sort((first, second) => Number(second.discountPercent || 0) - Number(first.discountPercent || 0))[0] || null;
}

export async function handler(event) {
    if (event.httpMethod === "GET" || event.httpMethod === "HEAD") {
        cachedCheckoutProducts().catch(() => {});
        cachedRates().catch(() => {});
        return json(200, { ok: true, warmed: true });
    }

    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return json(500, { error: "Stripe secret key is missing." });
    }

    try {
        const payload = JSON.parse(event.body || "{}");
        const [catalogProducts, rates] = await Promise.all([
            cachedCheckoutProducts(),
            cachedRates()
        ]);
        const cart = sanitizeCart(payload.cart, catalogProducts);
        const currency = sanitizeCurrency(payload.currency);
        const stripeCurrency = currency.toLowerCase();

        if (!cart.length) {
            return json(400, { error: "Cart is empty." });
        }

        const subtotal = cart.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
        const freeGift = storeSettings.freeGift?.enabled && FREE_GIFT_PRODUCT ? FREE_GIFT_PRODUCT : null;
        const reward = bestCartReward(itemCount(cart));
        const rewardDiscount = reward ? Number((subtotal * Number(reward.discountPercent || 0) / 100).toFixed(2)) : 0;
        const shippingAmount = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
        const origin = getOrigin(event);
        const discountMultiplier = subtotal ? Math.max(0, (subtotal - rewardDiscount) / subtotal) : 1;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            allow_promotion_codes: true,
            billing_address_collection: "required",
            phone_number_collection: {
                enabled: true
            },
            shipping_address_collection: {
                allowed_countries: ["GB", "US", "IE", "FR", "DE", "NL", "ES", "IT", "PT", "BE", "AT", "DK", "SE", "NO", "FI", "PL", "CZ", "CH", "GR"]
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        display_name: shippingAmount ? "Tracked shipping" : "Free shipping",
                        fixed_amount: {
                            amount: stripeAmount(shippingAmount, currency, rates),
                            currency: stripeCurrency
                        },
                        delivery_estimate: {
                            minimum: {
                                unit: "business_day",
                                value: 2
                            },
                            maximum: {
                                unit: "business_day",
                                value: 5
                            }
                        }
                    }
                }
            ],
            custom_text: freeGift ? {
                submit: {
                    message: `Buy one, get one free gift included: ${freeGift.name}.`
                }
            } : undefined,
            line_items: cart.map(({ product, quantity }) => ({
                quantity,
                price_data: {
                    currency: stripeCurrency,
                    unit_amount: stripeAmount(product.price * discountMultiplier, currency, rates),
                    product_data: {
                        name: product.name,
                        description: product.description,
                        metadata: {
                            product_id: product.id,
                            category: product.category
                        }
                    }
                }
            })),
            metadata: {
                brand: "MUTUMA",
                base_currency: BASE_CURRENCY,
                display_currency: currency,
                exchange_rate: String(rates[currency] || fallbackRates[currency] || 1),
                item_count: String(cart.reduce((total, item) => total + item.quantity, 0)),
                room_reward: reward ? `${reward.discountPercent}%` : "0%",
                room_reward_discount_usd: String(rewardDiscount),
                free_gift_product_id: freeGift?.id || "",
                free_gift_product_name: freeGift?.name || ""
            },
            success_url: `${origin}/cart.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/cart.html?checkout=cancelled`
        });

        return json(200, { url: session.url });
    } catch (error) {
        return json(500, { error: error.message || "Unable to create checkout session." });
    }
}
