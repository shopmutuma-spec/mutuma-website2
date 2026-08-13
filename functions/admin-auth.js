import { isAdminEmail, json, verifySupabaseUser } from "./supabase-client.js";

export function bearerToken(event) {
    const header = event.headers.authorization || event.headers.Authorization || "";
    return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function requireAdmin(event) {
    const user = await verifySupabaseUser(bearerToken(event));

    if (!user?.email || !isAdminEmail(user.email)) {
        return {
            ok: false,
            response: json(403, { error: "Admin access only." })
        };
    }

    return { ok: true, user };
}
