import assert from "node:assert/strict";
import { bindProductPurchase } from "../js/product-purchase.js";

class Control {
    constructor(attributes = []) { this.attributes = new Set(attributes); this.listeners = {}; this.value = "1"; this.textContent = "Buy Now"; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    setAttribute(name, value) { this[name] = value; }
    hasAttribute(name) { return this.attributes.has(name); }
    setCustomValidity(message) { this.validationMessage = message; }
    reportValidity() { this.reported = true; }
    fire(type, event = {}) { return this.listeners[type]?.(event); }
}

function fixture(overrides = {}) {
    const input = new Control();
    const minus = new Control();
    const plus = new Control();
    const add = [new Control(), new Control()];
    const buy = [new Control(), new Control(["data-mobile-buy"])];
    const lifecycle = new Control();
    const added = [];
    const requests = [];
    const notices = [];
    const root = {
        querySelector: (selector) => ({ "[data-quantity]": input, "[data-qty-minus]": minus, "[data-qty-plus]": plus })[selector],
        querySelectorAll: (selector) => selector.startsWith("[data-add") ? add : buy
    };
    bindProductPurchase({ root, product: { id: "rug", stock: 10 }, enabled: true, lifecycle,
        add: (...args) => added.push(args), notify: (message) => notices.push(message),
        checkout: async (...args) => { requests.push(args); return { ok: false, message: "Please retry" }; }, ...overrides });
    return { input, minus, plus, add, buy, lifecycle, added, requests, notices };
}

const page = fixture();
page.input.value = "3";
page.input.fire("input");
page.add[0].fire("click");
page.add[1].fire("click");
assert.deepEqual(page.added, [["rug", 3], ["rug", 3]]);
page.plus.fire("click");
assert.equal(page.input.value, "4");
await page.buy[0].fire("click");
await page.buy[1].fire("click");
assert.deepEqual(page.requests, [["rug", 4], ["rug", 4]]);
assert.ok(page.buy.every((button) => !button.disabled && button.textContent === "Buy Now"));
for (const invalid of ["", "0", "-1", "1.5", "11", "abc"]) {
    page.input.value = invalid;
    page.input.fire("input");
    await page.buy[0].fire("click");
    page.add[0].fire("click");
    assert.ok(page.input.validationMessage);
}
assert.equal(page.requests.length, 2);
assert.equal(page.added.length, 2);

let release;
let calls = 0;
const pending = fixture({ checkout: () => { calls++; return new Promise((resolve) => { release = resolve; }); } });
const first = pending.buy[0].fire("click");
await pending.buy[1].fire("click");
assert.equal(calls, 1);
assert.ok(pending.buy.every((button) => button.disabled));
release({ ok: true });
await first;
assert.ok(pending.buy.every((button) => button.disabled));
pending.lifecycle.fire("pageshow", { persisted: true });
assert.ok(pending.buy.every((button) => !button.disabled));

const failed = fixture({ checkout: async () => { throw new Error("Network failure"); } });
await failed.buy[1].fire("click");
assert.ok(failed.buy.every((button) => !button.disabled));
assert.equal(failed.notices.length, 1);
const telemetry = fixture({ onCheckoutStarted: () => { throw new Error("Analytics failure"); } });
await telemetry.buy[0].fire("click");
assert.equal(telemetry.requests.length, 1);
const paused = fixture({ enabled: false });
await paused.buy[0].fire("click");
assert.equal(paused.requests.length, 0);
assert.ok(paused.buy.every((button) => button.disabled));
const soldOut = fixture({ product: { id: "rug", stock: 0 } });
assert.ok([...soldOut.buy, ...soldOut.add].every((button) => button.disabled));
assert.equal(fixture({ product: { id: "rug", stock: null } }).input.max, "20");
console.log("PDP typed quantity, limits, mobile/desktop actions, failures, duplicate clicks and back navigation passed.");
