import { initCurrency } from "./currency.js?v=20260731d";
import { initBaseLayout } from "./ui.js?v=20260731d";

initBaseLayout();
initCurrency().catch(() => {});
