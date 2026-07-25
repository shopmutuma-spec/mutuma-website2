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

function dayKey(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function buildDailySeries(events, orders, days = 30) {
    const map = new Map();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - index);
        map.set(date.toISOString().slice(0, 10), {
            date: date.toISOString().slice(0, 10),
            visitors: new Set(),
            pageViews: 0,
            productViews: 0,
            checkoutStarts: 0,
            purchases: 0,
            revenue: 0
        });
    }

    events.forEach((eventItem) => {
        const bucket = map.get(dayKey(eventItem.created_at));
        if (!bucket) return;
        if (eventItem.session_id) bucket.visitors.add(eventItem.session_id);
        if (eventItem.event_name === "page_viewed") bucket.pageViews += 1;
        if (eventItem.event_name === "product_viewed") bucket.productViews += 1;
        if (eventItem.event_name === "checkout_started") bucket.checkoutStarts += 1;
        if (eventItem.event_name === "purchase_completed") bucket.purchases += 1;
    });

    orders.forEach((order) => {
        const bucket = map.get(dayKey(order.created_at));
        if (!bucket) return;
        bucket.purchases += 1;
        bucket.revenue += parseNumber(order.total);
    });

    return [...map.values()].map((bucket) => ({
        ...bucket,
        visitors: bucket.visitors.size
    }));
}

function buildProductPerformance(events, products, orders) {
    const lookup = new Map(products.map((product) => [product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.images?.[0] || "",
        views: 0,
        addToCart: 0,
        checkoutStarts: 0,
        purchases: 0,
        revenue: 0
    }]));

    events.forEach((eventItem) => {
        const productId = eventItem.product_id;
        const product = productId ? lookup.get(productId) : null;
        if (!product) return;

        if (eventItem.event_name === "product_viewed") product.views += 1;
        if (eventItem.event_name === "product_added_to_cart") product.addToCart += 1;
        if (eventItem.event_name === "checkout_started") product.checkoutStarts += 1;
    });

    orders.forEach((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        items.forEach((item) => {
            const product = lookup.get(item.product_id);
            if (!product) return;
            product.purchases += Number(item.quantity || 1);
            product.revenue += parseNumber(item.amount_total);
        });
    });

    return [...lookup.values()]
        .filter((product) => product.views || product.addToCart || product.checkoutStarts || product.purchases)
        .map((product) => ({
            ...product,
            cartRate: product.views ? product.addToCart / product.views : 0,
            checkoutRate: product.views ? product.checkoutStarts / product.views : 0,
            purchaseRate: product.views ? product.purchases / product.views : 0,
            score: product.views + product.addToCart * 3 + product.checkoutStarts * 5 + product.purchases * 10
        }))
        .sort((first, second) => second.score - first.score);
}

function buildFunnel(events, orders) {
    const visitors = new Set(events.map((eventItem) => eventItem.session_id).filter(Boolean)).size;
    const productViews = events.filter((eventItem) => eventItem.event_name === "product_viewed").length;
    const cartAdds = events.filter((eventItem) => eventItem.event_name === "product_added_to_cart").length;
    const checkoutStarts = events.filter((eventItem) => eventItem.event_name === "checkout_started").length;
    const purchases = orders.length;

    return [
        { label: "Visitors", value: visitors },
        { label: "Product views", value: productViews },
        { label: "Cart adds", value: cartAdds },
        { label: "Checkout starts", value: checkoutStarts },
        { label: "Purchases", value: purchases }
    ].map((step, index, steps) => ({
        ...step,
        rateFromPrevious: index === 0 || !steps[index - 1].value ? 1 : step.value / steps[index - 1].value,
        rateFromVisitors: visitors ? step.value / visitors : 0
    }));
}

function buildCategoryPerformance(productPerformance) {
    const categories = new Map();
    productPerformance.forEach((product) => {
        const category = categories.get(product.category) || {
            label: product.category,
            views: 0,
            addToCart: 0,
            purchases: 0,
            revenue: 0
        };
        category.views += product.views;
        category.addToCart += product.addToCart;
        category.purchases += product.purchases;
        category.revenue += product.revenue;
        categories.set(product.category, category);
    });

    return [...categories.values()]
        .map((category) => ({
            ...category,
            conversionRate: category.views ? category.purchases / category.views : 0
        }))
        .sort((first, second) => second.views - first.views);
}

function userAgentDevice(userAgent = "") {
    const value = userAgent.toLowerCase();
    if (/tablet|ipad/.test(value)) return "Tablet";
    if (/mobile|iphone|android/.test(value)) return "Mobile";
    if (!value) return "Unknown";
    return "Desktop";
}

