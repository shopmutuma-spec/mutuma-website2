import { handler as detectCurrency } from "../netlify/functions/detect-currency.js";
import { runNetlifyHandler } from "./_adapter.js";

export function onRequest(context) {
    return runNetlifyHandler(context, detectCurrency);
}
