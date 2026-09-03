import { handler as adminData } from "../../netlify/functions/admin-data.js";
import { handler as adminHealth } from "../../netlify/functions/admin-health.js";
import { handler as adminSaveOffer } from "../../netlify/functions/admin-save-offer.js";
import { handler as adminSaveProduct } from "../../netlify/functions/admin-save-product.js";
import { handler as adminUpdateOrder } from "../../netlify/functions/admin-update-order.js";
import { handler as collectAnalytics } from "../../netlify/functions/collect-analytics.js";
import { handler as createCheckoutSession } from "../../netlify/functions/create-checkout-session.js";
import { handler as detectCurrency } from "../../netlify/functions/detect-currency.js";
import { handler as getCheckoutSession } from "../../netlify/functions/get-checkout-session.js";
import { handler as storeCatalog } from "../../netlify/functions/store-catalog.js";
import { handler as stripeWebhook } from "../../netlify/functions/stripe-webhook.js";
import { handler as subscribeEmail } from "../../netlify/functions/subscribe-email.js";
import { handler as supabaseConfig } from "../../netlify/functions/supabase-config.js";
import { handler as supabaseHealth } from "../../netlify/functions/supabase-health.js";
import { handler as trackOrder } from "../../netlify/functions/track-order.js";
import { runNetlifyHandler } from "../_adapter.js";

const handlers = {
    "admin-data": adminData,
    "admin-health": adminHealth,
    "admin-save-offer": adminSaveOffer,
    "admin-save-product": adminSaveProduct,
    "admin-update-order": adminUpdateOrder,
    "collect-analytics": collectAnalytics,
    "create-checkout-session": createCheckoutSession,
    "detect-currency": detectCurrency,
    "get-checkout-session": getCheckoutSession,
    "store-catalog": storeCatalog,
    "stripe-webhook": stripeWebhook,
    "subscribe-email": subscribeEmail,
    "supabase-config": supabaseConfig,
    "supabase-health": supabaseHealth,
    "track-order": trackOrder
};

export async function onRequest(context) {
    const handler = handlers[String(context.params.name || "")];
    if (!handler) return Response.json({ error: "Function not found." }, { status: 404 });
    return runNetlifyHandler(context, handler);
}
