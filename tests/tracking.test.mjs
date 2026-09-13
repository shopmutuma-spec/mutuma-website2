import assert from "node:assert/strict";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
const { handler } = await import("../netlify/functions/track-order.js");
const originalFetch = globalThis.fetch;
const request = (body) => handler({ httpMethod: "POST", body: JSON.stringify(body) });
try {
    assert.equal((await handler({ httpMethod: "GET" })).statusCode, 405);
    assert.equal((await handler({ httpMethod: "POST", body: "{" })).statusCode, 400);
    assert.equal((await request(null)).statusCode, 400);
    assert.equal((await request({})).statusCode, 400);
    globalThis.fetch = async (url) => {
        assert.match(String(url), /order_number=eq.MUT-TEST/);
        assert.match(String(url), /email=eq.customer%40example.com/);
        return new Response(JSON.stringify([{ order_number: "MUT-TEST", status: "shipped", tracking_number: "ABC123", tracking_courier: "Carrier", tracking_url: "javascript:alert(1)", email: "customer@example.com", admin_notes: "private" }]), { status: 200 });
    };
    const result = await request({ orderNumber: "mut-test", email: "customer@example.com" });
    assert.equal(result.statusCode, 200);
    const data = JSON.parse(result.body);
    assert.equal(data.order.trackingUrl, "");
    assert.equal(data.order.trackingNumber, "ABC123");
    assert.equal(data.order.admin_notes, undefined);
    assert.equal(data.order.email, undefined);
    globalThis.fetch = async () => new Response("[]", { status: 200 });
    assert.equal((await request({ orderNumber: "OTHER", email: "wrong@example.com" })).statusCode, 404);
    globalThis.fetch = async () => { throw new Error("private server details"); };
    const failure = await request({ orderNumber: "OTHER", email: "wrong@example.com" });
    assert.equal(failure.statusCode, 503);
    assert.ok(!failure.body.includes("private server details"));
    console.log("Tracking validation, lookup filters, safe links, private-field exclusion and failure tests passed.");
} finally { globalThis.fetch = originalFetch; }
