import { initCurrency } from "./currency.js?v=20260731c";
import { initBaseLayout } from "./ui.js?v=20260731c";

initBaseLayout();
initCurrency().catch(() => {});
