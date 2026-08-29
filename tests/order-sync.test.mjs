import assert from "node:assert/strict";
import { appendOrderHistory, buildOrderItemsFromStripe } from "../netlify/functions/order-sync.js";

const session = {
    id: "cs_test_123",
    currency: "gbp"
};

const lineItems = {
    data: [
        {
            description: "Spider-Man Poster Rug - Punk Cover",
            quantity: 2,
            amount_subtotal: 4200,
            amount_discount: 0,
            amount_tax: 0,
            amount_total: 4200,
            currency: "gbp",
            price: {
                id: "price_123",
                product: {
                    name: "Spider-Man Poster Rug - Punk Cover",
                    images: ["https://mutumas.com/images/products/black-web-poster-rug-punk-cover.jpg"],
                    metadata: {
                        product_id: "black-web-poster-rug-punk-cover",
                        sku: "black-web-poster-rug-punk-cover",
                        variant: "Punk Cover / 80 x 120 cm",
                        category: "Rugs",
                        image_url: "https://mutumas.com/images/products/black-web-poster-rug-punk-cover.jpg"
                    }
                }
            }
        },
        {
            description: "Mystery item",
            quantity: 1,
            amount_total: 0,
            currency: "gbp",
            price: {
                id: "price_456",
                product: {
                    metadata: {
                        product_id: "missing-image-product"
                    }
                }
            }
        }
    ]
};

const items = buildOrderItemsFromStripe(lineItems, session);

assert.equal(items.length, 2);
assert.equal(items[0].name, "Spider-Man Poster Rug - Punk Cover");
assert.equal(items[0].sku, "black-web-poster-rug-punk-cover");
assert.equal(items[0].variant, "Punk Cover / 80 x 120 cm");
assert.equal(items[0].quantity, 2);
assert.equal(items[0].unit_price, 21);
assert.equal(items[0].line_total, 42);
assert.equal(items[0].currency, "GBP");
assert.equal(items[1].image_url, "images/products/product-placeholder.svg");

const history = appendOrderHistory([{ at: "old", event: "created", to: "processing" }], {
    at: "new",
    event: "admin.order_updated",
    from: "processing",
    to: "shipped"
});

assert.equal(history.length, 2);
assert.equal(history[1].to, "shipped");

console.log("Order sync tests passed.");
