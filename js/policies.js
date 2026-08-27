import { initCurrency } from "./currency.js?v=20260827a";
import { initBaseLayout } from "./ui.js?v=20260827a";

initBaseLayout();
initCurrency().catch(() => {});
