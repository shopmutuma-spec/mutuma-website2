import { initCurrency } from "./currency.js?v=20260906-payments";
import { initBaseLayout, notify } from "./ui.js?v=20260906-payments";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-contact-form]");

form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.reset();
    notify("Message ready to send");
});
