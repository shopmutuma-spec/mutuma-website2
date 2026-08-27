import { products } from "../../js/products.js";
import { requireAdmin } from "./admin-auth.js";
import { json, supabaseRequest } from "./supabase-client.js";

const STORE_BASE_CURRENCY = "USD";
const ANALYTICS_CURRENCY = "GBP";
const REPORTING_RATES = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.93,
    CAD: 1.37,
    AUD: 1.52,
    NZD: 1.66,
    JPY: 147.5,
    CHF: 0.88,
    SEK: 10.46,
    NOK: 10.12,
    DKK: 6.94
};
const DEFAULT_DAYS = 30;
const MAX_EVENT_LIMIT = 8000;
const PROFIT_UNAVAILABLE_REASON = "Connect real product costs, shipping costs and Stripe fee data before net profit can be reported.";
const LEGACY_GBP_TO_USD_RATE = 1.27;

function toUsdAmount(value, currency = STORE_BASE_CURRENCY) {
    const number = Number(value || 0);
    if (!number) return number;
    return String(currency || "").toUpperCase() === "GBP"
        ? Number((number * LEGACY_GBP_TO_USD_RATE).toFixed(2))
        : number;
}

function reportingRate(currency = STORE_BASE_CURRENCY) {
    return REPORTING_RATES[String(currency || STORE_BASE_CURRENCY).toUpperCase()] || REPORTING_RATES[STORE_BASE_CURRENCY];
}

function toAnalyticsCurrency(value, currency = STORE_BASE_CURRENCY) {
    const number = parseNumber(value);
    if (!number) return number;
    const usdValue = number / reportingRate(currency);
    return Number((usdValue * reportingRate(ANALYTICS_CURRENCY)).toFixed(2));
}

function orderCurrency(order) {
    return order.currency || STORE_BASE_CURRENCY;
}

function orderTotal(order) {
    return toAnalyticsCurrency(order.total, orderCurrency(order));
}

function lineItemTotal(item, order) {
    return toAnalyticsCurrency(item.amount_total, item.currency || orderCurrency(order));
}

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

function normalizeOffer(offer) {
    if (!offer) return offer;
    const offerName = String(offer.name || "").toLowerCase();
    const isLegacyStorewideSale = [25, 30, 45].includes(Number(offer.discount_percent))
        && (offerName.includes("25% off everything") || offerName.includes("30% off everything") || offerName.includes("45% off everything"));

    if (!isLegacyStorewideSale) return offer;

    return {
        ...offer,
        name: "30% off everything",
        discount_percent: 30
    };
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
            orders: 0,
            revenue: 0
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
        const total = orderTotal(order);
        bucket.purchases += 1;
        bucket.orders += 1;
        bucket.revenue += total;
    });

    return [...map.values()].map((bucket) => ({
        ...bucket,
        visitors: bucket.visitors.size,
        sessions: bucket.sessions.size
    }));
}

function productCostValue(productId, costLookup) {
    const row = costLookup.get(productId);
    if (!row || row.product_cost === null || row.product_cost === undefined || row.product_cost === "") return null;
    const cost = Number(row.product_cost);
    return Number.isFinite(cost) ? cost : null;
}

function buildCostCoverage(orders, costRows) {
    const costLookup = new Map((costRows || []).map((row) => [row.product_id, row]));
    let lineItems = 0;
    let coveredLineItems = 0;
    let productCostTotal = 0;

    orders.forEach((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        items.forEach((item) => {
            lineItems += 1;
            const quantity = Number(item.quantity || 1);
            const unitCost = productCostValue(item.product_id, costLookup);
            if (unitCost === null) return;
            coveredLineItems += 1;
            productCostTotal += toAnalyticsCurrency(unitCost * quantity, STORE_BASE_CURRENCY);
        });
    });

    const productCostComplete = lineItems > 0 && lineItems === coveredLineItems;
    return {
        costLookup,
        lineItems,
        coveredLineItems,
        productCostTotal,
        productCostComplete,
        grossProfitAvailable: productCostComplete,
        netProfitAvailable: false,
        status: productCostComplete ? "partial" : "unavailable",
        reason: productCostComplete
            ? "Product costs exist for all sold items, but shipping costs and Stripe fees still need real source data for net profit."
            : PROFIT_UNAVAILABLE_REASON
    };
}

