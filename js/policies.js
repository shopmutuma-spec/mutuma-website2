import { initCurrency } from "./currency.js?v=20260806e";
import { initBaseLayout } from "./ui.js?v=20260806e";

initBaseLayout();
initCurrency().catch(() => {});
