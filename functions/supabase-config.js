import { json, publicSupabaseConfig } from "./supabase-client.js";

export async function handler() {
    const config = publicSupabaseConfig();

    if (!config.url || !config.anonKey) {
        return json(503, { error: "Supabase auth is not configured yet." });
    }

    return json(200, config);
}
