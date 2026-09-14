import assert from "node:assert/strict";
import { confirmCheckout } from "../js/checkout-confirmation.js";
const paid = { paymentStatus: "paid", sessionId: "cs_test_example", orderNumber: "M-123" };
const response = (data, ok = true) => async () => ({ ok, json: async () => data });
assert.deepEqual(await confirmCheckout(paid.sessionId, response(paid)), paid);
for (const data of [{}, { ...paid, paymentStatus: "unpaid" }, { ...paid, sessionId: "cs_other" }, { ...paid, orderNumber: "" }]) {
    assert.equal(await confirmCheckout(paid.sessionId, response(data)), null);
}
assert.equal(await confirmCheckout(paid.sessionId, response(paid, false)), null);
assert.equal(await confirmCheckout(paid.sessionId, async () => { throw new Error("Offline"); }), null);
assert.equal(await confirmCheckout(null, () => { throw new Error("Must not request"); }), null);
console.log("Checkout confirmation rejects unpaid, invalid, mismatched and failed responses.");
