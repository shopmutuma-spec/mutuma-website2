import { hasSupabaseConfig, json, publicSupabaseConfig, supabaseRequest } from "./supabase-client.js";

export async function handler() {
    const publicConfig = publicSupabaseConfig();
    const checks = {
        supabaseUrl: Boolean(publicConfig.url),
        anonKey: Boolean(publicConfig.anonKey),
        serviceRoleKey: hasSupabaseConfig()
    };

    if (!checks.supabaseUrl || !checks.anonKey || !checks.serviceRoleKey) {
        return json(503, {
            ok: false,
            error: "Supabase environment variables are missing in Netlify.",
            checks
        });
    }

    try {
        await supabaseRequest("subscribers?select=id&limit=1");
        await supabaseRequest("orders?select=id&limit=1");
        await supabaseRequest("analytics_events?select=id&limit=1");

        return json(200, {
            ok: true,
            message: "Supabase is connected and the required tables are reachable.",
            checks
        });
    } catch (error) {
        return json(500, {
            ok: false,
            error: error.message,
            checks
        });
    }
}
