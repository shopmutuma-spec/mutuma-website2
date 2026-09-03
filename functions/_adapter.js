function requestHeaders(request) {
    return Object.fromEntries(request.headers.entries());
}

function queryParameters(url) {
    const values = {};
    url.searchParams.forEach((value, key) => {
        values[key] = value;
    });
    return values;
}

async function requestBody(request) {
    if (["GET", "HEAD"].includes(request.method)) return null;
    return request.text();
}

function cloudflareContext(context) {
    const country = context.request.cf?.country || context.request.headers.get("cf-ipcountry") || "";
    return {
        geo: {
            country: {
                code: country
            },
            countryCode: country,
            country_code: country
        },
        waitUntil: context.waitUntil?.bind(context)
    };
}

function responseHeaders(result) {
    const headers = new Headers(result?.headers || {});
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
    return headers;
}

export async function runNetlifyHandler(context, handler) {
    const request = context.request;
    const url = new URL(request.url);
    const event = {
        httpMethod: request.method,
        headers: requestHeaders(request),
        queryStringParameters: queryParameters(url),
        body: await requestBody(request),
        isBase64Encoded: false,
        path: url.pathname,
        rawUrl: request.url
    };

    try {
        const result = await handler(event, cloudflareContext(context));
        const status = Number(result?.statusCode || 200);
        const body = request.method === "HEAD" ? null : (result?.body ?? "");
        return new Response(body, {
            status,
            headers: responseHeaders(result)
        });
    } catch (error) {
        console.error("Cloudflare function adapter failed", error);
        return Response.json({ error: "Server request failed." }, { status: 500 });
    }
}
