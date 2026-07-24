import { initCurrency } from "./currency.js?v=20260722a";
import { initBaseLayout } from "./ui.js?v=20260722a";

initBaseLayout();
initCurrency().catch(() => {});
