import { initCurrency } from "./currency.js?v=20260813a";
import { initBaseLayout } from "./ui.js?v=20260813a";

initBaseLayout();
initCurrency().catch(() => {});
