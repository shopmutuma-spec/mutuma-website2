import assert from "node:assert/strict";
import { handler } from "../netlify/functions/detect-currency.js";
import edge from "../netlify/edge-functions/currency-location.js";

const cases = { GB: "GBP", US: "USD", FR: "EUR", CA: "CAD", AU: "AUD", PL: "PLN", SE: "SEK", DK: "DKK", CZ: "CZK", HU: "HUF", RO: "RON", QA: "USD" };
const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
globalThis.window = new EventTarget();
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
const originalFetch = globalThis.fetch;
try {
    for (const [country, expected] of Object.entries(cases)) {
        const response = await handler({ headers: { "accept-language": "en-US" } }, { geo: { country: { code: country } } });
        assert.equal(JSON.parse(response.body).currency, expected);
        const edgeResponse = await edge(new Request("https://example.com/currency-location"), { geo: { country: { code: country } } });
        assert.equal((await edgeResponse.json()).currency, expected);
        saved.clear();
        globalThis.fetch = async (url) => Response.json(String(url).includes("frankfurter") ? { rates: { USD: 1, [expected]: 1 } } : { country, currency: expected });
        const currency = await import(`../js/currency.js?country=${country}`);
        await currency.initCurrency();
        assert.equal(currency.currentCurrency(), expected);
        assert.equal(window.MUTUMACurrency.currency, expected);
    }
    const unknown = await handler({ headers: { "accept-language": "en-US" } }, {});
    assert.equal(JSON.parse(unknown.body).country, "", "Language must not be treated as location");
    saved.clear();
    let releaseRates;
    globalThis.fetch = async (url) => String(url).includes("frankfurter")
        ? new Promise((resolve) => { releaseRates = () => resolve(Response.json({ rates: { GBP: 0.8 } })); })
        : Response.json({ country: "GB", currency: "GBP" });
    const currency = await import("../js/currency.js?slow-rates");
    const pending = currency.initCurrency();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(currency.currentCurrency(), "GBP", "Detection should not wait for rates");
    currency.setCurrency("EUR");
    releaseRates();
    await pending;
    assert.equal(currency.currentCurrency(), "EUR", "A manual selection wins over in-flight detection");
    assert.equal(window.MUTUMACurrency.currency, "EUR");
    console.log("Currency detection: country mapping, edge/function parity, language fallback and selection races passed.");
} finally { globalThis.fetch = originalFetch; }
