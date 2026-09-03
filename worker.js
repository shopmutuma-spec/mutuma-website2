import { onRequest as handleApi } from "./functions/api/[name].js";
import { onRequest as handleCurrencyLocation } from "./functions/currency-location.js";

function functionContext(request, env, ctx, name = "") {
    return {
        request,
        env,
        params: { name },
        waitUntil: ctx.waitUntil.bind(ctx),
        passThroughOnException: ctx.passThroughOnException?.bind(ctx)
    };
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/currency-location") {
            return handleCurrencyLocation(functionContext(request, env, ctx));
        }

        const apiMatch = url.pathname.match(/^\/api\/([^/]+)\/?$/)
            || url.pathname.match(/^\/\.netlify\/functions\/([^/]+)\/?$/);
        if (apiMatch) {
            return handleApi(functionContext(request, env, ctx, apiMatch[1]));
        }

        return env.STATIC_ASSETS.fetch(request);
    }
};
