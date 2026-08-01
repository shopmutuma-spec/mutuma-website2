import { initCurrency } from "./currency.js?v=20260801b";
import { initBaseLayout } from "./ui.js?v=20260801b";

initBaseLayout();
initCurrency().catch(() => {});
