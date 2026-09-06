import { initCurrency } from "./currency.js?v=20260906-email-batch";
import { initBaseLayout } from "./ui.js?v=20260906-email-batch";

initBaseLayout();
initCurrency().catch(() => {});
