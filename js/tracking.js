import { initCurrency } from "./currency.js?v=20260902b";
import { initBaseLayout } from "./ui.js?v=20260902b";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-tracking-form]");
const message = document.querySelector("[data-tracking-message]");
const params = new URLSearchParams(window.location.search);

if (params.get("order")) {
    form.orderNumber.value = params.get("order");
}

if (params.get("email")) {
    form.email.value = params.get("email");
}

if (form.orderNumber.value && form.email.value) {
    window.setTimeout(() => form.requestSubmit(), 0);
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking...";
    message.textContent = "";

    try {
        const response = await fetch("/.netlify/functions/track-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                orderNumber: form.orderNumber.value.trim(),
                email: form.email.value.trim()
            })
        });

        if (response.status === 404) {
            message.textContent = "Order tracking is not connected yet. Contact MUTUMA with your order number and checkout email.";
            return;
        }

        const data = await response.json();
        if (response.ok && data.message) {
            renderTrackingMessage(data);
        } else {
            message.textContent = "Tracking is not available for this order yet.";
        }
    } catch (error) {
        message.textContent = "Order tracking is not connected yet. Contact MUTUMA with your order number and checkout email.";
    } finally {
        button.disabled = false;
        button.textContent = "Check Order";
    }
});

function renderTrackingMessage(data) {
    message.textContent = "";

    const status = document.createElement("strong");
    status.textContent = data.message;
    message.append(status);

    if (data.order?.trackingUrl) {
        const link = document.createElement("a");
        link.className = "button secondary";
        link.href = data.order.trackingUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Open carrier tracking";
        message.append(link);
    }

    const estimate = document.createElement("small");
    estimate.textContent = "Estimated delivery is 5-8 business days once dispatched.";
    message.append(estimate);
}
