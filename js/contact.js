import { initCurrency } from "./currency.js?v=20260722a";
import { initBaseLayout, notify } from "./ui.js?v=20260722a";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-contact-form]");

form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.reset();
    notify("Message ready to send");
});
