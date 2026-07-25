import { json, supabaseRequest } from "./supabase-client.js";

function isActiveOffer(offer) {
    const now = Date.now();
    const startsAt = offer.starts_at ? new Date(offer.starts_at).getTime() : 0;
    const endsAt = offer.ends_at ? new Date(offer.ends_at).getTime() : Infinity;

    return offer.enabled && startsAt <= now && now <= endsAt;
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        const [products, offers] = await Promise.all([
            supabaseRequest("catalog_products?select=id,name,description,category,price,old_price,currency,image_url,tags,stock,featured,published&published=eq.true&order=created_at.desc&limit=300"),
            supabaseRequest("store_offers?select=id,name,discount_percent,scope,enabled,starts_at,ends_at,created_at&enabled=eq.true&order=created_at.desc&limit=20")
        ]);

        return json(200, {
            products,
            offers: offers.filter(isActiveOffer)
        });
    } catch (error) {
        return json(200, {
            products: [],
            offers: []
        });
    }
}