function buildProductPerformance(events, productList, orders, costLookup = new Map()) {
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
        productCost: 0,
        costMissingItems: 0,
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
            product.revenue += lineItemTotal(item, order);
            const unitCost = productCostValue(item.product_id, costLookup);
            if (unitCost === null) {
                product.costMissingItems += quantity;
            } else {
                product.productCost += toAnalyticsCurrency(unitCost * quantity, STORE_BASE_CURRENCY);
            }
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
            const grossProfitAvailable = product.purchases > 0 && product.costMissingItems === 0;
            const grossProfit = grossProfitAvailable ? product.revenue - product.productCost : null;
            return {
                ...product,
                uniqueViewers: product.uniqueViewers.size,
                cartRate: product.views ? product.addToCart / product.views : 0,
                checkoutRate: product.views ? product.checkoutStarts / product.views : 0,
                purchaseRate: product.views ? product.purchases / product.views : 0,
                grossProfit,
                grossProfitAvailable,
                grossMargin: product.revenue && grossProfitAvailable ? grossProfit / product.revenue : null,
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
            grossProfit: 0,
            profitUnavailable: false
        };
        category.views += product.views;
        category.addToCart += product.addToCart;
        category.purchases += product.purchases;
        category.revenue += product.revenue;
        if (product.grossProfitAvailable) {
            category.grossProfit += product.grossProfit;
        } else if (product.purchases) {
            category.profitUnavailable = true;
        }
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
        customer.totalSpent += orderTotal(order);
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

function totals(events, orders, productList, sessionQuality, costCoverage) {
    const visitors = new Set(events.map((eventItem) => eventItem.session_id).filter(Boolean)).size;
    const pageViews = events.filter((eventItem) => eventItem.event_name === "page_viewed").length;
    const productViews = events.filter((eventItem) => eventItem.event_name === "product_viewed").length;
    const cartAdds = events.filter((eventItem) => eventItem.event_name === "product_added_to_cart" || eventItem.event_name === "add_to_cart").length;
    const checkoutStarts = events.filter((eventItem) => eventItem.event_name === "checkout_started").length;
    const paymentFailures = events.filter((eventItem) => eventItem.event_name === "payment_failed").length;
    const searches = events.filter((eventItem) => eventItem.event_name === "search_performed").length;
    const revenue = orders.reduce((total, order) => total + orderTotal(order), 0);
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
        grossProfit: costCoverage.grossProfitAvailable ? revenue - costCoverage.productCostTotal : null,
        netProfit: null,
        productCosts: costCoverage.grossProfitAvailable ? costCoverage.productCostTotal : null,
        stripeFees: null,
        fulfilmentCosts: null,
        shippingCosts: null,
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
        refundAmount: orders.filter((order) => String(order.status).includes("refund")).reduce((sum, order) => sum + orderTotal(order), 0),
        refundRate: orders.length ? orders.filter((order) => String(order.status).includes("refund")).length / orders.length : 0,
        productCount: productList.length,
        engagementRate: sessionQuality.engagementRate,
        singlePageRate: sessionQuality.singlePageRate,
        costCoverage: {
            lineItems: costCoverage.lineItems,
            coveredLineItems: costCoverage.coveredLineItems,
            productCostComplete: costCoverage.productCostComplete,
            netProfitAvailable: false,
            reason: costCoverage.reason
        }
    };
}

