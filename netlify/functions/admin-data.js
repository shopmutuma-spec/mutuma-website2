import { products } from "../../js/products.js";
import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

function startOfDay(daysAgo = 0) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString();
}

function parseNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function topByCount(rows, key, limit = 8) {
    const counts = new Map();
    rows.forEach((row) => {
        const value = row[key];
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((first, second) => second.count - first.count)
        .slice(0, limit);
}

function buildCustomers(orders, subscribers) {
    const customers = new Map();

    subscribers.forEach((subscriber) => {
        if (!subscriber.email) return;
        customers.set(subscriber.email, {
            email: subscriber.email,
            orders: 0,
            totalSpent: 0,
            lastOrder: "",
            source: subscriber.source || "subscriber"
        });
    });

    orders.forEach((order) => {
        if (!order.email) return;
        const customer = customers.get(order.email) || {
            email: order.email,
            orders: 0,
            totalSpent: 0,
            lastOrder: "",
            source: "checkout"
        };
        customer.orders += 1;
        customer.totalSpent += parseNumber(order.total);
        customer.lastOrder = customer.lastOrder && new Date(customer.lastOrder) > new Date(order.created_at)
            ? customer.lastOrder
            : order.created_at;
        customers.set(order.email, customer);
    });

    return [...customers.values()].sort((first, second) => second.totalSpent - first.totalSpent);
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    try {
        const thirtyDaysAgo = startOfDay(30);
        const sevenDaysAgo = startOfDay(7);
        const [subscribers, orders, analyticsEvents] = await Promise.all([
            supabaseRequest("subscribers?select=email,source,subscribed_at&order=subscribed_at.desc&limit=200"),
            supabaseRequest("orders?select=order_number,email,name,total,currency,status,stripe_session_id,tracking_courier,tracking_number,admin_notes,order_items,customer_details,created_at,updated_at&order=created_at.desc&limit=200"),
            supabaseRequest(`analytics_events?select=event_name,session_id,page_path,product_id,product_name,search_query,currency,value,created_at&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&order=created_at.desc&limit=1000`)
        ]);

        const orderRevenue = orders.reduce((total, order) => total + parseNumber(order.total), 0);
        const productViews = analyticsEvents.filter((eventItem) => eventItem.event_name === "product_viewed");
        const pageViews = analyticsEvents.filter((eventItem) => eventItem.event_name === "page_viewed");
        const searchEvents = analyticsEvents.filter((eventItem) => eventItem.event_name === "search_performed");
        const checkoutEvents = analyticsEvents.filter((eventItem) => eventItem.event_name === "checkout_started");
        const visitorSessions = new Set(analyticsEvents.map((eventItem) => eventItem.session_id).filter(Boolean));
        const recentSevenDayEvents = analyticsEvents.filter((eventItem) => new Date(eventItem.created_at) >= new Date(sevenDaysAgo));

        return json(200, {
            counts: {
                products: products.length,
                subscribers: subscribers.length,
                orders: orders.length,
                visitors: visitorSessions.size,
                pageViews: pageViews.length,
                analyticsEvents: analyticsEvents.length
            },
            metrics: {
                revenue: orderRevenue,
                averageOrderValue: orders.length ? orderRevenue / orders.length : 0,
                productViews: productViews.length,
                checkoutStarts: checkoutEvents.length,
                searches: searchEvents.length,
                eventsLastSevenDays: recentSevenDayEvents.length,
                topProducts: topByCount(productViews, "product_name"),
                topPages: topByCount(pageViews, "page_path"),
                topSearches: topByCount(searchEvents, "search_query")
            },
            subscribers,
            orders,
            customers: buildCustomers(orders, subscribers),
            products: products.map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                oldPrice: product.oldPrice || null,
                image: product.images?.[0] || "",
                stock: product.stock || null
            })),
            analyticsEvents
        });
    } catch (error) {
        return json(500, { error: error.message || "Admin data could not be loaded." });
    }
}
