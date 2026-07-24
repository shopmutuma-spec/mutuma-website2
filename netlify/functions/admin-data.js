import { products } from "../../js/products.js";
import { isAdminEmail, json, supabaseRequest, verifySupabaseUser } from "./supabase-client.js";

function bearerToken(event) {
    const header = event.headers.authorization || event.headers.Authorization || "";
    return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    const user = await verifySupabaseUser(bearerToken(event));

    if (!user?.email || !isAdminEmail(user.email)) {
        return json(403, { error: "Admin access only." });
    }

    try {
        const [subscribers, orders] = await Promise.all([
            supabaseRequest("subscribers?select=email,source,subscribed_at&order=subscribed_at.desc&limit=200"),
            supabaseRequest("orders?select=order_number,email,name,total,currency,status,stripe_session_id,created_at&order=created_at.desc&limit=200")
        ]);

        return json(200, {
            counts: {
                products: products.length,
                subscribers: subscribers.length,
                orders: orders.length
            },
            subscribers,
            orders
        });
    } catch (error) {
        return json(500, { error: error.message || "Admin data could not be loaded." });
    }
}