function compareValue(current, previous) {
    if (current === null || current === undefined) {
        return {
            change: null,
            label: "Unavailable"
        };
    }
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
        ["grossRevenue", "Gross revenue", "orders.total", "Sum of paid synced order totals.", "complete"],
        ["netRevenue", "Net revenue", "orders.status + orders.total", "Gross revenue minus orders marked refunded when status data exists.", "partial"],
        ["grossProfit", "Gross profit", "product_costs + orders.order_items", "Revenue minus real product costs when every sold item has a cost row.", current.grossProfit === null ? "unavailable" : "partial"],
        ["netProfit", "Net profit", "Not connected yet", "Requires real product costs, shipping costs, Stripe fees and refunds.", "unavailable"],
        ["orders", "Orders", "orders", "Completed synced orders.", "complete"],
        ["itemsSold", "Items sold", "orders.order_items", "Line item quantities from synced Stripe orders.", "complete"],
        ["uniqueVisitors", "Unique visitors", "analytics_events.session_id", "Unique tracked sessions in the selected period.", "complete"],
        ["sessions", "Sessions", "analytics_events.session_id", "Tracked website sessions.", "complete"],
        ["conversionRate", "Conversion rate", "orders / unique visitors", "Orders divided by unique visitors.", "complete"],
        ["averageOrderValue", "Average order value", "gross revenue / orders", "Gross revenue divided by order count.", "complete"],
        ["revenuePerVisitor", "Revenue per visitor", "gross revenue / unique visitors", "Gross revenue divided by unique visitors.", "complete"],
        ["returningCustomerRate", "Returning customer rate", "orders.email", "Repeat customers divided by customers.", "complete"],
        ["cartAbandonmentRate", "Cart abandonment", "analytics_events", "Add-to-cart events that did not reach checkout.", "estimated"],
        ["checkoutCompletionRate", "Checkout completion", "orders / checkout_started", "Orders divided by checkout starts.", "complete"],
        ["paymentSuccessRate", "Payment success", "orders / checkout_started", "Successful orders divided by checkout starts.", "partial"],
        ["refundRate", "Refund rate", "orders.status", "Refunded orders divided by total orders when refund status is synced.", "partial"]
    ];

    return definitions.map(([key, label, source, formula, status]) => ({
        key,
        label,
        value: current[key] ?? null,
        previous: previous[key] ?? null,
        comparison: compareValue(current[key] ?? null, previous[key] ?? null),
        tooltip: formula,
        source,
        formula,
        status,
        available: status !== "unavailable" && current[key] !== null && current[key] !== undefined,
        lastUpdated: new Date().toISOString()
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
        { label: "Missing campaign attribution", value: events.filter((eventItem) => eventCampaign(eventItem) === "untracked").length, status: "information" }
    ];
}

function buildDataQuality({ subscribers, orders, events, productList, costCoverage, generatedAt }) {
    return [
        {
            label: "Orders",
            status: orders.length ? "complete" : "delayed",
            source: "Supabase orders table, synced from Stripe checkout success.",
            detail: orders.length ? `${orders.length} orders in the selected range.` : "No synced orders in this range.",
            lastUpdated: generatedAt
        },
        {
            label: "Customer emails",
            status: subscribers.length || orders.some((order) => order.email) ? "complete" : "delayed",
            source: "subscribers table and Stripe checkout customer email.",
            detail: "Used for email list and customer analytics.",
            lastUpdated: generatedAt
        },
        {
            label: "Behaviour analytics",
            status: events.length ? "complete" : "delayed",
            source: "analytics_events table.",
            detail: events.length ? `${events.length} tracked events in range.` : "No tracked events in this range.",
            lastUpdated: generatedAt
        },
        {
            label: "Product catalogue",
            status: productList.length ? "complete" : "unavailable",
            source: "js/products.js plus catalog_products.",
            detail: `${productList.length} products available to the dashboard.`,
            lastUpdated: generatedAt
        },
        {
            label: "Product costs",
            status: costCoverage.productCostComplete ? "partial" : "unavailable",
            source: "product_costs table.",
            detail: costCoverage.lineItems
                ? `${costCoverage.coveredLineItems}/${costCoverage.lineItems} sold line items have real product cost data.`
                : "No sold line items in this range.",
            lastUpdated: generatedAt
        },
        {
            label: "Net profit",
            status: "unavailable",
            source: "Requires product_costs, real shipping costs, Stripe fees and refunds.",
            detail: PROFIT_UNAVAILABLE_REASON,
            lastUpdated: generatedAt
        },
        {
            label: "Ad spend",
            status: "unavailable",
            source: "No ad platform API is connected.",
            detail: "ROAS, CAC and blended marketing efficiency stay unavailable until ad spend is connected.",
            lastUpdated: generatedAt
        }
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
            grossProfit: null
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
            revenue: 0
        };
        source.orders += 1;
        source.revenue += orderTotal(order);
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
        detail: `${ANALYTICS_CURRENCY} ${orderTotal(order).toFixed(2)}`,
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
        const [subscribers, orders, analyticsEvents, adminProducts, offers, goals, productCostRows] = await Promise.all([
            supabaseRequest("subscribers?select=email,source,subscribed_at&order=subscribed_at.desc&limit=500"),
            supabaseRequest("orders?select=order_number,email,name,total,currency,status,stripe_session_id,tracking_courier,tracking_number,tracking_url,admin_notes,order_items,customer_details,created_at,updated_at&order=created_at.desc&limit=500"),
            supabaseRequest(`analytics_events?select=event_name,session_id,page_path,product_id,product_name,search_query,currency,value,metadata,user_agent,country,created_at&created_at=gte.${encodeURIComponent(fetchFrom.toISOString())}&order=created_at.desc&limit=${MAX_EVENT_LIMIT}`),
            optionalSupabaseRequest("catalog_products?select=id,name,description,category,price,old_price,currency,image_url,tags,stock,featured,published,created_at&order=created_at.desc&limit=500"),
            optionalSupabaseRequest("store_offers?select=id,name,discount_percent,scope,enabled,starts_at,ends_at,created_at&order=created_at.desc&limit=50"),
            optionalSupabaseRequest("business_goals?select=id,name,metric,target_value,period,starts_at,ends_at,created_at&order=created_at.desc&limit=50"),
            optionalSupabaseRequest("product_costs?select=product_id,product_cost,fulfilment_cost,shipping_cost,supplier,updated_at&limit=500")
        ]);

        const allProducts = [
            ...products,
            ...adminProducts.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description || "",
                category: product.category || "Decor",
                price: toUsdAmount(product.price, product.currency),
                oldPrice: product.old_price ? toUsdAmount(product.old_price, product.currency) : null,
                images: [product.image_url].filter(Boolean),
                tags: Array.isArray(product.tags) ? product.tags : [],
                stock: product.stock,
                featured: product.featured
            }))
        ];
        const productLookup = new Map(allProducts.map((product) => [product.id, product]));
        const currentRows = applyFilters(analyticsEvents, orders, filters, productLookup);
        const previousRows = applyFilters(analyticsEvents, orders, { ...filters, from: previous.from, to: previous.to }, productLookup);
        const currentCostCoverage = buildCostCoverage(currentRows.orders, productCostRows);
        const previousCostCoverage = buildCostCoverage(previousRows.orders, productCostRows);
        const sessionQuality = buildSessionQuality(currentRows.events);
        const previousSessionQuality = buildSessionQuality(previousRows.events);
        const currentTotals = totals(currentRows.events, currentRows.orders, allProducts, sessionQuality, currentCostCoverage);
        const previousTotals = totals(previousRows.events, previousRows.orders, allProducts, previousSessionQuality, previousCostCoverage);
        const productPerformance = buildProductPerformance(currentRows.events, allProducts, currentRows.orders, currentCostCoverage.costLookup);
        const dailySeries = buildDailySeries(currentRows.events, currentRows.orders, filters.from, filters.to);
        const sourceRows = buildTrafficSources(currentRows.events, currentRows.orders);
        const searchRows = buildSearchRows(currentRows.events);
        const recentTenMinuteEvents = currentRows.events.filter((eventItem) => Date.now() - new Date(eventItem.created_at).getTime() <= 10 * 60 * 1000);
        const generatedAt = new Date().toISOString();

        return json(200, {
            generatedAt,
            filters: {
                ...filters,
                from: filters.from.toISOString(),
                to: filters.to.toISOString(),
                previousFrom: previous.from.toISOString(),
                previousTo: previous.to.toISOString(),
                currency: ANALYTICS_CURRENCY
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
                    highestGrossProfit: [...productPerformance]
                        .filter((product) => product.grossProfitAvailable)
                        .sort((a, b) => b.grossProfit - a.grossProfit)
                        .slice(0, 10),
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
                campaignLinks: buildCampaignLinks(event.headers.origin || "https://mutumas.com"),
                dataQuality: buildDataQuality({
                    subscribers,
                    orders: currentRows.orders,
                    events: currentRows.events,
                    productList: allProducts,
                    costCoverage: currentCostCoverage,
                    generatedAt
                })
            },
            subscribers,
            orders: currentRows.orders,
            customers: buildCustomers(currentRows.orders, subscribers),
            offers: offers.map(normalizeOffer),
            goals,
            adminProducts,
            products: allProducts.map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                oldPrice: product.oldPrice || null,
                image: product.images?.[0] || "",
                stock: product.stock ?? null
            })),
            analyticsEvents: currentRows.events.slice(0, 250)
        });
    } catch (error) {
        return json(500, { error: error.message || "Admin data could not be loaded." });
    }
}
