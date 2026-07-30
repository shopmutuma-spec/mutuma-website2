import { initCurrency } from "./currency.js?v=20260730c";
import { initBaseLayout } from "./ui.js?v=20260730c";

initBaseLayout();
initCurrency().catch(() => {});
