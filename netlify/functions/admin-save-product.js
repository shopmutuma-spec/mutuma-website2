import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

function slug(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 120);
}

function cleanText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

function cleanNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanTags(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12);
}

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    try {
        const payload = JSON.parse(event.body || "{}");
        const name = cleanText(payload.name, 180);
        const id = slug(payload.id || name);
        const imageUrl = cleanText(payload.imageUrl, 800);
        const price = cleanNumber(payload.price);

        if (!id || !name || !imageUrl || !price) {
            return json(400, { error: "Name, image URL and price are required." });
        }

        const product = {
            id,
            name,
            description: cleanText(payload.description, 700),
            category: cleanText(payload.category, 80) || "Decor",
            price,
            old_price: payload.oldPrice ? cleanNumber(payload.oldPrice) : null,
            currency: "GBP",
            image_url: imageUrl,
            tags: cleanTags(payload.tags),
            stock: payload.stock ? Math.round(cleanNumber(payload.stock)) : null,
            featured: Boolean(payload.featured),
            published: payload.published !== false
        };

        const saved = await supabaseRequest("catalog_products", {
            method: "POST",
            body: JSON.stringify([product])
        });

        return json(200, { ok: true, product: saved[0] });
    } catch (error) {
        return json(500, { error: error.message || "Product could not be saved." });
    }
}
