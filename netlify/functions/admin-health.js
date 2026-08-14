import { requireAdmin } from "./admin-auth.js";
import { hasSupabaseConfig, json, supabaseRequest } from "./supabase-client.js";

async function checkSupabase() {
    if (!hasSupabaseConfig()) {
        return {
            ok: false,
            status: "missing_config",
            detail: "Supabase environment variables are not configured."
        };
    }

    try {
        await supabaseRequest("orders?select=id&limit=1");
        return {
            ok: true,
            status: "connected",
            detail: "Supabase service role can read operational tables."
        };
    } catch (error) {
        return {
            ok: false,
            status: "request_failed",
            detail: error.message || "Supabase health request failed."
        };
    }
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    return json(200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        checks: {
            supabase: await checkSupabase(),
            stripe: {
                ok: Boolean(process.env.STRIPE_SECRET_KEY),
                status: process.env.STRIPE_SECRET_KEY ? "configured" : "missing_config",
                detail: process.env.STRIPE_SECRET_KEY
                    ? "Stripe secret key is present server-side."
                    : "Stripe secret key is missing from the server environment."
            },
            adminAuth: {
                ok: Boolean(process.env.ADMIN_EMAILS),
                status: process.env.ADMIN_EMAILS ? "configured" : "missing_config",
                detail: process.env.ADMIN_EMAILS
                    ? "Admin email allow-list is configured."
                    : "ADMIN_EMAILS is missing."
            }
        }
    });
}
