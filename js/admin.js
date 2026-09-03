import { initCurrency } from "./currency.js?v=20260902b";
import { initBaseLayout } from "./ui.js?v=20260902b";
import { adminFetch, getCurrentUser, signIn } from "./supabase-auth.js?v=20260902b";

initBaseLayout();
initCurrency().catch(() => {});

const ANALYTICS_CURRENCY = "GBP";
const form = document.querySelector("[data-admin-login]");
const message = document.querySelector("[data-admin-message]");
const panel = document.querySelector("[data-admin-panel]");
const layout = document.querySelector(".admin-layout");
let currentAdminUser = null;
let commandOpen = false;

let adminData = null;
let adminHealth = null;
let adminState = {
    days: "30",
    compare: "previous_period",
    country: "",
    device: "",
    source: "",
    campaign: "",
    product: "",
    category: ""
};

const adminRoutes = [
    { path: "overview", label: "Overview", group: "Command" },
    { path: "analytics", label: "Analytics", group: "Command" },
    { path: "live", label: "Live Activity", group: "Command" },
    { path: "orders", label: "Orders", group: "Commerce" },
    { path: "customers", label: "Customers", group: "Commerce" },
    { path: "products", label: "Products", group: "Commerce" },
    { path: "inventory", label: "Inventory", group: "Commerce" },
    { path: "marketing", label: "Marketing", group: "Growth" },
    { path: "acquisition", label: "Acquisition", group: "Growth" },
    { path: "conversion", label: "Conversion", group: "Growth" },
    { path: "geography", label: "Geography", group: "Growth" },
    { path: "search", label: "Search", group: "Growth" },
    { path: "discounts", label: "Discounts", group: "Operations" },
    { path: "abandoned-carts", label: "Abandoned Carts", group: "Operations" },
    { path: "finance", label: "Finance", group: "Operations" },
    { path: "reports", label: "Reports", group: "Operations" },
    { path: "site-health", label: "Site Health", group: "System" },
    { path: "activity", label: "Activity Log", group: "System" },
    { path: "settings", label: "Settings", group: "System" }
];

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function money(value, currency = ANALYTICS_CURRENCY) {
    try {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency
        }).format(Number(value || 0));
    } catch (error) {
        return `${currency} ${Number(value || 0).toFixed(2)}`;
    }
}

function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function customerAddress(details = {}) {
    const address = details.address || {};
    return [
        details.name,
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postal_code,
        address.country
    ].filter(Boolean).join(", ");
}

function addressFromDetails(details = {}) {
    const address = details.address || details;
    return [
        details.name,
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postal_code,
        address.country
    ].filter(Boolean).join(", ");
}

function orderItems(order) {
    return Array.isArray(order.order_items) ? order.order_items : [];
}

function orderItemCount(order) {
    return orderItems(order).reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function orderPreviewImage(order) {
    const firstItem = orderItems(order).find((item) => item.image_url);
    return firstItem?.image_url || "images/products/product-placeholder.svg";
}

function orderPreviewName(order) {
    const items = orderItems(order);
    if (!items.length) return "Products pending";

    const extra = items.length > 1 ? ` +${items.length - 1} more` : "";
    return `${items[0].name || items[0].product_id || "Product"}${extra}`;
}

function isNewOrder(order) {
    return Date.now() - new Date(order.created_at).getTime() < 24 * 60 * 60 * 1000;
}

function fulfilmentStatus(order) {
    return order.fulfilment_status || order.status || "processing";
}

function paymentStatus(order) {
    return order.payment_status || (String(order.status || "").includes("refund") ? "refunded" : "paid");
}

function csvEscape(value) {
    const text = String(value ?? "");
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
    const lines = [
        headers.map((header) => csvEscape(header.label)).join(","),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header.key])).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function metricCard(label, value) {
    return `<span><strong>${escapeHtml(value)}</strong>${escapeHtml(label)}</span>`;
}

function adminEmpty(title, detail) {
    return `
        <div class="empty-state compact admin-empty">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(detail)}</span>
        </div>
    `;
}

function pageTitle(title, subtitle = "") {
    return `
        <div class="admin-page-title">
            <div>
                <span class="eyebrow">MUTUMA Command Centre</span>
                <h1>${escapeHtml(title)}</h1>
                ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
            </div>
        </div>
    `;
}

function adminStatStrip(data) {
    return `
        <div class="admin-stats">
            ${metricCard("products", data.counts.products)}
            ${metricCard("orders", data.counts.orders)}
            ${metricCard("subscribers", data.counts.subscribers)}
            ${metricCard("visitors", data.counts.visitors)}
            ${metricCard("page views", data.counts.pageViews)}
            ${metricCard("revenue", money(data.metrics.grossRevenue || 0, ANALYTICS_CURRENCY))}
        </div>
    `;
}

function listMetric(title, rows) {
    return `
        <section class="admin-card">
            <h3>${escapeHtml(title)}</h3>
            ${rows.length ? `
                <ol class="admin-rank-list">
                    ${rows.map((row) => `<li><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong></li>`).join("")}
                </ol>
            ` : '<div class="empty-state compact">No data yet.</div>'}
        </section>
    `;
}

function percent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function signedPercent(value) {
    if (value === null || value === undefined) return "No comparison";
    const number = Math.round(Number(value || 0) * 100);
    return `${number >= 0 ? "+" : ""}${number}%`;
}

