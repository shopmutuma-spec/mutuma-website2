import { initCurrency } from "./currency.js?v=20260817c";
import { initBaseLayout } from "./ui.js?v=20260817c";

initBaseLayout();
initCurrency().catch(() => {});
