import Stripe from "stripe";
import { products } from "../../js/products.js";
import { storeSettings } from "../../js/site-settings.js";

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

function sanitizeCart(cart) {
    if (!Array.isArray(cart)) return [];

    return cart
        .map((item) => {
            const product = products.find((entry) => entry.id === item.id);
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

function stripeAmount(gbpAmount, currency) {
    if (gbpAmount <= 0) return 0;

    const convertedAmount = gbpAmount * fallbackRates[currency];
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
        const cart = sanitizeCart(payload.cart);
        const currency = sanitizeCurrency(payload.currency);
        const stripeCurrency = currency.toLowerCase();

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
                            amount: stripeAmount(shippingAmount, currency),
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
                    unit_amount: stripeAmount(product.price, currency),
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
