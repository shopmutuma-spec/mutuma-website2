import assert from "node:assert/strict";
import { priceBands, normalizePriceBand, priceBandLabel, matchesPriceBand, shopSearchParams } from "../js/shop-filters.js";

for (const price of [0, 24.99, 25, 50, 50.01, 100, 100.01]) {
    assert.equal(priceBands.slice(1).filter((band) => matchesPriceBand(price, band)).length, 1);
}
assert.equal(normalizePriceBand("Under \u00a325"), "under-25");
assert.equal(normalizePriceBand("25-50"), "25-50");
assert.equal(normalizePriceBand('<img src=x onerror="alert(1)">'), "All");
assert.equal(priceBandLabel("under-25", (usd) => `GBP ${(usd * 0.8).toFixed(2)}`), "Under GBP 20.00");
assert.equal(priceBandLabel("25-50", (usd) => `USD ${usd}`), "USD 25 to USD 50");
const params = shopSearchParams({ query: "rug & poster", category: "All", sort: "featured", price: "25-50" });
assert.equal(new URLSearchParams(params.toString()).get("q"), "rug & poster");
assert.equal(params.has("query"), false);
assert.equal(params.has("sort"), false);
assert.equal(params.has("category"), false);
assert.equal(params.get("price"), "25-50");
console.log("Shop price bands and shareable search links passed.");
