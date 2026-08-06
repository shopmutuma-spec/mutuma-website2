import { initCurrency } from "./currency.js?v=20260806b";
import { initBaseLayout } from "./ui.js?v=20260806b";

initBaseLayout();
initCurrency().catch(() => {});
