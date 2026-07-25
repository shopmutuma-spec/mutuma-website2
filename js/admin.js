import { initCurrency } from "./currency.js?v=20260724a";
import { initBaseLayout } from "./ui.js?v=20260724a";
import { adminFetch, getCurrentUser, signIn } from "./supabase-auth.js?v=20260724a";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-admin-login]");
const message = document.querySelector("[data-admin-message]");
const panel = document.querySelector("[data-admin-panel]");

let adminData = null;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function money(value, currency = "GBP") {
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
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
                            <td>${money(customer.totalSpent, adminData.orders[0]?.currency || "GBP")}</td>
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
                            <td>${money(product.price, "GBP")}</td>
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
                <a class="button secondary" href="account.html">Account</a>
            </div>
        </div>
        <div class="admin-stats">
            ${metricCard("products", data.counts.products)}
            ${metricCard("orders", data.counts.orders)}
            ${metricCard("subscribers", data.counts.subscribers)}
            ${metricCard("visitors / 30 days", data.counts.visitors)}
            ${metricCard("page views / 30 days", data.counts.pageViews)}
            ${metricCard("revenue", money(data.metrics.revenue || 0, data.orders[0]?.currency || "GBP"))}
        </div>
        <div class="admin-analytics-grid">
            ${listMetric("Most Viewed Products", data.metrics.topProducts || [])}
            ${listMetric("Most Visited Pages", data.metrics.topPages || [])}
            ${listMetric("Top Searches", data.metrics.topSearches || [])}
            <section class="admin-card">
                <h3>Store Signals</h3>
                <div class="admin-mini-list">
                    <div><span>Average order value</span><strong>${money(data.metrics.averageOrderValue || 0, data.orders[0]?.currency || "GBP")}</strong></div>
                    <div><span>Product views</span><strong>${data.metrics.productViews || 0}</strong></div>
                    <div><span>Checkout starts</span><strong>${data.metrics.checkoutStarts || 0}</strong></div>
                    <div><span>Searches</span><strong>${data.metrics.searches || 0}</strong></div>
                </div>
            </section>
        </div>
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

async function loadAdmin() {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return;

    try {
        message.textContent = "Loading admin data...";
        adminData = await adminFetch("/.netlify/functions/admin-data");
        form.hidden = true;
        panel.hidden = false;
        renderAdmin(user);
        message.textContent = "";
    } catch (error) {
        message.textContent = error.message;
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

    if (event.target.closest("[data-export-subscribers]") && adminData) {
        downloadCsv("mutuma-subscribers.csv", [
            { label: "Email", key: "email" },
            { label: "Source", key: "source" },
            { label: "Joined", key: "subscribed_at" }
        ], adminData.subscribers);
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
    if (!updateForm) return;
    event.preventDefault();
    saveOrder(updateForm);
});

loadAdmin();
