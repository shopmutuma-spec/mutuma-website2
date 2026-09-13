import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const values = new Map();
globalThis.localStorage = globalThis.sessionStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.window = { dispatchEvent() {} };
const { analyticsAllowed, setAnalyticsChoice } = await import("../js/privacy-choice.js");
assert.equal(analyticsAllowed(), false);
setAnalyticsChoice("accepted");
assert.equal(analyticsAllowed(), true);
values.set("mutuma.analyticsSession", "private-id");
setAnalyticsChoice("rejected");
assert.equal(analyticsAllowed(), false);
assert.ok(!values.has("mutuma.analyticsSession"));
const listeners = {};
let sent = 0;
const source = (await readFile(new URL("../js/analytics.js", import.meta.url), "utf8")).replace(/^import .*;\r?\n/, "").replace("export function trackEvent", "function trackEvent");
const context = { analyticsAllowed, localStorage, sessionStorage, console, URL, URLSearchParams, Blob, Date, crypto: { randomUUID: () => "id" }, CustomEvent: class {},
    window: { location: { pathname: "/", search: "", origin: "https://example.com" }, matchMedia: () => ({ matches: false }), addEventListener: (name, fn) => { listeners[name] = fn; }, dispatchEvent() {} },
    document: { title: "Test", referrer: "", addEventListener: (name, fn) => { listeners[name] = fn; } },
    navigator: { sendBeacon: () => { sent++; return true; } }, requestAnimationFrame: (fn) => fn() };
vm.runInNewContext(source, context);
assert.equal(sent, 0);
setAnalyticsChoice("accepted");
listeners["mutuma:privacychange"]();
assert.ok(sent > 0);
assert.doesNotThrow(() => listeners.click({ target: { closest: () => null } }));
setAnalyticsChoice("rejected");
const before = sent;
listeners.click({ target: { closest: () => null } });
assert.equal(sent, before);
console.log("Consent default, acceptance, withdrawal, identifier clearing and null click tests passed.");
