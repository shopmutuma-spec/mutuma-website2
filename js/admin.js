import { initCurrency } from "./currency.js?v=20260724a";
import { initBaseLayout } from "./ui.js?v=20260724a";
import { adminFetch, getCurrentUser, signIn } from "./supabase-auth.js?v=20260724a";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-admin-login]");
const message = document.querySelector("[data-admin-message]");
const panel = document.querySelector("[data-admin-panel]");

function table(headers, rows) {
    if (!rows.length) return '<div class="empty-state compact">Nothing to show yet.</div>';

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr>${headers.map((header) => `<th>${header.label}</th>`).join("")}</tr></thead>
                <tbody>
                    ${rows.map((row) => `
                        <tr>${headers.map((header) => `<td>${row[header.key] || ""}</td>`).join("")}</tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function loadAdmin() {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return;

    try {
        message.textContent = "Loading admin data...";
        const data = await adminFetch("/.netlify/functions/admin-data");
        form.hidden = true;
        panel.hidden = false;
        panel.innerHTML = `
            <div class="admin-head">
                <div>
                    <span class="eyebrow">Signed in as</span>
                    <h2>${user.email}</h2>
                </div>
                <a class="button secondary" href="account.html">Account</a>
            </div>
            <div class="admin-stats">
                <span><strong>${data.counts.products}</strong> products</span>
                <span><strong>${data.counts.subscribers}</strong> subscribers</span>
                <span><strong>${data.counts.orders}</strong> synced orders</span>
            </div>
            <h3>Recent Orders</h3>
            ${table([
                { label: "Order", key: "order_number" },
                { label: "Email", key: "email" },
                { label: "Total", key: "total" },
                { label: "Currency", key: "currency" },
                { label: "Status", key: "status" },
                { label: "Date", key: "created_at" }
            ], data.orders)}
            <h3>Email List</h3>
            ${table([
                { label: "Email", key: "email" },
                { label: "Source", key: "source" },
                { label: "Joined", key: "subscribed_at" }
            ], data.subscribers)}
        `;
        message.textContent = "";
    } catch (error) {
        message.textContent = error.message;
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

loadAdmin();
