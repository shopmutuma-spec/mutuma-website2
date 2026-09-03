import { initCurrency } from "./currency.js?v=20260902b";
import { initBaseLayout } from "./ui.js?v=20260902b";

initBaseLayout();
initCurrency().catch(() => {});