function userAgentBrowser(userAgent = "") {
    const value = userAgent.toLowerCase();
    if (value.includes("edg/")) return "Edge";
    if (value.includes("chrome/") && !value.includes("edg/")) return "Chrome";
    if (value.includes("safari/") && !value.includes("chrome/")) return "Safari";
    if (value.includes("firefox/")) return "Firefox";
    if (!value) return "Unknown";
    return "Other";
}

function topByComputed(rows, getValue, limit = 8) {
    const counts = new Map();
    rows.forEach((row) => {
        const value = getValue(row);
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((first, second) => second.count - first.count)
        .slice(0, limit);
}

function buildSessionQuality(events) {
    const sessions = new Map();

    events.forEach((eventItem) => {
        if (!eventItem.session_id) return;
        const session = sessions.get(eventItem.session_id) || {
            events: 0,
            pageViews: 0,
            productViews: 0,
            cartAdds: 0,
            checkoutStarts: 0,
            firstSeen: eventItem.created_at,
            lastSeen: eventItem.created_at
        };
        session.events += 1;
        if (eventItem.event_name === "page_viewed") session.pageViews += 1;
        if (eventItem.event_name === "product_viewed") session.productViews += 1;
        if (eventItem.event_name === "product_added_to_cart") session.cartAdds += 1;
        if (eventItem.event_name === "checkout_started") session.checkoutStarts += 1;
        session.firstSeen = new Date(eventItem.created_at) < new Date(session.firstSeen) ? eventItem.created_at : session.firstSeen;
        session.lastSeen = new Date(eventItem.created_at) > new Date(session.lastSeen) ? eventItem.created_at : session.lastSeen;
        sessions.set(eventItem.session_id, session);
    });

    const sessionList = [...sessions.values()];
    const engaged = sessionList.filter((session) => session.events >= 2 || session.productViews || session.cartAdds || session.checkoutStarts);
    const singlePage = sessionList.filter((session) => session.pageViews <= 1 && session.events <= 1);

    return {
        engagedSessions: engaged.length,
        engagementRate: sessionList.length ? engaged.length / sessionList.length : 0,
        singlePageSessions: singlePage.length,
        singlePageRate: sessionList.length ? singlePage.length / sessionList.length : 0
    };
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
            supabaseRequest(`analytics_events?select=event_name,session_id,page_path,product_id,product_name,search_query,currency,value,user_agent,country,created_at&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&order=created_at.desc&limit=3000`)
        ]);

        const orderRevenue = orders.reduce((total, order) => total + parseNumber(order.total), 0);
        const productViews = analyticsEvents.filter((eventItem) => eventItem.event_name === "product_viewed");
        const pageViews = analyticsEvents.filter((eventItem) => eventItem.event_name === "page_viewed");
        const searchEvents = analyticsEvents.filter((eventItem) => eventItem.event_name === "search_performed");
        const checkoutEvents = analyticsEvents.filter((eventItem) => eventItem.event_name === "checkout_started");
        const visitorSessions = new Set(analyticsEvents.map((eventItem) => eventItem.session_id).filter(Boolean));
        const recentSevenDayEvents = analyticsEvents.filter((eventItem) => new Date(eventItem.created_at) >= new Date(sevenDaysAgo));
        const recentTenMinuteEvents = analyticsEvents.filter((eventItem) => Date.now() - new Date(eventItem.created_at).getTime() <= 10 * 60 * 1000);
        const productPerformance = buildProductPerformance(analyticsEvents, products, orders);
        const dailySeries = buildDailySeries(analyticsEvents, orders);
        const sessionQuality = buildSessionQuality(analyticsEvents);

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
                conversionRate: visitorSessions.size ? orders.length / visitorSessions.size : 0,
                productViews: productViews.length,
                checkoutStarts: checkoutEvents.length,
                searches: searchEvents.length,
                liveVisitors: new Set(recentTenMinuteEvents.map((eventItem) => eventItem.session_id).filter(Boolean)).size,
                engagementRate: sessionQuality.engagementRate,
                singlePageRate: sessionQuality.singlePageRate,
                eventsLastSevenDays: recentSevenDayEvents.length,
                topProducts: topByCount(productViews, "product_name"),
                topPages: topByCount(pageViews, "page_path"),
                topSearches: topByCount(searchEvents, "search_query"),
                topCountries: topByCount(analyticsEvents, "country"),
                deviceSplit: topByComputed(analyticsEvents, (eventItem) => userAgentDevice(eventItem.user_agent)),
                browserSplit: topByComputed(analyticsEvents, (eventItem) => userAgentBrowser(eventItem.user_agent)),
                funnel: buildFunnel(analyticsEvents, orders),
                dailySeries,
                productPerformance: productPerformance.slice(0, 40),
                underperformingProducts: productPerformance
                    .filter((product) => product.views >= 3 && product.addToCart === 0 && product.purchases === 0)
                    .sort((first, second) => second.views - first.views)
                    .slice(0, 12),
                categoryPerformance: buildCategoryPerformance(productPerformance)
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
