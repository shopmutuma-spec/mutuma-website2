import { initCurrency } from "./currency.js?v=20260914-sale20";
import { initBaseLayout } from "./ui.js?v=20260914-sale20";

initBaseLayout();
initCurrency().catch(() => {});
