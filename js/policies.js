import { initCurrency } from "./currency.js?v=20260915-geo";
import { initBaseLayout } from "./ui.js?v=20260915-geo";

initBaseLayout();
initCurrency().catch(() => {});
