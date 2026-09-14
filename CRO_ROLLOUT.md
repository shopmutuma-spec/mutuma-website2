# CRO rollout

All backlog items approved on 13 September 2026. Release one round at a time, rather than combining unrelated changes into one deployment. Approval to implement is not evidence of conversion uplift.

## Round 1: product-page purchase controls

Status: implemented locally, not deployed.

Target: mobile add-to-cart rate and checkout completion rate.

- Desktop and sticky mobile actions read the current quantity field.
- Whole quantities are required, capped by known stock and the existing checkout maximum of 20. Product prices and catalog data are unchanged.
- Both Buy Now buttons are locked while opening checkout to prevent duplicate requests.
- Failure restores the buttons; a successful handoff keeps them locked. Returning via the browser's page cache restores them.
- Optional analytics errors cannot block checkout.

Verification: nine automated test files pass. Browser entry of three items increased the existing item quantity by three; the test additions were then removed. The local backend failure displayed an error and left Buy Now available to retry. A real hosted Stripe handoff has not been exercised in this round.

Before release, test a Stripe test-mode handoff and Back navigation on desktop and a real mobile browser. After release, observe PDP add-to-cart, checkout starts and verified completed orders by device and traffic source for 1-2 weeks, longer when volumes are low. Watch incorrect-quantity reports and checkout failures as guardrails. Do not treat browser success URLs as verified purchases.

Changed implementation files: js/product.js and js/product-purchase.js. Regression tests: tests/product-purchase.test.mjs. No new dependencies, SQL, payment settings or environment variables are required. Roll back this round as a unit, not other store changes.

## Approved queue

### 14 September implementation status

- Confirmation: implemented server-paid confirmation before cart clearing. Invalid, unpaid, mismatched and unavailable responses preserve the cart; no browser cache can certify payment. Server replies are no-store. Removed the browser-side marketing signup from the confirmation dependency chain; existing server order/email work is unchanged.
- Images: category tiles now reuse the existing responsive Netlify image helper and missing-image fallback. Confirm CDN delivery on a hosted preview before measuring byte savings.
- Accessibility: closed menu/cart drawers are inert; cart quantity controls have product-specific names; shop banner contrast, crossed-out prices and reduced-motion ticker handling improved. Versioned storefront CSS references ensure returning browsers receive the update. Admin stylesheet is unchanged.
- Trust: unknown stock no longer implies low stock. Product data itself is unchanged.

Metrics: confirmation targets checkout completion/recovery and protects purchase measurement; responsive images target listing click-through through faster rendering; accessibility targets successful navigation/add-to-cart; stock messaging targets trust rather than fabricated urgency. Monitor each release separately, including error rate, verified orders, mobile product views and AOV guardrails. No measured uplift is claimed.

Verification: eleven test files passed, production build passed. An invalid return URL preserved both existing cart lines in the local browser. The shop banner's corrected white text was visually checked after stylesheet cache-versioning. No real payment, email delivery or real iOS/TikTok test was performed.

Remaining work is NOT complete: homepage loading-shift remediation; currency-provider failure handling; full modal focus management; real SKU-aware variants; atomic inventory/retryable side effects; verified review and delivery facts; progressive filters/purchase-layout experiments; abandoned-checkout recovery. Supplier mappings/facts are required for variants and claims. Database and email work needs a staging environment and integration verification before production rollout. Do not deploy these changes as proof that the whole backlog is finished.

2. Currency-aware filters and safe filter rendering implemented locally in Round 2 (see CRO_AUDIT.md). Currency request failure investigation remains pending.
3. Verified confirmation before clearing the cart or reporting success.
4. Stable homepage collection positioning during loading.
5. Responsive category images.
6. Real variant selection through order snapshots; confirm actual SKU/size mappings instead of inventing product data.
7. Transactional inventory and recoverable post-payment work; stage and test migrations before release.
8. Verify review/stock claims and reconcile delivery messaging with owner-approved facts.
9. Accessibility: focus, contrast and accessible names.
10. Test less prominent bundles and reward messaging; monitor average order value as well as checkout starts.
11. Consent-aware abandoned-checkout recovery, with suppression and delivery tests.

Pricing, product data and legal/policy facts must not be changed silently. Items requiring real supplier facts or service configuration remain conditional on those facts being available.
