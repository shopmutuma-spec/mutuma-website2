import { initCurrency } from "./currency.js?v=20260914-relaunch";
import { initBaseLayout } from "./ui.js?v=20260914-relaunch";

initBaseLayout();
initCurrency().catch(() => {});
