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

2. Currency-aware filters, safe filter rendering and currency request failure investigation.
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
