import assert from "node:assert/strict";

process.env.STRIPE_SECRET_KEY = "sk_test_local_placeholder";
process.env.SUPABASE_URL = "https://local.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-placeholder";
const { sanitizeCart, loadCheckoutProducts } = await import("../netlify/functions/create-checkout-session.js");
const { products } = await import("../js/products.js");
const available = { id: "available", price: 10, stock: 3 };
assert.equal(sanitizeCart([{ id: "available", quantity: 2, price: 0.01 }], [available])[0].product.price, 10);
for (const cart of [
    [{ id: "missing", quantity: 1 }],
    [{ id: "available", quantity: 1.5 }],
    [{ id: "available", quantity: 4 }],
    [{ id: "available", quantity: 2 }, { id: "available", quantity: 2 }],
    [null]
]) assert.throws(() => sanitizeCart(cart, [available]));
assert.throws(() => sanitizeCart([{ id: "available", quantity: 1 }], [{ ...available, stock: 0 }]));
const originalFetch = globalThis.fetch;
try {
    globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).includes("catalog_products") ? [
        { id: products[0].id, name: "Updated", price: 12, currency: "USD", published: true, stock: 0 },
        { id: products[1].id, published: false }
    ] : []));
    const catalog = await loadCheckoutProducts();
    assert.equal(catalog.find((item) => item.id === products[0].id).name, "Updated");
    assert.equal(catalog.find((item) => item.id === products[0].id).stock, 0);
    assert.equal(catalog.some((item) => item.id === products[1].id), false);
    globalThis.fetch = async () => { throw new Error("Database unavailable"); };
    await assert.rejects(loadCheckoutProducts(), (error) => error.statusCode === 503);
} finally {
    globalThis.fetch = originalFetch;
}
console.log("Checkout uses current catalog data, validates quantities and fails closed.");
