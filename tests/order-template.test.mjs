import assert from "node:assert/strict";
import { orderTemplateVariables } from "../netlify/functions/order-template.js";
const vars = orderTemplateVariables({
    name: '<script>"Buyer"</script>', order_number: "TEST", currency: "USD", total: 35,
    order_items: [
        { name: "Rug", quantity: 2, line_total: 20, variant: "Large", sku: "R1", image_url: "javascript:alert(1)" },
        { name: "Poster", quantity: 1, line_total: 15 }
    ], shipping_details: { address: { line1: "Example Street", country: "GB" } }
}, "https://example.com/tracking.html#order=TEST&email=a%40example.com");
assert.ok(!vars.CUSTOMER_NAME.includes("<script>"));
assert.match(vars.PRODUCT_NAME, /Rug \(x2\); Poster \(x1\)/);
assert.equal(vars.QUANTITY, "3");
assert.match(vars.LINE_TOTAL, /35\.00/);
assert.match(vars.PRODUCT_OPTIONS, /Large.*R1/);
assert.match(vars.PRODUCT_IMAGE_URL, /^https:.*product-placeholder/);
assert.match(vars.TRACKING_URL, /#order=TEST&amp;email=/);
assert.match(vars.DELIVERY_ADDRESS, /Example Street/);
assert.equal(orderTemplateVariables({}, "https://example.com/tracking.html").TOTAL_PAID, "Not recorded");
console.log("Order template snapshots, multi-item summaries, escaping and missing-data handling passed.");
