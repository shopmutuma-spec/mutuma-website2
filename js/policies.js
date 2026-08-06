import { initCurrency } from "./currency.js?v=20260806d";
import { initBaseLayout } from "./ui.js?v=20260806d";

initBaseLayout();
initCurrency().catch(() => {});
