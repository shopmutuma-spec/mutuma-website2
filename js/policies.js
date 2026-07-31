import { initCurrency } from "./currency.js?v=20260731b";
import { initBaseLayout } from "./ui.js?v=20260731b";

initBaseLayout();
initCurrency().catch(() => {});
