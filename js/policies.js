import { initCurrency } from "./currency.js?v=20260724a";
import { initBaseLayout } from "./ui.js?v=20260727a";

initBaseLayout();
initCurrency().catch(() => {});
