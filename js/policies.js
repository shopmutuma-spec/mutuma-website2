import { initCurrency } from "./currency.js?v=20260906-open";
import { initBaseLayout } from "./ui.js?v=20260906-open";

initBaseLayout();
initCurrency().catch(() => {});
