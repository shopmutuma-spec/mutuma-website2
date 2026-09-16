import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderTemplateVariables } from "../netlify/functions/order-template.js";
import { estimatedDeliveryDate, deliveryEstimateMessage } from "../js/delivery-date.js";

for (const file of ["js/cart.js", "js/product.js", "js/ui.js", "delivery.html", "policies.html", "tracking.html", "netlify/functions/mailer-lite.js", "netlify/functions/track-order.js"]) {
    const content = readFileSync(file, "utf8");
    assert.ok(content.includes("7 business days after dispatch"), `${file} must use the current estimate`);
    assert.ok(!content.includes("5-8"), `${file} must not show the previous estimate`);
}
assert.equal(orderTemplateVariables({}, "https://example.com/tracking").DELIVERY_ESTIMATE, "Your estimated delivery date will be confirmed after dispatch");
const shipped = (at) => ({ status: "shipped", order_status_history: [{ from: "processing", to: "shipped", at }] });
assert.equal(estimatedDeliveryDate(shipped("2026-09-16T12:00:00Z")), "2026-09-25");
assert.equal(estimatedDeliveryDate(shipped("2026-09-18T12:00:00Z")), "2026-09-29");
assert.equal(estimatedDeliveryDate(shipped("2026-12-31T12:00:00Z")), "2027-01-11");
assert.equal(estimatedDeliveryDate(shipped("2026-03-27T12:00:00Z")), "2026-04-07");
assert.equal(estimatedDeliveryDate(shipped("2026-09-16T23:30:00Z")), "2026-09-28");
const order = shipped("2026-09-16T12:00:00Z");
order.order_status_history.push({ from: "shipped", to: "shipped", at: "2026-09-21T12:00:00Z" });
assert.equal(estimatedDeliveryDate(order), "2026-09-25");
assert.equal(deliveryEstimateMessage(order), "Estimated delivery: 25 September 2026.");
assert.equal(orderTemplateVariables(order, "https://example.com/tracking").DELIVERY_ESTIMATE, "25 September 2026");
order.order_status_history.push({ from: "processing", to: "shipped", at: "2026-09-21T12:00:00Z" });
assert.equal(estimatedDeliveryDate(order), "2026-09-30");
assert.equal(estimatedDeliveryDate({ status: "shipped" }), "");
assert.match(deliveryEstimateMessage({ status: "shipped" }), /unavailable/);
for (const status of ["delivered", "refunded", "cancelled", "payment_failed"]) {
    assert.equal(deliveryEstimateMessage({ ...order, status }), "");
}
console.log("Delivery estimate is consistent across storefront, tracking and order emails.");
