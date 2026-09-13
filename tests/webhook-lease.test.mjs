import assert from "node:assert/strict";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
const { claimWebhook, finishWebhook } = await import("../netlify/functions/webhook-lease.js");
let row;
let tick = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    const result = (rows) => new Response(JSON.stringify(rows));
    if (options.method === "POST") {
        assert.match(options.headers.Prefer, /ignore-duplicates/);
        if (row) return result([]);
        row = { ...JSON.parse(options.body)[0], updated_at: new Date().toISOString() };
        return result([row]);
    }
    if (options.method === "PATCH") {
        const expected = new URL(url).searchParams.get("updated_at").slice(3);
        if (expected !== row.updated_at) return result([]);
        row = { ...row, ...JSON.parse(options.body), updated_at: new Date(Date.now() + ++tick).toISOString() };
        return result([row]);
    }
    return result(row ? [row] : []);
};
try {
    const event = { id: "evt_test", type: "checkout.session.completed" };
    const first = await claimWebhook(event);
    assert.equal(first.state, "claimed");
    assert.equal((await claimWebhook(event)).state, "busy");
    row.updated_at = "2020-01-01T00:00:00.000Z";
    const recovered = await claimWebhook(event);
    assert.equal(recovered.state, "claimed");
    await assert.rejects(finishWebhook(first, "processed"));
    await finishWebhook(recovered, "processed");
    assert.equal((await claimWebhook(event)).state, "processed");
    row.status = "failed";
    assert.equal((await claimWebhook(event)).state, "claimed");
    console.log("Webhook claim, busy retry, stale recovery, lease ownership and processed-duplicate tests passed.");
} finally { globalThis.fetch = originalFetch; }
