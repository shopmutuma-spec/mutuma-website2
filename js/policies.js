import { initCurrency } from "./currency.js?v=20260906-payments";
import { initBaseLayout } from "./ui.js?v=20260906-payments";

initBaseLayout();
initCurrency().catch(() => {});