function metricValue(key, value) {
    if (value === null || value === undefined) return "Needs data";
    if (["grossRevenue", "netRevenue", "grossProfit", "netProfit", "averageOrderValue", "revenuePerVisitor", "refundAmount"].includes(key)) {
        return money(value, ANALYTICS_CURRENCY);
    }
    if (["conversionRate", "returningCustomerRate", "cartAbandonmentRate", "checkoutCompletionRate", "paymentSuccessRate", "refundRate"].includes(key)) {
        return percent(value);
    }
    return Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function option(value, label, currentValue) {
    return `<option value="${escapeHtml(value)}" ${String(currentValue) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function uniqueOptions(rows, key) {
    return [...new Set((rows || []).map((row) => row[key]).filter(Boolean))]
        .sort((first, second) => String(first).localeCompare(String(second)));
}

function analyticsToolbar(data) {
    const filters = data.filters || {};
    const countries = uniqueOptions(data.analyticsEvents, "country");
    const categories = uniqueOptions(data.products, "category");
    const sources = (data.metrics.sourcePerformance || []).map((source) => source.label);

    return `
        <form class="analytics-toolbar" data-analytics-toolbar>
            <label>Date range
                <select name="days">
                    ${option("1", "Today", adminState.days)}
                    ${option("2", "Yesterday / last 2 days", adminState.days)}
                    ${option("7", "Last 7 days", adminState.days)}
                    ${option("30", "Last 30 days", adminState.days)}
                    ${option("90", "Last 90 days", adminState.days)}
                    ${option("365", "This year", adminState.days)}
                </select>
            </label>
            <label>Compare
                <select name="compare">
                    ${option("previous_period", "Previous period", adminState.compare)}
                    ${option("previous_year", "Previous year", adminState.compare)}
                </select>
            </label>
            <label>Country
                <select name="country">
                    ${option("", "All countries", adminState.country)}
                    ${countries.map((country) => option(country, country, adminState.country)).join("")}
                </select>
            </label>
            <label>Device
                <select name="device">
                    ${option("", "All devices", adminState.device)}
                    ${["Mobile", "Tablet", "Desktop"].map((device) => option(device, device, adminState.device)).join("")}
                </select>
            </label>
            <label>Source
                <select name="source">
                    ${option("", "All sources", adminState.source)}
                    ${sources.map((source) => option(source, source, adminState.source)).join("")}
                </select>
            </label>
            <label>Category
                <select name="category">
                    ${option("", "All categories", adminState.category)}
                    ${categories.map((category) => option(category, category, adminState.category)).join("")}
                </select>
            </label>
            <label>Product
                <select name="product">
                    ${option("", "All products", adminState.product)}
                    ${(data.products || []).slice(0, 250).map((product) => option(product.id, product.name, adminState.product)).join("")}
                </select>
            </label>
            <div class="analytics-toolbar-actions">
                <span>${ANALYTICS_CURRENCY}</span>
                <button class="button secondary" type="submit">Apply</button>
                <button class="button secondary" type="button" data-refresh-admin>Refresh</button>
                <button class="button secondary" type="button" data-export-report>Export Report</button>
            </div>
            <small>Last updated ${formatDate(data.generatedAt)}. Range ${formatDate(filters.from)} to ${formatDate(filters.to)}.</small>
        </form>
    `;
}

function kpiGrid(data) {
    return `
        <section class="analytics-kpi-grid">
            ${(data.metrics.kpis || []).map((kpi) => `
                <a class="analytics-kpi-card ${kpi.available ? "" : "is-unavailable"}" href="#report-${escapeHtml(kpi.key)}" title="${escapeHtml(kpi.tooltip)}">
                    <span>${escapeHtml(kpi.label)} <em>${escapeHtml(kpi.status || "complete")}</em></span>
                    <strong>${escapeHtml(metricValue(kpi.key, kpi.value))}</strong>
                    <small class="${Number(kpi.comparison.change || 0) >= 0 ? "positive" : "negative"}">${escapeHtml(signedPercent(kpi.comparison.change))} vs previous</small>
                    <i style="width:${Math.min(100, Math.max(6, Math.abs(Number(kpi.comparison.change || 0)) * 100))}%"></i>
                    <small>${escapeHtml(kpi.source || "")}</small>
                </a>
            `).join("")}
        </section>
    `;
}

function adminShell(user, activeRoute, content) {
    const groups = groupedRoutes();
    const active = routeMeta(activeRoute);
    const alerts = adminData?.metrics?.alerts || [];
    const unread = alerts.length;

    return `
        <div class="admin-app-shell" data-admin-shell>
            <aside class="admin-sidebar">
                <a class="admin-brand" href="${routeHref("overview")}">
                    <span>MUTUMA</span>
                    <small>Command Centre</small>
                </a>
                <nav class="admin-sidebar-nav" aria-label="Admin navigation">
                    ${Object.entries(groups).map(([group, routes]) => `
                        <div>
                            <strong>${escapeHtml(group)}</strong>
                            ${routes.map((route) => `
                                <a href="${routeHref(route.path)}" class="${route.path === activeRoute ? "active" : ""}" ${route.path === activeRoute ? 'aria-current="page"' : ""}>
                                    ${escapeHtml(route.label)}
                                </a>
                            `).join("")}
                        </div>
                    `).join("")}
                </nav>
            </aside>
            <section class="admin-workspace">
                <header class="admin-topbar">
                    <button class="icon-button admin-nav-toggle" type="button" data-admin-nav-toggle aria-label="Toggle admin navigation">Menu</button>
                    <div class="admin-breadcrumb">
                        <span>Admin</span>
                        <b>${escapeHtml(active.label)}</b>
                    </div>
                    <button class="admin-global-search" type="button" data-command-open>
                        Search orders, products, customers
                        <kbd>Ctrl K</kbd>
                    </button>
                    <div class="admin-topbar-actions">
                        <button class="icon-button" type="button" data-refresh-admin aria-label="Refresh admin">↻</button>
                        <a class="icon-button" href="${routeHref("site-health")}" aria-label="Notifications">${unread}</a>
                        <a class="button secondary" href="account.html">${escapeHtml(user.email)}</a>
                    </div>
                </header>
                <div class="admin-mobile-tabs" aria-label="Admin quick navigation">
                    ${adminRoutes.slice(0, 8).map((route) => `
                        <a href="${routeHref(route.path)}" class="${route.path === activeRoute ? "active" : ""}">${escapeHtml(route.label)}</a>
                    `).join("")}
                </div>
                <section class="admin-page" data-admin-page>
                    ${content}
                </section>
            </section>
            ${commandPalette(activeRoute)}
        </div>
    `;
}

function commandPalette(activeRoute) {
    return `
        <div class="admin-command-palette ${commandOpen ? "open" : ""}" data-command-palette ${commandOpen ? "" : "hidden"}>
            <div class="admin-command-panel" role="dialog" aria-modal="true" aria-label="Admin command palette">
                <div class="admin-command-input">
                    <span>K</span>
                    <input data-command-input placeholder="Search pages, products, orders, customers" autocomplete="off">
                    <button type="button" data-command-close aria-label="Close command palette">Close</button>
                </div>
                <div class="admin-command-results" data-command-results>
                    ${commandResults("", activeRoute)}
                </div>
            </div>
        </div>
    `;
}

function commandResults(query = "", activeRoute = currentRoute()) {
    const search = query.trim().toLowerCase();
    const commands = [
        ...adminRoutes.map((route) => ({
            type: "Page",
            label: route.label,
            detail: route.group,
            href: routeHref(route.path)
        })),
        ...(adminData?.products || []).slice(0, 40).map((product) => ({
            type: "Product",
            label: product.name,
            detail: product.category,
            href: `${routeHref("products")}?product=${encodeURIComponent(product.id)}`
        })),
        ...(adminData?.orders || []).slice(0, 40).map((order) => ({
            type: "Order",
            label: order.order_number,
            detail: order.email,
            href: `${routeHref("orders")}?order=${encodeURIComponent(order.order_number)}`
        })),
        ...(adminData?.customers || []).slice(0, 40).map((customer) => ({
            type: "Customer",
            label: customer.email,
            detail: `${customer.orders} orders`,
            href: routeHref("customers")
        }))
    ];
    const filtered = commands.filter((item) => !search || `${item.type} ${item.label} ${item.detail}`.toLowerCase().includes(search)).slice(0, 12);

    if (!filtered.length) return adminEmpty("No matching command", "Try an order number, product name, customer email or admin page.");

    return filtered.map((item) => `
        <a href="${item.href}" data-command-result class="${item.href.includes(`#/${activeRoute}`) ? "active" : ""}">
            <span>${escapeHtml(item.type)}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
        </a>
    `).join("");
}

function currentRoute() {
    const route = (String(location.hash || "#/overview").replace(/^#\/?/, "") || "overview").split("?")[0];
    return adminRoutes.some((item) => item.path === route) ? route : "overview";
}

function navigateAdmin(path) {
    location.hash = `/${path}`;
}

function routeMeta(route = currentRoute()) {
    return adminRoutes.find((item) => item.path === route) || adminRoutes[0];
}

function routeHref(path) {
    return `admin.html#/${path}`;
}

function groupedRoutes() {
    return adminRoutes.reduce((groups, route) => {
        groups[route.group] = groups[route.group] || [];
        groups[route.group].push(route);
        return groups;
    }, {});
}

function insightCards(insights) {
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">AI-style Insights</span>
                    <h3>Recommended Actions</h3>
                </div>
                <span class="status-pill">Rules based</span>
            </div>
            <div class="insight-grid">
                ${(insights || []).map((insight) => `
                    <article>
                        <strong>${escapeHtml(insight.title)}</strong>
                        <span>${escapeHtml(insight.metric)}</span>
                        <p>${escapeHtml(insight.action)}</p>
                        <small>${escapeHtml(insight.confidence)} confidence / ${escapeHtml(insight.report)}</small>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function alertCentre(alerts) {
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Alerts</span>
                    <h3>Risk Centre</h3>
                </div>
                <span class="status-pill">${alerts.length} active</span>
            </div>
            ${alerts.length ? `
                <div class="alert-list">
                    ${alerts.map((alert) => `
                        <article class="${escapeHtml(alert.severity)}">
                            <span>${escapeHtml(alert.severity)}</span>
                            <strong>${escapeHtml(alert.title)}</strong>
                            <p>${escapeHtml(alert.detail)}</p>
                        </article>
                    `).join("")}
                </div>
            ` : '<div class="empty-state compact">No alerts in this range.</div>'}
        </section>
    `;
}

function diagnosticsPanel(rows) {
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Data Quality</span>
                    <h3>Diagnostics</h3>
                </div>
            </div>
            <div class="admin-mini-list">
                ${(rows || []).map((row) => `
                    <div>
                        <span>${escapeHtml(row.label)}</span>
                        <strong>${escapeHtml(row.value)} ${row.status !== "ok" ? `(${escapeHtml(row.status)})` : ""}</strong>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function liveActivityPanel(data) {
    const live = data.metrics.live || {};
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Real Time</span>
                    <h3>Live Activity</h3>
                </div>
                <span class="status-pill">${live.visitors || 0} online</span>
            </div>
            ${(live.activity || []).length ? `
                <div class="activity-feed">
                    ${live.activity.slice(0, 18).map((item) => `
                        <article>
                            <span>${escapeHtml(item.type)}</span>
                            <strong>${escapeHtml(item.label)}</strong>
                            <small>${escapeHtml(item.detail)} / ${formatDate(item.created_at)}</small>
                        </article>
                    `).join("")}
                </div>
            ` : '<div class="empty-state compact">No live activity yet.</div>'}
        </section>
    `;
}

function sourceTable(rows) {
    if (!rows.length) return '<div class="empty-state compact">No acquisition data yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Source</th><th>Sessions</th><th>Product views</th><th>Cart adds</th><th>Orders</th><th>Revenue</th><th>Conv.</th></tr></thead>
                <tbody>
                    ${rows.map((source) => `
                        <tr>
                            <td>${escapeHtml(source.label)}</td>
                            <td>${source.sessions}</td>
                            <td>${source.productViews}</td>
                            <td>${source.cartAdds}</td>
                            <td>${source.orders}</td>
                            <td>${money(source.revenue, ANALYTICS_CURRENCY)}</td>
                            <td>${percent(source.conversionRate)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function campaignLinkGenerator(data) {
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Campaigns</span>
                    <h3>Trackable Links</h3>
                </div>
            </div>
            <div class="admin-mini-list">
                ${(data.metrics.campaignLinks || []).map((campaign) => `
                    <div>
                        <span>${escapeHtml(campaign.platform)}</span>
                        <button class="button secondary" type="button" data-copy-link="${escapeHtml(campaign.url)}">Copy URL</button>
                    </div>
                `).join("")}
            </div>
            <small class="muted">Rename the campaign value for each TikTok, Instagram or Pinterest post before posting.</small>
        </section>
    `;
}

function goalsPanel(data) {
    const goals = data.goals || [];
    const metrics = data.metrics || {};

    function currentValue(metric) {
        const key = String(metric || "").replaceAll("-", "_");
        return metrics[key] ?? metrics[metric] ?? 0;
    }

    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Targets</span>
                    <h3>Goals</h3>
                </div>
            </div>
            ${goals.length ? `
                <div class="goal-list">
                    ${goals.map((goal) => {
                        const current = Number(currentValue(goal.metric));
                        const target = Number(goal.target_value || 0);
                        const progress = target ? Math.min(100, current / target * 100) : 0;
                        return `
                            <article>
                                <span>${escapeHtml(goal.name)}</span>
                                <strong>${escapeHtml(current.toFixed(2))} / ${escapeHtml(target.toFixed(2))}</strong>
                                <i style="width:${progress}%"></i>
                                <small>${escapeHtml(goal.period)} / ${escapeHtml(goal.metric)}</small>
                            </article>
                        `;
                    }).join("")}
                </div>
            ` : '<div class="empty-state compact">No business goals set yet. Add rows to the business_goals table when you are ready.</div>'}
        </section>
    `;
}

function maxValue(rows, key) {
    return Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
}

function lineChart(title, rows, series, formatter = (value) => value) {
    const width = 720;
    const height = 220;
    const padding = 28;
    const max = Math.max(1, ...rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0))));
    const xStep = rows.length > 1 ? (width - padding * 2) / (rows.length - 1) : 0;
    const paths = series.map((item) => {
        const points = rows.map((row, index) => {
            const x = padding + index * xStep;
            const y = height - padding - (Number(row[item.key] || 0) / max) * (height - padding * 2);
            return `${x},${y}`;
        }).join(" ");
        return `<polyline points="${points}" class="${item.className}" vector-effect="non-scaling-stroke"></polyline>`;
    }).join("");
    const latest = rows[rows.length - 1] || {};

    return `
        <section class="admin-card admin-chart-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Trend</span>
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <div class="admin-chart-legend">
                    ${series.map((item) => `<span class="${item.className}">${escapeHtml(item.label)} ${escapeHtml(formatter(latest[item.key] || 0))}</span>`).join("")}
                </div>
            </div>
            <svg class="admin-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
                <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
                ${paths}
            </svg>
        </section>
    `;
}

function barChart(title, rows, key = "count") {
    const max = maxValue(rows, key);

    return `
        <section class="admin-card">
            <h3>${escapeHtml(title)}</h3>
            ${rows.length ? `
                <div class="admin-bar-list">
                    ${rows.map((row) => `
                        <div>
                            <span>${escapeHtml(row.label || row.name)}</span>
                            <b>${escapeHtml(row[key])}</b>
                            <i style="width:${Math.max(4, Number(row[key] || 0) / max * 100)}%"></i>
                        </div>
                    `).join("")}
                </div>
            ` : '<div class="empty-state compact">No data yet.</div>'}
        </section>
    `;
}

function signalCard(label, value, note = "") {
    return `
        <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        </div>
    `;
}

function growthScore(data) {
    const metrics = data.metrics || {};
    const conversion = Math.min(35, Number(metrics.conversionRate || 0) * 3500);
    const engagement = Math.min(25, Number(metrics.engagementRate || 0) * 2500);
    const checkout = Math.min(25, Number(metrics.checkoutCompletionRate || 0) * 2500);
    const revenue = Math.min(15, Number(metrics.revenuePerVisitor || 0) * 30);
    return Math.round(conversion + engagement + checkout + revenue);
}

function analyticsExecutiveStrip(data) {
    const metrics = data.metrics || {};
    const score = growthScore(data);
    const strongestProduct = metrics.productRankings?.mostViewed?.[0];
    const strongestSource = metrics.sourcePerformance?.[0];
    const biggestLeak = [...(metrics.funnel || [])]
        .slice(1)
        .sort((first, second) => Number(second.dropOffFromPrevious || 0) - Number(first.dropOffFromPrevious || 0))[0];

    return `
        <section class="analytics-executive-strip">
            <article>
                <span>Store momentum</span>
                <strong>${escapeHtml(score)}/100</strong>
                <small>Blends conversion, engagement, checkout completion and revenue per visitor.</small>
                <i style="width:${Math.max(6, Math.min(100, score))}%"></i>
            </article>
            <article>
                <span>Strongest product signal</span>
                <strong>${escapeHtml(strongestProduct?.name || "Waiting for product views")}</strong>
                <small>${strongestProduct ? `${strongestProduct.views} views / ${percent(strongestProduct.cartRate)} view-to-cart` : "More events will make this useful."}</small>
            </article>
            <article>
                <span>Best traffic source</span>
                <strong>${escapeHtml(strongestSource?.label || "No source yet")}</strong>
                <small>${strongestSource ? `${strongestSource.sessions} sessions / ${percent(strongestSource.conversionRate)} conversion` : "Use tracked links for TikTok, Instagram and Pinterest."}</small>
            </article>
            <article>
                <span>Biggest funnel leak</span>
                <strong>${escapeHtml(biggestLeak?.label || "No leak yet")}</strong>
                <small>${biggestLeak ? `${percent(biggestLeak.dropOffFromPrevious)} drop from previous step` : "More traffic is needed before judging."}</small>
            </article>
        </section>
    `;
}

function productSpotlightCard(product, label, valueFormatter = (item) => `${item.views || 0} views`) {
    if (!product) {
        return `
            <article class="analytics-product-spotlight empty">
                <span>${escapeHtml(label)}</span>
                <strong>Waiting for data</strong>
                <small>More customer events will unlock this card.</small>
            </article>
        `;
    }

    return `
        <article class="analytics-product-spotlight">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : ""}
            <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(product.name)}</strong>
                <small>${escapeHtml(product.category || "Product")} / ${escapeHtml(valueFormatter(product))}</small>
            </div>
        </article>
    `;
}

function productRankingsPanel(data) {
    const rankings = data.metrics.productRankings || {};

    return `
        <section class="admin-card analytics-rankings-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Merchandising</span>
                    <h3>What To Push Next</h3>
                </div>
                <span class="status-pill">Live catalogue</span>
            </div>
            <div class="analytics-product-spotlight-grid">
                ${productSpotlightCard(rankings.mostViewed?.[0], "Most viewed", (product) => `${product.views} views / ${percent(product.cartRate)} cart rate`)}
                ${productSpotlightCard(rankings.highestRevenue?.[0], "Highest revenue", (product) => `${money(product.revenue, ANALYTICS_CURRENCY)} revenue`)}
                ${productSpotlightCard(rankings.highestGrossProfit?.[0], "Highest gross profit", (product) => `${money(product.grossProfit, ANALYTICS_CURRENCY)} gross profit`)}
                ${productSpotlightCard(rankings.highViewsLowSales?.[0], "Fix this first", (product) => `${product.views} views / ${percent(product.purchaseRate)} purchase rate`)}
            </div>
        </section>
    `;
}

function dataQualityPanel(data) {
    const rows = data.metrics.dataQuality || [];

    return `
        <section class="admin-card analytics-quality-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Data Integrity</span>
                    <h3>Metric Source Status</h3>
                </div>
                <span class="status-pill">No fake data</span>
            </div>
            <div class="analytics-quality-grid">
                ${rows.map((row) => `
                    <article class="quality-${escapeHtml(row.status)}">
                        <span>${escapeHtml(row.status)}</span>
                        <strong>${escapeHtml(row.label)}</strong>
                        <p>${escapeHtml(row.detail)}</p>
                        <small>${escapeHtml(row.source)} / updated ${escapeHtml(formatDate(row.lastUpdated))}</small>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function conversionLeversPanel(data) {
    const metrics = data.metrics || {};
    const levers = [
        {
            label: "Product page pull",
            value: percent(metrics.productViews && metrics.uniqueVisitors ? metrics.productViews / metrics.uniqueVisitors : 0),
            note: "Product views per visitor. Raise this with stronger hero/category paths."
        },
        {
            label: "View to cart",
            value: percent(metrics.productViews ? metrics.cartAdds / metrics.productViews : 0),
            note: "If low, improve images, price clarity and product descriptions."
        },
        {
            label: "Cart to checkout",
            value: percent(metrics.cartAdds ? metrics.checkoutStarts / metrics.cartAdds : 0),
            note: "If low, make shipping and discount totals impossible to miss."
        },
        {
            label: "Checkout finish",
            value: percent(metrics.checkoutCompletionRate || 0),
            note: "If low, test payment speed and Stripe handoff."
        }
    ];

    return `
        <section class="admin-card analytics-levers-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Growth</span>
                    <h3>Conversion Levers</h3>
                </div>
            </div>
            <div class="analytics-lever-grid">
                ${levers.map((lever) => `
                    <article>
                        <span>${escapeHtml(lever.label)}</span>
                        <strong>${escapeHtml(lever.value)}</strong>
                        <small>${escapeHtml(lever.note)}</small>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function funnelChart(rows) {
    const max = maxValue(rows, "value");

    return `
        <section class="admin-card admin-funnel-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Conversion</span>
                    <h3>Store Funnel</h3>
                </div>
            </div>
            <div class="admin-funnel">
                ${rows.map((row) => `
                    <div>
                        <span>${escapeHtml(row.label)}</span>
                        <strong>${escapeHtml(row.value)}</strong>
                        <small>${percent(row.rateFromVisitors)} of visitors</small>
                        <i style="width:${Math.max(5, Number(row.value || 0) / max * 100)}%"></i>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function productPerformanceTable(products) {
    if (!products.length) return '<div class="empty-state compact">No product performance yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Product</th><th>Views</th><th>Cart</th><th>Checkout</th><th>Units</th><th>Revenue</th><th>Profit</th><th>View to cart</th></tr></thead>
                <tbody>
                    ${products.slice(0, 20).map((product) => `
                        <tr>
                            <td><strong>${escapeHtml(product.name)}</strong><br><span class="muted">${escapeHtml(product.category)}</span></td>
                            <td>${product.views}</td>
                            <td>${product.addToCart}</td>
                            <td>${product.checkoutStarts}</td>
                            <td>${product.purchases}</td>
                            <td>${money(product.revenue, ANALYTICS_CURRENCY)}</td>
                            <td>${product.grossProfitAvailable ? money(product.grossProfit, ANALYTICS_CURRENCY) : '<span class="muted">Needs costs</span>'}</td>
                            <td>${percent(product.cartRate)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function analyticsCommandCentre(data) {
    const dailySeries = data.metrics.dailySeries || [];
    const funnel = data.metrics.funnel || [];
    const categoryRows = (data.metrics.categoryPerformance || []).map((category) => ({
        label: category.label,
        count: category.views
    }));
    const underperformers = (data.metrics.underperformingProducts || []).map((product) => ({
        label: product.name,
        count: product.views
    }));

    return `
        <section class="admin-command-centre">
            <div class="admin-live-grid">
                ${signalCard("Live visitors", data.metrics.live?.visitors || 0, "active in the last 10 minutes")}
                ${signalCard("Conversion rate", percent(data.metrics.conversionRate || 0), "orders divided by visitors")}
                ${signalCard("Engagement rate", percent(data.metrics.engagementRate || 0), "sessions with meaningful activity")}
                ${signalCard("Single-page sessions", percent(data.metrics.singlePageRate || 0), "watch this if it rises")}
            </div>
            ${analyticsExecutiveStrip(data)}
            ${dataQualityPanel(data)}
            ${lineChart("Traffic and Product Interest", dailySeries, [
                { key: "visitors", label: "Visitors", className: "chart-line-primary" },
                { key: "pageViews", label: "Page views", className: "chart-line-secondary" },
                { key: "productViews", label: "Product views", className: "chart-line-tertiary" }
            ])}
            ${lineChart("Checkout and Revenue", dailySeries, [
                { key: "checkoutStarts", label: "Checkout starts", className: "chart-line-primary" },
                { key: "purchases", label: "Purchases", className: "chart-line-secondary" },
                { key: "revenue", label: "Revenue", className: "chart-line-tertiary" }
            ], (value) => Number(value || 0).toFixed(0))}
            ${productRankingsPanel(data)}
            <div class="admin-analytics-grid">
                ${conversionLeversPanel(data)}
                ${funnelChart(funnel)}
                ${barChart("Category Demand", categoryRows)}
                ${barChart("Most Viewed Products", data.metrics.topProducts || [])}
                ${barChart("Most Visited Pages", data.metrics.topPages || [])}
                ${barChart("Search Demand", data.metrics.topSearches || [])}
                ${barChart("Needs Attention", underperformers)}
                ${barChart("Countries", data.metrics.topCountries || [])}
                ${barChart("Devices", data.metrics.deviceSplit || [])}
                ${barChart("Browsers", data.metrics.browserSplit || [])}
            </div>
            <div class="admin-analytics-grid">
                ${insightCards(data.metrics.insights || [])}
                ${alertCentre(data.metrics.alerts || [])}
                ${liveActivityPanel(data)}
                ${diagnosticsPanel(data.metrics.diagnostics || [])}
                ${campaignLinkGenerator(data)}
                ${goalsPanel(data)}
                <section class="admin-card">
                    <div class="admin-card-head">
                        <div>
                            <span class="eyebrow">Acquisition</span>
                            <h3>Traffic Sources</h3>
                        </div>
                    </div>
                    ${sourceTable(data.metrics.sourcePerformance || [])}
                </section>
            </div>
            <section class="admin-card">
                <div class="admin-card-head">
                    <div>
                        <span class="eyebrow">Product Intelligence</span>
                        <h3>Performance Table</h3>
                    </div>
                </div>
                ${productPerformanceTable(data.metrics.productPerformance || [])}
            </section>
        </section>
    `;
}

function offersPanel(data) {
    const activeOffer = (data.offers || []).find((offer) => offer.enabled) || {};

    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Offers</span>
                    <h3>Storewide Sale</h3>
                </div>
                <span class="status-pill">${activeOffer.enabled ? `${activeOffer.discount_percent}% off` : "No active offer"}</span>
            </div>
            <form class="admin-update-form" data-offer-form>
                <input type="hidden" name="id" value="${escapeHtml(activeOffer.id || "")}">
                <label>Offer name<input name="name" value="${escapeHtml(activeOffer.name || "15% off everything")}" required></label>
                <label>Discount percent<input name="discountPercent" type="number" min="0" max="90" step="1" value="${escapeHtml(activeOffer.discount_percent || 25)}" required></label>
                <label>Start date<input name="startsAt" type="datetime-local"></label>
                <label>End date<input name="endsAt" type="datetime-local"></label>
                <label class="check-row"><input name="enabled" type="checkbox" ${activeOffer.enabled !== false ? "checked" : ""}> Active on website</label>
                <button class="button primary">Save Offer</button>
                <p class="form-message" data-offer-message></p>
            </form>
            ${(data.offers || []).length ? `
                <div class="admin-mini-list">
                    ${(data.offers || []).slice(0, 5).map((offer) => `
                        <div><span>${escapeHtml(offer.name)}</span><strong>${escapeHtml(offer.discount_percent)}%</strong></div>
                    `).join("")}
                </div>
            ` : ""}
        </section>
    `;
}

function productManagerPanel() {
    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Products</span>
                    <h3>Add Product</h3>
                </div>
            </div>
            <form class="admin-update-form" data-product-form>
                <label>Name<input name="name" required placeholder="Chrome Heart Style Rug"></label>
                <label>Description<textarea name="description" rows="3" placeholder="Short premium product description"></textarea></label>
                <label>Category<input name="category" list="admin-category-list" value="Decor" required></label>
                <datalist id="admin-category-list">
                    ${["Rugs", "Posters", "Lighting", "Lego", "Organisation", "Mirrors", "Furniture", "Decor"].map((category) => `<option value="${category}"></option>`).join("")}
                </datalist>
                <label>Price USD<input name="price" type="number" min="0" step="0.01" required></label>
                <label>Previous price USD<input name="oldPrice" type="number" min="0" step="0.01"></label>
                <label>Image URL<input name="imageUrl" required placeholder="https://... or images/products/name.webp"></label>
                <label>Tags<input name="tags" placeholder="featured, trending, rugs"></label>
                <label>Stock<input name="stock" type="number" min="0" step="1"></label>
                <label class="check-row"><input name="featured" type="checkbox"> Featured product</label>
                <label class="check-row"><input name="published" type="checkbox" checked> Published</label>
                <button class="button primary">Add Product</button>
                <p class="form-message" data-product-message></p>
            </form>
        </section>
    `;
}

function orderRows(orders) {
    if (!orders.length) return '<div class="empty-state compact">No orders yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table admin-order-table">
                <thead>
                    <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Products</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Fulfilment</th>
                        <th>Tracking</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map((order) => `
                        <tr data-order-row="${escapeHtml(order.order_number)}" tabindex="0">
                            <td>
                                <strong>${escapeHtml(order.order_number)}</strong>
                                ${isNewOrder(order) ? '<span class="status-pill new-order-pill">New</span>' : ""}
                            </td>
                            <td>
                                <strong>${escapeHtml(order.name || order.customer_details?.name || "Customer")}</strong>
                                <span class="muted">${escapeHtml(order.email)}</span>
                            </td>
                            <td>
                                <div class="admin-order-preview">
                                    <img src="${escapeHtml(orderPreviewImage(order))}" alt="" loading="lazy">
                                    <span>${escapeHtml(orderPreviewName(order))}</span>
                                </div>
                            </td>
                            <td>${orderItemCount(order)}</td>
                            <td>${money(order.total, order.currency)}</td>
                            <td><span class="status-pill">${escapeHtml(paymentStatus(order))}</span></td>
                            <td><span class="status-pill">${escapeHtml(fulfilmentStatus(order))}</span></td>
                            <td>${escapeHtml(order.tracking_number || "Not added")}</td>
                            <td>${formatDate(order.created_at)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function subscriberRows(subscribers) {
    if (!subscribers.length) return '<div class="empty-state compact">No subscribers yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Email</th><th>Source</th><th>Joined</th></tr></thead>
                <tbody>
                    ${subscribers.slice(0, 30).map((subscriber) => `
                        <tr>
                            <td>${escapeHtml(subscriber.email)}</td>
                            <td>${escapeHtml(subscriber.source)}</td>
                            <td>${formatDate(subscriber.subscribed_at)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function customerRows(customers) {
    if (!customers.length) return '<div class="empty-state compact">No customers yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Email</th><th>Orders</th><th>Total spent</th><th>Last order</th><th>Source</th></tr></thead>
                <tbody>
                    ${customers.slice(0, 50).map((customer) => `
                        <tr>
                            <td>${escapeHtml(customer.email)}</td>
                            <td>${escapeHtml(customer.orders)}</td>
                            <td>${money(customer.totalSpent, ANALYTICS_CURRENCY)}</td>
                            <td>${formatDate(customer.lastOrder)}</td>
                            <td>${escapeHtml(customer.source)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function productRows(products) {
    if (!products.length) return '<div class="empty-state compact">No products found.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th></tr></thead>
                <tbody>
                    ${products.slice(0, 80).map((product) => `
                        <tr>
                            <td><strong>${escapeHtml(product.name)}</strong><br><span class="muted">${escapeHtml(product.id)}</span></td>
                            <td>${escapeHtml(product.category)}</td>
                            <td>${money(product.price, "USD")}</td>
                            <td>${product.image ? "Visible" : "Missing image"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function orderSection(orders) {
    return `<div data-admin-orders>${orderRows(orders)}</div>`;
}

function orderDetail(order) {
    if (!order) return "";

    const items = orderItems(order);
    return `
        <section class="admin-card admin-order-detail">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Order Detail</span>
                    <h3>${escapeHtml(order.order_number)}</h3>
                </div>
                <strong>${money(order.total, order.currency)}</strong>
            </div>
            <div class="admin-detail-grid">
                <span><b>Email</b>${escapeHtml(order.email)}</span>
                <span><b>Name</b>${escapeHtml(order.name || order.customer_details?.name || "")}</span>
                <span><b>Phone</b>${escapeHtml(order.customer_details?.phone || "")}</span>
                <span><b>Payment status</b>${escapeHtml(paymentStatus(order))}</span>
                <span><b>Fulfilment status</b>${escapeHtml(fulfilmentStatus(order))}</span>
                <span><b>Delivery method</b>${escapeHtml(order.delivery_method || "Tracked shipping")}</span>
                <span><b>Delivery address</b>${escapeHtml(addressFromDetails(order.shipping_details) || customerAddress(order.customer_details))}</span>
                <span><b>Billing address</b>${escapeHtml(addressFromDetails(order.billing_details) || customerAddress(order.customer_details))}</span>
                <span><b>Stripe session</b>${escapeHtml(order.stripe_session_id || "")}</span>
            </div>
            <h4>Products</h4>
            ${items.length ? `
                <div class="admin-line-items">
                    ${items.map((item) => `
                        <div class="admin-line-item">
                            <img src="${escapeHtml(item.image_url || "images/products/product-placeholder.svg")}" alt="" loading="lazy">
                            <div>
                                <strong>${escapeHtml(item.name || item.product_id || "Product")}</strong>
                                <span>${escapeHtml([item.variant, item.sku ? `SKU ${item.sku}` : ""].filter(Boolean).join(" / "))}</span>
                            </div>
                            <span>${escapeHtml(item.quantity || 1)} item${Number(item.quantity || 1) === 1 ? "" : "s"}</span>
                            <span>${money(item.unit_price ?? item.amount_total, item.currency || order.currency)}</span>
                            <strong>${money(item.line_total ?? item.amount_total, item.currency || order.currency)}</strong>
                        </div>
                    `).join("")}
                </div>
            ` : '<p class="muted">Line items will appear for new synced Stripe orders.</p>'}
            <div class="admin-detail-grid admin-total-grid">
                <span><b>Subtotal</b>${money(order.subtotal ?? order.total, order.currency)}</span>
                <span><b>Discounts</b>${money(order.discounts || 0, order.currency)}</span>
                <span><b>Tax</b>${money(order.tax || 0, order.currency)}</span>
                <span><b>Shipping</b>${money(order.shipping_cost || 0, order.currency)}</span>
                <span><b>Final total</b>${money(order.total, order.currency)}</span>
            </div>
            <h4>Status history</h4>
            ${order.order_status_history?.length ? `
                <div class="admin-mini-list">
                    ${order.order_status_history.slice().reverse().map((entry) => `
                        <div>
                            <span>${escapeHtml(formatDate(entry.at))} / ${escapeHtml(entry.event || "update")}</span>
                            <strong>${escapeHtml(entry.to || "")}</strong>
                        </div>
                    `).join("")}
                </div>
            ` : '<p class="muted">Status history will appear after the next webhook/admin update.</p>'}
            <form class="admin-update-form" data-order-update="${escapeHtml(order.order_number)}">
                <label>Status
                    <select name="status">
                        ${["processing", "shipped", "delivered", "refunded", "payment_failed"].map((status) => `
                            <option value="${status}" ${fulfilmentStatus(order) === status ? "selected" : ""}>${status}</option>
                        `).join("")}
                    </select>
                </label>
                <label>Courier<input name="trackingCourier" value="${escapeHtml(order.tracking_courier || "")}" placeholder="Royal Mail, DHL, Evri"></label>
                <label>Tracking number<input name="trackingNumber" value="${escapeHtml(order.tracking_number || "")}" placeholder="Paste tracking number"></label>
                <label>Tracking link<input name="trackingUrl" value="${escapeHtml(order.tracking_url || "")}" placeholder="Paste carrier tracking URL"></label>
                <label>Private notes<textarea name="adminNotes" rows="3" placeholder="Internal notes only">${escapeHtml(order.admin_notes || "")}</textarea></label>
                <button class="button primary">Save Order</button>
                <p class="form-message" data-order-message></p>
            </form>
        </section>
    `;
}

function overviewPage(data) {
    return `
        ${pageTitle("Executive Overview", "A fast read on sales, traffic, conversion and operational risk.")}
        ${analyticsToolbar(data)}
        ${kpiGrid(data)}
        ${adminStatStrip(data)}
        ${analyticsExecutiveStrip(data)}
        <div class="admin-dashboard-grid">
            ${lineChart("Revenue, Orders and Visitors", data.metrics.dailySeries || [], [
                { key: "revenue", label: "Revenue", className: "chart-line-primary" },
                { key: "orders", label: "Orders", className: "chart-line-secondary" },
                { key: "visitors", label: "Visitors", className: "chart-line-tertiary" }
            ], (value) => Number(value || 0).toFixed(0))}
            ${insightCards(data.metrics.insights || [])}
            ${alertCentre(data.metrics.alerts || [])}
            ${productRankingsPanel(data)}
            <section class="admin-card">
                <div class="admin-card-head">
                    <div><span class="eyebrow">Orders</span><h3>Recent Orders</h3></div>
                    <a href="${routeHref("orders")}">View all</a>
                </div>
                ${orderRows((data.orders || []).slice(0, 8))}
            </section>
            <section class="admin-card">
                <div class="admin-card-head">
                    <div><span class="eyebrow">Traffic</span><h3>Sources</h3></div>
                    <a href="${routeHref("acquisition")}">Analyse</a>
                </div>
                ${sourceTable(data.metrics.sourcePerformance || [])}
            </section>
        </div>
    `;
}

function analyticsPage(data) {
    return `
        ${pageTitle("Analytics Workspace", "Revenue, behaviour, funnel, product demand and data quality in one serious workspace.")}
        ${analyticsToolbar(data)}
        ${kpiGrid(data)}
        ${analyticsCommandCentre(data)}
    `;
}

function livePage(data) {
    const live = data.metrics.live || {};
    return `
        ${pageTitle("Live Activity", "Near real-time activity from tracked customer events.")}
        <div class="admin-live-grid">
            ${signalCard("Active visitors", live.visitors || 0, "last 10 minutes")}
            ${signalCard("Recent events", live.activity?.length || 0, "latest tracked actions")}
            ${signalCard("Checkout starts", data.metrics.checkoutStarts || 0, "selected range")}
            ${signalCard("Purchases", data.metrics.orders || 0, "selected range")}
        </div>
        ${liveActivityPanel(data)}
        ${barChart("Products currently getting attention", data.metrics.topProducts || [])}
    `;
}

function ordersPage(data, selectedOrderNumber = "") {
    const selectedOrder = data.orders.find((order) => order.order_number === selectedOrderNumber) || data.orders[0];
    return `
        ${pageTitle("Orders", "Search, inspect and update real Stripe-synced orders.")}
        <div class="admin-split">
            <section class="admin-card">
                <div class="admin-card-head">
                    <div><span class="eyebrow">Orders</span><h3>Order Queue</h3></div>
                    <button class="button secondary" data-export-report>Export Report</button>
                </div>
                <input class="admin-search" data-admin-search="orders" placeholder="Search orders by email, number or status">
                ${orderSection(data.orders || [])}
            </section>
            ${orderDetail(selectedOrder)}
        </div>
    `;
}

function customersPage(data) {
    return `
        ${pageTitle("Customers", "Customer value, repeat behaviour and email list growth using real order/subscriber data.")}
        <div class="admin-live-grid">
            ${signalCard("Customers", data.customers?.length || 0, "known emails")}
            ${signalCard("New customers", data.metrics.newCustomers || 0, "selected range")}
            ${signalCard("Repeat customers", data.metrics.repeatCustomers || 0, "selected range")}
            ${signalCard("Returning rate", percent(data.metrics.returningCustomerRate || 0), "repeat customers / customers")}
        </div>
        <section class="admin-card">
            <div class="admin-card-head">
                <div><span class="eyebrow">Customers</span><h3>Customer Intelligence</h3></div>
                <button class="button secondary" data-export-subscribers>Email CSV</button>
            </div>
            ${customerRows(data.customers || [])}
        </section>
        <section class="admin-card">
            <div class="admin-card-head">
                <div><span class="eyebrow">Email</span><h3>Email List</h3></div>
            </div>
            ${subscriberRows(data.subscribers || [])}
        </section>
    `;
}

function productsPage(data) {
    return `
        ${pageTitle("Products", "Manage the catalogue and understand which room finds are actually performing.")}
        <div class="admin-management-grid">
            ${productManagerPanel()}
            ${productRankingsPanel(data)}
        </div>
        <section class="admin-card">
            <div class="admin-card-head">
                <div><span class="eyebrow">Catalogue</span><h3>Products</h3></div>
                <button class="button secondary" data-export-product-analytics>Product Analytics CSV</button>
            </div>
            <input class="admin-search" data-admin-search="products" placeholder="Search products by name or category">
            <div data-admin-products>${productRows(data.products || [])}</div>
        </section>
        <section class="admin-card">
            <div class="admin-card-head">
                <div><span class="eyebrow">Performance</span><h3>Product Analytics</h3></div>
            </div>
            ${productPerformanceTable(data.metrics.productPerformance || [])}
        </section>
    `;
}

function inventoryPage(data) {
    const rows = (data.products || []).filter((product) => product.stock !== null && product.stock !== undefined);
    const lowStock = rows.filter((product) => Number(product.stock) <= 3);
    return `
        ${pageTitle("Inventory", "Stock visibility based only on products with real stock values recorded.")}
        <div class="admin-live-grid">
            ${signalCard("Tracked SKUs", rows.length, "products with stock data")}
            ${signalCard("Low stock", lowStock.length, "stock at 3 or below")}
            ${signalCard("Untracked", (data.products || []).length - rows.length, "needs stock data")}
            ${signalCard("Units sold", data.metrics.itemsSold || 0, "selected range")}
        </div>
        <section class="admin-card">
            <div class="admin-card-head"><div><span class="eyebrow">Inventory</span><h3>Stock Watch</h3></div></div>
            ${rows.length ? productRows(rows.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))) : adminEmpty("No inventory data yet", "Add stock values to products before inventory alerts can be reliable.")}
        </section>
    `;
}

function acquisitionPage(data) {
    return `
        ${pageTitle("Traffic & Acquisition", "Which channels bring visitors, product interest, carts and revenue.")}
        ${analyticsToolbar(data)}
        <div class="admin-analytics-grid">
            <section class="admin-card"><div class="admin-card-head"><div><span class="eyebrow">Sources</span><h3>Source Performance</h3></div></div>${sourceTable(data.metrics.sourcePerformance || [])}</section>
            ${campaignLinkGenerator(data)}
            ${barChart("Campaigns", data.metrics.campaignPerformance || [])}
            ${barChart("Landing Pages", data.metrics.topPages || [])}
        </div>
    `;
}

function conversionPage(data) {
    return `
        ${pageTitle("Conversion", "Find exactly where shoppers move forward or drop off.")}
        ${analyticsToolbar(data)}
        ${funnelChart(data.metrics.funnel || [])}
        ${conversionLeversPanel(data)}
        ${lineChart("Conversion Over Time", data.metrics.dailySeries || [], [
            { key: "productViews", label: "Views", className: "chart-line-primary" },
            { key: "addToCart", label: "Cart adds", className: "chart-line-secondary" },
            { key: "checkoutStarts", label: "Checkout", className: "chart-line-tertiary" }
        ])}
    `;
}

function geographyPage(data) {
    return `
        ${pageTitle("Geography", "Country-level demand from privacy-conscious analytics events.")}
        ${analyticsToolbar(data)}
        <div class="admin-analytics-grid">
            ${barChart("Countries", data.metrics.topCountries || [])}
            ${barChart("Devices by filtered geography", data.metrics.deviceSplit || [])}
        </div>
        ${adminEmpty("Map not connected yet", "Country analytics are available. A map can be added when a lightweight mapping library or geographic asset is approved.")}
    `;
}

function searchPage(data) {
    return `
        ${pageTitle("Search Analytics", "What customers are trying to find on MUTUMA.")}
        ${analyticsToolbar(data)}
        <div class="admin-live-grid">
            ${signalCard("Searches", data.metrics.searches || 0, "selected range")}
            ${signalCard("Top query", data.metrics.topSearches?.[0]?.label || "No data yet", "tracked website search")}
            ${signalCard("Zero-result searches", (data.metrics.topSearches || []).reduce((sum, row) => sum + Number(row.zeroResults || 0), 0), "needs product/category action")}
            ${signalCard("Search terms", data.metrics.topSearches?.length || 0, "unique tracked queries")}
        </div>
        ${barChart("Top Searches", data.metrics.topSearches || [])}
    `;
}

function discountsPage(data) {
    return `
        ${pageTitle("Discounts", "Control storewide offers and measure promotion behaviour.")}
        ${offersPanel(data)}
        ${adminEmpty("Discount analytics need more order metadata", "Stripe coupon/code usage will appear here after discount identifiers are synced into orders.")}
    `;
}

function abandonedCartsPage(data) {
    return `
        ${pageTitle("Abandoned Carts", "Understand cart demand that does not reach purchase.")}
        <div class="admin-live-grid">
            ${signalCard("Cart adds", data.metrics.cartAdds || 0, "selected range")}
            ${signalCard("Checkout starts", data.metrics.checkoutStarts || 0, "selected range")}
            ${signalCard("Abandonment", percent(data.metrics.cartAbandonmentRate || 0), "cart adds not reaching checkout")}
            ${signalCard("Checkout completion", percent(data.metrics.checkoutCompletionRate || 0), "orders / checkout starts")}
        </div>
        ${funnelChart(data.metrics.funnel || [])}
        ${barChart("Products Commonly Abandoned", (data.metrics.productPerformance || []).filter((product) => product.addToCart && !product.purchases).map((product) => ({ label: product.name, count: product.addToCart })))}
    `;
}

function financePage(data) {
    return `
        ${pageTitle("Finance", "Revenue visibility without pretending profit exists before true costs and fees are connected.")}
        <div class="admin-live-grid">
            ${signalCard("Gross sales", money(data.metrics.grossRevenue || 0, ANALYTICS_CURRENCY), "synced paid orders")}
            ${signalCard("AOV", money(data.metrics.averageOrderValue || 0, ANALYTICS_CURRENCY), "revenue / orders")}
            ${signalCard("Refund rate", percent(data.metrics.refundRate || 0), "based on order status")}
            ${signalCard("Net profit", "Needs data", "costs, fees, shipping")}
        </div>
        ${lineChart("Revenue Trend", data.metrics.dailySeries || [], [
            { key: "revenue", label: "Revenue", className: "chart-line-primary" },
            { key: "purchases", label: "Purchases", className: "chart-line-secondary" }
        ], (value) => money(value, ANALYTICS_CURRENCY))}
        ${dataQualityPanel(data)}
    `;
}

function reportsPage(data) {
    return `
        ${pageTitle("Reports", "Export operational data without exposing fake or unsupported metrics.")}
        <div class="admin-management-grid">
            <section class="admin-card">
                <h3>Sales Report</h3>
                <p class="muted">Exports KPI values for the selected period.</p>
                <button class="button primary" data-export-report>Export Sales CSV</button>
            </section>
            <section class="admin-card">
                <h3>Product Report</h3>
                <p class="muted">Exports product views, carts, checkout starts, purchases and revenue.</p>
                <button class="button primary" data-export-product-analytics>Export Product CSV</button>
            </section>
            <section class="admin-card">
                <h3>Email Report</h3>
                <p class="muted">Exports the subscriber/customer email list.</p>
                <button class="button primary" data-export-subscribers>Export Email CSV</button>
            </section>
        </div>
    `;
}

function siteHealthPage(data) {
    return `
        ${pageTitle("Site Health", "Operational diagnostics for tracking, catalogue and checkout readiness.")}
        ${healthStatusPanel()}
        ${diagnosticsPanel(data.metrics.diagnostics || [])}
        ${dataQualityPanel(data)}
        ${adminEmpty("External uptime is not connected", "Netlify uptime/deploy APIs are not connected in this project yet, so uptime is not shown.")}
    `;
}

function healthStatusPanel() {
    const checks = adminHealth?.checks || {};
    const rows = [
        ["Supabase", checks.supabase],
        ["Stripe", checks.stripe],
        ["Admin Auth", checks.adminAuth]
    ];

    return `
        <section class="admin-card">
            <div class="admin-card-head">
                <div>
                    <span class="eyebrow">Runtime</span>
                    <h3>Backend Health</h3>
                </div>
                <button class="button secondary" type="button" data-refresh-health>Check Now</button>
            </div>
            <div class="analytics-quality-grid">
                ${rows.map(([label, check]) => `
                    <article class="quality-${check?.ok ? "complete" : "unavailable"}">
                        <span>${escapeHtml(check?.status || "not checked")}</span>
                        <strong>${escapeHtml(label)}</strong>
                        <p>${escapeHtml(check?.detail || "Open Site Health to run this check.")}</p>
                        <small>${adminHealth?.generatedAt ? `checked ${formatDate(adminHealth.generatedAt)}` : "No live check yet"}</small>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function activityPage(data) {
    return `
        ${pageTitle("Activity Log", "Real tracked business activity. Admin audit events can be added when the audit_log table is connected.")}
        ${liveActivityPanel(data)}
        ${adminEmpty("Admin audit log not connected yet", "Create an audit_log table and write admin mutations into it to track product edits, order status updates and settings changes.")}
    `;
}

function settingsPage(data, user) {
    return `
        ${pageTitle("Settings", "Store, analytics, security and integration status.")}
        <div class="admin-management-grid">
            <section class="admin-card">
                <h3>Store</h3>
                <div class="admin-mini-list">
                    <div><span>Brand</span><strong>MUTUMA</strong></div>
                    <div><span>Storefront base currency</span><strong>USD</strong></div>
                    <div><span>Analytics currency</span><strong>${ANALYTICS_CURRENCY}</strong></div>
                    <div><span>Business timezone</span><strong>Europe/London</strong></div>
                </div>
            </section>
            <section class="admin-card">
                <h3>Security</h3>
                <div class="admin-mini-list">
                    <div><span>Signed in as</span><strong>${escapeHtml(user.email)}</strong></div>
                    <div><span>Admin APIs</span><strong>Protected by Supabase auth</strong></div>
                    <div><span>Stripe secret key</span><strong>Server-side only</strong></div>
                </div>
            </section>
            <section class="admin-card">
                <h3>Integrations</h3>
                <div class="admin-mini-list">
                    <div><span>Stripe Checkout</span><strong>Connected through Netlify functions</strong></div>
                    <div><span>Supabase</span><strong>Auth, orders, subscribers, analytics</strong></div>
                    <div><span>Ad spend</span><strong>Not connected</strong></div>
                </div>
            </section>
        </div>
    `;
}

function marketingPage(data) {
    return `
        ${pageTitle("Marketing", "Campaign links, list growth and channel performance.")}
        <div class="admin-analytics-grid">
            ${campaignLinkGenerator(data)}
            ${barChart("Traffic Sources", data.metrics.sourcePerformance || [], "sessions")}
            <section class="admin-card">
                <h3>Email List</h3>
                ${subscriberRows(data.subscribers || [])}
            </section>
            ${adminEmpty("Campaign cost not connected", "ROAS and CAC need ad spend data from TikTok, Meta, Google or manual campaign costs.")}
        </div>
    `;
}

function routeContent(user, selectedOrderNumber = "") {
    const data = adminData;
    const route = currentRoute();

    if (route === "analytics") return analyticsPage(data);
    if (route === "live") return livePage(data);
    if (route === "orders") return ordersPage(data, selectedOrderNumber);
    if (route === "customers") return customersPage(data);
    if (route === "products") return productsPage(data);
    if (route === "inventory") return inventoryPage(data);
    if (route === "marketing") return marketingPage(data);
    if (route === "acquisition") return acquisitionPage(data);
    if (route === "conversion") return conversionPage(data);
    if (route === "geography") return geographyPage(data);
    if (route === "search") return searchPage(data);
    if (route === "discounts") return discountsPage(data);
    if (route === "abandoned-carts") return abandonedCartsPage(data);
    if (route === "finance") return financePage(data);
    if (route === "reports") return reportsPage(data);
    if (route === "site-health") return siteHealthPage(data);
    if (route === "activity") return activityPage(data);
    if (route === "settings") return settingsPage(data, user);
    return overviewPage(data);
}

function renderAdmin(user, selectedOrderNumber = "") {
    const content = routeContent(user, selectedOrderNumber);

    panel.innerHTML = `
        ${adminShell(user, currentRoute(), content)}
    `;
}

function adminDataUrl() {
    const params = new URLSearchParams();
    Object.entries(adminState).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    return `/api/admin-data?${params.toString()}`;
}

async function loadAdmin(options = {}) {
    const silent = Boolean(options.silent);
    const user = await getCurrentUser().catch(() => null);
    if (!user) {
        currentAdminUser = null;
        adminHealth = null;
        layout?.classList.remove("is-signed-in");
        form.hidden = false;
        panel.hidden = true;
        return;
    }

    try {
        currentAdminUser = user;
        if (!silent) message.textContent = "Loading admin data...";
        adminData = await adminFetch(adminDataUrl());
        form.hidden = true;
        panel.hidden = false;
        layout?.classList.add("is-signed-in");
        renderAdmin(user);
        maybeLoadRouteData();
        message.textContent = "";
    } catch (error) {
        layout?.classList.remove("is-signed-in");
        form.hidden = false;
        panel.hidden = true;
        if (!silent) message.textContent = error.message;
    }
}

async function loadAdminHealth() {
    try {
        adminHealth = await adminFetch("/api/admin-health");
    } catch (error) {
        adminHealth = {
            ok: false,
            generatedAt: new Date().toISOString(),
            checks: {
                supabase: { ok: false, status: "unavailable", detail: error.message },
                stripe: { ok: false, status: "unavailable", detail: "Health request failed." },
                adminAuth: { ok: false, status: "unavailable", detail: "Health request failed." }
            }
        };
    }
}

function rerenderAdmin(selectedOrderNumber = "") {
    if (currentAdminUser && adminData) {
        renderAdmin(currentAdminUser, selectedOrderNumber);
    }
}

function maybeLoadRouteData() {
    if (currentRoute() === "site-health" && !adminHealth) {
        loadAdminHealth().then(() => rerenderAdmin());
    }
}

function openCommandPalette() {
    commandOpen = true;
    rerenderAdmin();
    window.setTimeout(() => panel.querySelector("[data-command-input]")?.focus(), 0);
}

function closeCommandPalette() {
    commandOpen = false;
    rerenderAdmin();
}

async function saveOrder(formElement) {
    const orderNumber = formElement.dataset.orderUpdate;
    const statusMessage = formElement.querySelector("[data-order-message]");
    const submitButton = formElement.querySelector("button");
    submitButton.disabled = true;
    statusMessage.textContent = "Saving...";

    try {
        await adminFetch("/api/admin-update-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                orderNumber,
                status: formElement.status.value,
                trackingCourier: formElement.trackingCourier.value,
                trackingNumber: formElement.trackingNumber.value,
                trackingUrl: formElement.trackingUrl.value,
                adminNotes: formElement.adminNotes.value
            })
        });
        await loadAdmin();
        statusMessage.textContent = "Saved.";
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
}

async function saveOffer(formElement) {
    const statusMessage = formElement.querySelector("[data-offer-message]");
    const submitButton = formElement.querySelector("button");
    submitButton.disabled = true;
    statusMessage.textContent = "Saving offer...";

    try {
        await adminFetch("/api/admin-save-offer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: formElement.id.value || "",
                name: formElement.name.value,
                discountPercent: formElement.discountPercent.value,
                startsAt: formElement.startsAt.value ? new Date(formElement.startsAt.value).toISOString() : null,
                endsAt: formElement.endsAt.value ? new Date(formElement.endsAt.value).toISOString() : null,
                enabled: formElement.enabled.checked
            })
        });
        await loadAdmin({ silent: true });
        statusMessage.textContent = "Offer saved.";
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
}

async function saveProduct(formElement) {
    const statusMessage = formElement.querySelector("[data-product-message]");
    const submitButton = formElement.querySelector("button");
    submitButton.disabled = true;
    statusMessage.textContent = "Adding product...";

    try {
        await adminFetch("/api/admin-save-product", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: formElement.name.value,
                description: formElement.description.value,
                category: formElement.category.value,
                price: formElement.price.value,
                oldPrice: formElement.oldPrice.value,
                imageUrl: formElement.imageUrl.value,
                tags: formElement.tags.value,
                stock: formElement.stock.value,
                featured: formElement.featured.checked,
                published: formElement.published.checked
            })
        });
        formElement.reset();
        formElement.published.checked = true;
        await loadAdmin({ silent: true });
        statusMessage.textContent = "Product added.";
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    message.textContent = "Signing in...";

    try {
        await signIn(form.email.value.trim(), form.password.value);
        await loadAdmin();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

panel.addEventListener("click", (event) => {
    const row = event.target.closest("[data-order-row]");
    if (row && adminData) {
        renderAdmin(currentAdminUser, row.dataset.orderRow);
    }

    if (event.target.closest("[data-admin-nav-toggle]")) {
        panel.querySelector("[data-admin-shell]")?.classList.toggle("nav-open");
    }

    if (event.target.closest("[data-command-open]")) {
        openCommandPalette();
    }

    if (event.target.closest("[data-command-close]") || event.target.classList.contains("admin-command-palette")) {
        closeCommandPalette();
    }

    if (event.target.closest("[data-command-result]")) {
        commandOpen = false;
    }

    if (event.target.closest("[data-refresh-admin]")) {
        loadAdmin();
    }

    if (event.target.closest("[data-refresh-health]")) {
        loadAdminHealth().then(() => rerenderAdmin());
    }

    const copyLink = event.target.closest("[data-copy-link]");
    if (copyLink) {
        navigator.clipboard?.writeText(copyLink.dataset.copyLink).then(() => {
            copyLink.textContent = "Copied";
            setTimeout(() => {
                copyLink.textContent = "Copy URL";
            }, 1400);
        });
    }

    if (event.target.closest("[data-export-report]") && adminData) {
        downloadCsv("mutuma-analytics-report.csv", [
            { label: "Metric", key: "label" },
            { label: "Value", key: "value" },
            { label: "Previous", key: "previous" },
            { label: "Change", key: "change" },
            { label: "Estimated", key: "estimated" }
        ], (adminData.metrics.kpis || []).map((kpi) => ({
            label: kpi.label,
            value: metricValue(kpi.key, kpi.value),
            previous: metricValue(kpi.key, kpi.previous),
            change: signedPercent(kpi.comparison.change),
            estimated: kpi.estimated ? "yes" : "no"
        })));
    }

    if (event.target.closest("[data-export-subscribers]") && adminData) {
        downloadCsv("mutuma-subscribers.csv", [
            { label: "Email", key: "email" },
            { label: "Source", key: "source" },
            { label: "Joined", key: "subscribed_at" }
        ], adminData.subscribers);
    }

    if (event.target.closest("[data-export-product-analytics]") && adminData) {
        downloadCsv("mutuma-product-analytics.csv", [
            { label: "Product", key: "name" },
            { label: "Category", key: "category" },
            { label: "Views", key: "views" },
            { label: "Cart Adds", key: "addToCart" },
            { label: "Checkout Starts", key: "checkoutStarts" },
            { label: "Purchases", key: "purchases" },
            { label: `Revenue ${ANALYTICS_CURRENCY}`, key: "revenue" },
            { label: "View To Cart Rate", key: "cartRate" },
            { label: "Purchase Rate", key: "purchaseRate" }
        ], adminData.metrics.productPerformance || []);
    }
});

panel.addEventListener("input", (event) => {
    const commandInput = event.target.closest("[data-command-input]");
    if (commandInput) {
        const results = panel.querySelector("[data-command-results]");
        if (results) results.innerHTML = commandResults(commandInput.value);
        return;
    }

    const search = event.target.closest("[data-admin-search]");
    if (!search || !adminData) return;

    const query = search.value.trim().toLowerCase();

    if (search.dataset.adminSearch === "products") {
        const products = adminData.products.filter((product) => [product.name, product.category, product.id].join(" ").toLowerCase().includes(query));
        panel.querySelector("[data-admin-products]").innerHTML = productRows(products);
    }

    if (search.dataset.adminSearch === "orders") {
        const orders = adminData.orders.filter((order) => [order.order_number, order.email, order.status, order.tracking_number].join(" ").toLowerCase().includes(query));
        panel.querySelector("[data-admin-orders]").innerHTML = orderRows(orders);
    }
});

panel.addEventListener("submit", (event) => {
    const updateForm = event.target.closest("[data-order-update]");
    const offerForm = event.target.closest("[data-offer-form]");
    const productForm = event.target.closest("[data-product-form]");
    const toolbar = event.target.closest("[data-analytics-toolbar]");

    if (!updateForm && !offerForm && !productForm && !toolbar) return;
    event.preventDefault();
    if (toolbar) {
        adminState = {
            days: toolbar.days.value,
            compare: toolbar.compare.value,
            country: toolbar.country.value,
            device: toolbar.device.value,
            source: toolbar.source.value,
            campaign: adminState.campaign,
            product: toolbar.product.value,
            category: toolbar.category.value
        };
        loadAdmin();
    }
    if (updateForm) saveOrder(updateForm);
    if (offerForm) saveOffer(offerForm);
    if (productForm) saveProduct(productForm);
});

loadAdmin();

window.addEventListener("hashchange", () => {
    rerenderAdmin();
    maybeLoadRouteData();
});

window.addEventListener("keydown", (event) => {
    const isCommandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    if (isCommandShortcut) {
        event.preventDefault();
        if (panel.hidden) return;
        openCommandPalette();
    }

    if (event.key === "Escape" && commandOpen) {
        event.preventDefault();
        closeCommandPalette();
    }
});

setInterval(() => {
    if (!panel.hidden && document.visibilityState === "visible") {
        loadAdmin({ silent: true });
    }
}, 60000);
