import { json, publicSupabaseConfig } from "./supabase-client.js";

export async function handler() {
    const config = publicSupabaseConfig();

    if (!config.url || !config.anonKey) {
        return json(503, {
            error: "Supabase auth is not configured in Netlify.",
            required: [
                "SUPABASE_URL",
                "SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)"
            ]
        });
    }

    return json(200, config);
}
