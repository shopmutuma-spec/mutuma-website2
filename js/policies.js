import { initCurrency } from "./currency.js?v=20260806c";
import { initBaseLayout } from "./ui.js?v=20260806c";

initBaseLayout();
initCurrency().catch(() => {});
