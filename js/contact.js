import { initCurrency } from "./currency.js?v=20260906-email-batch";
import { initBaseLayout } from "./ui.js?v=20260906-email-batch";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-contact-form]");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button.disabled) return;
    const status = form.querySelector("[data-contact-status]");
    button.disabled = true;
    status.textContent = "Sending...";
    try {
        const response = await fetch("/.netlify/functions/contact-message", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(new FormData(form)))
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Message could not be sent.");
        form.reset();
        status.textContent = "Your message has been sent. We will reply by email.";
    } catch (error) { status.textContent = error.message || "Please try again or email support directly."; }
    finally { button.disabled = false; }
});
