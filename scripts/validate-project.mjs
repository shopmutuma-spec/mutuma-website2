import { access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
    "index.html",
    "shop.html",
    "product.html",
    "cart.html",
    "admin.html",
    "netlify/functions/create-checkout-session.js",
    "netlify/functions/stripe-webhook.js",
    "netlify/functions/order-sync.js",
    "netlify/functions/admin-data.js",
    "netlify/functions/admin-update-order.js",
    "supabase-schema.sql"
];

await Promise.all(requiredFiles.map(async (file) => {
    try {
        await access(file, constants.R_OK);
    } catch (error) {
        throw new Error(`Missing required file: ${file}`);
    }
}));

console.log(`Validated ${requiredFiles.length} required project files.`);
