import assert from "node:assert/strict";
import { runNetlifyHandler } from "../functions/_adapter.js";

const request = new Request("https://mutumas.com/.netlify/functions/example?item=one", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "CF-IPCountry": "GB"
    },
    body: JSON.stringify({ working: true })
});

const response = await runNetlifyHandler({
    request,
    params: { name: "example" },
    waitUntil() {}
}, async (event, context) => ({
    statusCode: 201,
    headers: { "X-Adapter-Test": "passed" },
    body: JSON.stringify({
        method: event.httpMethod,
        item: event.queryStringParameters.item,
        payload: JSON.parse(event.body),
        country: context.geo.country.code
    })
}));

assert.equal(response.status, 201);
assert.equal(response.headers.get("x-adapter-test"), "passed");
assert.deepEqual(await response.json(), {
    method: "POST",
    item: "one",
    payload: { working: true },
    country: "GB"
});

console.log("Cloudflare adapter tests passed.");
