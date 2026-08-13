import { initCurrency } from "./currency.js?v=20260813a";
import { initBaseLayout } from "./ui.js?v=20260813a";
import { adminFetch, getCurrentUser, signIn } from "./supabase-auth.js?v=20260813a";

initBaseLayout();
initCurrency().catch(() => {});

const ANALYTICS_CURRENCY = "GBP";
const form = document.querySelector("[data-admin-login]");
const message = document.querySelector("[data-admin-message]");
const panel = document.querySelector("[data-admin-panel]");
const layout = document.querySelector(".admin-layout");

let adminData = null;
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
                <label>Offer name<input name="name" value="${escapeHtml(activeOffer.name || "25% off everything")}" required></label>
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
                        <th>Total</th>
                        <th>Status</th>
                        <th>Tracking</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map((order) => `
                        <tr data-order-row="${escapeHtml(order.order_number)}" tabindex="0">
                            <td><strong>${escapeHtml(order.order_number)}</strong></td>
                            <td>${escapeHtml(order.email)}</td>
                            <td>${money(order.total, order.currency)}</td>
                            <td><span class="status-pill">${escapeHtml(order.status)}</span></td>
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

    const items = Array.isArray(order.order_items) ? order.order_items : [];
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
                <span><b>Address</b>${escapeHtml(customerAddress(order.customer_details))}</span>
            </div>
            <h4>Products</h4>
            ${items.length ? `
                <div class="admin-mini-list">
                    ${items.map((item) => `
                        <div>
                            <span>${escapeHtml(item.name || item.product_id || "Product")}</span>
                            <strong>${escapeHtml(item.quantity || 1)} x ${money(item.amount_total, item.currency || order.currency)}</strong>
                        </div>
                    `).join("")}
                </div>
            ` : '<p class="muted">Line items will appear for new synced Stripe orders.</p>'}
            <form class="admin-update-form" data-order-update="${escapeHtml(order.order_number)}">
                <label>Status
                    <select name="status">
                        ${["paid", "processing", "shipped", "delivered", "refunded"].map((status) => `
                            <option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>
                        `).join("")}
                    </select>
                </label>
                <label>Courier<input name="trackingCourier" value="${escapeHtml(order.tracking_courier || "")}" placeholder="Royal Mail, DHL, Evri"></label>
                <label>Tracking number<input name="trackingNumber" value="${escapeHtml(order.tracking_number || "")}" placeholder="Paste tracking number"></label>
                <label>Private notes<textarea name="adminNotes" rows="3" placeholder="Internal notes only">${escapeHtml(order.admin_notes || "")}</textarea></label>
                <button class="button primary">Save Order</button>
                <p class="form-message" data-order-message></p>
            </form>
        </section>
    `;
}

function renderAdmin(user, selectedOrderNumber = "") {
    const data = adminData;
    const selectedOrder = data.orders.find((order) => order.order_number === selectedOrderNumber) || data.orders[0];

    panel.innerHTML = `
        <div class="admin-head">
            <div>
                <span class="eyebrow">Signed in as</span>
                <h2>${escapeHtml(user.email)}</h2>
            </div>
            <div class="split-actions">
                <button class="button secondary" data-export-subscribers>Email CSV</button>
                <button class="button secondary" data-export-product-analytics>Product Analytics CSV</button>
                <a class="button secondary" href="account.html">Account</a>
            </div>
        </div>
        ${analyticsToolbar(data)}
        ${kpiGrid(data)}
        <div class="admin-stats">
            ${metricCard("products", data.counts.products)}
            ${metricCard("orders", data.counts.orders)}
            ${metricCard("subscribers", data.counts.subscribers)}
            ${metricCard("visitors / 30 days", data.counts.visitors)}
            ${metricCard("page views / 30 days", data.counts.pageViews)}
            ${metricCard("revenue", money(data.metrics.grossRevenue || 0, ANALYTICS_CURRENCY))}
        </div>
        <section class="admin-card">
            <h3>Store Signals</h3>
            <div class="admin-mini-list admin-signal-grid">
                <div><span>Average order value</span><strong>${money(data.metrics.averageOrderValue || 0, ANALYTICS_CURRENCY)}</strong></div>
                <div><span>Product views</span><strong>${data.metrics.productViews || 0}</strong></div>
                <div><span>Checkout starts</span><strong>${data.metrics.checkoutStarts || 0}</strong></div>
                <div><span>Searches</span><strong>${data.metrics.searches || 0}</strong></div>
            </div>
        </section>
        <div class="admin-management-grid">
            ${offersPanel(data)}
            ${productManagerPanel()}
        </div>
        ${analyticsCommandCentre(data)}
        <div class="admin-split">
            <section>
                <h3>Recent Orders</h3>
                <input class="admin-search" data-admin-search="orders" placeholder="Search orders by email, number or status">
                ${orderSection(data.orders)}
            </section>
            ${orderDetail(selectedOrder)}
        </div>
        <section>
            <h3>Customers</h3>
            ${customerRows(data.customers || [])}
        </section>
        <section>
            <h3>Product Catalogue</h3>
            <input class="admin-search" data-admin-search="products" placeholder="Search products by name or category">
            <div data-admin-products>${productRows(data.products || [])}</div>
        </section>
        <section>
            <h3>Email List</h3>
            ${subscriberRows(data.subscribers)}
        </section>
    `;
}

function adminDataUrl() {
    const params = new URLSearchParams();
    Object.entries(adminState).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    return `/.netlify/functions/admin-data?${params.toString()}`;
}

async function loadAdmin(options = {}) {
    const silent = Boolean(options.silent);
    const user = await getCurrentUser().catch(() => null);
    if (!user) {
        layout?.classList.remove("is-signed-in");
        form.hidden = false;
        panel.hidden = true;
        return;
    }

    try {
        if (!silent) message.textContent = "Loading admin data...";
        adminData = await adminFetch(adminDataUrl());
        form.hidden = true;
        panel.hidden = false;
        layout?.classList.add("is-signed-in");
        renderAdmin(user);
        message.textContent = "";
    } catch (error) {
        layout?.classList.remove("is-signed-in");
        form.hidden = false;
        panel.hidden = true;
        if (!silent) message.textContent = error.message;
    }
}

async function saveOrder(formElement) {
    const orderNumber = formElement.dataset.orderUpdate;
    const statusMessage = formElement.querySelector("[data-order-message]");
    const submitButton = formElement.querySelector("button");
    submitButton.disabled = true;
    statusMessage.textContent = "Saving...";

    try {
        await adminFetch("/.netlify/functions/admin-update-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                orderNumber,
                status: formElement.status.value,
                trackingCourier: formElement.trackingCourier.value,
                trackingNumber: formElement.trackingNumber.value,
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
        await adminFetch("/.netlify/functions/admin-save-offer", {
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
        await adminFetch("/.netlify/functions/admin-save-product", {
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
        getCurrentUser().then((user) => renderAdmin(user, row.dataset.orderRow));
    }

    if (event.target.closest("[data-refresh-admin]")) {
        loadAdmin();
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

setInterval(() => {
    if (!panel.hidden && document.visibilityState === "visible") {
        loadAdmin({ silent: true });
    }
}, 60000);
