import { products } from "../../js/products.js";
import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

const GBP = "GBP";
const DEFAULT_DAYS = 30;
const MAX_EVENT_LIMIT = 8000;
const ESTIMATED_PRODUCT_COST_RATE = 0.42;
const ESTIMATED_FULFILMENT_PER_ORDER = 1.25;
const ESTIMATED_SHIPPING_COST_PER_ORDER = 4.25;
const ESTIMATED_STRIPE_RATE = 0.015;
const ESTIMATED_STRIPE_FIXED_FEE = 0.2;

function startOfDay(daysAgo = 0) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date;
}

function endOfToday() {
    const date = new Date();
    date.setUTCHours(23, 59, 59, 999);
    return date;
}

function parseNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function cleanText(value, fallback = "") {
    return String(value ?? fallback).trim();
}

function clampDays(value) {
    const days = Number(value || DEFAULT_DAYS);
    if (!Number.isFinite(days)) return DEFAULT_DAYS;
    return Math.max(1, Math.min(365, Math.round(days)));
}

function parseDate(value, fallback) {
    const date = value ? new Date(value) : fallback;
    return Number.isNaN(date.getTime()) ? fallback : date;
}

function adminFilters(event) {
    const query = event.queryStringParameters || {};
    const days = clampDays(query.days);
    const to = parseDate(query.to, endOfToday());
    const from = parseDate(query.from, startOfDay(days));
    const compare = cleanText(query.compare || "previous_period");

    return {
        days,
        from,
        to,
        compare,
        country: cleanText(query.country),
        device: cleanText(query.device),
        source: cleanText(query.source),
        campaign: cleanText(query.campaign),
        product: cleanText(query.product),
        category: cleanText(query.category)
    };
}

function previousRange(filters) {
    const duration = filters.to.getTime() - filters.from.getTime();
    if (filters.compare === "previous_year") {
        const from = new Date(filters.from);
        const to = new Date(filters.to);
        from.setUTCFullYear(from.getUTCFullYear() - 1);
        to.setUTCFullYear(to.getUTCFullYear() - 1);
        return { from, to };
    }

    return {
        from: new Date(filters.from.getTime() - duration),
        to: new Date(filters.from.getTime() - 1)
    };
}

async function optionalSupabaseRequest(path) {
    try {
        return await supabaseRequest(path);
    } catch (error) {
        return [];
    }
}

function metadata(eventItem) {
    return eventItem.metadata && typeof eventItem.metadata === "object" ? eventItem.metadata : {};
}

function userAgentDevice(userAgent = "") {
    const value = String(userAgent || "").toLowerCase();
    if (/tablet|ipad/.test(value)) return "Tablet";
    if (/mobile|iphone|android/.test(value)) return "Mobile";
    if (!value) return "Unknown";
    return "Desktop";
}

function userAgentBrowser(userAgent = "") {
    const value = String(userAgent || "").toLowerCase();
    if (value.includes("edg/")) return "Edge";
    if (value.includes("chrome/") && !value.includes("edg/")) return "Chrome";
    if (value.includes("safari/") && !value.includes("chrome/")) return "Safari";
    if (value.includes("firefox/")) return "Firefox";
    if (!value) return "Unknown";
    return "Other";
}

function trafficSource(eventItem) {
    const meta = metadata(eventItem);
    const source = cleanText(meta.utm_source || meta.source || meta.firstTouchSource || meta.lastTouchSource);
    if (source) return source.toLowerCase();

    const referrer = cleanText(meta.referrer || meta.referringDomain).toLowerCase();
    if (!referrer) return "direct";
    if (referrer.includes("tiktok")) return "tiktok";
    if (referrer.includes("instagram")) return "instagram";
    if (referrer.includes("pinterest")) return "pinterest";
    if (referrer.includes("facebook")) return "facebook";
    if (referrer.includes("google")) return "google";
    return "referral";
}

function eventCampaign(eventItem) {
    const meta = metadata(eventItem);
    return cleanText(meta.utm_campaign || meta.campaign || "untracked");
}

