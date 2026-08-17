import { initCurrency } from "./currency.js?v=20260816a";
import { initBaseLayout } from "./ui.js?v=20260816a";

initBaseLayout();
initCurrency().catch(() => {});
