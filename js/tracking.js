import { initCurrency } from "./currency.js?v=20260724a";
import { initBaseLayout } from "./ui.js?v=20260726a";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-tracking-form]");
const message = document.querySelector("[data-tracking-message]");

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
        message.textContent = response.ok && data.message
            ? data.message
            : "Tracking is not available for this order yet.";
    } catch (error) {
        message.textContent = "Order tracking is not connected yet. Contact MUTUMA with your order number and checkout email.";
    } finally {
        button.disabled = false;
        button.textContent = "Check Order";
    }
});