function dayKey(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function inRange(row, from, to) {
    const time = new Date(row.created_at).getTime();
    return time >= from.getTime() && time <= to.getTime();
}

function productCategory(productId, productLookup) {
    return productLookup.get(productId)?.category || "";
}

function applyFilters(events, orders, filters, productLookup) {
    const eventRows = events.filter((eventItem) => {
        if (!inRange(eventItem, filters.from, filters.to)) return false;
        if (filters.country && cleanText(eventItem.country).toUpperCase() !== filters.country.toUpperCase()) return false;
        if (filters.device && userAgentDevice(eventItem.user_agent).toLowerCase() !== filters.device.toLowerCase()) return false;
        if (filters.source && trafficSource(eventItem) !== filters.source.toLowerCase()) return false;
        if (filters.campaign && eventCampaign(eventItem) !== filters.campaign) return false;
        if (filters.product && eventItem.product_id !== filters.product) return false;
        if (filters.category && productCategory(eventItem.product_id, productLookup).toLowerCase() !== filters.category.toLowerCase()) return false;
        return true;
    });

    const orderRows = orders.filter((order) => {
        if (!inRange(order, filters.from, filters.to)) return false;
        if (filters.product) {
            const items = Array.isArray(order.order_items) ? order.order_items : [];
            return items.some((item) => item.product_id === filters.product);
        }
        if (filters.category) {
            const items = Array.isArray(order.order_items) ? order.order_items : [];
            return items.some((item) => productCategory(item.product_id, productLookup).toLowerCase() === filters.category.toLowerCase());
        }
        return true;
    });

    return { events: eventRows, orders: orderRows };
}

function topByCount(rows, getValue, limit = 8) {
    const counts = new Map();
    rows.forEach((row) => {
        const value = typeof getValue === "function" ? getValue(row) : row[getValue];
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((first, second) => second.count - first.count)
        .slice(0, limit);
}

function buildDailySeries(events, orders, from, to) {
    const map = new Map();
    const cursor = new Date(from);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(0, 0, 0, 0);

    while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        map.set(key, {
            date: key,
            visitors: new Set(),
            sessions: new Set(),
            pageViews: 0,
            productViews: 0,
            addToCart: 0,
            checkoutStarts: 0,
            purchases: 0,
            revenue: 0,
            profit: 0
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    events.forEach((eventItem) => {
        const bucket = map.get(dayKey(eventItem.created_at));
        if (!bucket) return;
        if (eventItem.session_id) {
            bucket.visitors.add(eventItem.session_id);
            bucket.sessions.add(eventItem.session_id);
        }
        if (eventItem.event_name === "page_viewed") bucket.pageViews += 1;
        if (eventItem.event_name === "product_viewed") bucket.productViews += 1;
        if (eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart") bucket.addToCart += 1;
        if (eventItem.event_name === "checkout_started") bucket.checkoutStarts += 1;
    });

    orders.forEach((order) => {
        const bucket = map.get(dayKey(order.created_at));
        if (!bucket) return;
        const total = parseNumber(order.total);
        bucket.purchases += 1;
        bucket.revenue += total;
        bucket.profit += estimateOrderProfit(order).netProfit;
    });

    return [...map.values()].map((bucket) => ({
        ...bucket,
        visitors: bucket.visitors.size,
        sessions: bucket.sessions.size
    }));
}

function estimateOrderCosts(order) {
    const revenue = parseNumber(order.total);
    const productCost = revenue * ESTIMATED_PRODUCT_COST_RATE;
    const stripeFees = revenue * ESTIMATED_STRIPE_RATE + ESTIMATED_STRIPE_FIXED_FEE;
    const fulfilmentCost = ESTIMATED_FULFILMENT_PER_ORDER;
    const shippingCost = ESTIMATED_SHIPPING_COST_PER_ORDER;
    return {
        revenue,
        productCost,
        stripeFees,
        fulfilmentCost,
        shippingCost,
        estimated: true
    };
}

function estimateOrderProfit(order) {
    const costs = estimateOrderCosts(order);
    return {
        ...costs,
        netProfit: costs.revenue - costs.productCost - costs.stripeFees - costs.fulfilmentCost - costs.shippingCost
    };
}

function buildProductPerformance(events, productList, orders) {
    const lookup = new Map(productList.map((product) => [product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.images?.[0] || "",
        stock: product.stock ?? null,
        views: 0,
        uniqueViewers: new Set(),
        addToCart: 0,
        checkoutStarts: 0,
        purchases: 0,
        orders: 0,
        revenue: 0,
        wishlistAdds: 0,
        searchImpressions: 0
    }]));

    events.forEach((eventItem) => {
        const productId = eventItem.product_id;
        const product = productId ? lookup.get(productId) : null;
        if (!product) return;

        if (eventItem.event_name === "product_viewed") {
            product.views += 1;
            if (eventItem.session_id) product.uniqueViewers.add(eventItem.session_id);
        }
        if (eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart") product.addToCart += 1;
        if (eventItem.event_name === "checkout_started") product.checkoutStarts += 1;
        if (eventItem.event_name === "wishlist_item_added" || eventItem.event_name === "wishlist_added") product.wishlistAdds += 1;
        if (eventItem.event_name === "search_result_clicked") product.searchImpressions += 1;
    });

    orders.forEach((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        const seenInOrder = new Set();
        items.forEach((item) => {
            const product = lookup.get(item.product_id);
            if (!product) return;
            const quantity = Number(item.quantity || 1);
            product.purchases += quantity;
            product.revenue += parseNumber(item.amount_total);
            seenInOrder.add(item.product_id);
        });
        seenInOrder.forEach((productId) => {
            const product = lookup.get(productId);
            if (product) product.orders += 1;
        });
    });

    return [...lookup.values()]
        .filter((product) => product.views || product.addToCart || product.checkoutStarts || product.purchases || product.wishlistAdds)
        .map((product) => {
            const estimatedCost = product.revenue * ESTIMATED_PRODUCT_COST_RATE;
            const estimatedProfit = product.revenue - estimatedCost;
            return {
                ...product,
                uniqueViewers: product.uniqueViewers.size,
                cartRate: product.views ? product.addToCart / product.views : 0,
                checkoutRate: product.views ? product.checkoutStarts / product.views : 0,
                purchaseRate: product.views ? product.purchases / product.views : 0,
                estimatedProfit,
                grossMargin: product.revenue ? estimatedProfit / product.revenue : 0,
                averageQuantity: product.orders ? product.purchases / product.orders : 0,
                score: product.views + product.addToCart * 3 + product.checkoutStarts * 5 + product.purchases * 10
            };
        })
        .sort((first, second) => second.score - first.score);
}

function buildFunnel(events, orders) {
    const visitors = new Set(events.map((eventItem) => eventItem.session_id).filter(Boolean)).size;
    const productViews = events.filter((eventItem) => eventItem.event_name === "product_viewed").length;
    const cartAdds = events.filter((eventItem) => eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart").length;
    const cartViews = events.filter((eventItem) => eventItem.event_name === "cart_viewed" || eventItem.page_path?.includes("cart")).length;
    const checkoutStarts = events.filter((eventItem) => eventItem.event_name === "checkout_started").length;
    const paymentAttempts = events.filter((eventItem) => eventItem.event_name === "payment_attempted").length;
    const paymentFailures = events.filter((eventItem) => eventItem.event_name === "payment_failed").length;
    const purchases = orders.length;

    return [
        { label: "Sessions", value: visitors },
        { label: "Product viewed", value: productViews },
        { label: "Add to cart", value: cartAdds },
        { label: "Cart viewed", value: cartViews },
        { label: "Checkout started", value: checkoutStarts },
        { label: "Payment attempted", value: paymentAttempts },
        { label: "Payment failed", value: paymentFailures },
        { label: "Order completed", value: purchases }
    ].map((step, index, steps) => ({
        ...step,
        rateFromPrevious: index === 0 || !steps[index - 1].value ? 1 : step.value / steps[index - 1].value,
        dropOffFromPrevious: index === 0 || !steps[index - 1].value ? 0 : 1 - step.value / steps[index - 1].value,
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
            revenue: 0,
            profit: 0
        };
        category.views += product.views;
        category.addToCart += product.addToCart;
        category.purchases += product.purchases;
        category.revenue += product.revenue;
        category.profit += product.estimatedProfit;
        categories.set(product.category, category);
    });

    return [...categories.values()]
        .map((category) => ({
            ...category,
            conversionRate: category.views ? category.purchases / category.views : 0
        }))
        .sort((first, second) => second.revenue - first.revenue || second.views - first.views);
}

function buildSessionQuality(events) {
    const sessions = new Map();

    events.forEach((eventItem) => {
        if (!eventItem.session_id) return;
        const session = sessions.get(eventItem.session_id) || {
            id: eventItem.session_id,
            events: 0,
            pageViews: 0,
            productViews: 0,
            cartAdds: 0,
            checkoutStarts: 0,
            firstSeen: eventItem.created_at,
            lastSeen: eventItem.created_at,
            source: trafficSource(eventItem),
            device: userAgentDevice(eventItem.user_agent),
            country: eventItem.country || "Unknown"
        };
        session.events += 1;
        if (eventItem.event_name === "page_viewed") session.pageViews += 1;
        if (eventItem.event_name === "product_viewed") session.productViews += 1;
        if (eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart") session.cartAdds += 1;
        if (eventItem.event_name === "checkout_started") session.checkoutStarts += 1;
        session.firstSeen = new Date(eventItem.created_at) < new Date(session.firstSeen) ? eventItem.created_at : session.firstSeen;
        session.lastSeen = new Date(eventItem.created_at) > new Date(session.lastSeen) ? eventItem.created_at : session.lastSeen;
        sessions.set(eventItem.session_id, session);
    });

    const sessionList = [...sessions.values()];
    const engaged = sessionList.filter((session) => session.events >= 2 || session.productViews || session.cartAdds || session.checkoutStarts);
    const singlePage = sessionList.filter((session) => session.pageViews <= 1 && session.events <= 1);

    return {
        sessions: sessionList,
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
            firstOrder: "",
            lastOrder: "",
            source: subscriber.source || "subscriber",
            segment: "Subscriber"
        });
    });

    orders.forEach((order) => {
        if (!order.email) return;
        const customer = customers.get(order.email) || {
            email: order.email,
            orders: 0,
            totalSpent: 0,
            firstOrder: "",
            lastOrder: "",
            source: "checkout",
            segment: "New customer"
        };
        customer.orders += 1;
        customer.totalSpent += parseNumber(order.total);
        customer.firstOrder = !customer.firstOrder || new Date(customer.firstOrder) > new Date(order.created_at)
            ? order.created_at
            : customer.firstOrder;
        customer.lastOrder = customer.lastOrder && new Date(customer.lastOrder) > new Date(order.created_at)
            ? customer.lastOrder
            : order.created_at;
        customer.segment = customer.orders > 1 ? "Returning customer" : "One-time buyer";
        if (customer.totalSpent >= 150) customer.segment = "High-value customer";
        customers.set(order.email, customer);
    });

    return [...customers.values()].sort((first, second) => second.totalSpent - first.totalSpent);
}

function totals(events, orders, productList, sessionQuality) {
    const visitors = new Set(events.map((eventItem) => eventItem.session_id).filter(Boolean)).size;
    const pageViews = events.filter((eventItem) => eventItem.event_name === "page_viewed").length;
    const productViews = events.filter((eventItem) => eventItem.event_name === "product_viewed").length;
    const cartAdds = events.filter((eventItem) => eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart").length;
    const checkoutStarts = events.filter((eventItem) => eventItem.event_name === "checkout_started").length;
    const paymentFailures = events.filter((eventItem) => eventItem.event_name === "payment_failed").length;
    const searches = events.filter((eventItem) => eventItem.event_name === "search_performed").length;
    const revenue = orders.reduce((total, order) => total + parseNumber(order.total), 0);
    const profitRows = orders.map(estimateOrderProfit);
    const netProfit = profitRows.reduce((sum, order) => sum + order.netProfit, 0);
    const productCosts = profitRows.reduce((sum, order) => sum + order.productCost, 0);
    const stripeFees = profitRows.reduce((sum, order) => sum + order.stripeFees, 0);
    const fulfilmentCosts = profitRows.reduce((sum, order) => sum + order.fulfilmentCost, 0);
    const shippingCosts = profitRows.reduce((sum, order) => sum + order.shippingCost, 0);
    const itemsSold = orders.reduce((sum, order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        return sum + items.reduce((itemSum, item) => itemSum + Number(item.quantity || 1), 0);
    }, 0);
    const customerEmails = orders.map((order) => order.email).filter(Boolean);
    const uniqueCustomers = new Set(customerEmails).size;
    const repeatCustomers = [...new Set(customerEmails)].filter((email) => customerEmails.filter((value) => value === email).length > 1).length;

    return {
        grossRevenue: revenue,
        netRevenue: revenue,
        netProfit,
        productCosts,
        stripeFees,
        fulfilmentCosts,
        shippingCosts,
        orders: orders.length,
        itemsSold,
        uniqueVisitors: visitors,
        sessions: sessionQuality.sessions.length,
        pageViews,
        productViews,
        cartAdds,
        checkoutStarts,
        searches,
        paymentFailures,
        conversionRate: visitors ? orders.length / visitors : 0,
        averageOrderValue: orders.length ? revenue / orders.length : 0,
        revenuePerVisitor: visitors ? revenue / visitors : 0,
        newCustomers: uniqueCustomers - repeatCustomers,
        repeatCustomers,
        returningCustomerRate: uniqueCustomers ? repeatCustomers / uniqueCustomers : 0,
        cartAbandonmentRate: cartAdds ? Math.max(0, 1 - checkoutStarts / cartAdds) : 0,
        checkoutCompletionRate: checkoutStarts ? orders.length / checkoutStarts : 0,
        paymentSuccessRate: checkoutStarts ? orders.length / checkoutStarts : 0,
        refundAmount: orders.filter((order) => String(order.status).includes("refund")).reduce((sum, order) => sum + parseNumber(order.total), 0),
        refundRate: orders.length ? orders.filter((order) => String(order.status).includes("refund")).length / orders.length : 0,
        productCount: productList.length,
        engagementRate: sessionQuality.engagementRate,
        singlePageRate: sessionQuality.singlePageRate,
        estimated: true
    };
}

function compareValue(current, previous) {
    if (!previous) {
        return {
            change: null,
            label: "No comparison data"
        };
    }

    const change = (current - previous) / Math.abs(previous);
    return {
        change,
        label: `${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`
    };
}

function kpiCards(current, previous) {
    const definitions = [
        ["grossRevenue", "Gross revenue", "Total paid order value in the selected period."],
        ["netRevenue", "Net revenue", "Revenue after refunds where order status data is available."],
        ["netProfit", "Estimated net profit", "Revenue minus estimated product, Stripe, fulfilment and shipping costs."],
        ["orders", "Orders", "Completed synced orders."],
        ["itemsSold", "Items sold", "Line item quantities from synced Stripe orders."],
        ["uniqueVisitors", "Unique visitors", "Anonymous sessions seen in analytics events."],
        ["sessions", "Sessions", "Tracked website sessions."],
        ["conversionRate", "Conversion rate", "Orders divided by unique visitors."],
        ["averageOrderValue", "Average order value", "Gross revenue divided by order count."],
        ["revenuePerVisitor", "Revenue per visitor", "Gross revenue divided by unique visitors."],
        ["returningCustomerRate", "Returning customer rate", "Repeat customers divided by customers."],
        ["cartAbandonmentRate", "Cart abandonment", "Add-to-cart events that did not reach checkout."],
        ["checkoutCompletionRate", "Checkout completion", "Orders divided by checkout starts."],
        ["paymentSuccessRate", "Payment success", "Successful orders divided by checkout starts."],
        ["refundAmount", "Refund amount", "Refunded order value where status is marked refunded."],
        ["refundRate", "Refund rate", "Refunded orders divided by total orders."]
    ];

    return definitions.map(([key, label, tooltip]) => ({
        key,
        label,
        value: current[key] || 0,
        previous: previous[key] || 0,
        comparison: compareValue(current[key] || 0, previous[key] || 0),
        tooltip,
        estimated: key.toLowerCase().includes("profit") || key.includes("Fees") || key.includes("Costs")
    }));
}

function buildInsights(current, previous, productPerformance, sourceRows, searchRows) {
    const insights = [];
    const revenueChange = compareValue(current.grossRevenue, previous.grossRevenue);
    if (revenueChange.change !== null) {
        insights.push({
            title: `Revenue ${revenueChange.change >= 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(revenueChange.change * 100))}%`,
            metric: "Gross revenue",
            confidence: "High",
            action: revenueChange.change >= 0 ? "Identify which source and product drove the rise, then repeat that traffic push." : "Check traffic source and checkout failure reports for the biggest drop.",
            report: "Revenue"
        });
    }

    const highViewsLowSales = productPerformance.find((product) => product.views >= 5 && product.purchaseRate < 0.02);
    if (highViewsLowSales) {
        insights.push({
            title: `${highViewsLowSales.name} gets attention but low sales`,
            metric: `${highViewsLowSales.views} views, ${Math.round(highViewsLowSales.purchaseRate * 100)}% view-to-purchase`,
            confidence: "Medium",
            action: "Review price, product image, delivery clarity and the first product description line.",
            report: "Product Intelligence"
        });
    }

    const bestSource = sourceRows.find((source) => source.sessions >= 2);
    if (bestSource) {
        insights.push({
            title: `${bestSource.label} is the strongest tracked source right now`,
            metric: `${bestSource.sessions} sessions, ${Math.round(bestSource.conversionRate * 100)}% conversion`,
            confidence: bestSource.orders ? "Medium" : "Low",
            action: "Use UTM campaign links for every post so this source becomes easier to scale.",
            report: "Acquisition"
        });
    }

    const zeroResult = searchRows.find((row) => row.zeroResults);
    if (zeroResult) {
        insights.push({
            title: `Customers searched for "${zeroResult.label}" with no clear match`,
            metric: `${zeroResult.count} searches`,
            confidence: "Medium",
            action: "Add a matching product, synonym or category keyword if it fits MUTUMA.",
            report: "Search"
        });
    }

    if (!insights.length) {
        insights.push({
            title: "No strong insight yet",
            metric: "More real events are needed",
            confidence: "Low",
            action: "Keep analytics running and use campaign links for TikTok, Instagram and Pinterest.",
            report: "Diagnostics"
        });
    }

    return insights.slice(0, 6);
}

function buildAlerts(current, productPerformance, events, productList) {
    const alerts = [];
    if (current.checkoutStarts >= 3 && current.checkoutCompletionRate < 0.2) {
        alerts.push({ severity: "critical", title: "Checkout completion is low", detail: "Several shoppers started checkout but few completed payment." });
    }
    if (current.paymentFailures > 0) {
        alerts.push({ severity: "warning", title: "Payment failures detected", detail: `${current.paymentFailures} payment failure events were tracked.` });
    }
    productPerformance.filter((product) => product.stock !== null && product.stock <= 3).slice(0, 5).forEach((product) => {
        alerts.push({ severity: "warning", title: "Low stock", detail: `${product.name} has ${product.stock} units recorded.` });
    });
    productList.filter((product) => !product.images?.[0]).slice(0, 5).forEach((product) => {
        alerts.push({ severity: "warning", title: "Missing product image", detail: `${product.name} has no product image and may be hidden.` });
    });
    if (!events.length) {
        alerts.push({ severity: "information", title: "No analytics events in range", detail: "The selected filters have no tracked behaviour yet." });
    }
    return alerts;
}

function buildDiagnostics(productList, events, orders) {
    const duplicateEvents = events.length - new Set(events.map((eventItem) => `${eventItem.session_id}-${eventItem.event_name}-${eventItem.created_at}-${eventItem.product_id || ""}`)).size;
    return [
        { label: "Missing product images", value: productList.filter((product) => !product.images?.[0]).length, status: "warning" },
        { label: "Orders without line items", value: orders.filter((order) => !Array.isArray(order.order_items) || !order.order_items.length).length, status: "warning" },
        { label: "Events without session id", value: events.filter((eventItem) => !eventItem.session_id).length, status: "warning" },
        { label: "Duplicate-looking events", value: Math.max(0, duplicateEvents), status: duplicateEvents ? "warning" : "ok" },
        { label: "Missing campaign attribution", value: events.filter((eventItem) => eventCampaign(eventItem) === "untracked").length, status: "information" },
        { label: "Estimated cost rows", value: orders.length, status: "information" }
    ];
}

function buildTrafficSources(events, orders) {
    const sources = new Map();
    events.forEach((eventItem) => {
        const key = trafficSource(eventItem);
        const source = sources.get(key) || {
            label: key,
            sessions: new Set(),
            visitors: new Set(),
            productViews: 0,
            cartAdds: 0,
            checkoutStarts: 0,
            orders: 0,
            revenue: 0,
            profit: 0
        };
        if (eventItem.session_id) {
            source.sessions.add(eventItem.session_id);
            source.visitors.add(eventItem.session_id);
        }
        if (eventItem.event_name === "product_viewed") source.productViews += 1;
        if (eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart") source.cartAdds += 1;
        if (eventItem.event_name === "checkout_started") source.checkoutStarts += 1;
        sources.set(key, source);
    });

    orders.forEach((order) => {
        const source = sources.get("checkout") || {
            label: "checkout",
            sessions: new Set(),
            visitors: new Set(),
            productViews: 0,
            cartAdds: 0,
            checkoutStarts: 0,
            orders: 0,
            revenue: 0,
            profit: 0
        };
        source.orders += 1;
        source.revenue += parseNumber(order.total);
        source.profit += estimateOrderProfit(order).netProfit;
        sources.set(source.label, source);
    });

    return [...sources.values()].map((source) => ({
        ...source,
        sessions: source.sessions.size,
        visitors: source.visitors.size,
        conversionRate: source.sessions.size ? source.orders / source.sessions.size : 0,
        averageOrderValue: source.orders ? source.revenue / source.orders : 0,
        revenuePerVisitor: source.visitors.size ? source.revenue / source.visitors.size : 0
    })).sort((first, second) => second.sessions - first.sessions);
}

function buildSearchRows(events) {
    const searches = new Map();
    events.filter((eventItem) => eventItem.event_name === "search_performed").forEach((eventItem) => {
        const query = cleanText(eventItem.search_query || metadata(eventItem).query || metadata(eventItem).searchQuery).toLowerCase();
        if (!query) return;
        const row = searches.get(query) || { label: query, count: 0, zeroResults: 0, purchases: 0 };
        row.count += 1;
        if (metadata(eventItem).results === 0 || metadata(eventItem).resultCount === 0) row.zeroResults += 1;
        searches.set(query, row);
    });
    return [...searches.values()].sort((first, second) => second.count - first.count).slice(0, 30);
}

function recentActivity(events, orders) {
    const eventRows = events.slice(0, 30).map((eventItem) => ({
        type: eventItem.event_name,
        label: eventItem.product_name || eventItem.search_query || eventItem.page_path || eventItem.event_name,
        detail: `${trafficSource(eventItem)} / ${userAgentDevice(eventItem.user_agent)} / ${eventItem.country || "Unknown"}`,
        created_at: eventItem.created_at
    }));
    const orderRows = orders.slice(0, 10).map((order) => ({
        type: "order_completed",
        label: order.order_number,
        detail: `${order.currency || GBP} ${parseNumber(order.total).toFixed(2)}`,
        created_at: order.created_at
    }));
    return [...eventRows, ...orderRows].sort((first, second) => new Date(second.created_at) - new Date(first.created_at)).slice(0, 30);
}

function buildCampaignLinks(origin) {
    const base = origin || "https://mutumas.com";
    return [
        { platform: "TikTok", url: `${base}/shop.html?utm_source=tiktok&utm_medium=social&utm_campaign=video-name` },
        { platform: "Instagram", url: `${base}/shop.html?utm_source=instagram&utm_medium=social&utm_campaign=post-name` },
        { platform: "Pinterest", url: `${base}/shop.html?utm_source=pinterest&utm_medium=social&utm_campaign=pin-name` }
    ];
}

export async function handler(event) {
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(event);
    if (!admin.ok) return admin.response;

    try {
        const filters = adminFilters(event);
        const previous = previousRange(filters);
        const fetchFrom = new Date(Math.min(filters.from.getTime(), previous.from.getTime()));
        const [subscribers, orders, analyticsEvents, adminProducts, offers, goals] = await Promise.all([
            supabaseRequest("subscribers?select=email,source,subscribed_at&order=subscribed_at.desc&limit=500"),
            supabaseRequest("orders?select=order_number,email,name,total,currency,status,stripe_session_id,tracking_courier,tracking_number,admin_notes,order_items,customer_details,created_at,updated_at&order=created_at.desc&limit=500"),
            supabaseRequest(`analytics_events?select=event_name,session_id,page_path,product_id,product_name,search_query,currency,value,metadata,user_agent,country,created_at&created_at=gte.${encodeURIComponent(fetchFrom.toISOString())}&order=created_at.desc&limit=${MAX_EVENT_LIMIT}`),
            optionalSupabaseRequest("catalog_products?select=id,name,description,category,price,old_price,currency,image_url,tags,stock,featured,published,created_at&order=created_at.desc&limit=500"),
            optionalSupabaseRequest("store_offers?select=id,name,discount_percent,scope,enabled,starts_at,ends_at,created_at&order=created_at.desc&limit=50"),
            optionalSupabaseRequest("business_goals?select=id,name,metric,target_value,period,starts_at,ends_at,created_at&order=created_at.desc&limit=50")
        ]);

        const allProducts = [
            ...products,
            ...adminProducts.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description || "",
                category: product.category || "Decor",
                price: parseNumber(product.price),
                oldPrice: product.old_price ? parseNumber(product.old_price) : null,
                images: [product.image_url].filter(Boolean),
                tags: Array.isArray(product.tags) ? product.tags : [],
                stock: product.stock,
                featured: product.featured
            }))
        ];
        const productLookup = new Map(allProducts.map((product) => [product.id, product]));
        const currentRows = applyFilters(analyticsEvents, orders, filters, productLookup);
        const previousRows = applyFilters(analyticsEvents, orders, { ...filters, from: previous.from, to: previous.to }, productLookup);
        const sessionQuality = buildSessionQuality(currentRows.events);
        const previousSessionQuality = buildSessionQuality(previousRows.events);
        const currentTotals = totals(currentRows.events, currentRows.orders, allProducts, sessionQuality);
        const previousTotals = totals(previousRows.events, previousRows.orders, allProducts, previousSessionQuality);
        const productPerformance = buildProductPerformance(currentRows.events, allProducts, currentRows.orders);
        const dailySeries = buildDailySeries(currentRows.events, currentRows.orders, filters.from, filters.to);
        const sourceRows = buildTrafficSources(currentRows.events, currentRows.orders);
        const searchRows = buildSearchRows(currentRows.events);
        const recentTenMinuteEvents = currentRows.events.filter((eventItem) => Date.now() - new Date(eventItem.created_at).getTime() <= 10 * 60 * 1000);

        return json(200, {
            generatedAt: new Date().toISOString(),
            filters: {
                ...filters,
                from: filters.from.toISOString(),
                to: filters.to.toISOString(),
                previousFrom: previous.from.toISOString(),
                previousTo: previous.to.toISOString(),
                currency: GBP
            },
            counts: {
                products: allProducts.length,
                subscribers: subscribers.length,
                orders: currentRows.orders.length,
                visitors: currentTotals.uniqueVisitors,
                pageViews: currentTotals.pageViews,
                analyticsEvents: currentRows.events.length
            },
            metrics: {
                ...currentTotals,
                previous: previousTotals,
                kpis: kpiCards(currentTotals, previousTotals),
                topProducts: topByCount(currentRows.events.filter((eventItem) => eventItem.event_name === "product_viewed"), "product_name"),
                topPages: topByCount(currentRows.events.filter((eventItem) => eventItem.event_name === "page_viewed"), "page_path"),
                topSearches: searchRows,
                topCountries: topByCount(currentRows.events, "country"),
                deviceSplit: topByCount(currentRows.events, (eventItem) => userAgentDevice(eventItem.user_agent)),
                browserSplit: topByCount(currentRows.events, (eventItem) => userAgentBrowser(eventItem.user_agent)),
                sourcePerformance: sourceRows,
                campaignPerformance: topByCount(currentRows.events, eventCampaign),
                funnel: buildFunnel(currentRows.events, currentRows.orders),
                dailySeries,
                productPerformance: productPerformance.slice(0, 80),
                productRankings: {
                    bestSellers: [...productPerformance].sort((a, b) => b.purchases - a.purchases).slice(0, 10),
                    highestRevenue: [...productPerformance].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
                    highestProfit: [...productPerformance].sort((a, b) => b.estimatedProfit - a.estimatedProfit).slice(0, 10),
                    mostViewed: [...productPerformance].sort((a, b) => b.views - a.views).slice(0, 10),
                    highViewsLowSales: productPerformance.filter((product) => product.views >= 5 && product.purchaseRate < 0.02).slice(0, 10),
                    hiddenOpportunity: productPerformance.filter((product) => product.views < 5 && product.purchaseRate >= 0.2).slice(0, 10)
                },
                underperformingProducts: productPerformance
                    .filter((product) => product.views >= 3 && product.addToCart === 0 && product.purchases === 0)
                    .sort((first, second) => second.views - first.views)
                    .slice(0, 12),
                categoryPerformance: buildCategoryPerformance(productPerformance),
                live: {
                    visitors: new Set(recentTenMinuteEvents.map((eventItem) => eventItem.session_id).filter(Boolean)).size,
                    activity: recentActivity(currentRows.events, currentRows.orders)
                },
                insights: buildInsights(currentTotals, previousTotals, productPerformance, sourceRows, searchRows),
                alerts: buildAlerts(currentTotals, productPerformance, currentRows.events, allProducts),
                diagnostics: buildDiagnostics(allProducts, currentRows.events, currentRows.orders),
                campaignLinks: buildCampaignLinks(event.headers.origin || "https://mutumas.com")
            },
            subscribers,
            orders: currentRows.orders,
            customers: buildCustomers(currentRows.orders, subscribers),
            offers,
            goals,
            adminProducts,
            products: allProducts.map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                oldPrice: product.oldPrice || null,
                image: product.images?.[0] || "",
                stock: product.stock || null
            })),
            analyticsEvents: currentRows.events.slice(0, 250)
        });
    } catch (error) {
        return json(500, { error: error.message || "Admin data could not be loaded." });
    }
}
