import assert from "node:assert/strict";
import { filterRows, pageRows, localDateTime, orderChangePrompt } from "../js/admin-management.js";

const orders = [
    { order_number: "TEST-1", name: "Ada Smith", fulfilment_status: "processing", order_items: [{ name: "Blue Rug", sku: "RUG-1", variant: "Large" }] },
    { order_number: "TEST-2", email: "other@example.com", status: "shipped", tracking_number: "TRACK-2" }
];
assert.equal(filterRows(orders, "ada large", "processing").length, 1);
assert.equal(filterRows(orders, "rug-1").length, 1);
assert.equal(filterRows(orders, "TRACK-2", "shipped")[0].order_number, "TEST-2");
assert.equal(filterRows(orders, "ada", "shipped").length, 0);
assert.equal(filterRows([{ email: "ada@example.com" }], "ADA", "", "customers").length, 1);
assert.equal(filterRows([{ name: "Rug", id: "r1", category: "Rugs" }], "r1", "", "products").length, 1);
const rows = Array.from({ length: 81 }, (_, index) => index);
assert.deepEqual(pageRows(rows, 4).rows, [75, 76, 77, 78, 79, 80]);
assert.equal(pageRows(rows, 900).page, 4);
assert.equal(pageRows([], -1).pages, 1);
assert.equal(localDateTime(null), "");
assert.equal(localDateTime("invalid"), "");
const date = new Date("2026-09-14T12:30:00Z");
assert.equal(new Date(localDateTime(date)).getTime(), date.getTime());
assert.equal(orderChangePrompt("TEST", "processing", "processing"), "");
assert.match(orderChangePrompt("TEST", "processing", "shipped"), /customer an email/);
assert.match(orderChangePrompt("TEST", "processing", "refunded"), /does not refund/);
console.log("Admin search, status filters, pagination, preserved dates and status warnings passed.");
