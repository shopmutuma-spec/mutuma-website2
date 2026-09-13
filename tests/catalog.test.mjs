import assert from "node:assert/strict";
const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.sessionStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ products: [{ id: "aesthetic-soft-rug", name: "Updated rug", price: 100, currency: "USD", stock: 0, image_url: "images/example.jpg" }], unpublishedIds: ["red-web-mask-rug"], offers: [{ scope: "all", discount_percent: 15 }] }));
};
try {
    const { products, loadStoreCatalog } = await import("../js/products.js");
    await Promise.all([loadStoreCatalog(), loadStoreCatalog()]);
    assert.equal(requests, 1);
    const rug = products.find((item) => item.id === "aesthetic-soft-rug");
    assert.equal(rug.name, "Updated rug");
    assert.equal(rug.stock, 0);
    assert.equal(rug.price, 85);
    assert.ok(!products.some((item) => item.id === "red-web-mask-rug"));
    await loadStoreCatalog();
    assert.equal(requests, 1);
    console.log("Catalog override, price, zero-stock, hidden-product, cache-failure and concurrent-load tests passed.");
} finally { globalThis.fetch = originalFetch; delete globalThis.sessionStorage; }
