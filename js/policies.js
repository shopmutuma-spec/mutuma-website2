import { initCurrency } from "./currency.js?v=20260802a";
import { initBaseLayout } from "./ui.js?v=20260802a";

initBaseLayout();
initCurrency().catch(() => {});
