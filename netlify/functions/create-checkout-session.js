import Stripe from "stripe";
import { products } from "../../js/products.js";
import { storeSettings } from "../../js/site-settings.js";
import { supabaseRequest } from "./supabase-client.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const FREE_SHIPPING_THRESHOLD = storeSettings.freeShippingThreshold;
const STANDARD_SHIPPING = storeSettings.standardShipping;
const fallbackRates = {
    GBP: 1,
    USD: 1.27,
    EUR: 1.18,
    CAD: 1.73,
    AUD: 1.92,
    NZD: 2.08,
    JPY: 203,
    CHF: 1.14,
    CNY: 9.22,
    HKD: 9.94,
    SGD: 1.71,
    INR: 106.2,
    AED: 4.66,
    SAR: 4.76,
    ZAR: 23.1,
    SEK: 13.35,
    NOK: 13.42,
    DKK: 8.8,
    PLN: 5.03,
    MXN: 22.9,
    BRL: 7.05,
    KRW: 1760,
    THB: 46.3,
    TRY: 42.1,
    ILS: 4.76,
    CZK: 29.4,
    HUF: 463,
    RON: 5.87,
    BGN: 2.31,
    ISK: 176,
    IDR: 20700,
    MYR: 5.98,
    PHP: 74.3
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
    return {
        id: product.id,
        name: product.name,
        description: product.description || "",
        category: product.category || "Decor",
        price: Number(product.price || 0),
        oldPrice: product.old_price ? Number(product.old_price) : null,
        currency: product.currency || "GBP",
        images: [product.image_url].filter(Boolean),
        tags: Array.isArray(product.tags) ? product.tags : []
    };
}

function isActiveOffer(offer) {
    const now = Date.now();
    const startsAt = offer.starts_at ? new Date(offer.starts_at).getTime() : 0;
    const endsAt = offer.ends_at ? new Date(offer.ends_at).getTime() : Infinity;
    return offer.enabled && startsAt <= now && now <= endsAt;
}

async function loadCheckoutProducts() {
    try {
        const [remoteProducts, offers] = await Promise.all([
            supabaseRequest("catalog_products?select=id,name,description,category,price,old_price,currency,image_url,tags,published&published=eq.true&limit=300"),
            supabaseRequest("store_offers?select=name,discount_percent,scope,enabled,starts_at,ends_at&enabled=eq.true&limit=20")
        ]);
        const mergedProducts = [...products, ...remoteProducts.map(normalizeRemoteProduct)];
        const activeOffers = offers.length ? offers : [storeSettings.fallbackOffer].filter((offer) => offer?.enabled);
        const bestOffer = activeOffers
            .filter(isActiveOffer)
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
    return supportedCurrencies.has(code) ? code : "GBP";
}

async function loadRates() {
    try {
        const response = await fetch("https://api.frankfurter.app/latest?from=GBP", {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Exchange-rate request failed.");
        }

        const data = await response.json();
        return { ...fallbackRates, GBP: 1, ...(data.rates || {}) };
    } catch (error) {
        return fallbackRates;
    }
}

function stripeAmount(gbpAmount, currency, rates) {
    if (gbpAmount <= 0) return 0;

    const convertedAmount = gbpAmount * (rates[currency] || fallbackRates[currency] || 1);
    const multiplier = zeroDecimalCurrencies.has(currency) ? 1 : 100;
    return Math.max(1, Math.round(convertedAmount * multiplier));
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return json(500, { error: "Stripe secret key is missing." });
    }

    try {
        const payload = JSON.parse(event.body || "{}");
        const catalogProducts = await loadCheckoutProducts();
        const cart = sanitizeCart(payload.cart, catalogProducts);
        const currency = sanitizeCurrency(payload.currency);
        const stripeCurrency = currency.toLowerCase();
        const rates = await loadRates();

        if (!cart.length) {
            return json(400, { error: "Cart is empty." });
        }

        const subtotal = cart.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
        const shippingAmount = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
        const origin = getOrigin(event);

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
            line_items: cart.map(({ product, quantity }) => ({
                quantity,
                price_data: {
                    currency: stripeCurrency,
                    unit_amount: stripeAmount(product.price, currency, rates),
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
                base_currency: "GBP",
                display_currency: currency,
                exchange_rate: String(rates[currency] || fallbackRates[currency] || 1),
                item_count: String(cart.reduce((total, item) => total + item.quantity, 0))
            },
            success_url: `${origin}/cart.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/cart.html?checkout=cancelled`
        });

        return json(200, { url: session.url });
    } catch (error) {
        return json(500, { error: error.message || "Unable to create checkout session." });
    }
}
